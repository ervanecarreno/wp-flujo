#!/usr/bin/env node
/**
 * qa-contrato-publicado.mjs — QA nivel 0: ¿el contrato llegó al navegador?
 *
 * Nace de dos fallos reales, los dos del MISMO tipo, cometidos con dos semanas
 * de diferencia (proyecto Museo del Plátano, 2/09/2026):
 *
 *   1. Los 14 colores estaban empujados como Global Colors de GeneratePress y
 *      verificados uno a uno. Pero WP los publica como `--wp--preset--color--X`,
 *      no como `--X`, que es lo que usaba el marcado. Cero definiciones reales.
 *   2. El marcado declaraba Fraunces 16 veces y Public Sans 31. La página servía
 *      0 `@font-face` y 0 enlaces a Google Fonts. Todo salía en Georgia, sin un
 *      solo error en ninguna parte.
 *
 * El patrón común: DECLARAR NO ES PUBLICAR. Una referencia que no resuelve no
 * da error en ningún sitio — ni en el validador de marcado, ni en el
 * round-trip, ni en la puerta de calidad, que mira enlaces y no tipografía. El
 * navegador simplemente usa otra cosa y calla.
 *
 * Esto lo comprueba de la única forma que no se puede engañar: descargando la
 * página tal como la sirve el servidor, con todas sus hojas de estilo, y
 * resolviendo cada referencia contra lo que de verdad hay publicado.
 *
 * Determinista, sin navegador y sin dependencias.
 *
 * Uso:
 *   node qa-contrato-publicado.mjs <url> [--tokens fichero.tokens.css] [--json]
 *
 *   --tokens  además, exige que TODOS los tokens de ese fichero estén
 *             publicados (caza el contrato que se quedó a medias).
 *
 * Salida: 0 = todo resuelve · 1 = hay referencias rotas · 2 = error de uso.
 */
import fs from "node:fs";

const args = process.argv.slice(2);
const url = args[0];
if (!url || url.startsWith("--")) {
  console.error("Uso: node qa-contrato-publicado.mjs <url> [--tokens fichero.tokens.css] [--json]");
  process.exit(2);
}
const opt = (n) => { const i = args.indexOf(n); return i !== -1 ? args[i + 1] : null; };
const asJson = args.includes("--json");
const tokensFile = opt("--tokens");

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36";

/* Familias que el navegador siempre tiene: no necesitan @font-face. */
const GENERICAS = new Set([
  "serif", "sans-serif", "monospace", "cursive", "fantasy", "system-ui",
  "ui-serif", "ui-sans-serif", "ui-monospace", "ui-rounded", "math", "emoji", "fangsong",
  "-apple-system", "blinkmacsystemfont", "segoe ui", "roboto", "helvetica neue",
  "inherit", "initial", "unset", "revert",
]);
const WEBSAFE = new Set([
  "arial", "helvetica", "georgia", "times", "times new roman", "courier",
  "courier new", "verdana", "tahoma", "trebuchet ms", "impact", "comic sans ms",
  "palatino", "garamond", "bookman", "arial black", "lucida sans", "consolas",
  "monaco", "menlo", "segoe ui emoji", "apple color emoji", "noto color emoji",
]);

async function bajar(u) {
  const res = await fetch(u, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error("HTTP " + res.status);
  return await res.text();
}

/* ── 1. Reunir la página y TODAS sus hojas de estilo ─────────────────────── */

/* Si la página no se puede pedir, esto NO es un contrato roto: es que no hay
   nada que comprobar. Se distingue con el código de salida (2, no 1) para que
   nadie lo confunda con un fallo de fidelidad, y se dice en una línea en vez de
   volcar una pila de excepciones. */
let html;
try {
  html = await bajar(url);
} catch (e) {
  const causa = e?.cause?.code ?? e?.code ?? "";
  console.error("\n✖ No se pudo pedir " + url);
  if (causa === "ECONNREFUSED") {
    console.error("  Conexión rechazada. ¿Está arrancado el sitio en Local WP?");
  } else if (causa === "ENOTFOUND" || causa === "EAI_AGAIN") {
    console.error("  No resuelve el nombre. Revisa el dominio, incluido el subdirectorio si lo hay.");
  } else {
    console.error("  " + e.message);
  }
  console.error("  Esta puerta necesita la URL REAL y servida: contra un HTML local no comprueba nada.\n");
  process.exit(2);
}

const hojas = [];   // { origen, css }

for (const m of html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)) {
  hojas.push({ origen: "<style> en linea", css: m[1] });
}

/* WordPress escribe los `&` de una URL como `&#038;` (referencia numérica, no
   `&amp;`). El navegador la decodifica al parsear el atributo; hay que hacer lo
   mismo o se pide una URL distinta de la que el usuario recibe. Costó un falso
   positivo el 2/09/2026: la hoja de Google Fonts se pedía truncada y parecía
   que Public Sans no cargaba. */
function decodeEntidades(s) {
  return s
    .replace(/&#0*(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
    .replace(/&#x0*([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

const enlaces = [];
for (const m of html.matchAll(/<link\b[^>]*>/gi)) {
  const tag = m[0];
  if (!/rel\s*=\s*["']?stylesheet/i.test(tag)) continue;
  const href = tag.match(/href\s*=\s*["']([^"']+)["']/i)?.[1];
  if (href) enlaces.push(new URL(decodeEntidades(href), url).href);
}

const inaccesibles = [];
for (const href of enlaces) {
  try { hojas.push({ origen: href, css: await bajar(href) }); }
  catch (e) { inaccesibles.push({ href, motivo: e.message }); }
}

/* Los atributos style="" también usan var(): cuentan como uso, no como fuente. */
const estilosEnLinea = [...html.matchAll(/\bstyle\s*=\s*"([^"]*)"/gi)].map((m) => m[1]).join(";");

const todoElCss = hojas.map((h) => h.css).join("\n");

/* ── 2. Tokens: cada var(--x) usado tiene que estar definido ──────────────── */

/* Se captura el nombre COMPLETO a propósito. Contar por subcadena es lo que
   hizo dar por buena una definición que no existía: `--bg-page` "aparecía"
   dentro de `--wp--preset--color--bg-page`. */
const definidos = new Set();
for (const m of todoElCss.matchAll(/(--[A-Za-z0-9_-]+)\s*:/g)) definidos.add(m[1]);

const usados = new Map();   // nombre → { conRespaldo }
for (const m of (todoElCss + ";" + estilosEnLinea).matchAll(/var\(\s*(--[A-Za-z0-9_-]+)\s*(,)?/g)) {
  const prev = usados.get(m[1]);
  const conRespaldo = Boolean(m[2]);
  /* Si en algún sitio se usa SIN respaldo, ese es el caso que rompe. */
  usados.set(m[1], { conRespaldo: prev ? prev.conRespaldo && conRespaldo : conRespaldo });
}

const tokensRotos = [];
for (const [nombre, info] of usados) {
  if (definidos.has(nombre)) continue;
  tokensRotos.push({ nombre, conRespaldo: info.conRespaldo });
}

/* ── 3. Tipografía: cada familia declarada tiene que poder cargarse ───────── */

function limpiaFamilia(s) {
  return s.trim().replace(/^["']|["']$/g, "").trim().toLowerCase();
}

const caras = new Set();   // familias con @font-face de verdad
for (const bloque of todoElCss.matchAll(/@font-face\s*\{([\s\S]*?)\}/gi)) {
  const fam = bloque[1].match(/font-family\s*:\s*([^;]+)/i)?.[1];
  if (fam) caras.add(limpiaFamilia(fam));
}

/* Solo importa la PRIMERA familia de cada pila: las demás son el respaldo. */
const familias = new Map();   // familia → nº de declaraciones
for (const m of todoElCss.matchAll(/font-family\s*:\s*([^;}]+)/gi)) {
  const pila = m[1];
  if (/var\(/.test(pila)) continue;              // resuelto por token, ya cubierto arriba
  const primera = limpiaFamilia(pila.split(",")[0]);
  if (!primera || primera.startsWith("--")) continue;
  familias.set(primera, (familias.get(primera) ?? 0) + 1);
}

const fuentesRotas = [];
for (const [fam, veces] of familias) {
  if (GENERICAS.has(fam) || WEBSAFE.has(fam) || caras.has(fam)) continue;
  fuentesRotas.push({ familia: fam, declaraciones: veces });
}

/* ── 4. Opcional: el contrato entero, no solo lo que la página usa ────────── */

let contratoIncompleto = [];
if (tokensFile) {
  const fuente = fs.readFileSync(tokensFile, "utf8");
  const delContrato = new Set();
  for (const m of fuente.matchAll(/(--[A-Za-z0-9_-]+)\s*:/g)) delContrato.add(m[1]);
  contratoIncompleto = [...delContrato].filter((t) => !definidos.has(t));
}

/* ── 5. Informe ──────────────────────────────────────────────────────────── */

if (asJson) {
  console.log(JSON.stringify({
    url, hojas: hojas.length, inaccesibles,
    tokensDefinidos: definidos.size, tokensUsados: usados.size, tokensRotos,
    carasTipograficas: caras.size, familiasDeclaradas: familias.size, fuentesRotas,
    contratoIncompleto,
  }, null, 2));
} else {
  console.log("\n== Contrato publicado en " + url + " ==");
  console.log("  " + hojas.length + " hoja(s) de estilo · " + definidos.size +
              " propiedades definidas · " + caras.size + " @font-face");

  for (const f of inaccesibles) console.log("  ⚠ hoja inaccesible: " + f.href + " — " + f.motivo);

  if (!tokensRotos.length) {
    console.log("  ✔ Tokens: las " + usados.size + " referencias var() resuelven");
  } else {
    console.log("  ✖ Tokens: " + tokensRotos.length + " de " + usados.size + " referencias NO resuelven");
    for (const t of tokensRotos) {
      console.log("      " + t.nombre + (t.conRespaldo
        ? "  (siempre con respaldo: degrada, no rompe)"
        : "  <- sin respaldo"));
    }
  }

  if (!fuentesRotas.length) {
    console.log("  ✔ Tipografía: las " + familias.size + " familias declaradas pueden cargarse");
  } else {
    console.log("  ✖ Tipografía: " + fuentesRotas.length + " familia(s) que el navegador NO tiene");
    for (const f of fuentesRotas) {
      console.log("      \"" + f.familia + "\" — " + f.declaraciones +
                  " declaración(es), sin @font-face. Caerá al respaldo en silencio");
    }
  }

  if (tokensFile) {
    if (!contratoIncompleto.length) {
      console.log("  ✔ Contrato completo: todo " + tokensFile + " está publicado");
    } else {
      console.log("  ✖ Contrato a medias: " + contratoIncompleto.length + " token(s) del fichero no llegan");
      for (const t of contratoIncompleto) console.log("      " + t);
    }
  }
  console.log("");
}

const rotos = tokensRotos.filter((t) => !t.conRespaldo).length + fuentesRotas.length + contratoIncompleto.length;
process.exit(rotos ? 1 : 0);
