/**
 * gbp-global-styles.mjs — referencia GB Pro v2 "New Patterns Library".
 *
 * Fuente: guía de estilos globales de Pro Patterns (GenerateBlocks Pro 2.x),
 * pegada por el usuario el 2026-08-19. La librería de patrones de GB Pro
 * reparte sus estilos en 3 capas:
 *   1. Theme Styles — familias tipográficas y color de H1/H2/párrafo, vienen
 *      del Customizador de GeneratePress. Este proyecto NUNCA las pisa.
 *   2. Local Styles — estilos puntuales por bloque (fondo de imagen de
 *      sección; Sizing > Max Width del inner usando la Global Max Width).
 *   3. Global Styles — las clases gbp-* de abajo, compartidas en todo el sitio.
 *
 * REGLA DE USO (ver convert-frame.mjs): los estilos LOCALES calculados a
 * partir de Figma (colores, tamaños exactos) SIEMPRE se emiten igual — la
 * clase gbp-* es aditiva/organizativa (identidad compartida en el editor,
 * y le da a GenerateBlocks Pro la misma taxonomía que usan sus propios
 * patrones), nunca sustituye un valor real extraído del diseño. Cero valores
 * inventados — ver META del usuario: fiabilidad de conversión ante todo.
 *
 * Pendiente/no cubierto todavía (sin señal fiable en Figma para detectarlo
 * automáticamente — ver CLAUDE.md): gbp-card / gbp-card__* / gbp-overlay-panel.
 */

export const GBP_CLASSES = {
  "gbp-button--primary": {
    category: "buttons",
    label: "Botón primario",
    css: ".gbp-button--primary { display:inline-flex; font-size:1rem; padding:0.75rem 1.5rem; border:1px solid; background-color:#000000; color:#ffffff; }",
  },
  "gbp-button--secondary": {
    category: "buttons",
    label: "Botón secundario",
    css: ".gbp-button--secondary { display:inline-flex; font-size:1rem; padding:0.75rem 1.5rem; border:1px solid #000000; color:currentColor; }",
  },
  "gbp-section": {
    category: "sections",
    label: "Sección",
    css: ".gbp-section { padding:7rem 40px; } @media (max-width:1024px){ .gbp-section{padding:6rem 30px} } @media (max-width:767px){ .gbp-section{padding:4rem 20px} }",
  },
  "gbp-section__inner": {
    category: "sections",
    label: "Sección — Interior",
    css: ".gbp-section__inner { margin-left:auto; margin-right:auto; max-width:var(--gb-container-width); position:relative; z-index:1; }",
  },
  "gbp-section__headline": {
    category: "sections",
    label: "Sección — Titular",
    css: ".gbp-section__headline { margin-bottom:1.5rem; } @media (max-width:767px){ .gbp-section__headline{margin-bottom:1.25rem} }",
  },
  "gbp-section__tagline": {
    category: "sections",
    label: "Sección — Tagline",
    css: ".gbp-section__tagline { font-size:1rem; font-weight:600; margin-bottom:0.75rem; }",
  },
  "gbp-section__text": {
    category: "sections",
    label: "Sección — Texto",
    css: ".gbp-section__text { font-size:1.125rem; }",
  },
  "gbp-card": {
    category: "cards",
    label: "Tarjeta",
    css: ".gbp-card { padding:1.5rem; } @media (max-width:767px){ .gbp-card{padding:1.25rem} }",
  },
  "gbp-card--border": {
    category: "cards",
    label: "Tarjeta — con borde",
    css: ".gbp-card--border { border:1px solid #000000; }",
  },
  "gbp-card__title": {
    category: "cards",
    label: "Tarjeta — Título",
    css: ".gbp-card__title { font-size:1.25rem; margin-bottom:0.5rem; }",
  },
  "gbp-card__text": {
    category: "cards",
    label: "Tarjeta — Texto",
    css: ".gbp-card__text { font-size:1rem; margin-bottom:0px; }",
  },
  "gbp-card__meta-text": {
    category: "cards",
    label: "Tarjeta — Meta",
    css: ".gbp-card__meta-text { font-size:0.875rem; margin-bottom:0.5rem; }",
  },
  "gbp-footer": {
    category: "footer",
    label: "Footer",
    css: ".gbp-footer { font-size:0.875rem; padding:5rem 40px } .gbp-footer a { font-size:0.875rem } @media (max-width:1024px){ .gbp-footer{padding:4rem 30px} } @media (max-width:767px){ .gbp-footer{padding:3rem 20px} }",
  },
  "gbp-footer__title": {
    category: "footer",
    label: "Footer — Título",
    css: ".gbp-footer__title { font-size:1rem; font-weight:700; margin-bottom:1rem }",
  },
  "gbp-footer__link": {
    category: "footer",
    label: "Footer — Enlace",
    css: ".gbp-footer__link { display:block; padding-bottom:0.375rem; padding-top:0.375rem }",
  },
  "gbp-overlay-panel": {
    category: "overlay",
    label: "Panel superpuesto",
    css: ".gbp-overlay-panel { background-color:#ffffff; box-shadow:0 2px 4px rgba(0,0,0,0.06),0 8px 16px rgba(0,0,0,0.1) }",
  },
  "gbp-overlay-panel__close": {
    category: "overlay",
    label: "Panel superpuesto — Cerrar",
    css: ".gbp-overlay-panel__close { align-items:center; background-color:var(--base-3); color:#000000; column-gap:0.5em; display:inline-flex; padding:8px } .gbp-overlay-panel__close:is(:hover,:focus){ background-color:#000000; color:#ffffff } .gbp-overlay-panel__close .gb-shape svg{ width:16px; height:16px; fill:currentColor }",
  },
};

/** Etiqueta legible de una clase gbp-* (para renombrar la capa en el editor). */
export const labelFor = (gbpClass) => GBP_CLASSES[gbpClass]?.label ?? gbpClass;

const GENERIC_NAME_RE = /^(frame|group|rectangle|vector|ellipse|component|instance)\s*\d*$/i;

/**
 * Nombre de capa que conserva el nombre real de Figma (contenido de negocio:
 * "CTA Header", "Testimonial"...) y le añade la etiqueta estructural
 * detectada, sin perder ninguno de los dos — "intenta renombrar siguiendo
 * este marcado" sin destruir el nombre que ya tenía sentido. Si el nombre de
 * Figma está vacío, es genérico ("Frame 43") o ya coincide con la etiqueta,
 * se usa solo la etiqueta.
 */
/**
 * Si el nombre de una capa de Figma ES LITERALMENTE una clase gbp-* de la
 * taxonomía (el usuario ya nombra sus capas así, ej. "gbp-card--border",
 * "gbp-button--primary", "gbp-section__headline" — visto por primera vez el
 * 2026-08-19 en su extracción real "(IA) Inicio - Ayuntamiento..."), es la
 * señal más fuerte posible: intención explícita del usuario, no inferencia.
 * Nunca inventa nada que no esté en GBP_CLASSES. "gbp-card--border" incluye
 * también la clase base "gbp-card" (el modificador solo no trae el padding
 * — así se usan juntos en el ejemplo real de GB Pro, ver
 * ejemplos patters gnerateblock pro v2/background-image-with-content.json).
 */
export function matchLiteralGbp(figmaName) {
  const raw = (figmaName ?? "").trim().toLowerCase();
  if (!raw || !GBP_CLASSES[raw]) return null;
  const classes = raw === "gbp-card--border" ? ["gbp-card", "gbp-card--border"] : [raw];
  return { classes, label: labelFor(raw) };
}

export function structuralName(figmaName, roleLabel) {
  const clean = (figmaName ?? "").trim();
  if (!clean || GENERIC_NAME_RE.test(clean)) return roleLabel;
  if (clean.toLowerCase().startsWith(roleLabel.toLowerCase())) return clean; // ya lo dice ("Footer / 1 /" + "Footer")
  return `${clean} — ${roleLabel}`;
}
