#!/usr/bin/env node
/**
 * tokens-a-css.mjs — genera (o verifica) el CSS del contrato a partir del JSON.
 *
 * El contrato de diseño vive en UN fichero: `<sistema>.tokens.json`, en formato
 * W3C / Tokens Studio. El CSS es una DERIVADA, no una segunda fuente.
 *
 * Existe porque la cabecera del CSS del primer proyecto decía, literalmente,
 * «espejo exacto del JSON: si cambias uno, cambia el otro». Eso es sincronizar
 * a mano dos declaraciones de la misma verdad, y es la misma familia de fallo
 * que ya costó dos veces en este flujo: nada avisa cuando divergen. Y de hecho
 * ya habían divergido — el JSON decía `Fraunces` y el CSS `"Fraunces", Georgia,
 * serif`, con la pila de respaldo en un solo lado.
 *
 * Uso:
 *   node herramientas/tokens-a-css.mjs design/x.tokens.json                 (a stdout)
 *   node herramientas/tokens-a-css.mjs design/x.tokens.json -o design/x.tokens.css
 *   node herramientas/tokens-a-css.mjs design/x.tokens.json --verificar design/x.tokens.css
 *
 * `--verificar` no escribe: compara, dice en qué línea difieren y con qué
 * valores, y sale con 1. Es la puerta anti-deriva del contrato.
 *
 * Node, sin dependencias.
 */
import fs from "node:fs";
import path from "node:path";
import { leerContrato, resolverAlias } from "./lib-contrato.mjs";

const args = process.argv.slice(2);
const entrada = args[0];
if (!entrada || entrada.startsWith("-")) {
  console.error("Uso: node herramientas/tokens-a-css.mjs <x.tokens.json> [-o salida.css] [--verificar salida.css]");
  process.exit(2);
}
const opt = (n) => { const i = args.indexOf(n); return i !== -1 ? args[i + 1] : null; };
const salida = opt("-o");
const verificar = opt("--verificar");

const { meta, orden, tokens, porRuta, colisiones, setsAusentes } = leerContrato(entrada);

for (const s of setsAusentes) console.error(`⚠ El set «${s}» está en tokenSetOrder pero no existe en el fichero.`);

/* ── Emisión ──────────────────────────────────────────────────────────────── */

const ROTULOS = {
  radius: "Radio", size: "Control", space: "Espaciado",
  "font-family": "Tipografía", "font-size": "Escala tipográfica",
  bg: "Fondo", text: "Texto", border: "Borde", accent: "Acento", fill: "Relleno",
};

const sinResolver = [];
const lineas = [];
lineas.push("/* GENERADO por herramientas/tokens-a-css.mjs — no editar a mano.");
lineas.push(" * Fuente: " + path.basename(entrada));
if (meta.description) lineas.push(" * " + meta.description);
lineas.push(" *");
lineas.push(" * Para cambiar un valor, cámbialo en el JSON y regenera. Si editas");
lineas.push(" * este fichero, `--verificar` fallará: es lo que se pretende. */");
lineas.push("");
lineas.push(":root {");

let grupoActual = null;
for (const t of tokens) {
  if (t.grupo !== grupoActual) {
    if (grupoActual !== null) lineas.push("");
    lineas.push("  /* " + (ROTULOS[t.grupo] ?? t.grupo) + " */");
    grupoActual = t.grupo;
  }
  const r = resolverAlias(t.valor, porRuta);
  for (const s of r.sinResolver) sinResolver.push({ de: t.ruta, ref: s });
  let v = r.texto;
  /* Una familia con espacios necesita comillas para ser una pila CSS válida. */
  if (t.tipo === "fontFamilies" && /\s/.test(v) && !/["']/.test(v)) v = '"' + v + '"';
  lineas.push("  " + t.nombre + ": " + v + ";");
}

lineas.push("}");
lineas.push("");
const css = lineas.join("\n");

/* ── Lo que invalida el contrato entero ───────────────────────────────────── */

let problemas = 0;
for (const c of colisiones) {
  console.error(`✖ Colisión de nombre: ${c.nombre} lo producen «${c.a}» y «${c.b}». Usa "$css" en uno de los dos.`);
  problemas++;
}
for (const s of sinResolver) {
  console.error(`✖ Alias sin resolver en «${s.de}»: {${s.ref}} no existe.`);
  problemas++;
}
if (problemas) process.exit(1);

/* ── Salida ───────────────────────────────────────────────────────────────── */

if (verificar) {
  if (!fs.existsSync(verificar)) {
    console.error(`✖ No existe ${verificar}. Genéralo con -o.`);
    process.exit(1);
  }
  const actual = fs.readFileSync(verificar, "utf8").replace(/\r\n/g, "\n").trim();
  if (actual === css.replace(/\r\n/g, "\n").trim()) {
    console.log(`✔ ${verificar} corresponde a ${path.basename(entrada)} (${tokens.length} tokens).`);
    process.exit(0);
  }
  const a = actual.split("\n"), b = css.trim().split("\n");
  console.error(`✖ ${verificar} NO corresponde a ${path.basename(entrada)}. El contrato y su CSS han divergido.`);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (a[i] !== b[i]) {
      console.error(`   primera diferencia, línea ${i + 1}:`);
      console.error(`     en el CSS:   ${a[i] ?? "(no hay línea)"}`);
      console.error(`     debería ser: ${b[i] ?? "(no hay línea)"}`);
      break;
    }
  }
  /* Con la ruta REAL con la que se invocó: desde un proyecto, la relativa al
     plugin no sirve, y un comando que no se puede pegar no es una ayuda. */
  console.error(`   Regenera con: node "${process.argv[1]}" ${entrada} -o ${verificar}`);
  process.exit(1);
}

if (salida) {
  fs.writeFileSync(salida, css, "utf8");
  console.log(`✔ ${salida} — ${tokens.length} tokens de ${orden.length} set(s).`);
} else {
  process.stdout.write(css);
}
