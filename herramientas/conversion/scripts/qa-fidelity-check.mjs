#!/usr/bin/env node
/**
 * qa-fidelity-check.mjs — comprobación DETERMINISTA de fidelidad (sin IA).
 *
 * Reconvierte un frame ya extraído y verifica, nodo a nodo, que ciertas
 * propiedades de Figma (sizingH:FILL, clipsContent, textAlign) se reflejan
 * de verdad en los estilos generados — ver lib/fidelity-check.mjs para las
 * reglas exactas y de qué bug real nació cada una.
 *
 * Sustituye a la antigua "Auditoría de fidelidad" de la app (que pedía a un
 * LLM revisar el árbol completo a ciegas). Esto no reemplaza la verificación
 * VISUAL (composición, columnas, orden) — para eso sigue haciendo falta un
 * ojo humano o Claude mirando una captura real.
 *
 * Uso:
 *   node scripts/qa-fidelity-check.mjs <frame>        (un frame de extract/)
 *   node scripts/qa-fidelity-check.mjs --all          (todas las extracciones)
 *
 * Código de salida: 0 = sin discrepancias, 1 = se encontraron discrepancias.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { convertFrame } from "../lib/convert-frame.mjs";
import { checkFidelity } from "../lib/fidelity-check.mjs";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const EXTRACT_DIR = path.join(ROOT, "extract");

const args = process.argv.slice(2);
if (!args.length) {
  console.error("Uso: qa-fidelity-check.mjs <frame> | --all");
  process.exit(2);
}

const frames = args[0] === "--all"
  ? fs.readdirSync(EXTRACT_DIR).filter((f) => f.endsWith(".node.json")).map((f) => f.replace(/\.node\.json$/, ""))
  : [args[0]];

let tokenMap = null;
const mapPath = path.join(ROOT, "tokens", "map.json");
if (fs.existsSync(mapPath)) { try { tokenMap = JSON.parse(fs.readFileSync(mapPath, "utf8")); } catch {} }

let totalIssues = 0;

for (const frame of frames) {
  const nodePath = path.join(EXTRACT_DIR, `${frame}.node.json`);
  if (!fs.existsSync(nodePath)) {
    console.error(`✖ No existe extract/${frame}.node.json`);
    process.exitCode = 2;
    continue;
  }
  const node = JSON.parse(fs.readFileSync(nodePath, "utf8"));
  let images = {}, svgs = {};
  const imgPath = path.join(EXTRACT_DIR, `${frame}.images.json`);
  const svgPath = path.join(EXTRACT_DIR, `${frame}.svgs.json`);
  if (fs.existsSync(imgPath)) { try { images = JSON.parse(fs.readFileSync(imgPath, "utf8")); } catch {} }
  if (fs.existsSync(svgPath)) { try { svgs = JSON.parse(fs.readFileSync(svgPath, "utf8")); } catch {} }

  const { fidelityRecords } = convertFrame(node, { tokenMap, images, svgs });
  const issues = checkFidelity(fidelityRecords);
  totalIssues += issues.length;

  console.log(`\n== ${frame} (${fidelityRecords.length} nodos comprobados) ==`);
  if (!issues.length) { console.log("  ✔ OK — sin discrepancias"); continue; }
  for (const i of issues) {
    console.log(`  ⚠ [${i.rule}] «${i.name}» (${i.id}): ${i.detail}`);
  }
  console.log(`  ${issues.length} discrepancia(s)`);
}

console.log(`\nTOTAL: ${totalIssues} discrepancia(s) en ${frames.length} frame(s)`);
process.exit(totalIssues ? 1 : 0);
