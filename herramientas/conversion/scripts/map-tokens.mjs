#!/usr/bin/env node
/**
 * map-tokens.mjs — Etapa 2 del pipeline: tokens en dos capas.
 *
 * Entrada: extract/{frame}.variables.json (de extract.mjs) o cualquier JSON
 *          con { normalized: { colors, numbers, strings } }.
 *
 * Salida en ./tokens/ :
 *   map.json                        diccionario variableFigma -> var(--token) (fuente de verdad)
 *   generatepress-global-colors.json   payload para mcp: generatepress/update-settings {global_colors}
 *   theme-tokens.css                :root{--token:valor} de referencia y para --gb-container-width
 *   gb-global-styles.json           andamiaje de Global Styles/Classes de GB Pro (para revisar y guardar)
 *   customizer-checklist.md         pasos manuales de validación en WordPress
 *
 * NO escribe en WordPress. Genera artefactos revisables; la escritura se hace
 * en un paso aparte (mcp-abilities) tras tu validación.
 */
import fs from "node:fs";
import path from "node:path";
import {
  toGeneratePressGlobalColors,
  classifyNumbers,
} from "../lib/tokens.mjs";
import { pxToRem } from "../lib/canonical.mjs";

const inputFile = process.argv[2];
if (!inputFile) {
  console.error("Uso: node scripts/map-tokens.mjs extract/{frame}.variables.json");
  process.exit(2);
}
const data = JSON.parse(fs.readFileSync(inputFile, "utf8"));
const norm = data.normalized ?? data;
if (!norm.colors) { console.error("El JSON no tiene 'normalized.colors'. ¿Es la salida de extract.mjs?"); process.exit(2); }

const outDir = path.resolve("tokens");
fs.mkdirSync(outDir, { recursive: true });

// ---------------------------------------------------------------------------
// Capa de sitio: Global Colors de GeneratePress
// ---------------------------------------------------------------------------
const globalColors = toGeneratePressGlobalColors(norm.colors);

// ---------------------------------------------------------------------------
// Capa de sitio: números (spacing, radius, tipografía, contenedor)
// ---------------------------------------------------------------------------
const buckets = classifyNumbers(norm.numbers ?? []);
const containerWidth = buckets.containerWidth[0]
  ? `${Math.round(buckets.containerWidth[0].value)}px`
  : null;

// ---------------------------------------------------------------------------
// map.json — diccionario canónico variableFigma -> token css
// ---------------------------------------------------------------------------
const map = { colors: {}, spacing: {}, radius: {}, fontSize: {}, lineHeight: {}, container: {} };
for (const c of globalColors) map.colors[c._figmaVar] = { token: `var(--${c.slug})`, value: c.color, needsReview: c._needsReview };
const numToken = (n, prefix) => { map[prefix][n.name] = { token: `var(--${prefix}-${n.slug})`, value: pxToRem(n.value), px: n.value }; };
buckets.spacing.forEach((n) => numToken(n, "spacing"));
buckets.radius.forEach((n) => numToken(n, "radius"));
buckets.fontSize.forEach((n) => numToken(n, "fontSize"));
buckets.lineHeight.forEach((n) => (map.lineHeight[n.name] = { token: `var(--lh-${n.slug})`, value: String(n.value) }));
if (containerWidth) map.container["gb-container-width"] = { token: "var(--gb-container-width)", value: containerWidth };

// ---------------------------------------------------------------------------
// theme-tokens.css — :root de referencia
// ---------------------------------------------------------------------------
const cssLines = [":root{"];
for (const c of globalColors) cssLines.push(`  --${c.slug}:${c.color};`);
buckets.spacing.forEach((n) => cssLines.push(`  --spacing-${n.slug}:${pxToRem(n.value)};`));
buckets.radius.forEach((n) => cssLines.push(`  --radius-${n.slug}:${pxToRem(n.value)};`));
buckets.fontSize.forEach((n) => cssLines.push(`  --fs-${n.slug}:${pxToRem(n.value)};`));
buckets.lineHeight.forEach((n) => cssLines.push(`  --lh-${n.slug}:${n.value};`));
if (containerWidth) cssLines.push(`  --gb-container-width:${containerWidth};`);
cssLines.push("}");
const themeCss = cssLines.join("\n") + "\n";

// ---------------------------------------------------------------------------
// gb-global-styles.json — andamiaje de Global Classes de GB Pro.
// Basado en las clases observadas en tus patrones validados. Los valores
// referencian los tokens del sitio (var(--...)), nunca literales.
// ---------------------------------------------------------------------------
const gbGlobalStyles = {
  _note: "Andamiaje para GB Pro Global Styles/Classes. Revisar y guardar en WP (Appearance > ... > Global Styles). Los estilos usan var(--token) del sitio.",
  classes: {
    "gbp-section": { comment: "Sección full-width", styles: { paddingTop: "var(--spacing-xl,6rem)", paddingBottom: "var(--spacing-xl,6rem)" } },
    "gbp-section--alt": { comment: "Sección con fondo alterno", styles: { backgroundColor: "var(--base-2)" } },
    "gbp-section__inner": { comment: "Contenedor centrado", styles: { marginLeft: "auto", marginRight: "auto", maxWidth: "var(--gb-container-width)", width: "100%" } },
    "gbp-section__headline": { comment: "Titular de sección", styles: { color: "var(--contrast)" } },
    "gbp-section__tagline": { comment: "Antetítulo", styles: { color: "var(--accent)" } },
    "gbp-button--primary": { comment: "Botón primario", styles: { backgroundColor: "var(--accent)", color: "var(--base-3)", "&:is(:hover, :focus)": { backgroundColor: "var(--accent-2)" } } },
    "gbp-button--secondary": { comment: "Botón secundario", styles: { backgroundColor: "var(--base-2)", color: "var(--contrast)" } },
    "gbp-button--tertiary": { comment: "Botón terciario/enlace", styles: { color: "var(--accent)" } },
    "gbp-card": { comment: "Tarjeta", styles: { backgroundColor: "var(--base)", borderRadius: "var(--radius-md,0.5rem)" } },
  },
};

// ---------------------------------------------------------------------------
// customizer-checklist.md — validación manual
// ---------------------------------------------------------------------------
const reviewColors = globalColors.filter((c) => c._needsReview);
const checklist = `# Validación de tokens en WordPress (Semana 1)

Generado desde: \`${path.basename(inputFile)}\`
Colores: ${globalColors.length} · Spacing: ${buckets.spacing.length} · Radios: ${buckets.radius.length} · Tamaños fuente: ${buckets.fontSize.length}
Ancho de contenedor: ${containerWidth ?? "(no detectado — definir a mano)"}

## Capa 1 — GeneratePress (Customizer)

1. Apariencia → Personalizar → Colores → Colores globales. Deben quedar estos slugs con estos valores:

${globalColors.map((c) => `   - \`${c.slug}\` = ${c.color}  (Figma: ${c.name})${c._needsReview ? "  ⚠ REVISAR slug (no es base/contrast/accent)" : ""}`).join("\n")}

   Vía automática: \`generatepress/update-settings\` con el payload \`generatepress-global-colors.json\`.

2. Layout → Container → Content Width = ${containerWidth ?? "(definir)"}. Esto alimenta \`var(--gb-container-width)\`.

3. Tras guardar, verifica en el frontend que \`getComputedStyle(document.documentElement).getPropertyValue('--accent')\` devuelve el color esperado.

${reviewColors.length ? `## ⚠ Colores que requieren tu decisión de slug\n\n${reviewColors.map((c) => `- ${c.name} → propuesto \`${c.slug}\` (${c.color}). Renombra si debe ser base/contrast/accent-N.`).join("\n")}\n` : ""}
## Capa 2 — GenerateBlocks Pro (Global Styles / Global Classes)

1. Revisa \`gb-global-styles.json\`: son las clases \`gbp-*\` que usan tus patrones, con estilos que referencian los tokens del sitio.
2. Créalas/edítalas en GB Pro → Global Styles. IMPORTANTE: si las importas vía WP-CLI/XML, ABRE y GUARDA cada estilo en el editor para que GB las active (no es automático).
3. Verifica que un bloque con \`globalClasses:["gbp-button--primary"]\` toma el color de \`--accent\`.

## Regla de cierre

Ningún patrón debe contener un color o espaciado literal que no aparezca en \`theme-tokens.css\`. Ejecuta el validador en modo estricto (--tokens tokens/map.json) sobre cada patrón para garantizarlo.
`;

// ---------------------------------------------------------------------------
// Escribir artefactos
// ---------------------------------------------------------------------------
const write = (name, content) => {
  const p = path.join(outDir, name);
  fs.writeFileSync(p, typeof content === "string" ? content : JSON.stringify(content, null, 2));
  console.error(`  ✔ tokens/${name}`);
};
write("map.json", map);
write("generatepress-global-colors.json", { settings: {}, global_colors: globalColors.map(({ slug, color, name }) => ({ slug, color, name })) });
write("theme-tokens.css", themeCss);
write("gb-global-styles.json", gbGlobalStyles);
write("customizer-checklist.md", checklist);

console.error(`\n${globalColors.length} colores mapeados${reviewColors.length ? `, ${reviewColors.length} requieren revisión de slug` : ""}.`);
console.error("Revisa tokens/customizer-checklist.md antes de escribir en WordPress.");
