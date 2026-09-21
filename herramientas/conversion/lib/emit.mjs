/**
 * emit.mjs — Emisores canónicos de bloques GenerateBlocks v2.
 *
 * Cada emisor produce el par delimitador + HTML EXACTO que el editor
 * re-serializaría, siguiendo recovery-rules.md:
 *  - Opción A de clases: NO incluir la id-class en className; el plugin la
 *    auto-inyecta cuando styles no está vacío. En el HTML renderizado la
 *    id-class va PRIMERO: class="gb-element-{id} gb-element ..."
 *  - Cierre compacto: <div ...></div> sin líneas en blanco internas.
 *  - Enlaces con texto: element <a> envolviendo un text hijo (nunca
 *    text tagName:"a" con href — lo pierde al guardar).
 */
import {
  serializeBlockAttributes,
  buildCanonicalCss,
  orderAttrs,
  escapeHtmlAttr,
} from "./canonical.mjs";

let counter = 0;
let nsSeed = "";
/**
 * `namespace` distingue conversiones INDEPENDIENTES (procesos Node distintos)
 * que WordPress puede acabar fusionando en una sola página — p.ej. un
 * Elemento GeneratePress de header/footer más el contenido de la página que
 * lo incluye. Sin namespace, dos scripts que arrancan su propio contador en 0
 * pueden emitir el mismo uniqueId para su enésimo nodo sin estilos propios;
 * es invisible en cada marcado por separado y solo revienta cuando GB
 * compila el CSS real por nombre de clase (`.gb-element-{id}`) y una regla
 * pisa a la otra en silencio. `convertFrame()` pasa aquí el `id` del nodo
 * Figma raíz por defecto, que ya es único por frame — así ningún proyecto
 * tiene que acordarse de aplicar un desplazamiento a mano.
 */
export function resetUid(namespace = "") { counter = 0; nsSeed = namespace; }
/** uniqueId estable de 8 hex como los que genera GB */
export function uid(seed = "") {
  counter++;
  let h = 2166136261 >>> 0;
  const s = nsSeed + "|" + seed + ":" + counter;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

const BASE_CLASS = {
  "generateblocks/element": "gb-element",
  "generateblocks/text": "gb-text",
  "generateblocks/media": "gb-media",
  "generateblocks/shape": "gb-shape",
  "generateblocks/looper": "gb-looper",
  "generateblocks/loop-item": "gb-loop-item",
  "generateblocks-pro/accordion": "gb-accordion",
  "generateblocks-pro/accordion-item": "gb-accordion__item",
  "generateblocks-pro/accordion-toggle": "gb-accordion__toggle",
  "generateblocks-pro/accordion-toggle-icon": "gb-accordion__toggle-icon",
  "generateblocks-pro/accordion-content": "gb-accordion__content",
  "generateblocks-pro/tabs": "gb-tabs",
  "generateblocks-pro/tabs-menu": "gb-tabs__menu",
  "generateblocks-pro/tab-menu-item": "gb-tabs__menu-item",
  "generateblocks-pro/tab-items": "gb-tabs__items",
  "generateblocks-pro/tab-item": "gb-tabs__item",
  "generateblocks-pro/site-header": "gb-site-header",
  "generateblocks-pro/navigation": "gb-navigation",
  "generateblocks-pro/menu-toggle": "gb-menu-toggle",
  "generateblocks-pro/menu-container": "gb-menu-container",
  // classic-menu/-item/-sub-menu: base observada en el export real aunque el
  // bloque no imprime HTML propio (ver comentario en canonical.mjs) — se usa
  // solo para construir el selector CSS de `styles`/`css`, no para una clase
  // que este módulo llegue a renderizar.
  "generateblocks-pro/classic-menu": "gb-menu",
  "generateblocks-pro/classic-menu-item": "gb-menu-item",
  "generateblocks-pro/classic-sub-menu": "gb-sub-menu",
};

/**
 * IMPORTANTE: GB ha cambiado la forma de la lista de clases entre versiones.
 * La forma canónica correcta es LA QUE EMITE TU INSTALACIÓN: valida un patrón
 * con `scripts` de round-trip contra tu WP y ajusta CLASS_MODE si hace falta.
 *
 *  - "site-2026" (por defecto): coincide con los wp_block exportados del
 *    proyecto del usuario (GB Pro 2.x, 2026):
 *      element/media → [globalClasses] gb-{type}-{id}
 *      text/shape    → gb-{type} [globalClasses] gb-{type}-{id}
 *  - "option-a": recovery-rules Opción A (className:"gb-{type}", id primero):
 *      todos → gb-{type}-{id} gb-{type} [globalClasses]
 */
export let CLASS_MODE = "site-2026";
export function setClassMode(mode) { CLASS_MODE = mode; }

function classList(blockName, uniqueId, attrs) {
  const base = BASE_CLASS[blockName];
  /* `query` no tiene clase base: su cuerpo es un `<div>` pelado (medido en
     corpus-gb/latest-articles.html). Sin esta salida, base.replace reventaba. */
  if (!base) {
    const partes = [...(attrs.globalClasses ?? []), ...(attrs.className ? [attrs.className] : [])];
    return partes.join(" ");
  }
  const type = base.replace("gb-", "");
  const hasStyles = attrs.styles && Object.keys(attrs.styles).length > 0;
  const idCls = `gb-${type}-${uniqueId}`;
  const globals = attrs.globalClasses ?? [];
  const extra = attrs.className ? [attrs.className] : [];
  const parts = [];
  if (CLASS_MODE === "option-a") {
    if (hasStyles) parts.push(idCls);
    parts.push(base, ...globals, ...extra);
  } else {
    // site-2026
    // CALIBRADO el 2/09/2026 abriendo el editor de verdad (qa-editor-check.mjs),
    // que es justo lo que este comentario pedía desde agosto. Y salieron distintos:
    //
    //   looper    → SIN clase base. Medido en corpus-gb/latest-articles.html: un
    //               looper con estilos lleva class="gb-looper-ID" y nada más. Con
    //               la base de más, el editor la tomaba por un className propio y
    //               lo añadía a los atributos al guardar: drift en el primer
    //               guardado del cliente.
    //   loop-item → CON clase base. El editor lo acepta así y lo rechaza sin ella.
    //
    // El único ejemplo del corpus es un loop-item SIN estilos, cuya clase base sale
    // del respaldo de abajo; deducir de ahí que no la lleva fue inferir, no medir,
    // y el editor lo desmintió. Se queda como estaba.
    const withBase = [
      "generateblocks/text", "generateblocks/shape", "generateblocks/loop-item",
      // Accordion y Tabs (GB Pro) — calibrado contra exports reales pegados por
      // el usuario (2026-08-19): todos llevan la base class siempre presente,
      // igual que text/shape (nunca como element/media, que no la llevan).
      "generateblocks-pro/accordion", "generateblocks-pro/accordion-item", "generateblocks-pro/accordion-toggle",
      "generateblocks-pro/accordion-toggle-icon", "generateblocks-pro/accordion-content",
      "generateblocks-pro/tabs", "generateblocks-pro/tabs-menu", "generateblocks-pro/tab-menu-item",
      "generateblocks-pro/tab-items", "generateblocks-pro/tab-item",
      // Site Header / Navigation / Menu Toggle / Menu Container — verificado en
      // el mismo export real (post 49656, 3/09/2026): los 4 llevan su clase
      // base SIEMPRE, igual que accordion/tabs (class="gb-site-header
      // gb-site-header-{id}", nunca solo el id class).
      "generateblocks-pro/site-header", "generateblocks-pro/navigation",
      "generateblocks-pro/menu-toggle", "generateblocks-pro/menu-container",
    ].includes(blockName);
    // `className` (atributo core de WP, "clases CSS adicionales" del panel)
    // va SIEMPRE al final, DESPUÉS del id class — lo añade el soporte de
    // bloque genérico de WP por fuera de lo que renderiza GB, nunca se
    // mezcla con `globalClasses`. Verificado el 3/09/2026 contra el export
    // real post 49656: "Nav Items"/"Overlay Header"/"Overlay Items" (element
    // con styles Y className) dan class="gb-element-{id} {className}", NO
    // "{className} gb-element-{id}" — y sigue siendo compatible con el caso
    // ya calibrado el 2/09/2026 (globalClasses SIN className): corpus-gb da
    // "gbp-section__inner gb-element-{id}", globals ANTES del id class.
    if (withBase) parts.push(base);
    parts.push(...globals);
    if (hasStyles) parts.push(idCls);
    parts.push(...extra);
    if (!parts.length) parts.push(base);
  }
  return parts.join(" ");
}

function delimiter(blockName, attrs) {
  const ordered = orderAttrs(blockName, attrs);
  return `<!-- wp:${blockName} ${serializeBlockAttributes(ordered)} -->`;
}

function htmlAttrString(htmlAttributes = {}) {
  return Object.entries(htmlAttributes)
    .map(([k, v]) => ` ${k}="${escapeHtmlAttr(v)}"`)
    .join("");
}

/**
 * Bloque contenedor. children = array de strings (bloques ya emitidos).
 */
export function element({ uniqueId, tagName = "div", styles = {}, globalClasses, htmlAttributes, align, metadata, className, children = [] }) {
  compruebaEtiqueta("element", tagName);
  const id = uniqueId ?? uid(tagName);
  const attrs = { uniqueId: id, tagName };
  if (Object.keys(styles).length) {
    attrs.styles = styles;
    attrs.css = buildCanonicalCss(`.gb-element-${id}`, styles);
  }
  if (globalClasses?.length) attrs.globalClasses = globalClasses;
  if (htmlAttributes) attrs.htmlAttributes = htmlAttributes;
  if (align) attrs.align = align;
  if (metadata) attrs.metadata = metadata;
  if (className) attrs.className = className;

  const cls = classList("generateblocks/element", id, attrs);
  const inner = children.filter(Boolean).join("\n\n");
  const open = `<${tagName} class="${cls}"${htmlAttrString(htmlAttributes)}>`;
  const body = inner ? `${open}${inner}</${tagName}>` : `${open}</${tagName}>`;
  return `${delimiter("generateblocks/element", attrs)}\n${body}\n<!-- /wp:generateblocks/element -->`;
}

/**
 * Bloque de texto. content puede contener HTML inline (con estilos inline
 * literales — el cuerpo HTML no es JSON).
 */
/* Las etiquetas que GenerateBlocks admite de verdad en un `text`. Medidas el
   2/09/2026 sobre 287 bloques text de 25 exports reales (herramientas/corpus-gb).
   NO es una lista de buenas intenciones: con `blockquote`, el editor marca el
   bloque invalido y el cliente ve «Attempt Recovery». Pasaba en la landing del
   proyecto de referencia, y no lo veia ningun linter ni el round-trip de REST —
   solo qa-editor-check.mjs, abriendo el editor de verdad. */
export const ETIQUETAS_TEXT = ["p", "div", "a", "h1", "h2", "h3", "h4", "h5", "h6", "li", "span"];

/* Etiquetas que GenerateBlocks NO admite en un `element`. TODAS medidas abriendo
   el editor de verdad con qa-editor-check.mjs, no deducidas:
     validas   → div, a, ul, figure, section, article, aside, header
     invalidas → blockquote (2/09/2026), span, p, em (3/09/2026)
   El patron es que `element` admite etiquetas de bloque y no las de linea ni las
   de texto. Es una lista de lo COMPROBADO: si aparece otra, se mide antes de
   anadirla, y se mide de la unica forma que vale, abriendo el editor. */
export const ETIQUETAS_PROHIBIDAS = ["blockquote", "span", "p", "em", "strong", "i", "b"];

function compruebaEtiqueta(bloque, tagName) {
  /* Solo para `element`. Un bloque `text` SÍ usa <p> y <span> con toda
     normalidad: son sus etiquetas naturales. Aplicar aquí la lista de element
     rompería cada párrafo del sitio, y estuvo a punto de hacerlo. */
  if (bloque !== "element") return;
  if (ETIQUETAS_PROHIBIDAS.includes(tagName)) {
    throw new Error(
      `${bloque}: GenerateBlocks no admite <${tagName}> en un element; el editor marcaria el ` +
      `bloque invalido y el cliente veria «Attempt Recovery». Usa <div> —o <figure> para una cita—, ` +
      `y si lo que quieres es texto en linea, usa un bloque \`text\` con tagName "${tagName}".`
    );
  }
}

/**
 * ADVERTENCIA sobre `icon` — trampa 19 de la skill `flujo-wordpress-generateblocks`,
 * verificada el 21/09/2026 con `qa-editor-check.mjs`: un `text()` con `icon` genera
 * marcado válido para los dos linters estáticos, pero el EDITOR REAL lo marca inválido
 * («Attempt Recovery»). No investigado más a fondo por qué; la salida verificada es
 * escribir el SVG dentro del propio `content`, que valida y es más corto:
 *   text({ content: '<svg …>…</svg> Rótulo', styles: { display:'inline-flex', … } })
 * en vez de:
 *   text({ content: 'Rótulo', icon: '<svg …>…</svg>' })
 * Si vas a usar `icon`/`iconLocation`, pasa primero por `qa-editor-check.mjs` — es la
 * única capa de QA que ve este fallo.
 */
export function text({ uniqueId, tagName = "p", content = "", styles = {}, globalClasses, htmlAttributes, icon, iconLocation, metadata, className }) {
  compruebaEtiqueta("text", tagName);
  if (!ETIQUETAS_TEXT.includes(tagName)) {
    throw new Error(
      `text: tagName "${tagName}" no lo admite GenerateBlocks; el editor marcaria el bloque invalido. ` +
      `Usa una de: ${ETIQUETAS_TEXT.join(", ")}.`
    );
  }
  const id = uniqueId ?? uid(tagName + content.slice(0, 12));
  const attrs = { uniqueId: id, tagName };
  // "content" NUNCA se serializa en el JSON del comentario — GB lo deriva del
  // HTML renderizado al parsear (RichText source:"html"). Verificado contra
  // ~30 bloques text reales (hero-home, los 25 patrones oficiales de Pro
  // Patterns, y accordion/tabs pegados por el usuario 2026-08-19), CON y SIN
  // icon: ninguno lo lleva. (Un fichero suelto del proyecto,
  // "wpgenerateblockselement conversion.txt", sí lo incluye, pero su
  // procedencia no está verificada — se prioriza la evidencia real más fuerte.)
  if (Object.keys(styles).length) {
    attrs.styles = styles;
    attrs.css = buildCanonicalCss(`.gb-text-${id}`, styles);
  }
  if (globalClasses?.length) attrs.globalClasses = globalClasses;
  if (htmlAttributes) attrs.htmlAttributes = htmlAttributes;
  if (icon) { attrs.icon = icon; if (iconLocation) attrs.iconLocation = iconLocation; }
  if (metadata) attrs.metadata = metadata;
  if (className) attrs.className = className;

  const cls = classList("generateblocks/text", id, attrs);
  const iconHtml = icon ? `<span class="gb-shape">${icon}</span>` : "";
  const inner = iconLocation === "after" ? `${content}${iconHtml}` : `${iconHtml}${content}`;
  const body = `<${tagName} class="${cls}"${htmlAttrString(htmlAttributes)}>${inner}</${tagName}>`;
  return `${delimiter("generateblocks/text", attrs)}\n${body}\n<!-- /wp:generateblocks/text -->`;
}

/**
 * Imagen. src/alt van en htmlAttributes (objeto plano, nunca array).
 * `linkHtmlAttributes` (típico: `{ href: "/" }`) envuelve el `<img>` en un
 * `<a>` — verificado el 3/09/2026 contra el export real post 49656 (logo del
 * header enlazando a portada). Sin `linkHtmlAttributes` no hay envoltorio,
 * igual que antes.
 */
export function media({ uniqueId, tagName = "img", styles = {}, htmlAttributes = {}, globalClasses, mediaId, linkHtmlAttributes, metadata, className }) {
  const id = uniqueId ?? uid("img" + (htmlAttributes.src ?? ""));
  const attrs = { uniqueId: id, tagName };
  if (Object.keys(styles).length) {
    attrs.styles = styles;
    attrs.css = buildCanonicalCss(`.gb-media-${id}`, styles);
  }
  if (globalClasses?.length) attrs.globalClasses = globalClasses;
  attrs.htmlAttributes = htmlAttributes;
  if (mediaId) attrs.mediaId = mediaId;
  if (linkHtmlAttributes) attrs.linkHtmlAttributes = linkHtmlAttributes;
  if (metadata) attrs.metadata = metadata;
  if (className) attrs.className = className;

  const cls = classList("generateblocks/media", id, attrs);
  const img = `<img class="${cls}"${htmlAttrString(htmlAttributes)}/>`;
  const body = linkHtmlAttributes ? `<a${htmlAttrString(linkHtmlAttributes)}>${img}</a>` : img;
  return `${delimiter("generateblocks/media", attrs)}\n${body}\n<!-- /wp:generateblocks/media -->`;
}

/**
 * Icono/forma SVG.
 *
 * **El SVG va solo en el cuerpo, nunca en el JSON del comentario.** En el
 * `block.json` de GB, `html` se declara `"source": "html"` con selector
 * `.gb-shape`: el analizador de Gutenberg lo deriva del marcado y hace caso
 * omiso del valor del comentario. Los exports reales lo confirman — empiezan
 * por `uniqueId` y siguen con `styles`, sin `html` (verificado el 21/09/2026
 * contra `herramientas/corpus-gb/`). Escribirlo duplicaba el SVG en cada
 * bloque sin que nada lo leyera.
 */
export function shape({ uniqueId, html, styles = {}, globalClasses, metadata, className }) {
  const id = uniqueId ?? uid("shape");
  const attrs = { uniqueId: id };
  if (Object.keys(styles).length) {
    attrs.styles = styles;
    attrs.css = buildCanonicalCss(`.gb-shape-${id}`, styles);
  }
  if (globalClasses?.length) attrs.globalClasses = globalClasses;
  if (metadata) attrs.metadata = metadata;
  if (className) attrs.className = className;

  const cls = classList("generateblocks/shape", id, attrs);
  const body = `<span class="${cls}">${html}</span>`;
  return `${delimiter("generateblocks/shape", attrs)}\n${body}\n<!-- /wp:generateblocks/shape -->`;
}

/**
 * Contenido dinámico: query + looper + loop-item (cadena fija, uno dentro
 * de otro). `query` no imprime HTML propio: solo envuelve a `looper` con los
 * parámetros de WP_Query. `looper` es el contenedor (grid/lista) y `loop-item`
 * la plantilla que WordPress repite por cada entrada.
 *
 * Etiquetas dinámicas (van en `content` de text, o en `htmlAttributes.src`/
 * `href` de media/element, como strings literales — el caller las escribe):
 *   {{post_permalink}} {{post_title}} {{post_date dateFormat:j F, Y}}
 *   {{post_excerpt length:28}} {{featured_image size:large}} {{post_meta key:x}}
 *
 * SIN calibrar contra un export real de este WP (ninguno de los 18 patrones
 * usa query/looper) — verificar con round-trip antes de confiar a ciegas.
 */
export function query({ uniqueId, queryType, query: queryParams = {}, paginationType, inheritQuery, showTemplateSelector, styles = {}, tagName, globalClasses, htmlAttributes, metadata, className, children = [] }) {
  const id = uniqueId ?? uid("query");
  const attrs = { uniqueId: id };
  /* GB SIEMPRE escribe tagName en un query (medido: div en el unico query del
     corpus). Sin el, al guardar desde el editor lo anade y el marcado cambia. */
  attrs.tagName = tagName ?? "div";
  if (Object.keys(styles).length) {
    attrs.styles = styles;
    attrs.css = buildCanonicalCss(`.gb-query-${id}`, styles);
  }
  if (globalClasses?.length) attrs.globalClasses = globalClasses;
  if (htmlAttributes) attrs.htmlAttributes = htmlAttributes;
  /* `queryType` NO esta en el esquema del bloque: el editor lo descarta al
     guardar. Emitirlo garantiza drift en el primer guardado del cliente.
     Comprobado el 2/09/2026 con qa-editor-check sobre la landing de referencia. */
  void queryType;
  if (paginationType) attrs.paginationType = paginationType;
  attrs.query = queryParams;
  if (inheritQuery !== undefined) attrs.inheritQuery = inheritQuery;
  if (showTemplateSelector !== undefined) attrs.showTemplateSelector = showTemplateSelector;
  if (metadata) attrs.metadata = metadata;
  if (className) attrs.className = className;

  /* El cuerpo LLEVA etiqueta envolvente, y sin clase: `<div>` a secas (medido en
     corpus-gb/latest-articles.html). Faltaba, y el editor marcaba el bloque
     inválido — lo encontró qa-editor-check.mjs el 2/09/2026. Ni los dos
     validadores ni el round-trip de REST lo veían. */
  const inner = children.filter(Boolean).join("\n\n");
  const cls = classList("generateblocks/query", id, attrs);
  const abre = cls ? `<${attrs.tagName} class="${cls}">` : `<${attrs.tagName}>`;
  const body = `${abre}${inner}</${attrs.tagName}>`;
  return `${delimiter("generateblocks/query", attrs)}\n${body}\n<!-- /wp:generateblocks/query -->`;
}

/** Contenedor del bucle (grid/lista). Igual que `element` pero con base class gb-looper. */
export function looper({ uniqueId, tagName = "div", styles = {}, globalClasses, htmlAttributes, metadata, className, children = [] }) {
  const id = uniqueId ?? uid("looper");
  const attrs = { uniqueId: id, tagName };
  if (Object.keys(styles).length) {
    attrs.styles = styles;
    attrs.css = buildCanonicalCss(`.gb-looper-${id}`, styles);
  }
  if (globalClasses?.length) attrs.globalClasses = globalClasses;
  if (htmlAttributes) attrs.htmlAttributes = htmlAttributes;
  if (metadata) attrs.metadata = metadata;
  if (className) attrs.className = className;

  const cls = classList("generateblocks/looper", id, attrs);
  const inner = children.filter(Boolean).join("\n\n");
  const open = `<${tagName} class="${cls}"${htmlAttrString(htmlAttributes)}>`;
  const body = inner ? `${open}${inner}</${tagName}>` : `${open}</${tagName}>`;
  return `${delimiter("generateblocks/looper", attrs)}\n${body}\n<!-- /wp:generateblocks/looper -->`;
}

/** Plantilla de UN item del bucle (la card completa va dentro, como children). */
export function loopItem({ uniqueId, tagName = "div", styles = {}, globalClasses, htmlAttributes, metadata, className, children = [] }) {
  const id = uniqueId ?? uid("loopitem");
  const attrs = { uniqueId: id, tagName };
  if (Object.keys(styles).length) {
    attrs.styles = styles;
    attrs.css = buildCanonicalCss(`.gb-loop-item-${id}`, styles);
  }
  if (globalClasses?.length) attrs.globalClasses = globalClasses;
  if (htmlAttributes) attrs.htmlAttributes = htmlAttributes;
  if (metadata) attrs.metadata = metadata;
  if (className) attrs.className = className;

  const cls = classList("generateblocks/loop-item", id, attrs);
  const inner = children.filter(Boolean).join("\n\n");
  const open = `<${tagName} class="${cls}"${htmlAttrString(htmlAttributes)}>`;
  const body = inner ? `${open}${inner}</${tagName}>` : `${open}</${tagName}>`;
  return `${delimiter("generateblocks/loop-item", attrs)}\n${body}\n<!-- /wp:generateblocks/loop-item -->`;
}

// ---------------------------------------------------------------------------
// GB Pro: Carousel (generateblocks-pro/*) — calibrado contra un export real
// del usuario (2026-08-18): carousel + carousel-items + carousel-item +
// carousel-control + carousel-pagination. Ver nota en canonical.mjs KEY_ORDER
// sobre qué partes del orden de atributos están verificadas y cuáles no.
// ---------------------------------------------------------------------------

// SVG por defecto de las flechas, copiado literal del export real (no re-generar
// a mano: el editor los sirve tal cual desde su render_callback, con <path .../>
// autocerrado — NO pasar por cleanSvgMarkup/forceCurrentColor, son de otra familia).
const CAROUSEL_ICON_PREV = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M165.66,202.34a8,8,0,0,1-11.32,11.32l-80-80a8,8,0,0,1,0-11.32l80-80a8,8,0,0,1,11.32,11.32L91.31,128Z" /></svg>`;
const CAROUSEL_ICON_NEXT = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor"><path d="M181.66,133.66l-80,80a8,8,0,0,1-11.32-11.32L164.69,128,90.34,53.66a8,8,0,0,1,11.32-11.32l80,80A8,8,0,0,1,181.66,133.66Z" /></svg>`;

/** Carrusel raíz. slidesPerView/spaceBetween van como custom properties en styles
 * Y como data-attrs en htmlAttributes (así los usa el JS/CSS de Swiper). Cualquier
 * otro ajuste (effect, loop, autoplay…) se pasa tal cual en htmlAttributes — no se
 * adivina el nombre del data-attr para lo que no está verificado. */
export function carousel({ uniqueId, tagName = "div", styles = {}, slidesPerView = 1, spaceBetween = "0px", htmlAttributes = {}, globalClasses, metadata, className, children = [] }) {
  const id = uniqueId ?? uid("carousel");
  const finalStyles = { "--gb-carousel-slides-per-view": String(slidesPerView), "--gb-carousel-slide-gap": spaceBetween, ...styles };
  const ha = { "data-slides-per-view": String(slidesPerView), "data-space-between": spaceBetween, ...htmlAttributes };
  const attrs = { uniqueId: id, styles: finalStyles, css: buildCanonicalCss(`.gb-carousel-${id}`, finalStyles), tagName, htmlAttributes: ha };
  if (globalClasses?.length) attrs.globalClasses = globalClasses;
  if (metadata) attrs.metadata = metadata;
  if (className) attrs.className = className;

  const cls = ["gb-carousel", `gb-carousel-${id}`, ...(globalClasses ?? []), ...(className ? [className] : [])].join(" ");
  // data-carousel-id: el editor lo añade solo al renderizar, no vive en el JSON de atributos.
  const body = `<${tagName} class="${cls}"${htmlAttrString(ha)} data-carousel-id="${escapeHtmlAttr(id)}">${children.filter(Boolean).join("\n\n")}</${tagName}>`;
  return `${delimiter("generateblocks-pro/carousel", attrs)}\n${body}\n<!-- /wp:generateblocks-pro/carousel -->`;
}

/** Pista/track de diapositivas. Sin id-class si no lleva styles propios (verificado);
 * con id-class si los lleva (asumido por analogía con el resto de bloques, sin
 * un export real que lo confirme con styles). */
export function carouselItems({ uniqueId, tagName = "div", styles = {}, htmlAttributes, globalClasses, metadata, className, children = [] }) {
  const id = uniqueId ?? uid("carousel-items");
  const hasStyles = Object.keys(styles).length > 0;
  const attrs = { uniqueId: id, tagName };
  if (hasStyles) { attrs.styles = styles; attrs.css = buildCanonicalCss(`.gb-carousel-items-${id}`, styles); }
  if (htmlAttributes) attrs.htmlAttributes = htmlAttributes;
  if (globalClasses?.length) attrs.globalClasses = globalClasses;
  if (metadata) attrs.metadata = metadata;
  if (className) attrs.className = className;

  const cls = ["gb-carousel-items", ...(hasStyles ? [`gb-carousel-items-${id}`] : []), ...(globalClasses ?? []), ...(className ? [className] : [])].join(" ");
  const body = `<${tagName} class="${cls}"${htmlAttrString(htmlAttributes)}>${children.filter(Boolean).join("\n\n")}</${tagName}>`;
  return `${delimiter("generateblocks-pro/carousel-items", attrs)}\n${body}\n<!-- /wp:generateblocks-pro/carousel-items -->`;
}

/** Una diapositiva. El contenido de dentro son bloques normales (element/text/media/shape). */
export function carouselItem({ uniqueId, tagName = "div", styles = {}, htmlAttributes, globalClasses, metadata, className, children = [] }) {
  const id = uniqueId ?? uid("carousel-item");
  const hasStyles = Object.keys(styles).length > 0;
  const attrs = { uniqueId: id, tagName };
  if (hasStyles) { attrs.styles = styles; attrs.css = buildCanonicalCss(`.gb-carousel-item-${id}`, styles); }
  if (htmlAttributes) attrs.htmlAttributes = htmlAttributes;
  if (globalClasses?.length) attrs.globalClasses = globalClasses;
  if (metadata) attrs.metadata = metadata;
  if (className) attrs.className = className;

  const cls = ["gb-carousel-item", ...(hasStyles ? [`gb-carousel-item-${id}`] : []), ...(globalClasses ?? []), ...(className ? [className] : [])].join(" ");
  const body = `<${tagName} class="${cls}"${htmlAttrString(htmlAttributes)}>${children.filter(Boolean).join("\n\n")}</${tagName}>`;
  return `${delimiter("generateblocks-pro/carousel-item", attrs)}\n${body}\n<!-- /wp:generateblocks-pro/carousel-item -->`;
}

/** Flecha prev/next. controlType: "previous" | "next". Icono por defecto = el
 * SVG real de GB si no se pasa uno propio en `icon`. */
export function carouselControl({ uniqueId, controlType, iconOnly = true, tagName = "button", htmlAttributes, styles = {}, icon, globalClasses, metadata, className }) {
  const id = uniqueId ?? uid("carousel-control");
  const isNext = controlType === "next";
  const svg = icon ?? (isNext ? CAROUSEL_ICON_NEXT : CAROUSEL_ICON_PREV);
  const ha = { "data-carousel-control": isNext ? "next" : "prev", ...htmlAttributes };
  const attrs = { uniqueId: id, controlType, iconOnly, tagName, htmlAttributes: ha };
  if (Object.keys(styles).length) { attrs.styles = styles; attrs.css = buildCanonicalCss(`.gb-carousel-control-${id}`, styles); }
  if (globalClasses?.length) attrs.globalClasses = globalClasses;
  if (metadata) attrs.metadata = metadata;
  if (className) attrs.className = className;

  const modifier = `gb-carousel-control--${isNext ? "next" : "previous"}`;
  const cls = ["gb-carousel-control", `gb-carousel-control-${id}`, modifier, ...(globalClasses ?? []), ...(className ? [className] : [])].join(" ");
  const body = `<${tagName} class="${cls}"${htmlAttrString(ha)}><span class="gb-carousel-control-icon">${svg}</span></${tagName}>`;
  return `${delimiter("generateblocks-pro/carousel-control", attrs)}\n${body}\n<!-- /wp:generateblocks-pro/carousel-control -->`;
}

/** Paginación (puntos). El contenido lo rellena el JS del carrusel en tiempo real. */
export function carouselPagination({ uniqueId, tagName = "nav", styles = {}, paginationType = "bullets", htmlAttributes, globalClasses, metadata, className }) {
  const id = uniqueId ?? uid("carousel-pagination");
  const hasStyles = Object.keys(styles).length > 0;
  const ha = { "data-pagination-type": paginationType, ...htmlAttributes };
  const attrs = { uniqueId: id };
  if (hasStyles) { attrs.styles = styles; attrs.css = buildCanonicalCss(`.gb-carousel-pagination-${id}`, styles); }
  attrs.tagName = tagName;
  attrs.htmlAttributes = ha;
  if (globalClasses?.length) attrs.globalClasses = globalClasses;
  if (metadata) attrs.metadata = metadata;
  if (className) attrs.className = className;

  const cls = ["gb-carousel-pagination", ...(hasStyles ? [`gb-carousel-pagination-${id}`] : []), ...(globalClasses ?? []), ...(className ? [className] : [])].join(" ");
  const body = `<${tagName} class="${cls}"${htmlAttrString(ha)}><span class="gb-carousel-pagination-content"></span></${tagName}>`;
  return `${delimiter("generateblocks-pro/carousel-pagination", attrs)}\n${body}\n<!-- /wp:generateblocks-pro/carousel-pagination -->`;
}

/**
 * Botón/enlace con texto: un único bloque `generateblocks/text` con
 * tagName:"a" (href en htmlAttributes, URL ABSOLUTA o "#" placeholder) — NO
 * un `element<a>` envolviendo un `text<span>`. Confirmado por el usuario
 * (2026-08-19) con un export real de GB Pro: el bloque Button es una
 * variante de Text/Headline, un solo bloque plano, sin Container envolvente
 * (revierte la decisión previa "regla 4 de recovery-rules", que resultó
 * incorrecta para GB Pro 2.x — ver CLAUDE.md). `textDecoration:"none"`
 * siempre se añade (los enlaces llevan subrayado por defecto del navegador;
 * un botón nunca lo lleva) — mismo criterio que `margin:"0"` en textStyles().
 */
export function linkButton({ uniqueId, href, label, styles = {}, globalClasses, metadata, icon, iconLocation, htmlAttributes }) {
  if (href !== "#" && !/^https?:\/\//.test(href)) {
    throw new Error(`linkButton: href debe ser URL absoluta o "#" como placeholder explícito (recibido: ${href})`);
  }
  return text({
    uniqueId,
    tagName: "a",
    content: label,
    styles: { textDecoration: "none", ...styles },
    globalClasses,
    htmlAttributes: { href, ...htmlAttributes },
    icon,
    iconLocation,
    metadata,
  });
}

// ---------------------------------------------------------------------------
// GB Pro: Accordion (generateblocks-pro/accordion*) — calibrado contra un
// export real pegado por el usuario (2026-08-19): accordion > accordion-item
// > accordion-toggle (text + accordion-toggle-icon) + accordion-content.
// Iconos por defecto = los mismos SVG (chevron doble) que sirve el editor al
// insertar un Accordion nuevo — copiados literales del export, no regenerados.
// ---------------------------------------------------------------------------
const ACCORDION_ICON_OPEN_DEFAULT = `<svg aria-hidden="true" viewBox="0 0 256 256"><rect width="256" height="256" fill="none" /><polyline points="208 96 128 176 48 96" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="16" /></svg>`;
const ACCORDION_ICON_CLOSE_DEFAULT = `<svg aria-hidden="true" viewBox="0 0 256 256"><rect width="256" height="256" fill="none" /><polyline points="48 160 128 80 208 160" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="16" /></svg>`;

export function accordion({ uniqueId, tagName = "div", styles = {}, globalClasses, htmlAttributes, metadata, className, children = [] }) {
  const id = uniqueId ?? uid("accordion");
  const attrs = { uniqueId: id, tagName };
  if (Object.keys(styles).length) { attrs.styles = styles; attrs.css = buildCanonicalCss(`.gb-accordion-${id}`, styles); }
  if (globalClasses?.length) attrs.globalClasses = globalClasses;
  if (htmlAttributes) attrs.htmlAttributes = htmlAttributes;
  if (metadata) attrs.metadata = metadata;
  if (className) attrs.className = className;

  const cls = classList("generateblocks-pro/accordion", id, attrs);
  const inner = children.filter(Boolean).join("\n\n");
  const open = `<${tagName} class="${cls}"${htmlAttrString(htmlAttributes)}>`;
  const body = inner ? `${open}${inner}</${tagName}>` : `${open}</${tagName}>`;
  return `${delimiter("generateblocks-pro/accordion", attrs)}\n${body}\n<!-- /wp:generateblocks-pro/accordion -->`;
}

export function accordionItem({ uniqueId, tagName = "div", styles = {}, globalClasses, htmlAttributes, metadata, className, children = [] }) {
  const id = uniqueId ?? uid("accordion-item");
  const attrs = { uniqueId: id, tagName };
  if (Object.keys(styles).length) { attrs.styles = styles; attrs.css = buildCanonicalCss(`.gb-accordion__item-${id}`, styles); }
  if (globalClasses?.length) attrs.globalClasses = globalClasses;
  if (htmlAttributes) attrs.htmlAttributes = htmlAttributes;
  if (metadata) attrs.metadata = metadata;
  if (className) attrs.className = className;

  const cls = classList("generateblocks-pro/accordion-item", id, attrs);
  const inner = children.filter(Boolean).join("\n\n");
  const open = `<${tagName} class="${cls}"${htmlAttrString(htmlAttributes)}>`;
  const body = inner ? `${open}${inner}</${tagName}>` : `${open}</${tagName}>`;
  return `${delimiter("generateblocks-pro/accordion-item", attrs)}\n${body}\n<!-- /wp:generateblocks-pro/accordion-item -->`;
}

/** Fila clicable (título + icono). `uniqueId` propio genera el id HTML `gb-accordion-toggle-{id}`
 * (no referencia el id de accordion-content — cada bloque lleva su propio id independiente,
 * igual que en el export real). */
export function accordionToggle({ uniqueId, tagName = "div", styles = {}, globalClasses, htmlAttributes, metadata, className, children = [] }) {
  const id = uniqueId ?? uid("accordion-toggle");
  const ha = { id: `gb-accordion-toggle-${id}`, ...htmlAttributes };
  const attrs = { uniqueId: id, tagName };
  if (Object.keys(styles).length) { attrs.styles = styles; attrs.css = buildCanonicalCss(`.gb-accordion__toggle-${id}`, styles); }
  if (globalClasses?.length) attrs.globalClasses = globalClasses;
  attrs.htmlAttributes = ha;
  if (metadata) attrs.metadata = metadata;
  if (className) attrs.className = className;

  const cls = classList("generateblocks-pro/accordion-toggle", id, attrs);
  const inner = children.filter(Boolean).join("\n\n");
  const body = `<${tagName} class="${cls}"${htmlAttrString(ha)}>${inner}</${tagName}>`;
  return `${delimiter("generateblocks-pro/accordion-toggle", attrs)}\n${body}\n<!-- /wp:generateblocks-pro/accordion-toggle -->`;
}

/** Icono de apertura/cierre: DOS spans (open/close), el CSS del tema muestra uno
 * u otro según el estado — nunca uno solo. Si Figma solo da un icono (habitual,
 * solo mockea el estado cerrado), se usa el mismo para open y close. */
export function accordionToggleIcon({ uniqueId, tagName = "span", styles = {}, openIcon, closeIcon, globalClasses, metadata, className }) {
  const id = uniqueId ?? uid("accordion-toggle-icon");
  const attrs = { uniqueId: id, tagName };
  if (Object.keys(styles).length) { attrs.styles = styles; attrs.css = buildCanonicalCss(`.gb-accordion__toggle-icon-${id}`, styles); }
  if (globalClasses?.length) attrs.globalClasses = globalClasses;
  if (metadata) attrs.metadata = metadata;
  if (className) attrs.className = className;

  const cls = classList("generateblocks-pro/accordion-toggle-icon", id, attrs);
  const openSvg = openIcon ?? ACCORDION_ICON_OPEN_DEFAULT;
  const closeSvg = closeIcon ?? ACCORDION_ICON_CLOSE_DEFAULT;
  const body = `<${tagName} class="${cls}"><span class="gb-accordion__toggle-icon-open">${openSvg}</span><span class="gb-accordion__toggle-icon-close">${closeSvg}</span></${tagName}>`;
  return `${delimiter("generateblocks-pro/accordion-toggle-icon", attrs)}\n${body}\n<!-- /wp:generateblocks-pro/accordion-toggle-icon -->`;
}

/** Contenido colapsable. `uniqueId` propio genera `gb-accordion-content-{id}` (independiente del toggle). */
export function accordionContent({ uniqueId, tagName = "div", styles = {}, globalClasses, htmlAttributes, metadata, className, children = [] }) {
  const id = uniqueId ?? uid("accordion-content");
  const ha = { id: `gb-accordion-content-${id}`, ...htmlAttributes };
  const attrs = { uniqueId: id, tagName };
  if (Object.keys(styles).length) { attrs.styles = styles; attrs.css = buildCanonicalCss(`.gb-accordion__content-${id}`, styles); }
  if (globalClasses?.length) attrs.globalClasses = globalClasses;
  attrs.htmlAttributes = ha;
  if (metadata) attrs.metadata = metadata;
  if (className) attrs.className = className;

  const cls = classList("generateblocks-pro/accordion-content", id, attrs);
  const inner = children.filter(Boolean).join("\n\n");
  const body = `<${tagName} class="${cls}"${htmlAttrString(ha)}>${inner}</${tagName}>`;
  return `${delimiter("generateblocks-pro/accordion-content", attrs)}\n${body}\n<!-- /wp:generateblocks-pro/accordion-content -->`;
}

// ---------------------------------------------------------------------------
// GB Pro: Tabs (generateblocks-pro/tabs*) — calibrado contra un export real
// pegado por el usuario (2026-08-19): tabs > tabs-menu > tab-menu-item(xN) +
// tab-items > tab-item(xN). SOLO el emisor está calibrado; la detección
// automática desde Figma queda pendiente (sin ejemplo real de capas de Figma
// para Tabs todavía — ver CLAUDE.md).
// ---------------------------------------------------------------------------
export function tabs({ uniqueId, tagName = "div", styles = {}, openedTab = 1, globalClasses, htmlAttributes, metadata, className, children = [] }) {
  const id = uniqueId ?? uid("tabs");
  const ha = { "data-opened-tab": String(openedTab), ...htmlAttributes };
  const attrs = { uniqueId: id, tagName };
  if (Object.keys(styles).length) { attrs.styles = styles; attrs.css = buildCanonicalCss(`.gb-tabs-${id}`, styles); }
  if (globalClasses?.length) attrs.globalClasses = globalClasses;
  attrs.htmlAttributes = ha;
  if (metadata) attrs.metadata = metadata;
  if (className) attrs.className = className;

  const cls = classList("generateblocks-pro/tabs", id, attrs);
  const inner = children.filter(Boolean).join("\n\n");
  const body = `<${tagName} class="${cls}"${htmlAttrString(ha)}>${inner}</${tagName}>`;
  return `${delimiter("generateblocks-pro/tabs", attrs)}\n${body}\n<!-- /wp:generateblocks-pro/tabs -->`;
}

export function tabsMenu({ uniqueId, tagName = "div", styles = {}, globalClasses, htmlAttributes, metadata, className, children = [] }) {
  const id = uniqueId ?? uid("tabs-menu");
  const ha = { role: "tablist", ...htmlAttributes };
  const attrs = { uniqueId: id, tagName };
  if (Object.keys(styles).length) { attrs.styles = styles; attrs.css = buildCanonicalCss(`.gb-tabs__menu-${id}`, styles); }
  if (globalClasses?.length) attrs.globalClasses = globalClasses;
  attrs.htmlAttributes = ha;
  if (metadata) attrs.metadata = metadata;
  if (className) attrs.className = className;

  const cls = classList("generateblocks-pro/tabs-menu", id, attrs);
  const inner = children.filter(Boolean).join("\n\n");
  const body = `<${tagName} class="${cls}"${htmlAttrString(ha)}>${inner}</${tagName}>`;
  return `${delimiter("generateblocks-pro/tabs-menu", attrs)}\n${body}\n<!-- /wp:generateblocks-pro/tabs-menu -->`;
}

/** `isOpen` marca la pestaña abierta por defecto — debe coincidir con `openedTab` de `tabs()` (1-indexado). */
export function tabMenuItem({ uniqueId, tagName = "div", styles = {}, isOpen = false, globalClasses, htmlAttributes, metadata, className, children = [] }) {
  const id = uniqueId ?? uid("tab-menu-item");
  const ha = { role: "tab", id: `gb-tab-menu-item-${id}`, ...htmlAttributes };
  const attrs = { uniqueId: id, tagName };
  if (Object.keys(styles).length) { attrs.styles = styles; attrs.css = buildCanonicalCss(`.gb-tabs__menu-item-${id}`, styles); }
  if (globalClasses?.length) attrs.globalClasses = globalClasses;
  attrs.htmlAttributes = ha;
  if (isOpen) attrs.tabItemOpen = true;
  if (metadata) attrs.metadata = metadata;
  if (className) attrs.className = className;

  const cls = classList("generateblocks-pro/tab-menu-item", id, attrs);
  const inner = children.filter(Boolean).join("\n\n");
  const body = `<${tagName} class="${cls}"${htmlAttrString(ha)}>${inner}</${tagName}>`;
  return `${delimiter("generateblocks-pro/tab-menu-item", attrs)}\n${body}\n<!-- /wp:generateblocks-pro/tab-menu-item -->`;
}

export function tabItems({ uniqueId, tagName = "div", styles = {}, globalClasses, htmlAttributes, metadata, className, children = [] }) {
  const id = uniqueId ?? uid("tab-items");
  const attrs = { uniqueId: id, tagName };
  if (Object.keys(styles).length) { attrs.styles = styles; attrs.css = buildCanonicalCss(`.gb-tabs__items-${id}`, styles); }
  if (globalClasses?.length) attrs.globalClasses = globalClasses;
  if (htmlAttributes) attrs.htmlAttributes = htmlAttributes;
  if (metadata) attrs.metadata = metadata;
  if (className) attrs.className = className;

  const cls = classList("generateblocks-pro/tab-items", id, attrs);
  const inner = children.filter(Boolean).join("\n\n");
  const open = `<${tagName} class="${cls}"${htmlAttrString(htmlAttributes)}>`;
  const body = inner ? `${open}${inner}</${tagName}>` : `${open}</${tagName}>`;
  return `${delimiter("generateblocks-pro/tab-items", attrs)}\n${body}\n<!-- /wp:generateblocks-pro/tab-items -->`;
}

/** `isOpen` marca el panel visible por defecto — debe coincidir con el `tabMenuItem` correspondiente. */
export function tabItem({ uniqueId, tagName = "div", styles = {}, isOpen = false, globalClasses, htmlAttributes, metadata, className, children = [] }) {
  const id = uniqueId ?? uid("tab-item");
  const ha = { role: "tabpanel", id: `gb-tab-item-${id}`, ...htmlAttributes };
  const attrs = { uniqueId: id, tagName };
  if (Object.keys(styles).length) { attrs.styles = styles; attrs.css = buildCanonicalCss(`.gb-tabs__item-${id}`, styles); }
  if (globalClasses?.length) attrs.globalClasses = globalClasses;
  attrs.htmlAttributes = ha;
  if (isOpen) attrs.tabItemOpen = true;
  if (metadata) attrs.metadata = metadata;
  if (className) attrs.className = className;

  const cls = classList("generateblocks-pro/tab-item", id, attrs);
  const inner = children.filter(Boolean).join("\n\n");
  const body = `<${tagName} class="${cls}"${htmlAttrString(ha)}>${inner}</${tagName}>`;
  return `${delimiter("generateblocks-pro/tab-item", attrs)}\n${body}\n<!-- /wp:generateblocks-pro/tab-item -->`;
}

// ---------------------------------------------------------------------------
// GB Pro: Site Header / Navigation — VERIFICADO el 3/09/2026 contra un export
// real de WordPress (post 49656 "Site header ejemplo Claude", un patrón
// oficial de patterns.generatepress.com pegado por el usuario como Elemento
// GeneratePress; leído del post_content REAL vía wp-cli, no del panel del
// editor). Resuelve el trabajo a mano que hacía `header.mjs`/`footer.mjs` de
// WEB ACELIA (nav como `<ul><li>` planos + `display:none` a un breakpoint sin
// alternativa móvil): `Navigation` trae hamburguesa, panel móvil y
// visibilidad por dispositivo de fábrica, sin CSS a mano — ver trampa #9 del
// SKILL y el hallazgo previo en la memoria del proyecto.
// ---------------------------------------------------------------------------

/** Contenedor que reemplaza el header por defecto de GeneratePress. Normalmente envuelve un `navigation()`. */
export function siteHeader({ uniqueId, tagName = "header", styles = {}, globalClasses, htmlAttributes, metadata, className, children = [] }) {
  const id = uniqueId ?? uid("site-header");
  const attrs = { uniqueId: id };
  if (Object.keys(styles).length) { attrs.styles = styles; attrs.css = buildCanonicalCss(`.gb-site-header-${id}`, styles); }
  attrs.tagName = tagName;
  if (globalClasses?.length) attrs.globalClasses = globalClasses;
  if (htmlAttributes) attrs.htmlAttributes = htmlAttributes;
  if (metadata) attrs.metadata = metadata;
  if (className) attrs.className = className;

  const cls = classList("generateblocks-pro/site-header", id, attrs);
  const inner = children.filter(Boolean).join("\n\n");
  const body = `<${tagName} class="${cls}"${htmlAttrString(htmlAttributes)}>${inner}</${tagName}>`;
  return `${delimiter("generateblocks-pro/site-header", attrs)}\n${body}\n<!-- /wp:generateblocks-pro/site-header -->`;
}

/**
 * El menú en sí. `htmlAttributes` es donde vive el comportamiento móvil —
 * `data-gb-mobile-breakpoint` (px) y `data-gb-mobile-menu-type` (p.ej.
 * "full-overlay") — GB los lee en el front sin JS propio del proyecto.
 * children típicos: media() del logo, un menuToggle(), un menuContainer().
 */
export function navigation({ uniqueId, tagName = "nav", styles = {}, htmlAttributes, globalClasses, metadata, className, children = [] }) {
  const id = uniqueId ?? uid("navigation");
  const attrs = { uniqueId: id, tagName };
  if (Object.keys(styles).length) { attrs.styles = styles; attrs.css = buildCanonicalCss(`.gb-navigation-${id}`, styles); }
  if (htmlAttributes) attrs.htmlAttributes = htmlAttributes;
  if (globalClasses?.length) attrs.globalClasses = globalClasses;
  if (metadata) attrs.metadata = metadata;
  if (className) attrs.className = className;

  const cls = classList("generateblocks-pro/navigation", id, attrs);
  const inner = children.filter(Boolean).join("\n\n");
  const body = `<${tagName} class="${cls}"${htmlAttrString(htmlAttributes)}>${inner}</${tagName}>`;
  return `${delimiter("generateblocks-pro/navigation", attrs)}\n${body}\n<!-- /wp:generateblocks-pro/navigation -->`;
}

/* Iconos hamburguesa/cerrar por defecto del `menu-toggle` de GB Pro — copiados
   LITERALES del export real (post 49656). No son un icon set propio del
   proyecto: son el SVG que GB inyecta cuando no se sobreescribe el icono. */
const MENU_TOGGLE_OPEN_ICON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="none"></rect><line x1="40" y1="128" x2="216" y2="128" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="12"></line><line x1="40" y1="64" x2="216" y2="64" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="12"></line><line x1="40" y1="192" x2="216" y2="192" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="12"></line></svg>';
const MENU_TOGGLE_CLOSE_ICON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="none"></rect><line x1="200" y1="56" x2="56" y2="200" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"></line><line x1="200" y1="200" x2="56" y2="56" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"></line></svg>';

/** Botón hamburguesa. `htmlAttributes` va ANTES de `tagName` en el orden canónico — verificado, no es un descuido. */
export function menuToggle({ uniqueId, tagName = "button", styles = {}, htmlAttributes = { "aria-label": "Menu" }, iconOnly = true, globalClasses, metadata, className }) {
  const id = uniqueId ?? uid("menu-toggle");
  const attrs = { uniqueId: id };
  if (Object.keys(styles).length) { attrs.styles = styles; attrs.css = buildCanonicalCss(`.gb-menu-toggle-${id}`, styles); }
  if (htmlAttributes) attrs.htmlAttributes = htmlAttributes;
  attrs.tagName = tagName;
  if (iconOnly) attrs.iconOnly = iconOnly;
  if (globalClasses?.length) attrs.globalClasses = globalClasses;
  if (metadata) attrs.metadata = metadata;
  if (className) attrs.className = className;

  const cls = classList("generateblocks-pro/menu-toggle", id, attrs);
  const body = `<${tagName} class="${cls}"${htmlAttrString(htmlAttributes)}><span class="gb-menu-open-icon">${MENU_TOGGLE_OPEN_ICON}</span><span class="gb-menu-close-icon">${MENU_TOGGLE_CLOSE_ICON}</span></${tagName}>`;
  return `${delimiter("generateblocks-pro/menu-toggle", attrs)}\n${body}\n<!-- /wp:generateblocks-pro/menu-toggle -->`;
}

/**
 * Panel que agrupa lo que se muestra/oculta al abrir el menú móvil. El
 * estado "abierto en móvil" se estiliza con la pseudo-clase compuesta
 * `"&.gb-menu-container--mobile"` como clave de `styles` (soportada ya por
 * `buildCanonicalCss` vía el prefijo "&") — GB alterna esa clase por JS
 * propio, sin que el proyecto tenga que escribirlo. Los hijos que solo deben
 * verse en el panel móvil llevan `className:"gb-menu-show-on-toggled"`; los
 * que deben desaparecer, `"gb-menu-hide-on-toggled"` (ver el ejemplo real:
 * "Nav Items" los oculta, "Overlay Header"/"Overlay Items" los muestran).
 */
export function menuContainer({ uniqueId, tagName = "div", styles = {}, globalClasses, htmlAttributes, metadata, className, children = [] }) {
  const id = uniqueId ?? uid("menu-container");
  const attrs = { uniqueId: id };
  if (Object.keys(styles).length) { attrs.styles = styles; attrs.css = buildCanonicalCss(`.gb-menu-container-${id}`, styles); }
  attrs.tagName = tagName;
  if (globalClasses?.length) attrs.globalClasses = globalClasses;
  if (htmlAttributes) attrs.htmlAttributes = htmlAttributes;
  if (metadata) attrs.metadata = metadata;
  if (className) attrs.className = className;

  const cls = classList("generateblocks-pro/menu-container", id, attrs);
  const inner = children.filter(Boolean).join("\n\n");
  const body = `<${tagName} class="${cls}"${htmlAttrString(htmlAttributes)}>${inner}</${tagName}>`;
  return `${delimiter("generateblocks-pro/menu-container", attrs)}\n${body}\n<!-- /wp:generateblocks-pro/menu-container -->`;
}

function selfClosingDelimiter(blockName, attrs) {
  const ordered = orderAttrs(blockName, attrs);
  return `<!-- wp:${blockName} ${serializeBlockAttributes(ordered)} /-->`;
}

/**
 * Referencia a un menú REAL de WordPress por su ID numérico (`menu`, como
 * string — el export lo lleva así: `"menu":"5"`). Bloque DINÁMICO: a
 * diferencia de todo lo demás en este fichero, no imprime su propio HTML —
 * WordPress renderiza el `<ul>`/`<li>` real en tiempo de render a partir del
 * menú referenciado, así que el post_content SOLO lleva los tres
 * delimitadores (sin cuerpo, sin cierre con contenido). `item`/`subMenu` son
 * plantillas de estilo — `itemStyles` para cada `<li>` y `subMenuStyles` para
 * el desplegable — que van DENTRO del delimitador de `classicMenu`, nunca como
 * `children` de otro bloque.
 *
 * OJO con los uniqueId de esas dos plantillas: NO son libres. El `<li>` que
 * pinta WordPress lleva la clase `gb-menu-item-` + el uniqueId DEL MENÚ con
 * sus dos primeros caracteres sustituidos por `mi`, y el `<ul>` del submenú lo
 * mismo con `sm` (`class-classic-menu.php` líneas 170 y 256:
 * `substr_replace($unique_id, 'mi', 0, 2)`). Si a las plantillas se les deja
 * un uniqueId propio —lo que hacía este emisor hasta el 4/09/2026— el CSS sale
 * con un selector que no existe en el HTML y los estilos del menú
 * sencillamente no se aplican, sin ningún error. Por eso los ids se derivan
 * aquí y `classicMenuItem`/`classicSubMenu` exigen recibirlos.
 */
export function classicMenu({ uniqueId, menu, styles = {}, itemStyles, subMenuStyles }) {
  const id = uniqueId ?? uid("classic-menu");
  const attrs = { menu: String(menu), uniqueId: id };
  if (Object.keys(styles).length) { attrs.styles = styles; attrs.css = buildCanonicalCss(`.gb-menu-${id}`, styles); }

  const derivar = (prefijo) => prefijo + id.slice(2);
  const inner = [
    itemStyles && classicMenuItem({ uniqueId: derivar("mi"), styles: itemStyles }),
    subMenuStyles && classicSubMenu({ uniqueId: derivar("sm"), styles: subMenuStyles }),
  ].filter(Boolean).join("\n\n");

  return `${delimiter("generateblocks-pro/classic-menu", attrs)}\n${inner}\n<!-- /wp:generateblocks-pro/classic-menu -->`;
}

/** Plantilla de estilo de cada `<li>`. Autocierra, sin HTML propio. `uniqueId` obligatorio: lo deriva `classicMenu`. */
export function classicMenuItem({ uniqueId, styles = {} }) {
  if (!uniqueId) throw new Error("classicMenuItem: uniqueId obligatorio (se deriva del menú: 'mi' + id.slice(2)). Usa classicMenu({ itemStyles }).");
  const attrs = { uniqueId };
  if (Object.keys(styles).length) { attrs.styles = styles; attrs.css = buildCanonicalCss(`.gb-menu-item-${uniqueId}`, styles); }
  return selfClosingDelimiter("generateblocks-pro/classic-menu-item", attrs);
}

/** Plantilla de estilo del submenú desplegable. Autocierra. `uniqueId` obligatorio: lo deriva `classicMenu`. */
export function classicSubMenu({ uniqueId, styles = {} }) {
  if (!uniqueId) throw new Error("classicSubMenu: uniqueId obligatorio (se deriva del menú: 'sm' + id.slice(2)). Usa classicMenu({ subMenuStyles }).");
  const attrs = { uniqueId };
  if (Object.keys(styles).length) { attrs.styles = styles; attrs.css = buildCanonicalCss(`.gb-sub-menu-${uniqueId}`, styles); }
  return selfClosingDelimiter("generateblocks-pro/classic-sub-menu", attrs);
}
