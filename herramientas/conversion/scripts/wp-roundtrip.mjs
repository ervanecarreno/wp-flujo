#!/usr/bin/env node
/**
 * wp-roundtrip.mjs — QA nivel 1: round-trip REST + diff byte a byte por bloque.
 *
 * Publica el markup como BORRADOR en WordPress, lo relee con context=edit
 * (content.raw) y compara bloque a bloque. Detecta problemas de parseo y
 * cualquier re-serialización que WP haga al guardar por REST.
 *
 * IMPORTANTE: la validación de bloques "de verdad" (el aviso "Attempt Recovery")
 * ocurre en el editor JS, no siempre en REST. Este nivel es rápido y atrapa
 * problemas de estructura/parseo; para la validación fiel del editor usa
 * scripts/qa-editor-check.mjs (Playwright).
 *
 * Uso:
 *   node scripts/wp-roundtrip.mjs pagina.html [--type pages|posts] [--keep]
 *
 * Env: WP_URL, WP_USER, WP_APP_PASSWORD
 * --keep: no borra el borrador al terminar (para inspección manual en el editor).
 */
import fs from "node:fs";
import { diffBlocks, formatDrifts, normalizeInterblockWhitespace } from "../lib/blockdiff.mjs";

const [file, ...flags] = process.argv.slice(2);
if (!file) { console.error("Uso: node scripts/wp-roundtrip.mjs pagina.html [--type pages|posts] [--keep]"); process.exit(2); }
const { WP_URL, WP_USER, WP_APP_PASSWORD } = process.env;
if (!WP_URL || !WP_USER || !WP_APP_PASSWORD) { console.error("Faltan WP_URL / WP_USER / WP_APP_PASSWORD."); process.exit(2); }

const typeIdx = flags.indexOf("--type");
const type = typeIdx !== -1 ? flags[typeIdx + 1] : "pages";
const keep = flags.includes("--keep");
const auth = "Basic " + Buffer.from(`${WP_USER}:${WP_APP_PASSWORD}`).toString("base64");
const sent = fs.readFileSync(file, "utf8");

const api = (path) => `${WP_URL}/wp-json/wp/v2/${path}`;

async function wp(method, path, body) {
  const res = await fetch(api(path), {
    method,
    headers: { "Content-Type": "application/json", Authorization: auth },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch { json = { raw: text }; }
  if (!res.ok) throw new Error(`${method} ${path} → HTTP ${res.status}: ${text.slice(0, 400)}`);
  return json;
}

const run = async () => {
  console.error(`→ Creando borrador (${type}) en ${WP_URL}`);
  const created = await wp("POST", type, {
    title: `QA roundtrip ${new Date().toISOString()}`,
    status: "draft",
    content: sent,
  });
  const id = created.id;
  console.error(`  ✔ Borrador #${id}`);

  console.error("→ Releyendo con context=edit (content.raw)…");
  const reread = await wp("GET", `${type}/${id}?context=edit`);
  const got = reread.content?.raw ?? "";

  const drifts = diffBlocks(normalizeInterblockWhitespace(sent), normalizeInterblockWhitespace(got));
  console.error("\n" + formatDrifts(drifts));

  // Guardar artefactos para inspección
  fs.writeFileSync("qa-sent.html", sent);
  fs.writeFileSync("qa-got.html", got);
  console.error("\n  Artefactos: qa-sent.html, qa-got.html");

  if (!keep) {
    await wp("DELETE", `${type}/${id}?force=true`);
    console.error(`  ✔ Borrador #${id} eliminado (usa --keep para conservarlo)`);
  } else {
    console.error(`  ⏸ Borrador #${id} conservado. Ábrelo en el editor y ejecuta qa-editor-check.mjs para la validación fiel.`);
  }

  process.exit(drifts.length ? 1 : 0);
};

run().catch((e) => { console.error("✖", e.message); process.exit(1); });
