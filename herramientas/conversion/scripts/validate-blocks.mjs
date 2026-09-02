#!/usr/bin/env node
/**
 * validate-blocks.mjs — Linter estático de markup GenerateBlocks v2.
 *
 * Implementa los checks de recovery-rules.md (generateblocks-skills) para
 * detectar ANTES de pegar en WordPress cualquier causa de "Attempt Recovery".
 *
 * Uso:
 *   node scripts/validate-blocks.mjs archivo.html [archivo2.html ...]
 *   node scripts/validate-blocks.mjs --json patrones/home-hero.json   (campo .content de wp_block)
 *
 * Código de salida: 0 = OK, 1 = errores.
 */
import fs from "node:fs";
import { validate } from "../lib/validate.mjs";

const args = process.argv.slice(2);
if (!args.length) {
  console.error("Uso: validate-blocks.mjs [--json] [--tokens tokens/map.json] <archivo> [...]");
  process.exit(2);
}

// Modo estricto de tokens: carga el mapa y prepara el set de valores permitidos.
let allowedValues = null;
const tokIdx = args.indexOf("--tokens");
if (tokIdx !== -1) {
  const mapPath = args[tokIdx + 1];
  args.splice(tokIdx, 2);
  const map = JSON.parse(fs.readFileSync(mapPath, "utf8"));
  allowedValues = new Set();
  for (const group of Object.values(map)) {
    for (const entry of Object.values(group)) {
      if (entry.value) allowedValues.add(String(entry.value).toLowerCase());
      if (entry.px != null) allowedValues.add(`${entry.px}px`);
    }
  }
}

let totalErrors = 0;

for (const file of args.filter((a) => a !== "--json")) {
  const raw = fs.readFileSync(file, "utf8");
  const content = args.includes("--json") || file.endsWith(".json")
    ? extractJsonContent(raw, file)
    : raw;
  const errors = validate(content, allowedValues);
  report(file, errors);
  totalErrors += errors.filter((e) => e.level === "error").length;
}
process.exit(totalErrors ? 1 : 0);

function extractJsonContent(raw, file) {
  try {
    const j = JSON.parse(raw);
    if (typeof j.content === "string") return j.content;
    throw new Error("El JSON no tiene campo 'content' string");
  } catch (e) {
    console.error(`${file}: no se pudo leer como wp_block JSON: ${e.message}`);
    process.exit(2);
  }
}

// ---------------------------------------------------------------------------
function report(file, errors) {
  const errs = errors.filter((e) => e.level === "error");
  const warns = errors.filter((e) => e.level === "warn");
  console.log(`\n== ${file} ==`);
  if (!errors.length) { console.log("  ✔ OK — sin problemas detectados"); return; }
  for (const e of errors) {
    console.log(`  ${e.level === "error" ? "✖" : "⚠"} [${e.rule}] ${e.msg}`);
    if (e.ctx) console.log(`      …${e.ctx}…`);
  }
  console.log(`  ${errs.length} errores, ${warns.length} avisos`);
}
