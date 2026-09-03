#!/usr/bin/env node
/**
 * qa-run.mjs — Orquestador de QA de la Semana 2.
 *
 * Ejecuta las puertas de calidad en orden, deteniéndose en la primera que falle:
 *   0. Publicado  (qa-contrato-publicado, si --url; tokens y fuentes que resuelven)
 *   1. Estática   (validate-blocks, siempre; offline)
 *   2. Round-trip (wp-roundtrip, si hay credenciales WP)
 *   3. Editor     (qa-editor-check, si --sitio; abre el wp-admin real)
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
import path from "node:path";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);
const file = args[0];
if (!file || file.startsWith("--")) { console.error("Uso: node scripts/qa-run.mjs pagina.html [--url <permalink> --tokens-css x.tokens.css] [--sitio \"<app/public>\" --puerto N] [--tokens map.json] [--figma key node]"); process.exit(2); }
const has = (f) => args.includes(f);
const val = (f) => { const i = args.indexOf(f); return i !== -1 ? args[i + 1] : null; };
/* `new URL(".", import.meta.url).pathname` devuelve "/C:/TRABAJOS/..." en
   Windows, y al concatenar sale "C:\\C:\\TRABAJOS...": el orquestador NUNCA
   habia funcionado en esta maquina, y por eso nadie lo usaba. Se descubrio el
   2/09/2026 al cablearle el paso 0. fileURLToPath es lo correcto. */
const dir = path.dirname(fileURLToPath(import.meta.url)) + path.sep;

/* Hay tres desenlaces, no dos, y confundirlos hace daño:
     0 = la puerta pasa
     1 = la puerta FALLA — se para aquí
     2 = la puerta no se pudo ejecutar (el sitio parado, una credencial que
         falta). No es un fallo de fidelidad y no debe pararlo todo, pero
         tampoco cuenta como aprobado: la cadena queda incompleta y se dice al
         final, para que nadie entregue creyendo que pasó entera. */
const noComprobado = [];

const step = (title, cmd, cmdArgs) => {
  console.error(`\n──────── ${title} ────────`);
  const r = spawnSync("node", [dir + cmd, ...cmdArgs], { stdio: "inherit" });
  if (r.status === 2) { noComprobado.push(title); return; }
  if (r.status !== 0) { console.error(`\n✖ Puerta fallida: ${title}. Corrige antes de continuar.`); process.exit(1); }
};

// 0. ¿Llegó el contrato al navegador? (si hay una URL servida)
// Va PRIMERO a propósito: si los tokens o las fuentes no resuelven, el resto de
// las puertas dará verde sobre una página que se ve mal. Es el fallo que este
// flujo cometió dos veces —declarar no es publicar— sin que nadie lo viera.
const urlPublicada = val("--url");
if (urlPublicada) {
  const cArgs = [urlPublicada];
  if (val("--tokens-css")) cArgs.push("--tokens", val("--tokens-css"));
  step("0/5 Contrato publicado (tokens y fuentes)", "qa-contrato-publicado.mjs", cArgs);
} else {
  console.error("\n──────── 0/5 Contrato publicado ────────\n  ⏭ Omitido (añade --url <permalink servido> [--tokens-css x.tokens.css]).");
}

// 1. Estática (siempre)
const staticArgs = [file];
if (val("--tokens")) staticArgs.push("--tokens", val("--tokens"));
step("1/5 Validación estática (recovery-rules)", "validate-blocks.mjs", staticArgs);

// 2. Round-trip REST (si hay credenciales)
if (process.env.WP_URL && process.env.WP_USER && process.env.WP_APP_PASSWORD) {
  step("2/5 Round-trip REST (diff byte a byte)", "wp-roundtrip.mjs", [file]);
} else {
  console.error("\n──────── 2/5 Round-trip REST ────────\n  ⏭ Omitido (sin WP_URL/WP_USER/WP_APP_PASSWORD).");
}

// 3. La ÚNICA capa que ve el «Attempt Recovery». La validación de bloques vive
// en el JavaScript del editor, no en REST ni en el marcado. Medido el 2/09/2026:
// un bloque con un atributo de más en el cuerpo pasa los dos linters Y el
// round-trip, y el editor lo marca inválido. Abre el wp-admin de verdad, y no
// pide ninguna contraseña: WordPress emite su propia cookie de sesión.
if (val("--sitio")) {
  const eArgs = ["--sitio", val("--sitio"), "--file", file];
  if (val("--puerto")) eArgs.push("--puerto", val("--puerto"));
  step("3/5 Validación en el editor real", "qa-editor-check.mjs", eArgs);
} else {
  console.error("\n──────── 3/5 Validación en el editor real ────────\n  ⏭ Omitido (añade --sitio \"<ruta app/public>\" y --puerto N).");
}

// 4. La página contra su diseño, SECCIÓN A SECCIÓN. No por porcentaje de
// píxeles: se midió el 2/09/2026 y daba 51% con la página bien, porque en cuanto
// una sección se desplaza, todo lo que va debajo cuenta como distinto.
if (urlPublicada && val("--diseno")) {
  const vArgs = [urlPublicada, "--diseno", val("--diseno")];
  if (val("--tolerancia")) vArgs.push("--tolerancia", val("--tolerancia"));
  if (val("--sel")) vArgs.push("--sel", val("--sel"));
  if (val("--salida-visual")) vArgs.push("--salida", val("--salida-visual"));
  step("4/5 La página contra su diseño", "qa-visual-diff.mjs", vArgs);
} else {
  console.error("\n──────── 4/5 La página contra su diseño ────────\n  ⏭ Omitido (añade --url y --diseno <fichero.dc.html>).");
}

if (noComprobado.length) {
  console.error("\n⚠ Cadena INCOMPLETA. No se pudo ejecutar: " + noComprobado.join(", ") + ".");
  console.error("  Lo que sí se ejecutó, pasó. Pero esto no es un visto bueno.");
  process.exit(2);
}
console.error("\n✔ Todas las puertas ejecutadas superadas.");
