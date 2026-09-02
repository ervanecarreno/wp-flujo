#!/usr/bin/env node
/**
 * qa-run.mjs — Orquestador de QA de la Semana 2.
 *
 * Ejecuta las puertas de calidad en orden, deteniéndose en la primera que falle:
 *   1. Estática   (validate-blocks, siempre; offline)
 *   2. Round-trip (wp-roundtrip, si hay credenciales WP)
 *   3. Editor     (qa-editor-check, si --editor y Playwright)
 *   4. Visual     (qa-visual-diff, si --figma o --ref)
 *
 * Uso:
 *   node scripts/qa-run.mjs pagina.html \
 *     [--tokens tokens/map.json] \
 *     [--editor] \
 *     [--url <permalink-staging> --figma <fileKey> <nodeId>] \
 *     [--threshold 1]
 *
 * Pensado para CI y para pre-publicación. Cada etapa imprime su veredicto.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";

const args = process.argv.slice(2);
const file = args[0];
if (!file || file.startsWith("--")) { console.error("Uso: node scripts/qa-run.mjs pagina.html [--tokens map.json] [--editor] [--url ... --figma key node] [--threshold N]"); process.exit(2); }
const has = (f) => args.includes(f);
const val = (f) => { const i = args.indexOf(f); return i !== -1 ? args[i + 1] : null; };
const dir = new URL(".", import.meta.url).pathname;

const step = (title, cmd, cmdArgs) => {
  console.error(`\n──────── ${title} ────────`);
  const r = spawnSync("node", [dir + cmd, ...cmdArgs], { stdio: "inherit" });
  if (r.status !== 0) { console.error(`\n✖ Puerta fallida: ${title}. Corrige antes de continuar.`); process.exit(1); }
};

// 1. Estática (siempre)
const staticArgs = [file];
if (val("--tokens")) staticArgs.push("--tokens", val("--tokens"));
step("1/4 Validación estática (recovery-rules)", "validate-blocks.mjs", staticArgs);

// 2. Round-trip REST (si hay credenciales)
if (process.env.WP_URL && process.env.WP_USER && process.env.WP_APP_PASSWORD) {
  step("2/4 Round-trip REST (diff byte a byte)", "wp-roundtrip.mjs", [file]);
} else {
  console.error("\n──────── 2/4 Round-trip REST ────────\n  ⏭ Omitido (sin WP_URL/WP_USER/WP_APP_PASSWORD).");
}

// 3. Editor (opcional, requiere Playwright + login)
if (has("--editor")) {
  step("3/4 Validación en editor (Playwright)", "qa-editor-check.mjs", ["--file", file]);
} else {
  console.error("\n──────── 3/4 Validación en editor ────────\n  ⏭ Omitido (añade --editor para la validación fiel del editor).");
}

// 4. Visual (opcional)
const url = val("--url");
if (url && (has("--figma") || has("--ref"))) {
  const vArgs = [url];
  if (has("--figma")) { const i = args.indexOf("--figma"); vArgs.push("--figma", args[i + 1], args[i + 2]); }
  if (has("--ref")) vArgs.push("--ref", val("--ref"));
  if (val("--threshold")) vArgs.push("--threshold", val("--threshold"));
  step("4/4 Diff visual (pixelmatch)", "qa-visual-diff.mjs", vArgs);
} else {
  console.error("\n──────── 4/4 Diff visual ────────\n  ⏭ Omitido (añade --url <permalink> y --figma <key> <node> o --ref ref.png).");
}

console.error("\n✔ Todas las puertas ejecutadas superadas.");
