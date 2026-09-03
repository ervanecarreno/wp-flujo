#!/usr/bin/env node
/**
 * tokens-a-css.js — genera (o verifica) el CSS del contrato a partir del JSON.
 *
 * El contrato de diseño vive en UN fichero: `<sistema>.tokens.json`, en formato
 * W3C / Tokens Studio. El CSS es una DERIVADA, no una segunda fuente.
 *
 * Existe porque la cabecera del CSS del primer proyecto decía, literalmente,
 * «espejo exacto del JSON: si cambias uno, cambia el otro». Eso es sincronizar
 * a mano dos declaraciones de la misma verdad, y es la misma familia de fallo
 * que ya costó dos veces en este flujo: nada avisa cuando divergen.
 *
 * Uso:
 *   node herramientas/tokens-a-css.js design/x.tokens.json                 (a stdout)
 *   node herramientas/tokens-a-css.js design/x.tokens.json -o design/x.tokens.css
 *   node herramientas/tokens-a-css.js design/x.tokens.json --verificar design/x.tokens.css
 *
 * `--verificar` no escribe: compara y sale con 1 si el CSS no corresponde al
 * JSON. Es la puerta anti-deriva del contrato, para la fase 7 o para CI.
 *
 * Nombres: la ruta del token unida por guiones. `space.md` → `--space-md`.
 * Dos escapes para los casos que no encajan:
 *   · `$metadata.renombres` — { "font-family": "font" } renombra el primer tramo
 *   · `"$css": "--lo-que-sea"` dentro del token — manda sobre todo lo demás
 *
 * Node, sin dependencias.
 */
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const args = process.argv.slice(2);
const entrada = args[0];
if (!entrada || entrada.startsWith("-")) {
  console.error("Uso: node herramientas/tokens-a-css.js <x.tokens.json> [-o salida.css] [--verificar salida.css]");
  process.exit(2);
}
const opt = (n) => { const i = args.indexOf(n); return i !== -1 ? args[i + 1] : null; };
const salida = opt("-o");
const verificar = opt("--verificar");

const doc = JSON.parse(fs.readFileSync(entrada, "utf8"));
const meta = doc.$metadata ?? {};
const renombres = meta.renombres ?? {};
const orden = meta.tokenSetOrder ?? Object.keys(doc).filter((k) => !k.startsWith("$"));

/* ── Aplanado ─────────────────────────────────────────────────────────────── */

const tokens = [];        // { set, ruta, nombre, valor, tipo }
const porRuta = new Map(); // "core.space.md" → valor crudo, para resolver alias

function nombreCss(ruta, override) {
  if (override) return override.startsWith("--") ? override : "--" + override;
  const tramos = ruta.split(".");
  if (renombres[tramos[0]]) tramos[0] = renombres[tramos[0]];
  return "--" + tramos.filter(Boolean).join("-");
}

function recorrer(nodo, set, prefijo) {
  for (const [clave, valor] of Object.entries(nodo)) {
    if (clave.startsWith("$")) continue;
    if (!valor || typeof valor !== "object") continue;
    const ruta = prefijo ? prefijo + "." + clave : clave;
    if ("$value" in valor) {
      tokens.push({
        set,
        ruta,
        nombre: nombreCss(ruta, valor.$css),
        valor: valor.$value,
        tipo: valor.$type ?? null,
        grupo: ruta.split(".")[0],
      });
      porRuta.set(set + "." + ruta, valor.$value);
      porRuta.set(ruta, valor.$value);
    } else {
      recorrer(valor, set, ruta);
    }
  }
}

for (const set of orden) {
  if (!doc[set]) { console.error(`⚠ El set «${set}» está en tokenSetOrder pero no existe en el fichero.`); continue; }
  recorrer(doc[set], set, "");
}

/* ── Alias: {core.space.md} → var(--space-md) ─────────────────────────────── */

const porRutaANombre = new Map();
for (const t of tokens) { porRutaANombre.set(t.set + "." + t.ruta, t.nombre); porRutaANombre.set(t.ruta, t.nombre); }

const sinResolver = [];
function resolver(valor, deQuien) {
  if (typeof valor !== "string") return String(valor);
  return valor.replace(/\{([^}]+)\}/g, (todo, ref) => {
    const destino = porRutaANombre.get(ref.trim());
    if (!destino) { sinResolver.push({ de: deQuien, ref: ref.trim() }); return todo; }
    return "var(" + destino + ")";
  });
}

/* ── Colisiones: dos tokens distintos con el mismo nombre CSS ─────────────── */

const vistos = new Map();
const colisiones = [];
for (const t of tokens) {
  if (vistos.has(t.nombre) && vistos.get(t.nombre) !== t.ruta) {
    colisiones.push({ nombre: t.nombre, a: vistos.get(t.nombre), b: t.ruta });
  }
  vistos.set(t.nombre, t.ruta);
}

/* ── Emisión ──────────────────────────────────────────────────────────────── */

const ROTULOS = {
  radius: "Radio", size: "Control", space: "Espaciado",
  "font-family": "Tipografía", "font-size": "Escala tipográfica",
  bg: "Fondo", text: "Texto", border: "Borde", accent: "Acento", fill: "Relleno",
};

const lineas = [];
lineas.push("/* GENERADO por herramientas/tokens-a-css.js — no editar a mano.");
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
  let v = resolver(t.valor, t.ruta);
  /* Una familia con espacios necesita comillas para ser una pila CSS válida. */
  if (t.tipo === "fontFamilies" && /\s/.test(v) && !/["']/.test(v)) v = '"' + v + '"';
  lineas.push("  " + t.nombre + ": " + v + ";");
}

lineas.push("}");
lineas.push("");
const css = lineas.join("\n");

/* ── Avisos ───────────────────────────────────────────────────────────────── */

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
  /* Decir DÓNDE difiere, no solo que difiere. */
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
