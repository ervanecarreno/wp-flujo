/**
 * canonical.mjs — Serialización canónica para GenerateBlocks v2 (GB 2.3 / Pro 2.6)
 *
 * Principio (recovery-rules.md): el editor de WordPress valida los bloques
 * re-serializando los atributos y comparando el STRING byte a byte.
 * No basta con JSON válido: hay que emitir EXACTAMENTE lo que el editor emitiría.
 *
 * Este módulo implementa:
 *  1. serialize_block_attributes() de WP (las 5 sustituciones unicode)
 *  2. Constructor de CSS canónico (alfabetizado, minificado, una línea)
 *  3. Orden de claves canónico por tipo de bloque (block.json de GB)
 */

// ---------------------------------------------------------------------------
// 1. Las 5 sustituciones de serialize_block_attributes() (post wp_json_encode)
// ---------------------------------------------------------------------------
export function serializeBlockAttributes(attrs) {
  // JSON.stringify sin espacios ≈ wp_json_encode con flags por defecto,
  // salvo que PHP escapa "/" como "\/" — WP usa UNESCAPED_SLASHES en bloques,
  // así que JSON.stringify coincide.
  let json = JSON.stringify(attrs);
  return json
    .replace(/--/g, "\\u002d\\u002d")
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\\"/g, "\\u0022");
}

// ---------------------------------------------------------------------------
// 2. CSS canónico
// ---------------------------------------------------------------------------

/** Minifica argumentos de función: clamp(1rem, 4vw, 2rem) → clamp(1rem,4vw,2rem) */
export function minifyCssValue(value) {
  return String(value)
    .replace(/\s*,\s*/g, ",")
    .replace(/\s*\/\s*/g, "/")
    .replace(/\(\s+/g, "(")
    .replace(/\s+\)/g, ")")
    .trim();
}

export function toKebab(prop) {
  if (prop.startsWith("--")) return prop; // custom property
  return prop.replace(/([A-Z])/g, (c) => "-" + c.toLowerCase());
}

/** Propiedades prohibidas en el string `css` (el plugin las regenera desde `styles`) */
export const CSS_FORBIDDEN_PROPS = new Set(["transition"]);

/**
 * Construye el string `css` canónico a partir del objeto `styles`.
 * Reglas:
 *  - Propiedades ALFABETIZADAS dentro de cada regla (2.6)
 *  - Minificado, una sola línea (2.7)
 *  - Sin `transition` ni `:hover` de nivel de bloque (2.2, 2.3) — esos
 *    se declaran solo en `styles` y el plugin los genera.
 *  - Selectores anidados permitidos: pseudo-elementos propios, media queries,
 *    clases generadas de bloques hijos (parent-hover), y selectores internos
 *    declarados en styles como claves objeto (".gb-shape svg", "&:hover::after"…)
 *
 * `styles` conserva su orden de inserción (el editor NO lo alfabetiza);
 * solo el string `css` se alfabetiza.
 */
const BORDER_SIDES = ["Top", "Right", "Bottom", "Left"];
const RADIUS_CORNERS = ["TopLeft", "TopRight", "BottomRight", "BottomLeft"];

/**
 * GB fusiona en shorthand las longhands de padding/margin/borde/radio cuando los
 * 4 lados/esquinas coinciden EXACTAMENTE (1 valor), y coloca el resultado al
 * FINAL de la regla. Para padding/margin, además, cuando NO coinciden los 4
 * pero arriba=abajo Y derecha=izquierda, fusiona en la forma de 2 valores
 * ("padding:1rem 2rem") — verificado con un export real de un botón GB Pro
 * (2026-08-19, paddingTop/Bottom:1rem, paddingLeft/Right:2rem → "padding:1rem
 * 2rem"). NO se intenta la forma de 3 valores (top / izq=der / bottom) — sin
 * evidencia real de ese caso todavía, se deja sin fusionar si no coincide 1 o
 * 2 valores.
 * Verificado también contra: un carousel-control (borde y radio uniformes) y
 * un carousel-item (padding uniforme de 60px en los 4 lados).
 * Orden relativo cuando coinciden varios a la vez: MARGIN, BORDER,
 * BORDER-RADIUS, PADDING (de fuera a dentro de la caja) — verificado contra
 * un export real de accordion-item pegado por el usuario (2026-08-19) que
 * combina margin-bottom (suelto) + border uniforme + padding uniforme:
 * ".gb-accordion__item-x{margin-bottom:1em;border:1px solid #000000;padding:1em}"
 * (border-radius no aparecía en ese ejemplo; su posición entre border y
 * padding es la más plausible dado que ya iba justo después de border en
 * los ejemplos previos que combinaban border+border-radius, sin padding).
 * Devuelve las claves ya consumidas (para excluirlas del resto) y las líneas
 * "prop:valor" del shorthand, en ese orden fijo.
 */
/** BORDER_SIDES = [Top, Right, Bottom, Left]. 1 valor si los 4 coinciden; 2
 * valores ("top/bottom" "right/left") si top=bottom Y right=left; si no, null
 * (no se fusiona — se deja cada longhand tal cual, aún sin evidencia real de
 * la forma de 3 valores). */
function boxShorthandValue(obj, prop) {
  const [top, right, bottom, left] = BORDER_SIDES.map((s) => obj[`${prop}${s}`]);
  if (top === right && right === bottom && bottom === left) return minifyCssValue(top);
  if (top === bottom && right === left) return `${minifyCssValue(top)} ${minifyCssValue(right)}`;
  return null;
}

function extractShorthands(obj) {
  const used = new Set();
  const shorthand = [];

  const marginKeys = BORDER_SIDES.map((s) => `margin${s}`);
  if (marginKeys.every((k) => k in obj)) {
    const v = boxShorthandValue(obj, "margin");
    if (v !== null) {
      shorthand.push(`margin:${v}`);
      for (const k of marginKeys) used.add(k);
    }
  }

  const [w0, s0, c0] = [`border${BORDER_SIDES[0]}Width`, `border${BORDER_SIDES[0]}Style`, `border${BORDER_SIDES[0]}Color`];
  const borderKeys = BORDER_SIDES.map((s) => [`border${s}Width`, `border${s}Style`, `border${s}Color`]);
  if (borderKeys.every(([w, s, c]) => w in obj && s in obj && c in obj)) {
    const uniform = borderKeys.every(([w, s, c]) => obj[w] === obj[w0] && obj[s] === obj[s0] && obj[c] === obj[c0]);
    if (uniform) {
      shorthand.push(`border:${minifyCssValue(obj[w0])} ${minifyCssValue(obj[s0])} ${minifyCssValue(obj[c0])}`);
      for (const [w, s, c] of borderKeys) { used.add(w); used.add(s); used.add(c); }
    }
  }
  const radiusKeys = RADIUS_CORNERS.map((c) => `border${c}Radius`);
  if (radiusKeys.every((k) => k in obj)) {
    const v0 = obj[radiusKeys[0]];
    if (radiusKeys.every((k) => obj[k] === v0)) {
      shorthand.push(`border-radius:${minifyCssValue(v0)}`);
      for (const k of radiusKeys) used.add(k);
    }
  }

  const paddingKeys = BORDER_SIDES.map((s) => `padding${s}`);
  if (paddingKeys.every((k) => k in obj)) {
    const v = boxShorthandValue(obj, "padding");
    if (v !== null) {
      shorthand.push(`padding:${v}`);
      for (const k of paddingKeys) used.add(k);
    }
  }
  return { used, shorthand };
}

export function buildCanonicalCss(selector, styles) {
  const base = [];
  const nested = []; // [fullSelectorOrAtRule, rulesString]

  const walk = (sel, obj, isMedia = false) => {
    const { used, shorthand } = extractShorthands(obj);
    const props = [];
    // Selectores anidados no-media (&/:/descendiente) del MISMO nivel se
    // alfabetizan por su clave cruda antes de emitirse — verificado contra un
    // export real de accordion-toggle (2026-08-19) con "&:is(:hover, :focus)"
    // Y "&:is(.gb-block-is-current, ...)" a la vez: el orden final es
    // ".is(.gb-block-is-current...)" ANTES que ".is(:hover,:focus)" — es decir
    // alfabético por la clave ("&:is(." < "&:is(:"), no el orden de inserción.
    const selectorEntries = [];
    for (const [k, v] of Object.entries(obj)) {
      if (used.has(k)) continue;
      if (v && typeof v === "object") {
        if (k.startsWith("@media")) {
          // media query: regla anidada con el selector base dentro
          nested.push([k, `${sel}{${collectSorted(v)}}`]);
        } else if (k.startsWith("&")) {
          // pseudo sobre el propio selector: "&:is(:hover, :focus)" → .sel:is(:hover,:focus)
          selectorEntries.push([k, `${sel}${minifyCssValue(k.slice(1))}{${collectSorted(v)}}`]);
        } else if (k.startsWith(":")) {
          // forma corta ":hover" → self-pseudo
          selectorEntries.push([k, `${sel}${minifyCssValue(k)}{${collectSorted(v)}}`]);
        } else {
          // selector descendiente (p.ej. ".gb-shape svg" o ".gb-text-x")
          selectorEntries.push([k, `${sel} ${k}{${collectSorted(v)}}`]);
        }
      } else {
        const prop = toKebab(k);
        if (CSS_FORBIDDEN_PROPS.has(prop)) continue;
        props.push(`${prop}:${minifyCssValue(v)}`);
      }
    }
    selectorEntries.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
    for (const [, rule] of selectorEntries) nested.push([null, rule]);
    return [...props.sort(cssPropCompare), ...shorthand];
  };

  const collectSorted = (obj) => {
    const { used, shorthand } = extractShorthands(obj);
    const props = [];
    for (const [k, v] of Object.entries(obj)) {
      if (used.has(k)) continue;
      if (v && typeof v === "object") continue; // no anidar dos niveles en media
      const prop = toKebab(k);
      if (CSS_FORBIDDEN_PROPS.has(prop)) continue;
      props.push(`${prop}:${minifyCssValue(v)}`);
    }
    return [...props.sort(cssPropCompare), ...shorthand].join(";");
  };

  const baseProps = walk(selector, styles);
  let css = "";
  if (baseProps.length) css += `${selector}{${baseProps.join(";")}}`;
  // Primero los selectores anidados no-media, luego media queries (orden GB observado:
  // los ejemplos validados emiten reglas en orden: base, descendientes, media)
  for (const [at, rule] of nested.filter(([a]) => a === null)) css += rule;
  for (const [at, rule] of nested.filter(([a]) => a !== null)) css += `${at.replace(/\s*\(\s*/g, " (").replace(/\s*:\s*/g, ":").replace(/\s*\)\s*/g, ")")}{${rule}}`;
  return css;
}

function cssPropCompare(a, b) {
  const pa = a.split(":")[0];
  const pb = b.split(":")[0];
  return pa < pb ? -1 : pa > pb ? 1 : 0;
}

// ---------------------------------------------------------------------------
// 3. Orden de claves canónico por bloque (block.json GB 2.3 / Pro 2.6)
//    className (atributo core) SIEMPRE al final.
// ---------------------------------------------------------------------------
export const KEY_ORDER = {
  "generateblocks/element": ["uniqueId", "tagName", "styles", "css", "globalClasses", "htmlAttributes", "align", "metadata", "className"],
  // "content" NUNCA se serializa (se deriva del HTML al parsear) — ver nota en emit.mjs text().
  "generateblocks/text": ["uniqueId", "tagName", "styles", "css", "globalClasses", "htmlAttributes", "icon", "iconLocation", "iconOnly", "metadata", "className"],
  "generateblocks/media": ["uniqueId", "tagName", "styles", "css", "globalClasses", "htmlAttributes", "mediaId", "linkHtmlAttributes", "metadata", "className"],
  "generateblocks/shape": ["uniqueId", "html", "styles", "css", "globalClasses", "htmlAttributes", "metadata", "className"],
  "generateblocks/query": ["uniqueId", "tagName", "styles", "css", "globalClasses", "htmlAttributes", "queryType", "paginationType", "query", "inheritQuery", "showTemplateSelector", "metadata", "className"],
  "generateblocks/looper": ["uniqueId", "tagName", "styles", "css", "globalClasses", "htmlAttributes", "metadata", "className"],
  "generateblocks/loop-item": ["uniqueId", "tagName", "styles", "css", "globalClasses", "htmlAttributes", "metadata", "className"],
  "generateblocks/query-page-numbers": ["uniqueId", "tagName", "styles", "css", "globalClasses", "htmlAttributes", "midSize", "metadata", "className"],

  // --- GB Pro: Carousel — VERIFICADO contra un export real del usuario (2026-08-18).
  // Detalle real importante: "carousel" y "carousel-pagination" llevan styles/css
  // ANTES de tagName/htmlAttributes; "carousel-control" al revés (sus atributos
  // propios + tagName/htmlAttributes ANTES de styles/css) — no es un orden uniforme
  // entre los 5, así que no extrapolar a otros bloques nuevos sin volver a verificar.
  // globalClasses/metadata/className NO aparecían en el export (no se usaron) —
  // su posición es una suposición razonable (patrón habitual: al final), sin confirmar.
  "generateblocks-pro/carousel": ["uniqueId", "styles", "css", "tagName", "htmlAttributes", "globalClasses", "metadata", "className"],
  "generateblocks-pro/carousel-items": ["uniqueId", "tagName", "styles", "css", "globalClasses", "htmlAttributes", "metadata", "className"],
  "generateblocks-pro/carousel-item": ["uniqueId", "tagName", "styles", "css", "globalClasses", "htmlAttributes", "metadata", "className"],
  "generateblocks-pro/carousel-control": ["uniqueId", "controlType", "openIcon", "closeIcon", "iconLocation", "iconOnly", "content", "carouselId", "tagName", "htmlAttributes", "globalClasses", "styles", "css", "metadata", "className"],
  "generateblocks-pro/carousel-pagination": ["uniqueId", "styles", "css", "tagName", "htmlAttributes", "globalClasses", "metadata", "className"],

  // --- GB Pro: Accordion — VERIFICADO contra un export real pegado por el
  // usuario (2026-08-19): uniqueId, tagName, styles, css, htmlAttributes en
  // ese orden relativo (accordion-content no tenía styles en el export, así
  // que htmlAttributes seguía directo a tagName — consistente con el resto).
  // globalClasses/metadata/className NO aparecían — posición asumida (patrón
  // habitual del resto de bloques), sin confirmar.
  "generateblocks-pro/accordion": ["uniqueId", "tagName", "styles", "css", "globalClasses", "htmlAttributes", "metadata", "className"],
  "generateblocks-pro/accordion-item": ["uniqueId", "tagName", "styles", "css", "globalClasses", "htmlAttributes", "metadata", "className"],
  "generateblocks-pro/accordion-toggle": ["uniqueId", "tagName", "styles", "css", "globalClasses", "htmlAttributes", "metadata", "className"],
  "generateblocks-pro/accordion-toggle-icon": ["uniqueId", "tagName", "styles", "css", "globalClasses", "metadata", "className"],
  "generateblocks-pro/accordion-content": ["uniqueId", "tagName", "styles", "css", "globalClasses", "htmlAttributes", "metadata", "className"],

  // --- GB Pro: Tabs — VERIFICADO contra un export real pegado por el usuario
  // (2026-08-19): tab-menu-item/tab-item llevan "tabItemOpen" DESPUÉS de
  // htmlAttributes (solo presente en la pestaña abierta por defecto).
  // globalClasses/metadata/className: posición asumida, sin confirmar.
  "generateblocks-pro/tabs": ["uniqueId", "tagName", "styles", "css", "globalClasses", "htmlAttributes", "metadata", "className"],
  "generateblocks-pro/tabs-menu": ["uniqueId", "tagName", "styles", "css", "globalClasses", "htmlAttributes", "metadata", "className"],
  "generateblocks-pro/tab-menu-item": ["uniqueId", "tagName", "styles", "css", "globalClasses", "htmlAttributes", "tabItemOpen", "metadata", "className"],
  "generateblocks-pro/tab-items": ["uniqueId", "tagName", "styles", "css", "globalClasses", "htmlAttributes", "metadata", "className"],
  "generateblocks-pro/tab-item": ["uniqueId", "tagName", "styles", "css", "globalClasses", "htmlAttributes", "tabItemOpen", "metadata", "className"],
};

/** Reordena las claves de attrs según el orden canónico del bloque. */
export function orderAttrs(blockName, attrs) {
  const order = KEY_ORDER[blockName];
  if (!order) return attrs;
  const out = {};
  for (const k of order) if (k in attrs) out[k] = attrs[k];
  // claves desconocidas al final, en orden de inserción (mejor omitir que adivinar)
  for (const k of Object.keys(attrs)) if (!(k in out)) out[k] = attrs[k];
  return out;
}

// ---------------------------------------------------------------------------
// Utilidades de valores
// ---------------------------------------------------------------------------
export function pxToRem(px, base = 16) {
  return `${Math.round((px / base) * 1000) / 1000}rem`;
}

export function rgba({ r, g, b, a = 1 }) {
  const R = Math.round(r * 255), G = Math.round(g * 255), B = Math.round(b * 255);
  const A = Math.round(a * 100) / 100;
  if (A >= 0.99) {
    const hex = (n) => n.toString(16).padStart(2, "0");
    return `#${hex(R)}${hex(G)}${hex(B)}`;
  }
  // canónico GB: rgba(r,g,b,a) SIN espacios (regla 2.4)
  return `rgba(${R},${G},${B},${A})`;
}

/** Escapa texto para el cuerpo HTML renderizado (no JSON): & → &amp;, etc. */
export function escapeHtmlText(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Escapa un valor de atributo HTML del cuerpo renderizado. */
export function escapeHtmlAttr(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
