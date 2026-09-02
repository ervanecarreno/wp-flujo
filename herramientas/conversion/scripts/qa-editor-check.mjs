#!/usr/bin/env node
/**
 * qa-editor-check.mjs — QA nivel 2: validación FIEL en el editor de bloques.
 *
 * La validación real de GenerateBlocks (el aviso "Attempt Recovery" / "This
 * block contains unexpected or invalid content") vive en el editor JS de
 * Gutenberg, no en REST. Este script abre el borrador en wp-admin con
 * Playwright, detecta bloques marcados como inválidos, fuerza un guardado
 * (que re-serializa) y relee content.raw para un diff byte a byte fiable.
 *
 * Requiere: npm i (instala playwright) + npx playwright install chromium
 *
 * Uso:
 *   node scripts/qa-editor-check.mjs <postId> [--type pages|posts]
 *   node scripts/qa-editor-check.mjs --file pagina.html   (crea borrador y valida)
 *
 * Env: WP_URL, WP_USER, WP_APP_PASSWORD (para REST) y WP_LOGIN_PASSWORD
 *      (contraseña real de login para wp-admin; el Application Password NO
 *      sirve para el formulario de login del navegador).
 */
import fs from "node:fs";

let chromium;
try { ({ chromium } = await import("playwright")); }
catch { console.error("Playwright no instalado. Ejecuta: npm i && npx playwright install chromium"); process.exit(2); }

import { diffBlocks, formatDrifts, normalizeInterblockWhitespace } from "../lib/blockdiff.mjs";

const args = process.argv.slice(2);
const { WP_URL, WP_USER, WP_APP_PASSWORD, WP_LOGIN_PASSWORD } = process.env;
if (!WP_URL || !WP_USER) { console.error("Faltan WP_URL / WP_USER."); process.exit(2); }

const typeIdx = args.indexOf("--type");
const type = typeIdx !== -1 ? args[typeIdx + 1] : "pages";
const fileIdx = args.indexOf("--file");
const auth = "Basic " + Buffer.from(`${WP_USER}:${WP_APP_PASSWORD}`).toString("base64");

async function wp(method, path, body) {
  const res = await fetch(`${WP_URL}/wp-json/wp/v2/${path}`, {
    method, headers: { "Content-Type": "application/json", Authorization: auth },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} → HTTP ${res.status}: ${text.slice(0, 300)}`);
  return JSON.parse(text);
}

const run = async () => {
  let postId, sent;
  if (fileIdx !== -1) {
    sent = fs.readFileSync(args[fileIdx + 1], "utf8");
    const created = await wp("POST", type, { title: `QA editor ${Date.now()}`, status: "draft", content: sent });
    postId = created.id;
    console.error(`  ✔ Borrador #${postId} creado`);
  } else {
    postId = args[0];
    if (!postId) { console.error("Da un postId o --file pagina.html"); process.exit(2); }
    sent = (await wp("GET", `${type}/${postId}?context=edit`)).content.raw;
  }

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  // Login en wp-admin (el editor necesita sesión de navegador)
  console.error("→ Login en wp-admin…");
  await page.goto(`${WP_URL}/wp-login.php`);
  await page.fill("#user_login", WP_USER);
  await page.fill("#user_pass", WP_LOGIN_PASSWORD ?? WP_APP_PASSWORD);
  await page.click("#wp-submit");
  await page.waitForLoadState("networkidle");

  console.error(`→ Abriendo editor del ${type} #${postId}…`);
  await page.goto(`${WP_URL}/wp-admin/post.php?post=${postId}&action=edit`);
  await page.waitForSelector(".block-editor", { timeout: 30000 });
  // Cerrar el modal de bienvenida si aparece
  await page.locator('button[aria-label="Close"], .components-modal__header button').first().click().catch(() => {});
  await page.waitForTimeout(2500); // dejar que el validador de bloques corra

  // Detectar bloques inválidos (recovery)
  const warnings = await page.evaluate(() => {
    const sel = [".block-editor-warning", ".block-editor-block-list__block.has-warning", ".wp-block[data-block] .block-editor-warning__message"];
    const found = [];
    for (const s of sel) document.querySelectorAll(s).forEach((el) => found.push(el.textContent.trim().slice(0, 120)));
    return found;
  });

  if (warnings.length) {
    console.error(`\n  ✖ ${warnings.length} bloque(s) con aviso de validación en el editor:`);
    warnings.forEach((w) => console.error(`    · ${w}`));
  } else {
    console.error("\n  ✔ El editor no marcó ningún bloque como inválido (sin 'Attempt Recovery').");
  }

  // Forzar guardado para re-serializar, luego releer
  console.error("→ Guardando para re-serializar…");
  await page.keyboard.press("Control+S").catch(() => {});
  await page.waitForTimeout(3000);

  const reread = await wp("GET", `${type}/${postId}?context=edit`);
  const got = reread.content.raw;
  const drifts = diffBlocks(normalizeInterblockWhitespace(sent), normalizeInterblockWhitespace(got));
  console.error("\n" + formatDrifts(drifts));

  fs.writeFileSync("qa-sent.html", sent);
  fs.writeFileSync("qa-got.html", got);
  console.error("\n  Artefactos: qa-sent.html, qa-got.html");

  await browser.close();
  process.exit(warnings.length || drifts.length ? 1 : 0);
};

run().catch((e) => { console.error("✖", e.message); process.exit(1); });
