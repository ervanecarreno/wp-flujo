/**
 * convert-frame.mjs — Enfoque 1: conversión automática de un frame completo
 * de Figma a bloques GenerateBlocks v2, con máxima fidelidad.
 *
 * Diferencias clave frente al conversor del proyecto Google Studio anterior:
 *  1. Emite a través de lib/emit.mjs (serialización canónica → 0 recovery).
 *  2. Sustituye colores por var(--token) cuando coinciden con tokens/map.json.
 *  3. Traduce el auto-layout de Figma (layoutMode, itemSpacing, paddings,
 *     alineaciones, FILL/HUG/FIXED) a flex de forma sistemática.
 *  4. Tipografía completa en bloques text (familia, peso, tamaño, interlineado,
 *     letter-spacing, alineación, color).
 *  5. Imágenes reales desde el mapa imageRef→URL de la extracción.
 *
 * Limitación honesta (por diseño): un solo frame Desktop no define responsive.
 * Se añaden salvaguardas (max-width:100% en imágenes, wrap opcional) pero las
 * reglas Mobile/Tablet reales deben definirse aparte (regla: no adivinar).
 */
import { element, text, media, shape, carousel, carouselItems, carouselItem, carouselControl, carouselPagination, linkButton, accordion, accordionItem, accordionToggle, accordionToggleIcon, accordionContent, siteHeader, navigation, menuToggle, menuContainer, classicMenu, resetUid } from "./emit.mjs";
import { rgba, pxToRem as rem } from "./canonical.mjs";
import { labelFor, structuralName, matchLiteralGbp } from "./gbp-global-styles.mjs";

// ---------------------------------------------------------------------------
// Utilidades de color / tokens
// ---------------------------------------------------------------------------
function fillToCss(fill) {
  if (!fill || fill.visible === false) return null;
  if (fill.type === "SOLID" && fill.color) {
    return rgba({ r: fill.color.r, g: fill.color.g, b: fill.color.b, a: (fill.color.a ?? 1) * (fill.opacity ?? 1) });
  }
  if (fill.type === "GRADIENT_LINEAR" && Array.isArray(fill.gradientStops)) {
    const stops = fill.gradientStops.map((s) => `${rgba({ r: s.color.r, g: s.color.g, b: s.color.b, a: s.color.a ?? 1 })} ${Math.round(s.position * 100)}%`).join(",");
    return `linear-gradient(180deg,${stops})`;
  }
  return null;
}

/** El último fill VISIBLE del array gana (así renderiza Figma los fills apilados). */
function topVisibleFill(node) {
  const fills = Array.isArray(node.fills) ? node.fills.filter((f) => f && f.visible !== false) : [];
  return fills.length ? fills[fills.length - 1] : null;
}

const SCALE_MODE_FIT = { FIT: "contain" };
const scaleModeToObjectFit = (mode) => SCALE_MODE_FIT[mode] ?? "cover"; // FILL/CROP/TILE → cover

// ---------------------------------------------------------------------------
// Vectores/iconos: detección de subárboles 100% vectoriales y limpieza del
// SVG exportado por la API de Figma para que coincida con lo que el editor
// de WordPress guardaría (ver patterns/hero-home/ejemplo-salida.html).
// ---------------------------------------------------------------------------
const VECTOR_LEAF_TYPES = new Set(["VECTOR", "BOOLEAN_OPERATION", "STAR", "LINE", "ELLIPSE", "REGULAR_POLYGON"]);

/**
 * true si el propio nodo pinta algo (fondo/borde/radio/padding) más allá de agrupar.
 * Un FRAME/COMPONENT/INSTANCE así es un contenedor real (botón, badge, chip) que
 * envuelve un icono — NO un icono compuesto de varias capas — y no debe aplanarse
 * a un solo SVG, o se pierde su decoración propia (borde, cornerRadius, padding).
 * Los GROUP nunca pintan nada propio en Figma.
 */
function hasOwnVisualDecoration(node) {
  if (node.type === "GROUP") return false;
  const hasFill = Array.isArray(node.fills) && node.fills.some((f) => f && f.visible !== false);
  const hasStroke = Array.isArray(node.strokes) && node.strokes.some((s) => s && s.visible !== false) && node.strokeWeight > 0;
  const hasRadius = (typeof node.cornerRadius === "number" && node.cornerRadius > 0) || (Array.isArray(node.rectangleCornerRadii) && node.rectangleCornerRadii.some((r) => r > 0));
  const hasPadding = ["paddingTop", "paddingBottom", "paddingLeft", "paddingRight"].some((k) => typeof node[k] === "number" && node[k] > 0);
  return hasFill || hasStroke || hasRadius || hasPadding;
}

/** true si el nodo (o TODO su subárbol) es puramente geometría vectorial → un solo icono exportable.
 * Bug real corregido (2026-08-24, "Logo / 1 /" en home-8): una fila de 6-7
 * logotipos ("Webflow / Black", "Relume / Black"...) con Auto Layout
 * HORIZONTAL se fusionaba en UN SOLO SVG gigante, porque cada logotipo
 * individual SÍ es 100% vectorial (icono + texto ya vectorizado por Figma) y
 * la recursión no distinguía "un icono compuesto de varias formas" de "varios
 * iconos independientes colocados en fila con su propio gap". Auto Layout con
 * 2+ hijos es la señal de Figma de que son elementos de flex independientes
 * (se reflowarían con su propio espaciado) — nunca un icono compuesto legítimo
 * (esos no usan Auto Layout en la práctica). Cortar aquí deja cada logotipo
 * como su propio `shape`, y el contenedor (Row/Content) sigue el flujo normal
 * de conversión a flex real. */
export function isVectorLikeSubtree(node) {
  if (!node || node.visible === false) return false;
  if (VECTOR_LEAF_TYPES.has(node.type)) return true;
  if (!["GROUP", "FRAME", "COMPONENT", "INSTANCE"].includes(node.type)) return false;
  if (hasOwnVisualDecoration(node)) return false;
  const kids = Array.isArray(node.children) ? node.children.filter((c) => c.visible !== false) : [];
  if (!kids.length) return false;
  if (node.layoutMode && kids.length >= 2) return false;
  return kids.every(isVectorLikeSubtree);
}

const SVG_VOID_ELEMENTS = ["path", "rect", "circle", "ellipse", "line", "polygon", "polyline", "stop", "use", "image"];

/** Normaliza el SVG crudo de Figma a la forma que re-serializaría el editor de WP. */
function cleanSvgMarkup(raw) {
  let svg = String(raw);
  const start = svg.indexOf("<svg");
  if (start > 0) svg = svg.slice(start);
  svg = svg.replace(/<\?xml[^>]*\?>/g, "");
  svg = svg.replace(/<!--[\s\S]*?-->/g, ""); // comentarios HTML dentro del SVG romperían el parseo de bloques
  svg = svg.replace(/>\s+</g, "><").trim();
  for (const tagName of SVG_VOID_ELEMENTS) {
    svg = svg.replace(new RegExp(`<${tagName}([^>]*?)\\s*/>`, "g"), `<${tagName}$1></${tagName}>`);
  }
  return svg;
}

/** Quita width/height del <svg> raíz: el tamaño se controla por CSS (selector `svg` en styles). */
function stripSvgRootSize(svg) {
  const m = svg.match(/^<svg\b[^>]*>/);
  if (!m) return svg;
  const openTag = m[0].replace(/\s+(width|height)="[^"]*"/g, "");
  return openTag + svg.slice(m[0].length);
}

/** Color efectivo de un nodo vectorial hoja: su fill sólido, o si no hay, su stroke sólido. */
function leafVectorColor(node) {
  const fill = topVisibleFill(node);
  if (fill?.type === "SOLID") return fillToCss(fill);
  const stroke = Array.isArray(node.strokes) ? node.strokes.find((s) => s && s.visible !== false && s.type === "SOLID") : null;
  return stroke ? fillToCss(stroke) : null;
}

/** Colores distintos usados en todo el subárbol vectorial (para decidir si el icono es monocromo). */
function collectVectorColors(node, out = new Set()) {
  if (VECTOR_LEAF_TYPES.has(node.type)) {
    const c = leafVectorColor(node);
    if (c) out.add(c.toLowerCase());
    return out;
  }
  for (const c of node.children ?? []) collectVectorColors(c, out);
  return out;
}

/** Sustituye fill/stroke de color por currentColor (icono monocromo → hereda color vía CSS). */
function forceCurrentColor(svg) {
  return svg
    .replace(/(?<=[\s])fill="(?!none")[^"]*"/g, 'fill="currentColor"')
    .replace(/(?<=[\s])stroke="(?!none")[^"]*"/g, 'stroke="currentColor"');
}

/** Crea un sustituto de tokens: hex/rgba → var(--slug) si hay match exacto. */
export function makeTokenizer(tokenMap) {
  const lookup = new Map();
  for (const entry of Object.values(tokenMap?.colors ?? {})) {
    if (entry.value && entry.token) lookup.set(String(entry.value).toLowerCase(), entry.token);
  }
  return (cssColor) => {
    if (!cssColor) return cssColor;
    return lookup.get(String(cssColor).toLowerCase()) ?? cssColor;
  };
}

// ---------------------------------------------------------------------------
// Layout: Figma auto-layout → flex
// ---------------------------------------------------------------------------
const ALIGN = { MIN: "flex-start", CENTER: "center", MAX: "flex-end", SPACE_BETWEEN: "space-between", BASELINE: "baseline" };

/**
 * flex-wrap vs. grid — CRITERIO MEDIDO el 4/09/2026, dos rondas.
 *
 * Primera ronda (contra `herramientas/corpus-gb/`, 742 bloques YA CONVERTIDOS
 * a GenerateBlocks, y `WEB ACELIA/build/home.mjs`, código a mano): la señal de
 * partida fue `layoutMode:"HORIZONTAL" + layoutWrap:"WRAP"`, calcada del CSS
 * de salida (`flexWrap:"wrap"`).
 *
 * Segunda ronda — **la que manda, probada contra Figma de verdad**: 15
 * extracciones REALES de `C:\TRABAJOS\figma-gb-pipeline\extract\*.node.json`
 * (proyectos de cliente ya extraídos con `figma-client.mjs`, no inventados).
 * Resultado, medido con `grep`: **`layoutWrap:"WRAP"` no aparece NI UNA VEZ**
 * en esas 15 extracciones — todas usan `"NO_WRAP"`. Los diseñadores no usan
 * el wrap nativo de Figma para "grids"; construyen filas fijas a mano:
 *   - `home-1.node.json`/`home-2.node.json`: `"Row"` (HORIZONTAL, NO_WRAP) con
 *     3 `"Card"` hijos DIRECTOS de igual ancho (416px) — caso plano, grid-able
 *     sin tocar la estructura.
 *   - `home-4/5/6/8/home3.node.json`: `"Blogs"` (HORIZONTAL) con solo 2
 *     `"Column"` hijos (632px), cada Column apilando 2 Cards VERTICAL —
 *     rejilla 2×2 vía anidamiento, no vía hijos planos. Aplanar esto a un grid
 *     de verdad reescribiría el árbol DOM, no solo el CSS — fuera de alcance
 *     aquí (se queda en flex, sin cambios, exactamente como antes).
 *
 * Por eso el criterio real YA NO exige `layoutWrap:"WRAP"` (no ocurre en la
 * práctica) — exige la ESTRUCTURA PLANA que sí ocurre: fila HORIZONTAL con 3+
 * hijos DIRECTOS de ancho uniforme. Umbral añadido tras la segunda ronda:
 * ancho ≥150px, para no atrapar filas de iconos/chips/logos pequeños
 * (`WEB ACELIA/home.mjs` ya distinguía esto por ancho VARIABLE; los iconos
 * reales pueden ser uniformes Y pequeños a la vez — ver la excepción de
 * `logos.html` de más abajo). 150px es una cota práctica, no medida contra un
 * corpus de iconos — si aparece un caso real que la contradiga, corregir aquí.
 *
 * Responsive (columnas → mitad en tablet @1024px → 1 en móvil @767px):
 * MISMOS breakpoints que ya usan `gbp-section`/`gbp-footer` en
 * `gbp-global-styles.mjs`, medidos contra el corpus de 742 bloques (primera
 * ronda) — eso no cambia con el hallazgo de la segunda ronda, sigue siendo
 * el patrón real de GB Pro para cuando SÍ hay un grid. Única excepción
 * medida ahí: una fila de 6 logos pequeños se queda en 2 columnas en móvil en
 * vez de bajar a 1 — no implementada (sin señal fiable en Figma para
 * distinguir "icono" de "tarjeta" más allá del umbral de 150px de arriba).
 */
function shouldUseGrid(node) {
  if (node.layoutMode !== "HORIZONTAL") return false;
  const kids = (node.children ?? []).filter((c) => c.visible !== false);
  if (kids.length < 3) return false; // 1-2 elementos: flex ya se ve igual, no hace falta grid
  const widths = kids.map((c) => c.absoluteBoundingBox?.width);
  if (widths.some((w) => typeof w !== "number")) return false;
  const w0 = widths[0];
  if (w0 < 150) return false; // ítems pequeños (iconos/chips/logos) -> flex, no grid (ver comentario)
  return widths.every((w) => Math.abs(w - w0) <= 2); // ancho uniforme (tolerancia 2px) = candidato a grid
}

function estimateGridColumns(node) {
  const kids = (node.children ?? []).filter((c) => c.visible !== false);
  const childW = kids[0]?.absoluteBoundingBox?.width;
  const containerW = node.absoluteBoundingBox?.width;
  const gap = node.itemSpacing || 0;
  if (!childW || !containerW) return Math.min(kids.length, 3);
  return Math.max(1, Math.min(kids.length, Math.round((containerW + gap) / (childW + gap))));
}

/** Ver el comentario largo de shouldUseGrid: N → mitad en tablet → 1 en móvil. */
function gridResponsiveSteps(cols) {
  if (cols <= 1) return { tablet: 1, mobile: 1 };
  return { tablet: Math.max(1, Math.round(cols / 2)), mobile: 1 };
}

/* Ancho de contenido de un móvil real (~375px de pantalla menos el padding
   habitual). Es la cota contra la que se decide si una fila CABE en móvil o
   hay que apilarla. No es un breakpoint: el breakpoint sigue siendo 767px. */
const ANCHO_CONTENIDO_MOVIL = 360;

/**
 * REGLA DEL USUARIO (4/09/2026, explícita): "normalmente son flex alineados en
 * vertical en versión móvil". Como sus diseños de Figma NO traen frames de
 * móvil aparte —comprobado: las 23 extracciones reales del histórico son todas
 * de 1440px—, la versión móvil hay que INTERPRETARLA desde el auto-layout del
 * Desktop, y su regla es: las filas se apilan en vertical.
 *
 * Guardarraíl para no apilar lo que no toca: solo se apila si la fila de verdad
 * NO CABE en un móvil (suma de anchos de los hijos + huecos >
 * ANCHO_CONTENIDO_MOVIL). Así, una fila de 3 iconos de 40px (≈140px) se queda
 * en horizontal —apilarla sería absurdo— y una fila de 3 tarjetas de 416px
 * (≈1300px) se apila. La medida sale del propio Figma, no de una suposición.
 *
 * No se toca `alignItems`/`justifyContent`: cambiarlos sería inventar
 * intención de diseño que el frame Desktop no expresa.
 */
function shouldStackOnMobile(node) {
  if (node.layoutMode !== "HORIZONTAL") return false;
  const kids = (node.children ?? []).filter((c) => c.visible !== false);
  if (kids.length < 2) return false;
  const widths = kids.map((c) => c.absoluteBoundingBox?.width);
  if (widths.some((w) => typeof w !== "number")) return false;
  const gaps = (node.itemSpacing || 0) * (kids.length - 1);
  return widths.reduce((a, b) => a + b, 0) + gaps > ANCHO_CONTENIDO_MOVIL;
}

/**
 * El padding lateral de Figma se copiaba tal cual, y en un móvil se come la
 * pantalla: medido sobre las extracciones reales, **93 nodos traen
 * `paddingLeft: 64`** (128px de los 375 de un móvil, un tercio de la pantalla)
 * y 9 traen ~109px. Es la misma trampa que el usuario capturó en la home de
 * ACELIA, donde el padding de 52px dejaba el texto en una columna estrechísima.
 *
 * Los valores a los que se baja NO son inventados: son los que ya usa
 * `gbp-section` en `gbp-global-styles.mjs`, la propia librería de patrones de
 * GB Pro — `40px` en escritorio, `30px` en tablet (≤1024) y `20px` en móvil
 * (≤767). Solo se toca si el padding original es MAYOR que el de ese tramo:
 * un padding pequeño se respeta tal cual.
 *
 * El padding VERTICAL no se toca a propósito: `gbp-section` también lo reduce,
 * pero un padding vertical grande en móvil deja hueco de más, no rompe el
 * layout — y aquí se prefiere no tocar lo que no está roto.
 */
const PADDING_LATERAL_MAX = { tablet: 30, movil: 20 };

function aplicaPaddingLateralResponsive(s, node) {
  const izq = node.paddingLeft, der = node.paddingRight;
  if (typeof izq !== "number" && typeof der !== "number") return;
  for (const [tramo, bp] of [["tablet", "@media (max-width:1024px)"], ["movil", "@media (max-width:767px)"]]) {
    const tope = PADDING_LATERAL_MAX[tramo];
    const reglas = {};
    if (typeof izq === "number" && izq > tope) reglas.paddingLeft = rem(tope);
    if (typeof der === "number" && der > tope) reglas.paddingRight = rem(tope);
    // Se FUSIONA con lo que ya hubiera en ese breakpoint (apilado, grid…),
    // nunca se pisa: el orden de llamadas no debe importar.
    if (Object.keys(reglas).length) s[bp] = { ...(s[bp] ?? {}), ...reglas };
  }
}

function layoutStyles(node, parent, depth) {
  const s = {};
  const mode = node.layoutMode;

  if (mode === "HORIZONTAL" && shouldUseGrid(node)) {
    const cols = estimateGridColumns(node);
    s.display = "grid";
    s.gridTemplateColumns = `repeat(${cols}, minmax(0, 1fr))`;
    /* Figma expone counterAxisSpacing para el hueco de fila en layouts WRAP,
       pero no está verificado todavía contra la API real en este proyecto —
       se usa itemSpacing para las dos direcciones hasta medirlo (ver LEEME.md). */
    if (node.itemSpacing > 0) { s.columnGap = rem(node.itemSpacing); s.rowGap = rem(node.itemSpacing); }
    if (node.primaryAxisAlignItems && ALIGN[node.primaryAxisAlignItems]) s.justifyContent = ALIGN[node.primaryAxisAlignItems];
    if (node.counterAxisAlignItems && ALIGN[node.counterAxisAlignItems]) s.alignItems = ALIGN[node.counterAxisAlignItems];
    const { tablet, mobile } = gridResponsiveSteps(cols);
    if (tablet < cols) s["@media (max-width:1024px)"] = { gridTemplateColumns: `repeat(${tablet}, minmax(0, 1fr))` };
    if (mobile < tablet) s["@media (max-width:767px)"] = { gridTemplateColumns: "1fr" };
  } else if (mode === "HORIZONTAL" || mode === "VERTICAL") {
    s.display = "flex";
    if (mode === "VERTICAL") s.flexDirection = "column";
    if (node.itemSpacing > 0) {
      s[mode === "HORIZONTAL" ? "columnGap" : "rowGap"] = rem(node.itemSpacing);
    }
    if (node.primaryAxisAlignItems && ALIGN[node.primaryAxisAlignItems]) s.justifyContent = ALIGN[node.primaryAxisAlignItems];
    if (node.counterAxisAlignItems && ALIGN[node.counterAxisAlignItems]) s.alignItems = ALIGN[node.counterAxisAlignItems];
    if (node.layoutWrap === "WRAP") s.flexWrap = "wrap";
    // Ver shouldStackOnMobile: la fila se apila en vertical en móvil si no cabe.
    if (shouldStackOnMobile(node)) s["@media (max-width:767px)"] = { flexDirection: "column" };
  }

  // Paddings
  for (const [k, cssk] of [["paddingTop", "paddingTop"], ["paddingBottom", "paddingBottom"], ["paddingLeft", "paddingLeft"], ["paddingRight", "paddingRight"]]) {
    if (typeof node[k] === "number" && node[k] > 0) s[cssk] = rem(node[k]);
  }
  aplicaPaddingLateralResponsive(s, node);

  // Padre sin Auto Layout (canvas libre en Figma): en vez de perder la posición,
  // se replican las coordenadas absolutas exactas del canvas. Fiel al pixel, pero
  // no responsive — por eso sigue avisándose (ver más abajo, en el contenedor).
  // Excepciones (se resuelven con padding/flex normal más abajo, sin posición
  // absoluta): el padre tiene un solo hijo, o sus hijos forman una fila/columna
  // limpia sin solaparse (ver singleChildPadding / inferFlexLayout).
  const parentInferred = parent && !parent.layoutMode ? (singleChildPadding(parent) || inferFlexLayout(parent)) : null;
  const parentIsFreeform = depth > 0 && parent && !parent.layoutMode && !parentInferred;
  if (parentIsFreeform && node.absoluteBoundingBox && parent.absoluteBoundingBox) {
    s.position = "absolute";
    s.left = px(Math.round(node.absoluteBoundingBox.x - parent.absoluteBoundingBox.x));
    s.top = px(Math.round(node.absoluteBoundingBox.y - parent.absoluteBoundingBox.y));
    if (node.absoluteBoundingBox.width) s.width = px(Math.round(node.absoluteBoundingBox.width));
    if (node.absoluteBoundingBox.height) s.height = px(Math.round(node.absoluteBoundingBox.height));
    return s;
  }

  // Dimensionado dentro del padre. Si el padre se emite como grid (ver
  // shouldUseGrid arriba), sus hijos NO están en un eje flex — flexGrow/
  // flexBasis no pintan nada ahí; caen por la rama `else` de abajo
  // (`width:100%`, rellena la celda de la grid) en vez de recibir estilos flex.
  const parentIsGrid = parent?.layoutMode === "HORIZONTAL" && shouldUseGrid(parent);
  const parentFlexDirection = parentIsGrid ? null
    : parent?.layoutMode === "HORIZONTAL" ? "HORIZONTAL"
    : parent?.layoutMode === "VERTICAL" ? "VERTICAL"
    : parentInferred?.direction === "row" ? "HORIZONTAL"
    : parentInferred?.direction === "column" ? "VERTICAL"
    : null;
  const inHFlex = parentFlexDirection === "HORIZONTAL";
  const inVFlex = parentFlexDirection === "VERTICAL";
  const sizingH = node.layoutSizingHorizontal; // FIXED | HUG | FILL
  const sizingV = node.layoutSizingVertical;
  const w = node.absoluteBoundingBox?.width;
  const h = node.absoluteBoundingBox?.height;

  if (sizingH === "FILL") {
    if (inHFlex) { s.flexGrow = "1"; s.flexBasis = "0"; s.minWidth = "0"; }
    else s.width = "100%";
  } else if (sizingH === "FIXED" && w && !isRootLike(node, parent, depth)) {
    /* `width:Npx` + `maxWidth:100%` NO basta, y costó verlo: `max-width:100%`
       se mide contra el PADRE, así que si toda la cadena de contenedores viene
       FIXED del mismo diseño de 1440, el 100% de cada uno es el ancho fijo del
       de arriba y no limita nada. Medido el 4/09/2026 en la conversión real de
       `home-4.node.json` a 390px: cuatro contenedores anidados a 768px, el
       titular del hero cortado y 422px saliéndose de la pantalla.
       `min(Npx, 100%)` sí lo resuelve: mismo ancho exacto en escritorio y
       encogible por debajo. Es además el idiom que ya usaba a mano el proyecto
       de referencia (`width: "min(976px, 100%)"` en WEB ACELIA/build/home.mjs),
       y ya está probado en el editor real de WordPress sin drift. */
    s.width = `min(${px(Math.round(w))}, 100%)`;
  }
  if (sizingV === "FIXED" && h && node.type !== "TEXT" && !hasChildren(node)) {
    s.height = px(Math.round(h));
  }
  if (typeof node.minWidth === "number") s.minWidth = px(node.minWidth);
  if (typeof node.maxWidth === "number") s.maxWidth = px(node.maxWidth);

  return s;
}

function decorationStyles(node, tokenize, warn = null) {
  const s = {};
  // Fondo: el fill superior VISIBLE gana, sea color o gradiente. Los fills de
  // tipo IMAGE se resuelven aparte, en convertNode, como <img> real de fondo
  // (técnica canónica de tus patrones GB Pro v2: media absoluta + wrapper de
  // contenido con position:relative;z-index:5 — no como CSS background-image).
  const topFill = topVisibleFill(node);
  if (topFill && node.type !== "TEXT" && topFill.type !== "IMAGE") {
    const v = fillToCss(topFill);
    if (v) {
      if (v.startsWith("linear-gradient")) s.backgroundImage = v;
      else s.backgroundColor = tokenize(v);
    } else {
      warn?.(`Fill «${topFill.type}» en «${node.name}» no soportado aún; revisar manualmente.`);
    }
  }
  // Bordes
  if (Array.isArray(node.strokes) && node.strokes.length && node.strokeWeight > 0) {
    const c = fillToCss(node.strokes[0]);
    if (c) s.border = `${px(node.strokeWeight)} solid ${tokenize(c)}`;
  }
  // Radios
  if (typeof node.cornerRadius === "number" && node.cornerRadius > 0) s.borderRadius = px(node.cornerRadius);
  else if (Array.isArray(node.rectangleCornerRadii) && node.rectangleCornerRadii.some((r) => r > 0)) {
    s.borderRadius = node.rectangleCornerRadii.map((r) => px(r)).join(" ");
  }
  // Sombras
  if (Array.isArray(node.effects)) {
    const shadows = node.effects.filter((e) => e.type === "DROP_SHADOW" && e.visible !== false)
      .map((e) => `${px(e.offset?.x ?? 0)} ${px(e.offset?.y ?? 0)} ${px(e.radius ?? 0)}${e.spread ? " " + px(e.spread) : ""} ${rgba({ r: e.color.r, g: e.color.g, b: e.color.b, a: e.color.a ?? 1 })}`);
    if (shadows.length) s.boxShadow = shadows.join(", ");
  }
  if (typeof node.opacity === "number" && node.opacity < 1) s.opacity = String(Math.round(node.opacity * 100) / 100);
  if (node.clipsContent) s.overflow = "hidden";
  return s;
}

/**
 * Cuando un nodo tiene un fill de imagen (solo o combinado con otros, p.ej. un
 * overlay translúcido encima), Figma COMPONE todos los fills visibles — no basta
 * con "el de arriba gana". Construye una capa absoluta por fill (imagen real via
 * <img>, color/gradiente via div) en su mismo orden, técnica canónica de GB Pro v2
 * (ver "background-image-with-content" / "hero-home": imagen, overlay, contenido).
 * Devuelve null si no hay ninguna imagen entre los fills (nada que componer aquí).
 */
function buildFillLayers(node, images, tokenize, warn) {
  const visibleFills = Array.isArray(node.fills) ? node.fills.filter((f) => f && f.visible !== false) : [];
  if (node.type === "TEXT" || !visibleFills.some((f) => f.type === "IMAGE")) return null;
  const layers = [];
  let z = 1;
  for (const fill of visibleFills) {
    if (fill.type === "IMAGE") {
      const url = images[fill.imageRef];
      if (url) {
        layers.push(media({
          htmlAttributes: { src: url, alt: node.name ?? "" },
          styles: { position: "absolute", top: "0px", right: "0px", bottom: "0px", left: "0px", width: "100%", height: "100%", maxWidth: "100%", objectFit: scaleModeToObjectFit(fill.scaleMode), zIndex: String(z++) },
        }));
      } else {
        warn?.(`Imagen de fondo sin URL (${node.name}): sube la imagen a WP y sustituye el fill.`);
      }
    } else {
      const css = fillToCss(fill);
      if (css) {
        const layerStyles = { position: "absolute", top: "0px", right: "0px", bottom: "0px", left: "0px", zIndex: String(z++) };
        if (css.startsWith("linear-gradient")) layerStyles.backgroundImage = css;
        else layerStyles.backgroundColor = tokenize(css);
        layers.push(element({ tagName: "div", styles: layerStyles }));
      } else {
        warn?.(`Fill «${fill.type}» en «${node.name}» no soportado aún; revisar manualmente.`);
      }
    }
  }
  return { layers, nextZ: z };
}

function textStyles(node, tokenize) {
  const s = {};
  const st = node.style ?? {};
  // Figma no tiene el concepto de "margen de párrafo": todo el espaciado entre
  // textos viene del gap del contenedor (ya se traduce a columnGap/rowGap). El
  // margen por defecto que el navegador aplica a <p>/<h1-6> es puro ruido que
  // puede desalinear el texto respecto a hermanos sin margen (p.ej. un icono
  // en la misma fila) — se anula siempre.
  s.margin = "0";
  const fill = Array.isArray(node.fills) ? fillToCss(node.fills.find((f) => f.type === "SOLID")) : null;
  if (fill) s.color = tokenize(fill);
  // NO se inyecta fontFamily: la tipografía la define el Tema (Customizador de
  // GeneratePress) — inyectarla aquí duplicaría/pisaría esa configuración.
  if (st.fontWeight) s.fontWeight = String(st.fontWeight);
  if (st.fontSize) s.fontSize = px(round2(st.fontSize));
  if (st.lineHeightPx && st.fontSize) s.lineHeight = String(round2(st.lineHeightPx / st.fontSize));
  if (typeof st.letterSpacing === "number" && st.letterSpacing !== 0) s.letterSpacing = px(round2(st.letterSpacing));
  if (st.textAlignHorizontal && st.textAlignHorizontal !== "LEFT") s.textAlign = st.textAlignHorizontal.toLowerCase();
  if (st.textCase === "UPPER") s.textTransform = "uppercase";
  if (st.textDecoration === "UNDERLINE") s.textDecoration = "underline";
  return s;
}

// ---------------------------------------------------------------------------
// Heurísticas mínimas y transparentes
// ---------------------------------------------------------------------------
let usedH1 = false;
function headingTag(node) {
  const size = node.style?.fontSize ?? 16;
  const weight = node.style?.fontWeight ?? 400;
  if (size >= 36 && weight >= 600 && !usedH1) { usedH1 = true; return "h1"; }
  if (size >= 30 && weight >= 600) return "h2";
  if (size >= 22 && weight >= 500) return "h3";
  if (size >= 18 && weight >= 600) return "h4";
  return "p";
}

const px = (n) => `${n}px`;
// Espaciado (padding/gap) en rem, no px — verificado contra un export real de
// tu WordPress (patterns/hero-home/pattern.html): TODOS los padding/gap ahí
// son rem ("paddingTop":"12rem", "columnGap":"3rem"...), nunca px; solo los
// anchos/altos exactos (width/height) se quedan en px. `rem` = pxToRem() de
// canonical.mjs (ya existía, usada en otras partes del proyecto).
const round2 = (n) => Math.round(n * 100) / 100;
const hasChildren = (n) => Array.isArray(n.children) && n.children.length > 0;
// Ni el frame raíz ni las secciones de primer nivel (header/section de página completa)
// deben heredar el ancho fijo en px del artboard de Figma: en HTML real ocupan el 100%
// de su contenedor. Sin esto, cualquier pantalla ≥1440px deja la sección pegada a un
// lado (no hay margin:auto) en vez de expandirse a todo el ancho.
const isRootLike = (node, parent, depth) => !parent || depth === 1;
const hasImageFill = (n) => topVisibleFill(n)?.type === "IMAGE";

/**
 * Si `node` tiene EXACTAMENTE un hijo visible y ese hijo cabe dentro de sus
 * límites (margen ≥0 en los 4 lados, con tolerancia a redondeo de Figma),
 * devuelve el padding equivalente (izq/arriba/der/abajo en px). Así una caja
 * sin Auto Layout con un solo elemento dentro (fondo+enlace, botón+icono…)
 * se convierte en un layout normal y responsive en vez de fijar coordenadas
 * absolutas — automatiza exactamente lo que el aviso recomienda hacer a mano
 * en Figma. Devuelve null si no aplica (2+ hijos, o el hijo se sale de los
 * límites del padre): en ese caso sigue el fallback de posición absoluta.
 */
function singleChildPadding(node) {
  const kids = (node.children ?? []).filter((c) => c.visible !== false);
  if (kids.length !== 1) return null;
  const pb = node.absoluteBoundingBox;
  const cb = kids[0].absoluteBoundingBox;
  if (!pb || !cb) return null;
  const TOL = 2;
  const left = cb.x - pb.x, top = cb.y - pb.y;
  const right = (pb.x + pb.width) - (cb.x + cb.width);
  const bottom = (pb.y + pb.height) - (cb.y + cb.height);
  if (left < -TOL || top < -TOL || right < -TOL || bottom < -TOL) return null;
  return { left: Math.max(0, Math.round(left)), top: Math.max(0, Math.round(top)), right: Math.max(0, Math.round(right)), bottom: Math.max(0, Math.round(bottom)) };
}

/**
 * Extensión de singleChildPadding a N hijos: si `node` (sin Auto Layout) tiene
 * 2+ hijos visibles en una fila o columna limpia (sin solaparse, con hueco
 * uniforme), devuelve dirección/orden visual/gap/alineación/padding para
 * convertirlo a flex real — lo que Auto Layout habría producido. Devuelve
 * null ante solapes reales, huecos muy irregulares o disposición 2D: en ese
 * caso sigue el fallback de posición absoluta (más seguro que adivinar).
 */
function inferFlexLayout(node) {
  const kids = (node.children ?? []).filter((c) => c.visible !== false);
  if (kids.length < 2) return null;
  const pb = node.absoluteBoundingBox;
  if (!pb) return null;
  const boxes = kids.map((c) => c.absoluteBoundingBox);
  if (boxes.some((b) => !b)) return null;
  const TOL = 2, GAP_TOL = 4;

  const tryDirection = (axis) => {
    const size = axis === "x" ? "width" : "height";
    const idx = kids.map((_, i) => i).sort((a, b) => boxes[a][axis] - boxes[b][axis]);
    const sorted = idx.map((i) => boxes[i]);
    const gaps = [];
    for (let i = 1; i < sorted.length; i++) {
      const gap = sorted[i][axis] - (sorted[i - 1][axis] + sorted[i - 1][size]);
      if (gap < -TOL) return null; // se solapan en este eje: no es fila/columna limpia
      gaps.push(Math.round(gap));
    }
    const gap0 = gaps[0] ?? 0;
    if (gaps.some((g) => Math.abs(g - gap0) > GAP_TOL)) return null; // huecos muy irregulares
    return { idx, gap: Math.max(0, gap0) };
  };

  const rowResult = tryDirection("x");
  const colResult = tryDirection("y");
  let direction, result;
  if (rowResult && colResult) {
    // Ambos ejes "no se solapan" (frecuente con pocos hijos separados en
    // diagonal) — usar el eje de mayor variación como el real.
    const spreadX = Math.max(...boxes.map((b) => b.x + b.width)) - Math.min(...boxes.map((b) => b.x));
    const spreadY = Math.max(...boxes.map((b) => b.y + b.height)) - Math.min(...boxes.map((b) => b.y));
    direction = spreadX >= spreadY ? "row" : "column";
    result = spreadX >= spreadY ? rowResult : colResult;
  } else if (rowResult) { direction = "row"; result = rowResult; }
  else if (colResult) { direction = "column"; result = colResult; }
  else return null;

  const orderedKids = result.idx.map((i) => kids[i]);
  const orderedBoxes = result.idx.map((i) => boxes[i]);

  const crossAxis = direction === "row" ? "y" : "x";
  const crossSize = direction === "row" ? "height" : "width";
  const starts = orderedBoxes.map((b) => b[crossAxis]);
  const ends = orderedBoxes.map((b) => b[crossAxis] + b[crossSize]);
  const centers = orderedBoxes.map((b) => b[crossAxis] + b[crossSize] / 2);
  const closeAll = (arr) => arr.every((v) => Math.abs(v - arr[0]) <= TOL);
  let alignItems = "flex-start";
  if (closeAll(centers)) alignItems = "center";
  else if (closeAll(ends)) alignItems = "flex-end";

  const minX = Math.min(...boxes.map((b) => b.x)), maxX = Math.max(...boxes.map((b) => b.x + b.width));
  const minY = Math.min(...boxes.map((b) => b.y)), maxY = Math.max(...boxes.map((b) => b.y + b.height));
  const padding = {
    left: Math.round(minX - pb.x), top: Math.round(minY - pb.y),
    right: Math.round((pb.x + pb.width) - maxX), bottom: Math.round((pb.y + pb.height) - maxY),
  };
  if (padding.left < -TOL || padding.top < -TOL || padding.right < -TOL || padding.bottom < -TOL) return null;
  padding.left = Math.max(0, padding.left); padding.top = Math.max(0, padding.top);
  padding.right = Math.max(0, padding.right); padding.bottom = Math.max(0, padding.bottom);

  return { direction, orderedKids, gap: result.gap, alignItems, padding };
}
const escapeText = (t) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>");

// ---------------------------------------------------------------------------
// Carrusel: Figma no tiene un componente de carrusel real, así que se detecta
// SOLO por convención de nombre de capa (igual que el usuario ya nombra
// "Slider Dots" en su Figma real) — es un indicio, no una certeza, por eso
// siempre se avisa en vez de convertir en silencio.
// ---------------------------------------------------------------------------
/**
 * Header/navegación — REGLA DEL USUARIO (4/09/2026, explícita): "cuando
 * encuentre un Frame con nombre NAV, footer, Menu, navegación... tendrás que
 * interpretar el layout de Figma o el Claude Design".
 *
 * Solo dispara en capas de PRIMER NIVEL de la página (depth <= 1): ahí es donde
 * vive el header real. Un frame llamado "menu" enterrado dentro del contenido
 * (un desplegable, un menú de filtros) sigue el flujo normal, sin tocar.
 *
 * "HEADER" NO ESTÁ EN LA LISTA, y es deliberado — medido el 4/09/2026 contra
 * las extracciones reales: en el vocabulario de las librerías que usan estos
 * diseños (Relume/Webflow), "Header / N" es una SECCIÓN HERO, no el header del
 * sitio. Comprobado: `Header / 5 /` (home-4) y `Header / 30 /` (hero-01) son
 * titular + párrafo + botones, mientras que `Navbar / 9 /` (home-4) sí es el
 * menú real ("Link One/Two/Three/Four" + Mega Menu). Incluir "header" convertía
 * heros en cabeceras con hamburguesa. La lista es la que dio el usuario:
 * nav / navbar / navegación / menú.
 *
 * El FOOTER NO entra aquí a propósito: ya tiene su ruta propia (tagName
 * `footer` + clase global `gbp-footer`) y no necesita hamburguesa ni panel.
 */
const NAV_NAME_RE = /^\s*(nav(bar|igation)?|navegaci[oó]n|men[uú])\b/i;
/* Anclas de la estructura del header (ver buildSiteHeader): la fila de enlaces
   suele llamarse así, y el logo/marca igual. Sirven para saber QUÉ duplicar en
   el panel móvil, no para decidir si algo es un header. */
const NAV_LINKS_NAME_RE = /men[uú]|links?|enlaces|nav\b|navegaci[oó]n/i;

const CAROUSEL_NAME_RE = /carou?sel|slider/i;
const CAROUSEL_DOT_RE = /\bdots?\b|paginaci[oó]n|pagination/i;
// "chevron"/"arrow" a solas son demasiado genéricos (aparecen en dropdowns,
// acordeones, breadcrumbs...) — solo se usan para IDENTIFICAR el icono una
// vez que ya hay una señal fuerte (dot o palabra claramente direccional) de
// que estamos dentro de un carrusel confirmado. Nunca para decidir si algo
// ES un carrusel (ver CAROUSEL_STRICT_ARROW_RE / containsCarouselControlSignal).
const CAROUSEL_ARROW_RE = /flecha|arrow|chevron|\bprev(ious)?\b|\bnext\b|anterior|siguiente/i;
const CAROUSEL_STRICT_ARROW_RE = /\bprev(ious)?\b|\bnext\b|anterior|siguiente|flecha/i;
// Nombres como "Slider Buttons"/"Carousel Controls" son el grupo de CONTROLES de
// un carrusel (probablemente otro, ya existente aparte) — no el contenedor de
// diapositivas. Detectado como falso positivo real en el Figma del usuario
// (grupo "Slider Buttons" con 2 botones de flecha, sin relación con sus slides).
const CAROUSEL_NOT_SLIDES_RE = /bot[oó]n(es)?|buttons?|controls?|flecha|arrow|chevron|\bprev(ious)?\b|\bnext\b|anterior|siguiente|dots?\b|paginaci[oó]n|pagination/i;
/**
 * true si TODO el subárbol visible de `node` está compuesto solo por cosas
 * de control de carrusel: iconos sueltos (dots/flechas dibujados como un
 * único vector) o envoltorios simples alrededor de ellos — nunca texto real
 * ni imágenes. Detecta filas de controles aunque estén anidadas y sin nombre
 * descriptivo (ej. "Row" > "Slider Dots" + "Slider Buttons" > "Button" x2 >
 * "Icon", ninguno de los "Button"/"Icon" dice "flecha" ni "anterior").
 */
function looksLikeControlsRow(node) {
  if (!node || node.visible === false) return false;
  if (CAROUSEL_DOT_RE.test(node.name ?? "") || CAROUSEL_ARROW_RE.test(node.name ?? "")) return true;
  if (node.type === "TEXT") return false;
  if (isVectorLikeSubtree(node)) return true;
  const kids = (node.children ?? []).filter((c) => c.visible !== false);
  if (!kids.length) return false;
  return kids.every(looksLikeControlsRow);
}

/** Recorre el subárbol de `node` y devuelve los nodos cuyo nombre coincide con
 * `re`, sin bajar más allá de la primera coincidencia (evita duplicar
 * icono+envoltorio cuando ambos coinciden). */
function findMatchingDescendants(node, re) {
  const out = [];
  const walk = (n) => {
    if (!n || n.visible === false) return;
    if (re.test(n.name ?? "")) { out.push(n); return; }
    (n.children ?? []).forEach(walk);
  };
  (node.children ?? []).forEach(walk);
  return out;
}

/** Candidatos a flecha SIN nombre reconocible: nodos (hijos directos de una
 * fila de controles) que son ellos mismos un icono, o un envoltorio simple
 * con un único hijo vectorial dentro (patrón "Button" > "Icon"). Solo se usa
 * si hay exactamente 2 — izquierda/derecha es la única señal disponible
 * cuando el diseñador no los nombró "anterior"/"siguiente".
 */
function findUnnamedIconPair(node, exclude) {
  const kids = (node.children ?? []).filter((c) => c.visible !== false && !exclude.includes(c));
  const candidates = kids.filter((k) => {
    if (isVectorLikeSubtree(k)) return true;
    const kk = (k.children ?? []).filter((c) => c.visible !== false);
    return kk.length === 1 && isVectorLikeSubtree(kk[0]);
  });
  if (candidates.length === 2) return candidates;
  // El par puede estar anidado un nivel más (ej. "Row" > "Slider Buttons" >
  // 2x "Button") en vez de ser hijos directos del nodo de control.
  for (const k of kids) {
    const nested = findUnnamedIconPair(k, exclude);
    if (nested.length === 2) return nested;
  }
  return [];
}

/** true si en algún punto del subárbol hay un nombre CLARAMENTE de control de
 * carrusel (dot/paginación, o una palabra direccional sin ambigüedad: prev/
 * next/anterior/siguiente/flecha). Deliberadamente NO incluye "chevron"/
 * "arrow" a solas aquí — son demasiado genéricos (dropdowns, acordeones) y
 * causaban falsos positivos reales (Menu Item, Nav Link Dropdown, Logo…). */
function containsCarouselControlSignal(node) {
  if (!node || node.visible === false) return false;
  if (CAROUSEL_DOT_RE.test(node.name ?? "") || CAROUSEL_STRICT_ARROW_RE.test(node.name ?? "")) return true;
  return (node.children ?? []).some((c) => containsCarouselControlSignal(c));
}

const isCarouselContainer = (node) => {
  const kids = (node.children ?? []).filter((c) => c.visible !== false);
  if (kids.length < 2) return false;
  const name = node.name ?? "";
  if (CAROUSEL_NAME_RE.test(name) && !CAROUSEL_NOT_SLIDES_RE.test(name)) return true;
  // Patrón estructural: un hijo que ES controles (señal fuerte de dot/flecha
  // direccional en su interior, Y estructuralmente compuesto solo de iconos)
  // Y, aparte, al menos un hijo que sea contenido real (ni controles ni "solo
  // iconos") — así no dispara en el nivel de arriba (donde el hermano es un
  // título, no otra diapositiva) ni de nuevo dentro de la propia fila de
  // controles (donde el otro hijo también es "solo iconos", sin señal fuerte).
  const controlsKids = kids.filter((c) => containsCarouselControlSignal(c) && looksLikeControlsRow(c));
  const contentKids = kids.filter((c) => !controlsKids.includes(c) && !looksLikeControlsRow(c));
  return controlsKids.length >= 1 && contentKids.length >= 1;
};

// ---------------------------------------------------------------------------
// Acordeón (FAQ): detectado por nombre de capa "Accordion Item" (convención
// de nombre, igual que el resto de detecciones estructurales de este archivo
// — un indicio, no una certeza). Calibrado contra un export real de Accordion
// pegado por el usuario (2026-08-19, ver lib/emit.mjs). Visto en su Figma real
// (secciones "FAQ / 10 /" en home-4/5/6/home3/prueba-bloques1-0): "Column" >
// N x "Accordion Item" > ["Divider" (línea fina), "Title" > ["Question","Icon"]].
// Figma solo mockea el estado cerrado — nunca hay contenido de respuesta real,
// así que accordion-content se emite vacío con aviso (el usuario lo rellena
// en el editor).
// ---------------------------------------------------------------------------
const ACCORDION_ITEM_NAME_RE = /^accordion\s*item$|^elemento\s*(del\s*)?acorde[oó]n$/i;
const DIVIDER_NAME_RE = /^divider$|^divisor$/i;

// ---------------------------------------------------------------------------
// Menú desplegable (Mega Menu / dropdown de navegación): Figma solo puede
// mockear su estado ABIERTO (no existe forma de diseñar "oculto, aparece al
// pasar el ratón") — calibrado 2026-08-24 contra un caso real del usuario
// (Navbar/9 en home-8: "Nav Link Dropdown" seguido de un hermano "Mega Menu"
// con el contenido del desplegable). Sin este filtro, ese contenido se
// transcribía literalmente como bloque fijo dentro del flujo normal de la
// página, apareciendo SIEMPRE visible en WordPress en vez de solo al hover.
// Se oculta por defecto (display:none) y se avisa siempre — el usuario
// decide en el editor si activa un hover real (GB Pro no tiene un bloque de
// menú desplegable calibrado todavía en este proyecto).
// ---------------------------------------------------------------------------
const DROPDOWN_PANEL_NAME_RE = /^mega\s*menu$|^dropdown(\s*menu)?$|^men[uú]\s*desplegable$/i;

const isAccordionItemsContainer = (node) => {
  const kids = (node.children ?? []).filter((c) => c.visible !== false && !DIVIDER_NAME_RE.test(c.name ?? ""));
  return kids.length >= 2 && kids.every((c) => ACCORDION_ITEM_NAME_RE.test(c.name ?? ""));
};

function findFirstText(node) {
  if (!node || node.visible === false) return null;
  if (node.type === "TEXT") return node;
  for (const c of node.children ?? []) { const r = findFirstText(c); if (r) return r; }
  return null;
}
function findFirstVectorIcon(node) {
  if (!node || node.visible === false) return null;
  if (isVectorLikeSubtree(node)) return node;
  for (const c of node.children ?? []) { const r = findFirstVectorIcon(c); if (r) return r; }
  return null;
}
/** Busca dentro de `root` (a cualquier profundidad) el nodo cuyo `children`
 * contiene literalmente a `target` — su padre real en el árbol de Figma, sin
 * asumir una estructura concreta (a veces el texto cuelga de un envoltorio
 * "Title" intermedio, a veces es hijo directo del propio item — ambas formas
 * reales, vistas en home-8 y home-2 respectivamente). */
function findParentOf(root, target) {
  if ((root.children ?? []).includes(target)) return root;
  for (const c of root.children ?? []) {
    const r = findParentOf(c, target);
    if (r) return r;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Botón/enlace: Figma no tiene un bloque "link" — se detecta por nombre de
// capa (Button/Link/CTA/Botón, igual que "Slider Dots" ya delató el patrón
// del carrusel) + que tenga un texto dentro (con o sin un icono al lado).
// Sin URL real en Figma no hay a qué enlazar: se usa "#" de placeholder y se
// avisa siempre — nunca se inventa un destino.
// ---------------------------------------------------------------------------
const LINK_BUTTON_NAME_RE = /\b(button|link|cta|bot[oó]n)\b/i;
const isLinkButtonContainer = (node) => {
  if (!LINK_BUTTON_NAME_RE.test(node.name ?? "")) return false;
  const kids = (node.children ?? []).filter((c) => c.visible !== false);
  if (!kids.length || kids.length > 2) return false;
  return kids.some((c) => c.type === "TEXT");
};

// ---------------------------------------------------------------------------
// Estructura de sección de GB Pro (New Patterns Library) detectada por
// POSICIÓN en el árbol, no por nombre de capa — calibrado 2026-08-19 contra
// el export oficial real "ejemplos patters gnerateblock pro v2/
// about-page-gbp-injection-reference.html" (pegado por el usuario). Evidencia
// real observada ahí, byte a byte:
//  - gbp-section__inner va SOLO en el PRIMER hijo directo "contenedor" de un
//    gbp-section, nunca en todos (la sección "Testimonials" tiene 2 hijos
//    directos — texto intro + rejilla de tarjetas — y la rejilla NO lleva la
//    clase, aunque su metadata.name diga "inner container max width").
//  - dentro de esa inner (o de UN único envoltorio narrativo sin clase propia
//    dentro de ella, tipo "Content container"), los TEXT se clasifican en
//    SECUENCIA: negrita/pequeño antes del titular → tagline; primer h1-h4 →
//    headline; cualquier otro párrafo → text (no exclusivo del primero: el
//    texto de una tarjeta de testimonio también lo lleva).
//  - esa clasificación NUNCA baja más de un nivel de envoltorio, y nunca entra
//    en listas/rejillas repetidas ("Feature List" con 4 "Feature List Item"
//    iguales) ni en sub-bloques con imagen propia ("Meta Byline" con avatar +
//    nombre/cargo) — esos quedan sin clase, igual que en el ejemplo real.
// ---------------------------------------------------------------------------
const TEXT_GROUP_LABELS = {
  section: { tagline: "gbp-section__tagline", headline: "gbp-section__headline", text: "gbp-section__text" },
};

/**
 * true si `node` es un envoltorio narrativo sin clase propia (ej. "Content
 * container"): agrupa texto secuencial en vez de ser una lista/rejilla
 * repetida (3+ hijos del mismo tipo) o un sub-bloque con una imagen propia
 * entre sus hijos directos (ej. "Meta Byline") — en ambos casos reales no se
 * propaga la clasificación de texto por posición dentro de ellos.
 */
function looksLikeNarrativeWrapper(node) {
  if (!node || node.visible === false) return false;
  if (!["FRAME", "GROUP", "COMPONENT", "INSTANCE"].includes(node.type)) return false;
  const kids = (node.children ?? []).filter((c) => c.visible !== false);
  if (!kids.length) return false;
  if (kids.some((c) => hasImageFill(c) && !hasChildren(c))) return false;
  if (kids.length >= 3 && kids.every((c) => c.type === kids[0].type)) return false;
  return true;
}

/** Clasifica un TEXT dentro de un grupo activo (ver activeGroupCtx en
 * convertNode) y avanza su estado (sawHeadline) — se llama una sola vez por
 * nodo, reutilizando el `tag` ya calculado por headingTag() para no invocarlo
 * dos veces (headingTag tiene el efecto lateral "solo un h1 por conversión"). */
function classifyGroupText(node, tag, groupCtx) {
  if (tag !== "p") {
    if (groupCtx.sawHeadline) return null; // ya hay titular en este grupo; una 2ª cabecera no se reclasifica
    groupCtx.sawHeadline = true;
    return groupCtx.labels.headline;
  }
  if (!groupCtx.sawHeadline && (node.style?.fontWeight ?? 400) >= 600) return groupCtx.labels.tagline;
  return groupCtx.labels.text;
}

// ---------------------------------------------------------------------------
// Tarjetas gbp-card por POSICIÓN — calibrado 2026-08-24 contra un ejemplo real
// del usuario (extract/home-2.node.json): una fila "Row" con 3 hermanos
// idénticos, nombrados genéricamente "Card" (no gbp-*), cada uno con borde
// visible y sin nombre especial: imagen + [Categoría, Titular, Texto] +
// bloque "Avatar" (con SU PROPIA imagen) con nombre/fecha/tiempo de lectura.
// Señal usada para distinguir una tarjeta real de una simple lista repetida
// (ej. las 4 "Summary of service N" de home-4/5/6/home3, que NO tienen borde
// ni relleno propio y siguen sin clasificarse, igual que antes): decoración
// visual propia (borde y/o relleno, no solo padding) en 2+ hermanos del mismo
// tipo. El sub-bloque con imagen propia (aquí "Avatar") activa un modo meta
// que reutiliza la misma señal que ya cortaba la cadena narrativa de
// secciones (looksLikeNarrativeWrapper) — aquí en vez de cortar, entra en
// gbp-card__meta-text para TODO su subárbol de texto.
// ---------------------------------------------------------------------------

/** true si `node` es una tarjeta real: contenedor con hijos y con decoración
 * visual propia (fondo o borde, no solo padding/radio) — y no algo ya resuelto
 * por otra ruta (nombre literal gbp-*, carrusel, acordeón, botón/enlace). */
function looksLikeCard(node) {
  if (!node || node.visible === false) return false;
  if (!["FRAME", "COMPONENT", "INSTANCE"].includes(node.type)) return false;
  if (!hasChildren(node)) return false;
  if (matchLiteralGbp(node.name)) return false;
  if (isCarouselContainer(node) || isAccordionItemsContainer(node) || isLinkButtonContainer(node)) return false;
  const topFill = topVisibleFill(node);
  const hasFill = !!topFill && topFill.type !== "IMAGE";
  const hasStroke = Array.isArray(node.strokes) && node.strokes.some((s) => s && s.visible !== false) && node.strokeWeight > 0;
  return hasFill || hasStroke;
}

/** true si `node` agrupa 2+ hermanos del mismo tipo que son todos tarjetas
 * reales (ver looksLikeCard) EN FILA (horizontal, real o inferida) — la
 * fila/rejilla que las contiene, nunca una tarjeta individual. Sin este
 * filtro de dirección, cualquier pila VERTICAL de secciones de página con
 * fondo propio (Header/Section/Footer, cada una con su color de fondo)
 * cumple la misma firma estructural que una fila de tarjetas — falso
 * positivo real encontrado en `regnskap-...-lexaro.node.json` (Main Content
 * > Header/6×Section/Footer, layoutMode VERTICAL, cada una con fill propio),
 * donde el titular H1 del Header acabó marcado como gbp-card__meta-text.
 */
function isCardsRow(node) {
  const kids = (node.children ?? []).filter((c) => c.visible !== false);
  if (kids.length < 2) return false;
  if (!kids.every((c) => c.type === kids[0].type)) return false;
  const direction = node.layoutMode === "HORIZONTAL" ? "row"
    : node.layoutMode === "VERTICAL" ? "column"
    : !node.layoutMode ? inferFlexLayout(node)?.direction ?? null
    : null;
  if (direction !== "row") return false;
  return kids.every(looksLikeCard);
}

/** true si `node` es un sub-bloque tipo "Avatar"/"Meta Byline": tiene, entre
 * sus hijos directos, una imagen propia (sin hijos) Y algún texto en su
 * subárbol — la misma señal que ya usa looksLikeNarrativeWrapper para CORTAR
 * la cadena narrativa de secciones, aquí se usa para ENTRAR en modo
 * "gbp-card__meta-text" en vez de cortar. */
function looksLikeMetaWrapper(node) {
  if (!node || node.visible === false) return false;
  if (!["FRAME", "GROUP", "COMPONENT", "INSTANCE"].includes(node.type)) return false;
  const kids = (node.children ?? []).filter((c) => c.visible !== false);
  if (!kids.length) return false;
  if (!kids.some((c) => hasImageFill(c) && !hasChildren(c))) return false;
  return !!findFirstText(node);
}

/** Clasifica un TEXT dentro de un grupo de tarjeta activo (ver
 * activeCardGroupCtx en convertNode). En modo meta (dentro de un sub-bloque
 * tipo Avatar) TODO se etiqueta gbp-card__meta-text, sin distinguir
 * heading/párrafo — nombre, fecha, tiempo de lectura son igual de "meta". */
function classifyCardText(node, tag, cardCtx, isMeta) {
  if (isMeta) return "gbp-card__meta-text";
  if (tag !== "p") {
    if (cardCtx.sawTitle) return null; // ya hay título en esta tarjeta; una 2ª cabecera no se reclasifica
    cardCtx.sawTitle = true;
    return "gbp-card__title";
  }
  return "gbp-card__text";
}

// ---------------------------------------------------------------------------
// Conversión
// ---------------------------------------------------------------------------
export function convertFrame(root, { tokenMap = null, images = {}, svgs = {}, containerWidth = null, namespace = null, menuId = null } = {}) {
  // Namespace por defecto = id del nodo Figma raíz: distingue esta conversión
  // de cualquier OTRA conversión independiente (otro proceso Node, p.ej. el
  // header o el footer de la misma página) para que sus uniqueId nunca
  // choquen aunque las dos empiecen su contador en 0. Ver el comentario largo
  // en emit.mjs junto a resetUid().
  resetUid(namespace ?? root?.id ?? "");
  usedH1 = false;
  const tokenize = makeTokenizer(tokenMap ?? {});
  const warnings = [];
  const warn = (msg) => warnings.push(msg);

  // Registro para la comprobación de fidelidad determinista (ver
  // lib/fidelity-check.mjs): por cada nodo que de verdad se emite, guarda el
  // propio nodo de Figma junto a los estilos FINALES ya calculados — así el
  // checker no tiene que re-analizar el HTML generado (donde se pierde el id
  // de Figma), compara directamente "lo que Figma pedía" contra "lo que este
  // nodo concreto recibió", nodo a nodo, tal cual se decidió en conversión.
  const fidelityRecords = [];
  const record = (node, styles) => {
    if (!node?.id) return;
    fidelityRecords.push({
      id: node.id, name: node.name ?? "", type: node.type,
      sizingH: node.layoutSizingHorizontal, sizingV: node.layoutSizingVertical,
      clipsContent: !!node.clipsContent, textAlign: node.style?.textAlignHorizontal,
      styles: { ...styles },
    });
  };

  // Estilos globales gbp-* (New Patterns Library de GB Pro v2, ver
  // lib/gbp-global-styles.mjs): se añaden como globalClasses ADITIVOS junto a
  // los estilos locales exactos de Figma (que siguen mandando visualmente) —
  // nunca sustituyen un valor real. Un solo aviso por conversión.
  let gbpWarned = false;
  const warnGbp = () => {
    if (gbpWarned) return;
    gbpWarned = true;
    warn("Se añadieron clases globales «gbp-*» (New Patterns Library de GenerateBlocks Pro v2) a secciones/botones/footer, además de tus estilos locales exactos de Figma — esos son los que mandan visualmente. Es organizativo; revisa en el editor que tu sitio no tenga ya esas clases definidas con otros valores.");
  };
  // Ancho de contenedor aprobado por el usuario (flujo C+A de la pestaña
  // Tokens) — nunca se adivina; si no está aprobado, no se aplica. Se referencia
  // la MISMA variable CSS que usa GB Pro en sus propios patrones reales (ver
  // ejemplos patters gnerateblock pro v2/background-image-with-content.json:
  // "maxWidth":"var(--gb-container-width)"), no el valor en px copiado — así
  // sigue coincidiendo si el usuario cambia el ancho aprobado más tarde.
  const hasApprovedContainerWidth = !!tokenMap?.container?.["gb-container-width"];
  /** Metadatos del wrapper "contenido sobre fondo" que crea buildFillLayers. */
  const sectionInnerMeta = (name, depth) => {
    if (depth !== 1) return { metadata: { name: structuralName(name, "Contenido").slice(0, 60) } };
    warnGbp();
    return {
      metadata: { name: structuralName(name, labelFor("gbp-section__inner")).slice(0, 60) },
      globalClasses: ["gbp-section__inner"],
      styles: hasApprovedContainerWidth ? { maxWidth: "var(--gb-container-width)", marginLeft: "auto", marginRight: "auto" } : {},
    };
  };

  // Activo solo mientras se convierte una fila de controles de carrusel
  // detectada (ver convertCarousel): Map<nodeId, (node) => markup> que
  // sustituye la conversión normal de un nodo concreto (dot/flecha) por el
  // bloque nativo correspondiente, preservando el resto de su contexto
  // (contenedor flex, posición) sin tocar.
  let carouselOverrides = null;

  const convertNode = (node, parent, depth, ctx = {}) => {
    if (!node || node.visible === false) return null;
    if (carouselOverrides?.has(node.id)) return carouselOverrides.get(node.id)(node);

    // Imagen: nodo con fill de imagen (y sin hijos de contenido)
    if (hasImageFill(node) && !hasChildren(node)) {
      const topFill = topVisibleFill(node);
      const ref = topFill?.imageRef;
      const src = images[ref] ?? "https://placehold.co/800x600";
      if (!images[ref]) warnings.push(`Imagen sin URL (${node.name}): usa placeholder; sube la imagen a WP y sustituye.`);
      const styles = { ...layoutStyles(node, parent, depth), ...decorationStyles(node, tokenize, warn) };
      styles.objectFit = scaleModeToObjectFit(topFill?.scaleMode);
      if (!styles.width) styles.width = "100%";
      styles.maxWidth = "100%";
      const w = node.absoluteBoundingBox?.width, h = node.absoluteBoundingBox?.height;
      if (w && h) styles.aspectRatio = `${Math.round(w)}/${Math.round(h)}`;
      delete styles.height;
      record(node, styles);
      return media({ htmlAttributes: { src, alt: node.name ?? "" }, styles });
    }

    // Texto
    if (node.type === "TEXT") {
      const tag = headingTag(node);
      const lit = matchLiteralGbp(node.name);
      let groupRole = null;
      if (lit) warnGbp();
      else if (ctx?.groupCtx) {
        groupRole = classifyGroupText(node, tag, ctx.groupCtx);
        if (groupRole) warnGbp();
      } else if (ctx?.cardGroupCtx) {
        groupRole = classifyCardText(node, tag, ctx.cardGroupCtx, !!ctx.cardMeta);
        if (groupRole) warnGbp();
      }
      // Bug real corregido (2026-08-19, auditoría de fidelidad): un TEXT con
      // sizingH:"FILL" nunca llevaba width:100%/flexGrow (layoutStyles() solo
      // se llamaba para contenedores) — como casi todo padre de Auto Layout
      // fija un alignItems explícito (incluso "MIN"→flex-start), el stretch
      // por defecto de CSS nunca entraba en juego y el texto no se ajustaba
      // al ancho de la columna (una sola línea en vez de envolver). Mismo
      // tratamiento de sizing que cualquier otro nodo, ahora también en texto.
      const styles = { ...layoutStyles(node, parent, depth), ...textStyles(node, tokenize) };
      const globalClasses = lit?.classes ?? (groupRole ? [groupRole] : undefined);
      const metaName = lit ? lit.label : (groupRole ? structuralName(node.name, labelFor(groupRole)) : null);
      record(node, styles);
      return text({ tagName: tag, content: escapeText(node.characters ?? ""), styles, globalClasses, metadata: metaName ? { name: metaName.slice(0, 60) } : undefined });
    }

    // Vector/icono: subárbol 100% geometría → un solo bloque shape con el SVG real exportado
    if (isVectorLikeSubtree(node)) {
      const raw = svgs[node.id];
      if (!raw) {
        warnings.push(`Vector «${node.name}» omitido: no se pudo exportar su SVG (revisa el scope del token de Figma o vuelve a extraer).`);
        return null;
      }
      let html = cleanSvgMarkup(raw);
      const w = node.absoluteBoundingBox?.width, h = node.absoluteBoundingBox?.height;
      const svgStyles = {};
      if (w) svgStyles.width = px(Math.round(w));
      if (h) svgStyles.height = px(Math.round(h));

      // Icono monocromo → currentColor + color heredado (por CSS, como en tus patrones reales).
      // Multicolor → se preserva el color original de cada trazo (forzar currentColor lo rompería).
      const colors = collectVectorColors(node);
      if (colors.size === 1) {
        html = forceCurrentColor(html);
        svgStyles.fill = "currentColor";
        svgStyles.color = tokenize([...colors][0]);
      } else if (colors.size > 1) {
        warnings.push(`«${node.name}»: icono con varios colores; se conserva el color original de cada trazo.`);
      }
      html = stripSvgRootSize(html);

      const styles = layoutStyles(node, parent, depth);
      if (typeof node.opacity === "number" && node.opacity < 1) styles.opacity = String(Math.round(node.opacity * 100) / 100);
      if (Object.keys(svgStyles).length) styles.svg = svgStyles;
      const meta = node.name ? { metadata: { name: node.name.slice(0, 60) } } : {};
      // Sin record() aquí a propósito: Figma marca clipsContent:true por
      // defecto en casi cualquier icono/vector aplanado, sin que signifique
      // nada real que recortar — la regla clips-content solo tiene sentido
      // en contenedores con contenido real, no en un icono de una pieza.
      return shape({ html, styles, ...meta });
    }

    // Contenedores (FRAME, GROUP, COMPONENT, INSTANCE, RECTANGLE decorativo)
    if (["FRAME", "GROUP", "COMPONENT", "INSTANCE", "COMPONENT_SET", "SECTION", "RECTANGLE"].includes(node.type)) {
      // Carrusel: detectado SOLO por el nombre de la capa en Figma (carousel/slider/
      // carrusel) + al menos 2 hijos reconocibles como diapositivas. Figma no tiene
      // un componente de carrusel real — esto es un indicio, no una certeza, por eso
      // siempre se avisa. Se convierte al bloque Carousel nativo de GB Pro (calibrado
      // y verificado con round-trip real, ver lib/emit.mjs).
      if (isCarouselContainer(node)) {
        const builtCarousel = convertCarousel(node, parent, depth);
        if (builtCarousel) return builtCarousel;
        // Si no se pudo interpretar como carrusel (menos de 2 diapositivas
        // reconocibles), sigue el flujo normal de conversión de contenedor.
      }

      // Header/navegación por nombre de capa (ver NAV_NAME_RE): bloques nativos
      // Site Header + Navigation + Menu Toggle + Menu Container de GB Pro, con
      // el menú móvil de fábrica, en vez de <div>s genéricos.
      if (depth <= 1 && NAV_NAME_RE.test(node.name ?? "") && hasChildren(node)) {
        const builtHeader = buildSiteHeader(node, parent, depth);
        if (builtHeader) return builtHeader;
        // Si no se pudo interpretar, sigue el flujo normal (sin cambios).
      }

      // Acordeón (FAQ): nombre de capa "Accordion Item" en 2+ hijos → bloque
      // Accordion nativo de GB Pro (ver isAccordionItemsContainer arriba).
      if (isAccordionItemsContainer(node)) {
        return convertAccordionItems(node, parent, depth);
      }

      // Botón/enlace: nombre de capa sugiere Button/Link/CTA y tiene un texto
      // dentro (con o sin icono) → <a> real envolviendo un <span>, en vez de
      // un <div> genérico. Sin URL real en Figma: placeholder "#" + aviso.
      if (isLinkButtonContainer(node)) {
        const builtLink = convertLinkButtonContainer(node, parent, depth);
        if (builtLink) return builtLink;
      }

      // tagName semántico básico
      const nm = (node.name ?? "").toLowerCase();
      // Bug real corregido (2026-08-24): al extraer una sección AISLADA (no
      // la página completa) — ej. "FAQ / 10 /" sola, en vez de dentro de
      // "Home / 8 /" — sus hijos internos ("Section Title", "Content"×2)
      // quedan en depth===1 sin más contexto, y la regla "depth===1 = sección
      // de página" los marcaba como gbp-section uno a uno, cuando en
      // realidad son subestructura interna de UNA sola sección. Figma no da
      // ninguna señal fiable de "esto es una página completa o una sección
      // aislada" — pero SÍ es una señal fiable que estos envoltorios
      // genéricos (sin número de componente, nombre repetido entre
      // hermanos) nunca son el nombre real de una sección de página (Navbar,
      // Header, Testimonial, FAQ... siempre llevan "/ N /"). Se excluyen de
      // la promoción automática a <section>/gbp-section por nombre.
      const isGenericTopLevelWrapper = /^(content|section title|row|column|actions|title)$/i.test((node.name ?? "").trim());
      let tagName = "div";
      if (depth === 1 && !isGenericTopLevelWrapper) tagName = "section";
      if (/footer/.test(nm)) tagName = "footer";
      else if (/navbar|\bnav\b/.test(nm) && depth <= 1) tagName = "nav"; // Container acepta "nav" como tag propio — más semántico que forzarlo a header
      else if (/header/.test(nm) && depth <= 1) tagName = "header";

      // Prioridad máxima: el nombre de la capa en Figma ES literalmente una
      // clase gbp-* (el usuario ya nombra así sus capas — intención
      // explícita, gana a cualquier heurística por posición/profundidad).
      // Si no hay nombre literal: secciones/footer de primer nivel (como
      // siempre), o esta capa fue elegida por su padre gbp-section como su
      // envoltorio de contenido de ancho máximo (ctx.forceInner, ver abajo).
      const lit = matchLiteralGbp(node.name);
      let sectionGlobalClasses, roleLabel = null;
      if (lit) { sectionGlobalClasses = lit.classes; roleLabel = lit.label; }
      else if (depth === 1 && tagName === "section" && !isGenericTopLevelWrapper) { sectionGlobalClasses = ["gbp-section"]; roleLabel = labelFor("gbp-section"); }
      else if (depth === 1 && tagName === "footer") { sectionGlobalClasses = ["gbp-footer"]; roleLabel = labelFor("gbp-footer"); }
      else if (ctx?.forceInner) { sectionGlobalClasses = ["gbp-section__inner"]; roleLabel = labelFor("gbp-section__inner"); }
      else if (ctx?.forceCard) { sectionGlobalClasses = ctx.cardHasBorder ? ["gbp-card", "gbp-card--border"] : ["gbp-card"]; roleLabel = labelFor("gbp-card"); }
      if (roleLabel) warnGbp();
      const isGbpSectionNode = !!sectionGlobalClasses?.includes("gbp-section");
      const isGbpInnerNode = !!sectionGlobalClasses?.includes("gbp-section__inner");
      const isGbpCardNode = !!sectionGlobalClasses?.includes("gbp-card");

      const styles = { ...layoutStyles(node, parent, depth), ...decorationStyles(node, tokenize, warn) };
      if (isGbpInnerNode && hasApprovedContainerWidth) {
        styles.maxWidth = "var(--gb-container-width)"; styles.marginLeft = "auto"; styles.marginRight = "auto";
      }
      if (DROPDOWN_PANEL_NAME_RE.test(node.name ?? "")) {
        styles.display = "none";
        warnings.push(`«${node.name}» parece el panel de un menú desplegable (Figma solo puede mostrarlo abierto) → se oculta por defecto (display:none). Si quieres que aparezca al pasar el ratón, activa ese comportamiento en el editor de WordPress.`);
      }

      // GROUP/FRAME sin auto-layout: se intenta resolver sin recurrir a
      // coordenadas absolutas, en este orden — un solo hijo (padding), o
      // varios en fila/columna limpia (flex). Solo si ninguno aplica se usan
      // coordenadas absolutas exactas (fiel al pixel, pero fijo) y se avisa.
      // IMPORTANTE: estas dos heurísticas son SOLO para nodos SIN Auto Layout
      // propio (bug real encontrado 2026-08-19: un "Column" con Auto Layout
      // VERTICAL real y un solo hijo que no llena el ancho —alineación normal
      // de Figma, MIN por defecto— se interpretaba como padding decorativo
      // inventado, comprimiendo una fila de navegación real. Si el nodo ya
      // tiene layoutMode, su padding real ya lo puso layoutStyles() arriba.
      const scp = !node.layoutMode ? singleChildPadding(node) : null;
      const flexInfo = !node.layoutMode && !scp ? inferFlexLayout(node) : null;
      const isFreeform = !node.layoutMode && hasChildren(node) && !scp && !flexInfo;
      if (scp) {
        if (scp.left && !styles.paddingLeft) styles.paddingLeft = rem(scp.left);
        if (scp.top && !styles.paddingTop) styles.paddingTop = rem(scp.top);
        if (scp.right && !styles.paddingRight) styles.paddingRight = rem(scp.right);
        if (scp.bottom && !styles.paddingBottom) styles.paddingBottom = rem(scp.bottom);
      }
      if (flexInfo) {
        styles.display = "flex";
        if (flexInfo.direction === "column") styles.flexDirection = "column";
        if (flexInfo.gap > 0) styles[flexInfo.direction === "row" ? "columnGap" : "rowGap"] = rem(flexInfo.gap);
        if (flexInfo.alignItems !== "flex-start") styles.alignItems = flexInfo.alignItems;
        if (flexInfo.padding.left && !styles.paddingLeft) styles.paddingLeft = rem(flexInfo.padding.left);
        if (flexInfo.padding.top && !styles.paddingTop) styles.paddingTop = rem(flexInfo.padding.top);
        if (flexInfo.padding.right && !styles.paddingRight) styles.paddingRight = rem(flexInfo.padding.right);
        if (flexInfo.padding.bottom && !styles.paddingBottom) styles.paddingBottom = rem(flexInfo.padding.bottom);
        warnings.push(`«${node.name}» no usa Auto Layout en Figma, pero sus ${flexInfo.orderedKids.length} hijos están en ${flexInfo.direction === "row" ? "fila" : "columna"} sin solaparse → convertido a flex automáticamente (responsive). Es una interpretación, no una certeza — revisa que se vea bien.`);
      }
      if (isFreeform && depth > 0) {
        if (!styles.position) styles.position = "relative";
        if (!styles.height && node.absoluteBoundingBox?.height) styles.height = px(Math.round(node.absoluteBoundingBox.height));
        if (!styles.width && node.absoluteBoundingBox?.width) styles.width = px(Math.round(node.absoluteBoundingBox.width));
        warnings.push(`«${node.name}» no usa Auto Layout en Figma: se replicaron las coordenadas absolutas exactas del canvas (fiel al pixel, pero fijo — no responsive). Recomendado a futuro: aplicar Auto Layout en Figma para que sea responsive.`);
      }

      const orderedSource = flexInfo ? flexInfo.orderedKids : (node.children ?? []);

      // Envoltorio de ancho máximo por posición: solo si esta capa ES un
      // gbp-section (y no lleva ya su propio fondo de imagen — ese caso crea
      // su propia inner sintética más abajo, vía sectionInnerMeta), se busca
      // su PRIMER hijo contenedor real para asignarle gbp-section__inner.
      const built = buildFillLayers(node, images, tokenize, warn);
      const eligibleForAutoInner = isGbpSectionNode && !built;
      const isEligibleInnerChild = (c) => c.visible !== false
        && ["FRAME", "GROUP", "COMPONENT", "INSTANCE", "COMPONENT_SET", "SECTION"].includes(c.type)
        && hasChildren(c) && !matchLiteralGbp(c.name)
        && !isCarouselContainer(c) && !isAccordionItemsContainer(c) && !isLinkButtonContainer(c);
      let innerAssigned = false;

      // Grupo activo de texto (tagline/headline/text): arranca si ESTA capa
      // es la inner; se propaga a sus TEXT hijos directos y, EN CADENA, a
      // cada envoltorio narrativo sin clase propia que encuentre (ver
      // looksLikeNarrativeWrapper) — puede haber varios hermanos (patrón
      // real "Título" / "Acciones" como envoltorios separados) Y varios
      // niveles de profundidad (patrón real visto en el Figma del usuario:
      // "Section Title" > "Title" > "Content" > Heading/Text, 2 envoltorios
      // intermedios sin clase antes de llegar al texto). La cadena se corta
      // sola en cuanto un nivel deja de calificar (lista/rejilla repetida
      // tipo "Feature List", o sub-bloque con imagen propia tipo "Meta
      // Byline") — esos quedan sin clasificar, igual que en el ejemplo
      // oficial de GB Pro.
      const activeGroupCtx = isGbpInnerNode ? { sawHeadline: false, labels: TEXT_GROUP_LABELS.section } : (ctx?.groupCtx ?? null);
      const passThroughTargets = activeGroupCtx
        ? new Set(orderedSource.filter((c) => c.visible !== false && !matchLiteralGbp(c.name) && looksLikeNarrativeWrapper(c)))
        : null;

      // Fila/rejilla de tarjetas por posición (ver isCardsRow más arriba):
      // esta capa agrupa 2+ hermanos que parecen tarjetas reales — cada uno
      // se marca para llevar gbp-card en su propia conversión más abajo.
      const cardsRowDetected = isCardsRow(node);

      // Grupo de texto de tarjeta activo: arranca si ESTA capa ES una
      // tarjeta (ctx.forceCard, resuelto en la conversión del propio nodo
      // como contenedor); se propaga en cadena igual que activeGroupCtx,
      // salvo que al entrar en un sub-bloque con imagen propia (ver
      // looksLikeMetaWrapper, ej. "Avatar") activa el modo meta para TODO
      // su subárbol de texto en vez de cortar la cadena.
      const activeCardGroupCtx = isGbpCardNode ? { sawTitle: false } : (ctx?.cardGroupCtx ?? null);
      const cardMetaTargets = activeCardGroupCtx && !ctx?.cardMeta
        ? new Set(orderedSource.filter((c) => c.visible !== false && !matchLiteralGbp(c.name) && looksLikeMetaWrapper(c)))
        : null;
      const cardPassThroughTargets = activeCardGroupCtx
        ? new Set(orderedSource.filter((c) => c.visible !== false && !matchLiteralGbp(c.name) && !cardMetaTargets?.has(c) && looksLikeNarrativeWrapper(c)))
        : null;

      let children = orderedSource.map((c) => {
        let childCtx = {};
        if (eligibleForAutoInner && !innerAssigned && isEligibleInnerChild(c)) {
          childCtx = { forceInner: true };
          innerAssigned = true;
        } else if (cardsRowDetected && looksLikeCard(c)) {
          const cardHasBorder = Array.isArray(c.strokes) && c.strokes.some((s) => s && s.visible !== false) && c.strokeWeight > 0;
          childCtx = { forceCard: true, cardHasBorder };
        } else if (activeGroupCtx && (c.type === "TEXT" || passThroughTargets?.has(c))) {
          childCtx = { groupCtx: activeGroupCtx };
        } else if (activeCardGroupCtx && (c.type === "TEXT" || cardPassThroughTargets?.has(c) || cardMetaTargets?.has(c) || ctx?.cardMeta)) {
          childCtx = { cardGroupCtx: activeCardGroupCtx, cardMeta: !!ctx?.cardMeta || !!cardMetaTargets?.has(c) };
        }
        return convertNode(c, node, depth + 1, childCtx);
      }).filter(Boolean);

      if (built) {
        if (!styles.position) styles.position = "relative";
        delete styles.backgroundColor; delete styles.backgroundImage; // decorationStyles pudo poner la del fill superior; se sustituye por capas explícitas
        const contentZ = Math.max(5, built.nextZ);
        if (children.length) {
          const wm = sectionInnerMeta(node.name, depth);
          children = [...built.layers, element({ tagName: "div", styles: { position: "relative", zIndex: String(contentZ), ...wm.styles }, globalClasses: wm.globalClasses, metadata: wm.metadata, children })];
        } else {
          children = built.layers;
        }
      }

      const displayName = lit ? roleLabel : (roleLabel ? structuralName(node.name, roleLabel) : node.name);
      const meta = displayName ? { metadata: { name: displayName.slice(0, 60) } } : {};
      record(node, styles);
      return element({ tagName, styles, globalClasses: sectionGlobalClasses, children, ...meta });
    }

    return null;
  };

  /**
   * Convierte un frame de header/navegación (detectado por NAV_NAME_RE en
   * primer nivel) a los bloques nativos de GB Pro: Site Header > Navigation >
   * [grupo de escritorio, Menu Toggle, Menu Container > panel móvil].
   *
   * La estructura es la MISMA que se validó a mano y en vivo contra WordPress
   * el 4/09/2026 en `WEB ACELIA/build/header.mjs` (ver ese fichero y
   * `LEEME.md`), incluido el detalle que costó encontrar: el grupo de
   * escritorio NO puede depender de la clase `gb-menu-hide-on-toggled` (esa
   * clase solo actúa sobre DESCENDIENTES de `.gb-menu-container`, y aquí es un
   * hermano), así que se oculta con su propio `@media (max-width:767px)`.
   *
   * Los enlaces salen del MENÚ REAL de WordPress (`menuId`), no de una lista a
   * mano copiada de Figma. No es una preferencia: GB Pro solo encola
   * `classic-menu-style.css` **y `classic-menu.js`** cuando se RENDERIZA un
   * bloque `classic-menu` (`includes/blocks/classic-menu/class-classic-menu.php`,
   * `render_block()`). Sin ese bloque no existe la regla que esconde el panel
   * cuando el menú está cerrado y, peor, no se carga el JS que pone la clase
   * `--toggled`: el overlay se ve en escritorio y la hamburguesa no abre nada.
   * Comprobado en vivo el 4/09/2026, y comprobado también al revés (con el
   * bloque puesto: abre, cierra y se oculta en escritorio).
   *
   * Por eso, SIN `menuId` esto devuelve null y el header cae a la conversión de
   * contenedor normal: más vale un header estático correcto que uno «nativo»
   * roto. El resto del frame (logo, CTA…) sí se convierte desde Figma y queda
   * como hermano del menú, igual que en el patrón oficial.
   *
   * Devuelve null si no encuentra la fila de enlaces — en ese caso el llamador
   * sigue con la conversión normal, sin tocar nada.
   */
  const buildSiteHeader = (node, parent, depth) => {
    const kids = (node.children ?? []).filter((c) => c.visible !== false);
    if (!kids.length) return null;

    // La fila de enlaces del diseño: es lo ÚNICO que se sustituye por el menú
    // real de WordPress. Todo lo demás del frame (logo, CTA…) se convierte
    // desde Figma tal cual.
    // La fila de enlaces tiene que llevar VARIOS enlaces, y el header varias
    // cosas. Sin ese mínimo, «Menu» casaba con un solo "Nav Link" suelto y un
    // trozo interno del header se promovía a Site Header él solo.
    const linksNode = kids.find((c) => NAV_LINKS_NAME_RE.test(c.name ?? "") &&
      (c.children ?? []).filter((g) => g.visible !== false).length >= 2);
    if (!linksNode || kids.length < 2) return null;

    if (!menuId) {
      warnings.push(
        `«${node.name}» parece un header/navegación, pero NO se convirtió a los bloques nativos de ` +
        `GenerateBlocks Pro porque falta el menú de WordPress: pásalo con la opción \`menuId\` ` +
        `(Apariencia → Menús; el id sale de \`wp menu list\`). Sin un bloque classic-menu, GB Pro no ` +
        `carga classic-menu.js y la hamburguesa no abre nada. Se ha convertido como contenedor normal.`
      );
      return null;
    }

    const otherKids = kids.filter((c) => c !== linksNode);
    const desktopChildren = otherKids.map((c) => convertNode(c, node, depth + 1)).filter(Boolean);

    warnings.push(
      `«${node.name}» se convirtió a los bloques nativos Site Header + Navigation de GenerateBlocks Pro ` +
      `(menú móvil con hamburguesa incluido, breakpoint 767px). Los enlaces vienen del menú ${menuId} de ` +
      `WordPress, no de Figma: para cambiarlos, Apariencia → Menús.`
    );

    /* Tipografía de los enlaces, tomada del primer TEXT de la fila de enlaces
       de Figma. Va en `.gb-menu-link`, que es el <a> que pinta WordPress
       dentro de cada <li>; el <li> en sí solo pierde la viñeta. */
    const primerTexto = (() => {
      const pila = [linksNode];
      while (pila.length) {
        const n = pila.shift();
        if (n.type === "TEXT" && n.visible !== false) return n;
        pila.push(...(n.children ?? []).filter((c) => c.visible !== false));
      }
      return null;
    })();
    const { margin: _m, ...tipografia } = primerTexto ? textStyles(primerTexto, tokenize) : {};

    const menuBlock = classicMenu({
      menu: menuId,
      styles: {
        display: "flex", alignItems: "center", flexWrap: "wrap", listStyleType: "none",
        columnGap: rem(linksNode.itemSpacing ?? 16), rowGap: rem(8),
        marginTop: "0px", marginRight: "0px", marginBottom: "0px", marginLeft: "0px",
        paddingTop: "0px", paddingRight: "0px", paddingBottom: "0px", paddingLeft: "0px",
      },
      itemStyles: {
        listStyleType: "none",
        ".gb-menu-link": { display: "flex", alignItems: "center", textDecoration: "none", ...tipografia },
      },
    });

    /* El GRUPO DE ESCRITORIO conserva el layout EXACTO del frame de Figma
       (fila o columna, huecos, alineaciones): no se le impone una fila propia.
       Medido el 4/09/2026: `Navbar / 9 /` de home-4 es VERTICAL (una fila de
       contenido + un mega menú debajo); imponerle `display:flex` horizontal
       ponía el mega menú AL LADO del contenido en vez de debajo.
       Solo se le añade el ocultado en móvil, y se le quita el apilado
       automático (el menú móvil no se apila: se esconde tras la hamburguesa). */
    const rowStyles = layoutStyles(node, parent, depth);
    delete rowStyles["@media (max-width:767px)"];
    const decor = decorationStyles(node, tokenize, warn);

    /* El padding del frame es el MARGEN DE LA BARRA entera, no del grupo de
       escritorio: si se queda en el grupo, el menú y la hamburguesa salen
       pegados al borde. Se traslada al `navigation`, que es el elemento a
       ancho completo. */
    const navPadding = {};
    for (const k of ["paddingTop", "paddingRight", "paddingBottom", "paddingLeft"]) {
      if (rowStyles[k] != null) { navPadding[k] = rowStyles[k]; delete rowStyles[k]; }
    }
    for (const [k, v] of Object.entries(rowStyles)) {
      if (!k.startsWith("@media") || typeof v !== "object") continue;
      for (const p of ["paddingTop", "paddingRight", "paddingBottom", "paddingLeft"]) {
        if (v[p] == null) continue;
        (navPadding[k] ??= {})[p] = v[p];
        delete v[p];
      }
      if (!Object.keys(v).length) delete rowStyles[k];
    }

    /* Lo que NO es el menú (logo, CTA…) se oculta bajo el breakpoint con su
       propio @media, NO con `gb-menu-hide-on-toggled`: esa clase solo actúa
       sobre DESCENDIENTES de `.gb-menu-container`, y esto es un hermano
       (comprobado en vivo el 4/09/2026 — no tenía ningún efecto). */
    const desktopGroup = desktopChildren.length ? element({
      tagName: "div",
      metadata: { name: structuralName(node.name, "Escritorio").slice(0, 60) },
      styles: { ...rowStyles, "@media (max-width:767px)": { display: "none" } },
      children: desktopChildren,
    }) : null;

    /* El panel móvil repite el logo/CTA debajo del menú real, como el patrón
       oficial de GB. Va DENTRO del menu-container, que es donde
       `gb-menu-show-on-toggled` sí funciona. */
    const overlayPanel = desktopChildren.length ? element({
      tagName: "div",
      className: "gb-menu-show-on-toggled",
      metadata: { name: structuralName(node.name, "Panel móvil").slice(0, 60) },
      styles: { display: "flex", flexDirection: "column", rowGap: rem(24), width: "100%" },
      children: otherKids.map((c) => convertNode(c, node, depth + 1)).filter(Boolean),
    }) : null;

    /* El `navigation` es solo la envolvente semántica: una fila que alinea el
       grupo de escritorio con la hamburguesa. La decoración (fondo, borde) del
       frame de Figma va aquí, que es lo que se ve a ancho completo. */
    const nav = navigation({
      tagName: "nav",
      htmlAttributes: { "data-gb-mobile-breakpoint": "767px", "data-gb-mobile-menu-type": "full-overlay" },
      styles: { display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", ...navPadding, ...decor },
      children: [
        desktopGroup,
        menuContainer({
          styles: {
            display: "flex", alignItems: "center", justifyContent: "center", flexGrow: "1",
            "&.gb-menu-container--mobile": {
              position: "fixed", top: "0px", left: "0px", right: "0px", bottom: "0px", zIndex: "1000",
              display: "flex", flexDirection: "column", justifyContent: "flex-start", alignItems: "flex-start",
              rowGap: rem(24), paddingTop: rem(32), paddingRight: rem(32), paddingBottom: rem(32), paddingLeft: rem(32),
              ...(decor.backgroundColor ? { backgroundColor: decor.backgroundColor } : {}),
            },
            "&.gb-menu-container--mobile .gb-menu": { flexDirection: "column", alignItems: "flex-start", width: "100%" },
          },
          children: [menuBlock, overlayPanel].filter(Boolean),
        }),
        menuToggle({ styles: {
          display: "none", alignItems: "center", justifyContent: "center",
          width: "44px", height: "44px",
          "@media (max-width:767px)": { display: "flex" },
          svg: { width: "24px", height: "24px", fill: "currentColor" },
        } }),
      ].filter(Boolean),
    });

    return siteHeader({
      tagName: "header",
      htmlAttributes: { role: "banner" },
      metadata: { name: structuralName(node.name, "Header").slice(0, 60) },
      styles: { width: "100%" },
      children: [nav],
    });
  };

  /**
   * Convierte un contenedor detectado como carrusel al bloque Carousel nativo
   * de GB Pro. Los hijos con nombre de flecha/dot se separan y se intentan
   * mapear a carouselControl/carouselPagination; el resto son diapositivas
   * (cada una pasa por convertNode normal, así que puede llevar cualquier
   * contenido). Devuelve null si no hay al menos 2 diapositivas reconocibles
   * (el llamador sigue entonces con la conversión de contenedor genérica).
   */
  const convertCarousel = (node, parent, depth) => {
    const kids = (node.children ?? []).filter((c) => c.visible !== false);
    const isControlsChild = (c) => CAROUSEL_DOT_RE.test(c.name ?? "") || CAROUSEL_ARROW_RE.test(c.name ?? "") || looksLikeControlsRow(c);
    const controlsKids = kids.filter(isControlsChild);
    let slideNodes = kids.filter((c) => !controlsKids.includes(c));

    // Si el propio nombre del contenedor dice "carrusel"/"slider" (patrón
    // clásico: varias diapositivas iguales una junto a otra) hacen falta 2+
    // para que tenga sentido. Si lo que delató el carrusel fueron los
    // controles (patrón "Content" > [contenido, fila de controles]), basta
    // con 1 — es habitual que Figma solo mockee una diapositiva y los puntos
    // indiquen que hay más (se avisa igual, para que el usuario lo sepa).
    const byName = CAROUSEL_NAME_RE.test(node.name ?? "") && !CAROUSEL_NOT_SLIDES_RE.test(node.name ?? "");
    const minSlides = byName ? 2 : 1;
    if (slideNodes.length < minSlides) {
      warnings.push(`«${node.name}» parece un carrusel pero no tiene suficiente contenido reconocible como diapositiva; se convirtió como contenedor normal — revísalo a mano si de verdad es un carrusel.`);
      return null;
    }
    // Sin Auto Layout, el orden de node.children no garantiza izquierda→derecha.
    if (!node.layoutMode) {
      slideNodes = [...slideNodes].sort((a, b) => (a.absoluteBoundingBox?.x ?? 0) - (b.absoluteBoundingBox?.x ?? 0));
    }

    // Recolectar dots/flechas dentro de los hijos de control (pueden estar
    // anidados, ej. "Row" > "Slider Dots" + "Slider Buttons" > 2x "Button").
    const dotNodes = controlsKids.flatMap((c) => findMatchingDescendants(c, CAROUSEL_DOT_RE));
    let arrowNodes = controlsKids.flatMap((c) => findMatchingDescendants(c, CAROUSEL_ARROW_RE));
    if (!arrowNodes.length) {
      for (const c of controlsKids) {
        const pair = findUnnamedIconPair(c, dotNodes);
        if (pair.length === 2) { arrowNodes = pair; break; }
      }
    }

    const overrides = new Map();
    for (const d of dotNodes) overrides.set(d.id, () => carouselPagination({}));
    let prevNode, nextNode;
    if (arrowNodes.length) {
      const sorted = [...arrowNodes].sort((a, b) => (a.absoluteBoundingBox?.x ?? 0) - (b.absoluteBoundingBox?.x ?? 0));
      prevNode = sorted.find((n) => /prev|anterior|\bleft\b|izquierd/i.test(n.name ?? "")) ?? sorted[0];
      nextNode = sorted.find((n) => n !== prevNode && /next|siguiente|\bright\b|derech/i.test(n.name ?? "")) ?? sorted[sorted.length - 1];
      const iconNodeOf = (btnNode) => {
        const kk = (btnNode.children ?? []).filter((c) => c.visible !== false);
        return isVectorLikeSubtree(btnNode) ? btnNode : kk.find((c) => isVectorLikeSubtree(c));
      };
      // Igual que el resto de iconos monocromo del proyecto: currentColor +
      // color heredado por CSS (así el botón puede cambiar el tono en :hover).
      const iconAndColorFor = (btnNode) => {
        const iconNode = iconNodeOf(btnNode);
        if (!iconNode) return { icon: null, color: null };
        const raw = svgs[iconNode.id];
        if (!raw) return { icon: null, color: null };
        let html = cleanSvgMarkup(raw);
        const colors = collectVectorColors(iconNode);
        const mono = colors.size <= 1;
        if (mono) html = forceCurrentColor(html);
        return { icon: stripSvgRootSize(html), color: mono ? tokenize([...colors][0] ?? "#000000") : null };
      };
      const controlStylesFor = (btnNode, iconColor) => {
        const w = btnNode.absoluteBoundingBox?.width, h = btnNode.absoluteBoundingBox?.height;
        return {
          display: "flex", alignItems: "center", justifyContent: "center",
          ...(w ? { width: px(Math.round(w)) } : {}), ...(h ? { height: px(Math.round(h)) } : {}),
          ...decorationStyles(btnNode, tokenize, warn),
          ...(iconColor ? { ".gb-carousel-control-icon svg": { fill: "currentColor", color: iconColor } } : {}),
        };
      };
      const prevIcon = iconAndColorFor(prevNode), nextIcon = iconAndColorFor(nextNode);
      overrides.set(prevNode.id, () => carouselControl({ controlType: "previous", styles: controlStylesFor(prevNode, prevIcon.color), icon: prevIcon.icon ?? undefined }));
      if (nextNode !== prevNode) overrides.set(nextNode.id, () => carouselControl({ controlType: "next", styles: controlStylesFor(nextNode, nextIcon.color), icon: nextIcon.icon ?? undefined }));
    }

    const slideCountMsg = slideNodes.length === 1
      ? "1 diapositiva reconocida — si debería haber más, duplica el carousel-item en el editor de WordPress"
      : `${slideNodes.length} diapositivas reconocidas`;
    warnings.push(`«${node.name}» detectado como carrusel → convertido al bloque Carousel nativo de GenerateBlocks Pro (${slideCountMsg}). Revisa slidesPerView/spaceBetween/loop en el editor y ajusta si falta algo — Figma no tiene un componente de carrusel real, esto es una interpretación.`);

    const prevOverrides = carouselOverrides;
    carouselOverrides = overrides.size ? overrides : null;
    const items = slideNodes.map((slideNode) => carouselItem({ children: [convertNode(slideNode, node, depth + 1)].filter(Boolean) }));
    // Los hijos de control se convierten normalmente (conservan su propio
    // flex/posición tal cual estaban en Figma) — solo los nodos concretos en
    // `overrides` (los dots/flechas) salen como bloques nativos.
    const controlsChildren = controlsKids.map((c) => convertNode(c, node, depth + 1)).filter(Boolean);
    carouselOverrides = prevOverrides;

    const carouselBlock = carousel({ styles: { position: "relative" }, slidesPerView: 1, children: [carouselItems({ children: items }), ...controlsChildren] });
    if (depth === 1) {
      warnGbp();
      const meta = { metadata: { name: structuralName(node.name, labelFor("gbp-section")).slice(0, 60) } };
      return element({ tagName: "section", styles: {}, globalClasses: ["gbp-section"], children: [carouselBlock], ...meta });
    }
    return carouselBlock;
  };

  /**
   * Convierte un contenedor detectado como grupo de "Accordion Item" (ver
   * isAccordionItemsContainer) al bloque Accordion nativo de GB Pro.
   * Dentro de cada item: "Divider" (línea fina) → borde del propio item
   * (border-top o border-bottom, según de qué lado esté más cerca — misma
   * forma longhand-por-lado que el export real calibrado, nunca shorthand
   * adivinado); el resto del subárbol se busca por ESTRUCTURA (primer TEXT =
   * pregunta, primer subárbol vectorial = icono), no por nombre literal
   * "Question"/"Icon" — así funciona aunque el diseñador los llame distinto.
   */
  const convertAccordionItems = (node, parent, depth) => {
    const rawKids = (node.children ?? []).filter((c) => c.visible !== false);
    const kids = rawKids.filter((c) => !DIVIDER_NAME_RE.test(c.name ?? ""));
    // Línea de cierre real (encontrada en `home-8`, sección FAQ): un "Divider"
    // SUELTO, hermano de los "Accordion Item" (no anidado dentro de ninguno),
    // al final de la lista — cierra el borde INFERIOR del último elemento. El
    // divisor propio de cada item siempre se usa como borde SUPERIOR (línea
    // encima de la pregunta), así que sin este cierre el último elemento se
    // queda sin línea debajo, distinto de los demás (que la "heredan" de la
    // línea superior del siguiente item). Antes se descartaba sin más al
    // filtrar cualquier Divider fuera de un item.
    const lastRaw = rawKids[rawKids.length - 1];
    const trailingDivider = lastRaw && DIVIDER_NAME_RE.test(lastRaw.name ?? "") && lastRaw.type === "RECTANGLE" ? lastRaw : null;

    const items = kids.map((itemNode, i) => {
      const itemKids = (itemNode.children ?? []).filter((c) => c.visible !== false);
      const dividerNode = itemKids.find((c) => DIVIDER_NAME_RE.test(c.name ?? "") && c.type === "RECTANGLE");
      const restKids = itemKids.filter((c) => c !== dividerNode);

      let questionNode = null, iconNode = null;
      for (const k of restKids) if (!questionNode) questionNode = findFirstText(k);
      for (const k of restKids) if (!iconNode) iconNode = findFirstVectorIcon(k);

      let borderStyle = {};
      if (dividerNode?.absoluteBoundingBox && itemNode.absoluteBoundingBox) {
        const db = dividerNode.absoluteBoundingBox, ib = itemNode.absoluteBoundingBox;
        if (db.height > 0 && db.height <= 4) {
          const color = fillToCss(topVisibleFill(dividerNode)) ?? "#000000";
          const distTop = db.y - ib.y, distBottom = (ib.y + ib.height) - (db.y + db.height);
          const side = distTop <= distBottom ? "Top" : "Bottom";
          borderStyle[`border${side}Width`] = px(Math.max(1, Math.round(db.height)));
          borderStyle[`border${side}Style`] = "solid";
          borderStyle[`border${side}Color`] = tokenize(color);
        }
      }
      if (i === kids.length - 1 && trailingDivider?.absoluteBoundingBox && !borderStyle.borderBottomWidth) {
        const db = trailingDivider.absoluteBoundingBox;
        if (db.height > 0 && db.height <= 4) {
          const color = fillToCss(topVisibleFill(trailingDivider)) ?? "#000000";
          borderStyle.borderBottomWidth = px(Math.max(1, Math.round(db.height)));
          borderStyle.borderBottomStyle = "solid";
          borderStyle.borderBottomColor = tokenize(color);
        }
      }
      const itemStyles = { ...layoutStyles(itemNode, node, depth + 1), ...decorationStyles(itemNode, tokenize, warn), ...borderStyle };

      let iconHtml, iconStyles = {};
      if (iconNode) {
        const raw = svgs[iconNode.id];
        if (raw) {
          let html = cleanSvgMarkup(raw);
          const colors = collectVectorColors(iconNode);
          if (colors.size <= 1) html = forceCurrentColor(html);
          iconHtml = stripSvgRootSize(html);
          const w = iconNode.absoluteBoundingBox?.width, h = iconNode.absoluteBoundingBox?.height;
          iconStyles = { svg: { ...(w ? { width: px(Math.round(w)) } : {}), ...(h ? { height: px(Math.round(h)) } : {}) } };
        } else {
          warnings.push(`«${itemNode.name}»: el icono del acordeón no se pudo exportar como SVG; se usa el icono por defecto de GenerateBlocks Pro.`);
        }
      }

      const questionText = questionNode ? escapeText(questionNode.characters ?? "") : "Pregunta";
      // Bug real corregido (2026-08-24, FAQ de home-8): en Figma la pregunta
      // tiene layoutSizingHorizontal:FILL (se expande para empujar el icono
      // al borde derecho de la fila) — solo se aplicaba textStyles() aquí,
      // nunca layoutStyles(), así que el texto se quedaba con su ancho
      // natural, el icono acababa pegado justo a su lado en vez de al final,
      // y el hueco restante de la fila se leía como "demasiado padding"
      // aunque el padding real (20px arriba/abajo) fuera correcto.
      const questionParent = questionNode ? (findParentOf(itemNode, questionNode) ?? itemNode) : itemNode;
      const questionStyles = questionNode ? { ...layoutStyles(questionNode, questionParent, depth + 2), ...textStyles(questionNode, tokenize) } : {};
      if (questionNode) record(questionNode, questionStyles);
      record(itemNode, itemStyles);

      return accordionItem({
        styles: itemStyles,
        metadata: { name: structuralName(itemNode.name, "Elemento del acordeón").slice(0, 60) },
        children: [
          accordionToggle({
            children: [
              text({ tagName: "span", content: questionText, styles: questionStyles }),
              accordionToggleIcon({ openIcon: iconHtml, closeIcon: iconHtml, styles: iconStyles }),
            ],
          }),
          accordionContent({
            children: [
              element({
                tagName: "div",
                styles: { marginTop: "1em" },
                children: ["<!-- wp:paragraph -->\n<p>Respuesta pendiente de rellenar — Figma solo mockea el acordeón cerrado.</p>\n<!-- /wp:paragraph -->"],
              }),
            ],
          }),
        ],
      });
    });

    warnings.push(`«${node.name}» detectado como acordeón (FAQ) → convertido al bloque Accordion nativo de GenerateBlocks Pro (${items.length} elementos). Figma solo muestra el estado cerrado: el contenido de la respuesta (accordion-content) lleva un párrafo de marcador de posición — sustitúyelo por la respuesta real en el editor de WordPress. Es una interpretación por nombre de capa ("Accordion Item"), no una certeza — revisa el resultado.`);

    const styles = { ...layoutStyles(node, parent, depth), ...decorationStyles(node, tokenize, warn) };
    const accordionBlock = accordion({ styles, metadata: { name: structuralName(node.name, "Acordeón").slice(0, 60) }, children: items });
    if (depth === 1) {
      return element({ tagName: "section", styles: {}, children: [accordionBlock], metadata: { name: structuralName(node.name, "Sección").slice(0, 60) } });
    }
    return accordionBlock;
  };

  /**
   * Convierte un contenedor detectado como botón/enlace (ver isLinkButtonContainer)
   * en un <a> real envolviendo un <span> — usa el soporte nativo de icono del
   * bloque text (icon/iconLocation, atributo real de GB, no un hack) cuando hay
   * un icono junto al texto, en vez de un flex row de dos bloques separados.
   */
  const convertLinkButtonContainer = (node, parent, depth) => {
    const kids = (node.children ?? []).filter((c) => c.visible !== false);
    const textNode = kids.find((c) => c.type === "TEXT");
    if (!textNode) return null;
    const iconNode = kids.find((c) => c !== textNode);

    let iconHtml, iconLocation;
    if (iconNode) {
      if (isVectorLikeSubtree(iconNode)) {
        const raw = svgs[iconNode.id];
        if (raw) {
          let html = cleanSvgMarkup(raw);
          const colors = collectVectorColors(iconNode);
          if (colors.size <= 1) html = forceCurrentColor(html);
          iconHtml = stripSvgRootSize(html);
          const textX = textNode.absoluteBoundingBox?.x ?? 0;
          const iconX = iconNode.absoluteBoundingBox?.x ?? 0;
          iconLocation = iconX < textX ? "before" : "after";
        } else {
          warnings.push(`«${node.name}»: el icono junto al texto no se pudo exportar como SVG; se omite.`);
        }
      } else {
        warnings.push(`«${node.name}»: hay contenido junto al texto que no es un icono simple; revisa el resultado manualmente.`);
        return null; // demasiado complejo para tratarlo como botón simple — sigue el flujo normal
      }
    }

    // Un solo bloque plano (text tagName="a", ver linkButton en emit.mjs) — se
    // fusionan aquí los estilos de "contenedor" (fondo/borde/padding/layout)
    // y los de "texto" (color/tamaño/peso) porque ya no hay Container que los
    // separe.
    const styles = { ...layoutStyles(node, parent, depth), ...decorationStyles(node, tokenize, warn), ...textStyles(textNode, tokenize) };
    // Prioridad máxima: nombre de capa literalmente "gbp-button--primary/
    // --secondary" (o "gbp-footer__link", "gbp-overlay-panel__close"...) →
    // se usa tal cual, intención explícita del usuario. Si no, se infiere:
    // primario = tiene un fill sólido visible (botón "lleno"); secundario =
    // solo borde/outline REAL. El color/relleno REAL sigue viniendo de
    // decorationStyles() arriba; la clase es solo organizativa.
    // Bug real corregido (2026-08-24, capa de verificación visual sobre
    // home-8): capas "Link" de una lista de enlaces de footer/nav SIN fill
    // NI stroke (verificado en el node.json: "fills":[],"strokes":[]) caían
    // siempre a "gbp-button--secondary" (que trae borde+padding en el estilo
    // global), dibujando una caja de botón que nunca existió en Figma. Ahora
    // "secondary" exige un stroke REALMENTE visible (mismo chequeo que ya se
    // usa en el resto del archivo); si no hay ni fill sólido ni stroke, no se
    // asigna ninguna clase gbp-button--* y queda como enlace de texto plano.
    const lit = matchLiteralGbp(node.name);
    const hasVisibleStroke = Array.isArray(node.strokes) && node.strokes.some((s) => s && s.visible !== false) && node.strokeWeight > 0;
    const inferredClasses = topVisibleFill(node)?.type === "SOLID" ? ["gbp-button--primary"] : hasVisibleStroke ? ["gbp-button--secondary"] : null;
    const gbpClasses = lit ? lit.classes : inferredClasses;
    const roleLabel = lit ? lit.label : (gbpClasses ? labelFor(gbpClasses[0]) : null);
    if (roleLabel) warnGbp();
    const displayName = roleLabel ? (lit ? roleLabel : structuralName(node.name, roleLabel)) : node.name;
    const meta = { metadata: { name: displayName?.slice(0, 60) } };
    // Sin URL real en Figma: se deja "#" como placeholder explícito, sin
    // avisar — el usuario ya sabe que debe sustituirlo antes de publicar.
    return linkButton({
      href: "#",
      label: escapeText(textNode.characters ?? ""),
      styles,
      icon: iconHtml,
      iconLocation,
      globalClasses: gbpClasses,
      metadata: meta.metadata,
    });
  };

  // Raíz: normalmente es solo "la página" y se descarta (se emiten sus hijos como
  // secciones hermanas de primer nivel). Pero si el propio frame raíz extraído TIENE
  // fill de imagen (p.ej. extrajiste directamente un "Header" con imagen+overlay,
  // no la página completa que lo contiene), ese fondo debe aplicarse igual — si no,
  // se pierde por completo, porque el nodo raíz nunca pasa por convertNode.
  // Si el frame EXTRAÍDO es el propio header/navegación (no la página que lo
  // contiene), la detección de convertNode no lo ve nunca: la raíz no pasa por
  // ahí. Y es el caso más habitual —se extrae el header solo, para publicarlo
  // como Elemento de GeneratePress—, así que se comprueba también aquí.
  if (NAV_NAME_RE.test(root.name ?? "") && hasChildren(root)) {
    const rootHeader = buildSiteHeader(root, null, 0);
    if (rootHeader) return { markup: rootHeader, warnings, fidelityRecords };
  }

  /* Cada SECCIÓN de primer nivel arranca su propio namespace de uid, derivado
     de su propio id de Figma — no del contador compartido de toda la página.
     Sin esto, el `uniqueId` de una sección depende de CUÁNTAS cosas la
     preceden: mover "About" antes de "Hero" en Figma, o insertar una sección
     nueva en medio, desplaza el contador y cambia los `uniqueId` de TODO lo
     que viene detrás, aunque su contenido no se tocara. El diff de una
     reordenación de una línea salía enorme, y una sección reconvertida sola
     nunca coincidía byte a byte con la misma sección dentro de la página
     completa.
     Con el namespace atado al id de Figma del nodo (estable aunque se mueva
     o se reordene, solo cambia si se borra y se rehace el nodo), reordenar,
     añadir o quitar una sección deja intactos los uniqueId de las demás. Es
     la misma mezcla de namespace que evita colisiones entre scripts
     independientes (ver resetUid() en emit.mjs); aquí se aplica una vez por
     sección en vez de una vez por página. */
  const nsRaiz = namespace ?? root?.id ?? "";
  const pageChildren = (root.children ?? [])
    .map((c) => { resetUid(`${nsRaiz}/${c.id ?? c.name ?? ""}`); return convertNode(c, root, 1); })
    .filter(Boolean);
  // El envoltorio de la propia raíz (más abajo) es un único nodo, no una
  // lista reordenable: namespace propio y fijo, para no heredar el del
  // último hijo procesado.
  resetUid(`${nsRaiz}/__root__`);
  const builtRoot = buildFillLayers(root, images, tokenize, warn);

  // Si la raíz TIENE su propio Auto Layout (frecuente cuando se extrae un
  // componente aislado, no una página completa — p.ej. una sección de 2
  // columnas), sus hijos deben ir dentro de un flex compartido con ese
  // layoutMode. Sin esto, cada hijo se emitía como sección independiente y
  // se perdía la fila/columna del padre (columnas colapsando a una sola).
  const rootFlexStyles = root.layoutMode ? layoutStyles(root, null, 0) : null;
  const wrapInFlex = (kids) => {
    if (!rootFlexStyles || kids.length <= 1) return kids;
    const label = root.layoutMode === "HORIZONTAL" ? "Fila" : "Columna";
    return [element({ tagName: "div", styles: rootFlexStyles, children: kids, metadata: { name: structuralName(root.name, label).slice(0, 60) } })];
  };

  let markup;
  if (builtRoot) {
    const nm = (root.name ?? "").toLowerCase();
    let tagName = hasChildren(root) ? "section" : "div";
    if (/footer/.test(nm)) tagName = "footer";
    else if (/navbar|\bnav\b/.test(nm)) tagName = "nav";
    else if (/header/.test(nm)) tagName = "header";
    const contentZ = Math.max(5, builtRoot.nextZ);
    const innerChildren = wrapInFlex(pageChildren);
    let wrapped;
    if (innerChildren.length) {
      const wm = sectionInnerMeta(root.name, 1);
      wrapped = [...builtRoot.layers, element({ tagName: "div", styles: { position: "relative", zIndex: String(contentZ), ...wm.styles }, globalClasses: wm.globalClasses, metadata: wm.metadata, children: innerChildren })];
    } else {
      wrapped = builtRoot.layers;
    }
    const rootDecoration = decorationStyles(root, tokenize, warn);
    delete rootDecoration.backgroundColor; delete rootDecoration.backgroundImage;
    let rootGlobalClasses, roleLabel = null;
    if (tagName === "section") { rootGlobalClasses = ["gbp-section"]; roleLabel = labelFor("gbp-section"); }
    else if (tagName === "footer") { rootGlobalClasses = ["gbp-footer"]; roleLabel = labelFor("gbp-footer"); }
    if (roleLabel) warnGbp();
    const displayName = roleLabel ? structuralName(root.name, roleLabel) : root.name;
    const meta = displayName ? { metadata: { name: displayName.slice(0, 60) } } : {};
    markup = element({ tagName, styles: { position: "relative", ...rootDecoration }, globalClasses: rootGlobalClasses, children: wrapped, ...meta });
  } else {
    markup = wrapInFlex(pageChildren).join("\n\n");
  }
  return { markup, warnings, fidelityRecords };
}
