#!/usr/bin/env node
/**
 * resolver-huerfanos-color.mjs — resuelve colores "huérfanos" (fuera del
 * contrato) contra los tokens base, con la misma medida que ya se hizo A MANO
 * en Fundación Santa Cruz de La Palma (`design/mapa-colores.md`, 15/09/2026):
 * para cada huérfano, prueba cada token solo y cada
 * `color-mix(in srgb, tokenA P%, tokenB)` en pasos de `--paso` puntos, y se
 * queda con el más parecido por **redmean** — la aproximación perceptual de
 * compuphase.com/cmetric.htm, la misma que usa `convert -fuzz` de ImageMagick.
 *
 * Verificado contra la tabla real de ese proyecto: `#45403A` → `muted 40% /
 * ink` da redmean = 1.51, que redondea al Δ = 2 que el documento ya tenía
 * escrito a mano. Es la fórmula que estaba detrás de esas Δ sin que el
 * documento dijera cuál era.
 *
 * Por qué existe: `importar-handoff-diseno` avisa de que un handoff trae HEX
 * fuera del contrato («124 HEX repartidos por 179 bloques», visto en real) y
 * dice qué hacer con ellos en general, pero resolver cada uno contra el
 * contrato —elegir la mejor mezcla de dos tokens— era trabajo manual, color a
 * color. En Fundación SC La Palma fueron 15 huérfanos y una sesión entera.
 * Esto automatiza el paso mecánico; el criterio de si de verdad hace falta el
 * derivado sigue siendo de quien lo lee.
 *
 * Lo que NO hace: contraste WCAG. Un derivado con Δ bajo puede seguir
 * fallando AA sobre su fondo real — compruébalo aparte (ver las "reglas de
 * contraste" del contrato del proyecto).
 *
 * Uso:
 *   node herramientas/resolver-huerfanos-color.mjs <contrato.tokens.json> --huerfanos huerfanos.json
 *   node herramientas/resolver-huerfanos-color.mjs <contrato.tokens.json> "#E0B36A:198" "#8A6220:18"
 *
 * huerfanos.json: [{ "hex": "#E0B36A", "usos": 198 }, ...]   ("usos" es opcional)
 *
 * Opciones:
 *   --paso N       granularidad del porcentaje de mezcla probado (por defecto 5)
 *   --umbral N     Δ por encima del cual se avisa "no entra limpio" (por defecto 30)
 *   -o salida.md   escribe la tabla en vez de imprimirla
 *
 * Node, sin dependencias.
 */
import fs from "node:fs";
import path from "node:path";
import { leerContrato, coloresGlobales } from "./lib-contrato.mjs";

const args = process.argv.slice(2);
const rutaContrato = args[0];
if (!rutaContrato || rutaContrato.startsWith("-")) {
  console.error(`Uso: node herramientas/resolver-huerfanos-color.mjs <contrato.tokens.json> --huerfanos huerfanos.json [--paso 5] [--umbral 30] [-o salida.md]`);
  console.error(`     node herramientas/resolver-huerfanos-color.mjs <contrato.tokens.json> "#E0B36A:198" "#8A6220:18"`);
  process.exit(2);
}
const opt = (n, def = null) => { const i = args.indexOf(n); return i !== -1 ? args[i + 1] : def; };
const rutaHuerfanos = opt("--huerfanos");
const paso = Number(opt("--paso", "5"));
const umbral = Number(opt("--umbral", "30"));
const salida = opt("-o");

/* ── Contrato: solo los tokens base de color. Los modos redefinen los MISMOS
   nombres (ver lib-contrato.mjs) y mezclarlos aquí confundiría qué valor es
   cuál — por eso `coloresGlobales` ya los excluye. ───────────────────────── */
const { tokens } = leerContrato(rutaContrato);
const baseColores = coloresGlobales(tokens); // [{name, slug, color}]
if (baseColores.length < 2) {
  console.error(`✖ El contrato tiene ${baseColores.length} color(es) base. Hacen falta al menos 2 para mezclar.`);
  process.exit(1);
}

const hex2 = (n) => n.toString(16).padStart(2, "0");
const aRgb = (hex) => {
  const h = String(hex).replace("#", "").trim();
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(full, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
};
const aHex = ({ r, g, b }) => `#${hex2(Math.round(r))}${hex2(Math.round(g))}${hex2(Math.round(b))}`.toUpperCase();

/* redmean — https://www.compuphase.com/cmetric.htm. Máximo ≈764.83 (≈765)
   entre negro y blanco puros: es el mismo tope que usaba `mapa-colores.md`
   sin nombrar la fórmula. */
function redmean(c1, c2) {
  const rmean = (c1.r + c2.r) / 2;
  const dr = c1.r - c2.r, dg = c1.g - c2.g, db = c1.b - c2.b;
  const suma = (2 + rmean / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rmean) / 256) * db * db;
  return Math.sqrt(suma);
}

/* Interpolación lineal en sRGB directo (0–255), como hace CSS `color-mix(in srgb, …)`. */
const lerp = (c1, c2, p) => ({
  r: c1.r * p + c2.r * (1 - p),
  g: c1.g * p + c2.g * (1 - p),
  b: c1.b * p + c2.b * (1 - p),
});

const paleta = baseColores.map((t) => ({ ...t, rgb: aRgb(t.color) }));

/** Mejor ajuste para un color: token directo, o color-mix de dos tokens. */
function mejorAjuste(objetivo) {
  let mejor = null;
  const anota = (cand) => { if (!mejor || cand.delta < mejor.delta) mejor = cand; };

  for (const t of paleta) {
    anota({ delta: redmean(objetivo, t.rgb), formula: `\`${t.slug}\`` });
  }
  for (let i = 0; i < paleta.length; i++) {
    for (let j = 0; j < paleta.length; j++) {
      if (i === j) continue;
      for (let pct = paso; pct < 100; pct += paso) {
        const mix = lerp(paleta[i].rgb, paleta[j].rgb, pct / 100);
        anota({
          delta: redmean(objetivo, mix),
          formula: `\`${paleta[i].slug} ${pct}% / ${paleta[j].slug}\``,
          css: `color-mix(in srgb, var(--${paleta[i].slug}) ${pct}%, var(--${paleta[j].slug}))`,
        });
      }
    }
  }
  return mejor;
}

/* ── Huérfanos: de un fichero JSON, o de argumentos sueltos "#hex:usos" ──── */
let huerfanos;
if (rutaHuerfanos) {
  huerfanos = JSON.parse(fs.readFileSync(rutaHuerfanos, "utf8"));
} else {
  huerfanos = args.slice(1)
    .filter((a) => a.startsWith("#"))
    .map((a) => {
      const [hex, usos] = a.split(":");
      return { hex, usos: usos ? Number(usos) : null };
    });
}
if (!huerfanos.length) {
  console.error(`✖ No hay huérfanos que resolver. Pásalos con --huerfanos o como argumentos "#hex:usos".`);
  process.exit(2);
}

const filas = huerfanos.map((h) => {
  const rgb = aRgb(h.hex);
  const ajuste = mejorAjuste(rgb);
  return { ...h, ajuste };
});
filas.sort((a, b) => (b.usos ?? 0) - (a.usos ?? 0));

const limpias = filas.filter((f) => f.ajuste.delta <= umbral);
const sucias = filas.filter((f) => f.ajuste.delta > umbral);

const md = [];
md.push(`# Huérfanos resueltos contra ${path.basename(rutaContrato)}`);
md.push("");
md.push(`Paleta base: ${paleta.map((p) => p.slug).join(", ")}. Δ = distancia redmean (máx. ≈765). Paso de mezcla probado: ${paso} puntos. Umbral de "no entra limpio": ${umbral}.`);
md.push("");
md.push("| Original | Usos | Se convierte en | Δ |");
md.push("|---|---|---|---|");
for (const f of limpias) {
  md.push(`| \`${f.hex}\` | ${f.usos ?? "—"} | ${f.ajuste.formula} | **${f.ajuste.delta.toFixed(0)}** |`);
}
if (sucias.length) {
  md.push("");
  md.push(`## No entran limpios (Δ > ${umbral})`);
  md.push("");
  md.push("| Original | Usos | Mejor ajuste posible | Δ |");
  md.push("|---|---|---|---|");
  for (const f of sucias) {
    md.push(`| \`${f.hex}\` | ${f.usos ?? "—"} | ${f.ajuste.formula} | **${f.ajuste.delta.toFixed(0)}** |`);
  }
  md.push("");
  md.push('Antes de declararlos derivados, confirma que de verdad hace falta ese matiz y que no es');
  md.push("un color medido mal en origen. Si se confirma, van al mapa de color del proyecto como");
  md.push("**derivados** (`color-mix` de dos tokens) — nunca como tokens nuevos del contrato.");
}
md.push("");
md.push("**Esto mide parecido de color, no contraste.** Un derivado con Δ bajo puede seguir");
md.push("fallando WCAG AA sobre su fondo real — compruébalo aparte.");
const texto = md.join("\n") + "\n";

if (salida) {
  fs.writeFileSync(salida, texto, "utf8");
  console.log(`✔ ${salida} — ${filas.length} huérfano(s), ${sucias.length} sin ajuste limpio.`);
} else {
  process.stdout.write(texto);
}
