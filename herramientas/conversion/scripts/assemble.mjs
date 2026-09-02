#!/usr/bin/env node
/**
 * assemble.mjs — Ensamblaje determinista: patrón validado + contenido → página.
 *
 * Filosofía: NUNCA se genera markup nuevo. Se toma un patrón ya validado
 * (round-trip en WordPress) y solo se sustituye contenido en slots declarados.
 * La forma canónica del patrón (escapes, orden de claves, css) se preserva
 * byte a byte fuera de los slots.
 *
 * Uso:
 *   node scripts/assemble.mjs patron.html manifest.json contenido.json [--reid] > pagina.html
 *
 * manifest.json:
 *   { "slots": {
 *       "titulo":  { "uniqueId": "ad0fde9a", "type": "text"  },
 *       "imagen":  { "uniqueId": "7a1c1d14", "type": "image" },
 *       "cta_url": { "uniqueId": "40d35601", "type": "href"  }
 *   } }
 *
 * contenido.json:
 *   { "titulo": "Nuevo titular", "imagen": {"src":"https://…/x.jpg","alt":"…"}, "cta_url": "https://…" }
 *
 * --reid: remapea TODOS los uniqueId a valores nuevos (necesario si el mismo
 * patrón se usa dos veces en la misma página, para no colisionar CSS).
 */
import fs from "node:fs";
import crypto from "node:crypto";
import { serializeBlockAttributes, orderAttrs, escapeHtmlText, escapeHtmlAttr } from "../lib/canonical.mjs";

const [patternFile, manifestFile, contentFile, ...flags] = process.argv.slice(2);
if (!patternFile || !manifestFile || !contentFile) {
  console.error("Uso: assemble.mjs patron.html manifest.json contenido.json [--reid] [--out salida.html]");
  process.exit(2);
}
const outIdx = flags.indexOf("--out");
const outFile = outIdx !== -1 ? flags[outIdx + 1] : null;

let markup = fs.readFileSync(patternFile, "utf8");
const manifest = JSON.parse(fs.readFileSync(manifestFile, "utf8"));
const content = JSON.parse(fs.readFileSync(contentFile, "utf8"));

// ---------------------------------------------------------------------------
// 1. Sustituir slots. Se localiza el bloque por uniqueId, se re-serializa su
//    delimitador con el atributo nuevo (misma canónica) y se sustituye el
//    valor en el cuerpo HTML renderizado.
// ---------------------------------------------------------------------------
const BLOCK_RE = /<!--\s+wp:([a-z0-9\/-]+)\s+(\{[\s\S]*?\})\s+(\/?)-->/g;

function transformBlocks(src, fn) {
  return src.replace(BLOCK_RE, (full, name, json, selfClose) => {
    let attrs;
    try { attrs = JSON.parse(json); } catch { return full; }
    const changed = fn(name, attrs);
    if (!changed) return full;
    const ser = serializeBlockAttributes(orderAttrs(name, attrs));
    return `<!-- wp:${name} ${ser} ${selfClose ? "/" : ""}-->`.replace(" -->", " -->");
  });
}

for (const [slot, def] of Object.entries(manifest.slots ?? {})) {
  if (!(slot in content)) { console.error(`⚠ slot '${slot}' sin contenido; se deja el del patrón`); continue; }
  const value = content[slot];
  const id = def.uniqueId;

  if (def.type === "text") {
    markup = transformBlocks(markup, (name, attrs) => {
      if (attrs.uniqueId !== id) return false;
      attrs.content = String(value);
      return true;
    });
    // Cuerpo HTML: <tag class="...gb-text-{id}...">VIEJO</tag>
    const bodyRe = new RegExp(`(<([a-z0-9]+)([^>]*\\bgb-text-${id}\\b[^>]*)>)([\\s\\S]*?)(</\\2>)`);
    markup = markup.replace(bodyRe, (_, open, tag, attrsHtml, _old, close) => `${open}${String(value)}${close}`);
  } else if (def.type === "image") {
    const { src, alt } = typeof value === "string" ? { src: value, alt: undefined } : value;
    markup = transformBlocks(markup, (name, attrs) => {
      if (attrs.uniqueId !== id) return false;
      attrs.htmlAttributes = { ...(attrs.htmlAttributes ?? {}) , src };
      if (alt !== undefined) attrs.htmlAttributes.alt = alt;
      return true;
    });
    const imgRe = new RegExp(`(<img[^>]*\\bgb-media-${id}\\b[^>]*)`);
    markup = markup.replace(imgRe, (m0) => {
      let out = m0.replace(/\bsrc="[^"]*"/, `src="${escapeHtmlAttr(src)}"`);
      if (alt !== undefined) out = out.replace(/\balt="[^"]*"/, `alt="${escapeHtmlAttr(alt)}"`);
      return out;
    });
  } else if (def.type === "href") {
    markup = transformBlocks(markup, (name, attrs) => {
      if (attrs.uniqueId !== id) return false;
      attrs.htmlAttributes = { ...(attrs.htmlAttributes ?? {}), href: String(value) };
      return true;
    });
    const aRe = new RegExp(`(<a[^>]*\\bgb-(?:element|text)-${id}\\b[^>]*)`);
    markup = markup.replace(aRe, (m0) => m0.replace(/\bhref="[^"]*"/, `href="${escapeHtmlAttr(value)}"`));
  } else {
    console.error(`⚠ tipo de slot desconocido: ${def.type}`);
  }
}

// ---------------------------------------------------------------------------
// 2. --reid: remapear uniqueIds (hex de 8) a nuevos valores en TODO el doc:
//    delimitadores JSON, selectores css y listas de clase quedan coherentes
//    porque el id aparece como el mismo literal hex en los tres sitios.
// ---------------------------------------------------------------------------
if (flags.includes("--reid")) {
  const ids = new Set();
  for (const m of markup.matchAll(/"uniqueId":"([0-9a-f]{8})"/g)) ids.add(m[1]);
  for (const oldId of ids) {
    const newId = crypto.randomBytes(4).toString("hex");
    markup = markup.split(oldId).join(newId);
  }
}

if (outFile) {
  fs.writeFileSync(outFile, markup, "utf8");
  console.error(`✔ Escrito ${outFile} (${markup.length} caracteres, UTF-8)`);
} else {
  process.stdout.write(markup);
}
