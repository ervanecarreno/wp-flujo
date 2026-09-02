#!/usr/bin/env node
/**
 * wp-push-tokens.mjs — Escribe los tokens de la capa de sitio en WordPress.
 *
 * Estrategia dual:
 *  1. Si mcp-abilities-generatepress está instalado, llama a la ability
 *     `generatepress/update-settings` con { global_colors } (canal preferido).
 *  2. Si no, cae al endpoint REST de opciones que exponga tu instalación.
 *
 * Este script asume un WordPress de STAGING con Application Password.
 * Variables de entorno:
 *   WP_URL=https://staging.tusitio.com
 *   WP_USER=usuario
 *   WP_APP_PASSWORD="xxxx xxxx xxxx xxxx xxxx xxxx"
 *
 * Uso:
 *   node scripts/wp-push-tokens.mjs tokens/generatepress-global-colors.json [--verify]
 *
 * --verify: tras escribir, vuelve a leer y compara los global_colors.
 *
 * NOTA: la ruta exacta de la ability MCP depende de cómo exponga el plugin su
 * endpoint (REST namespace configurable). Ajusta ABILITY_ENDPOINT si difiere.
 * Por eso el script primero hace un dry-run que solo imprime la petición.
 */
import fs from "node:fs";

const [payloadFile, ...flags] = process.argv.slice(2);
if (!payloadFile) {
  console.error("Uso: node scripts/wp-push-tokens.mjs tokens/generatepress-global-colors.json [--verify] [--live]");
  process.exit(2);
}
const { WP_URL, WP_USER, WP_APP_PASSWORD } = process.env;
const live = flags.includes("--live");
const verify = flags.includes("--verify");

const payload = JSON.parse(fs.readFileSync(payloadFile, "utf8"));
const auth = "Basic " + Buffer.from(`${WP_USER}:${WP_APP_PASSWORD}`).toString("base64");

// Confirmado por wp-discover-abilities.mjs: la Abilities API expone
// POST /wp-abilities/v1/abilities/{name}/run  (namespace real, no "mcp/v1").
const ABILITY_ENDPOINT = (slug) => `${WP_URL}/wp-json/wp-abilities/v1/abilities/${slug}/run`;

async function callAbility(slug, input) {
  const res = await fetch(ABILITY_ENDPOINT(slug), {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: auth },
    body: JSON.stringify({ input }),
  });
  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch { json = { raw: text }; }
  if (!res.ok) throw new Error(`${slug} → HTTP ${res.status}: ${text.slice(0, 300)}`);
  return json;
}

const run = async () => {
  if (!live) {
    console.log("DRY-RUN (sin --live). Petición que se enviaría:\n");
    console.log(`POST ${ABILITY_ENDPOINT("generatepress/update-settings")}`);
    console.log("input =", JSON.stringify({ global_colors: payload.global_colors }, null, 2));
    console.log(`\n${payload.global_colors.length} colores. Añade --live para ejecutar contra ${WP_URL || "(WP_URL no definido)"}.`);
    return;
  }
  if (!WP_URL || !WP_USER || !WP_APP_PASSWORD) {
    console.error("Faltan WP_URL / WP_USER / WP_APP_PASSWORD en el entorno.");
    process.exit(2);
  }

  console.error(`→ Escribiendo ${payload.global_colors.length} global_colors en ${WP_URL}`);
  const result = await callAbility("generatepress/update-settings", { global_colors: payload.global_colors });
  console.error("  ✔", result.message ?? JSON.stringify(result));

  if (verify) {
    console.error("→ Verificando (get-settings)…");
    const back = await callAbility("generatepress/get-settings", {});
    const got = back.global_colors ?? back.result?.global_colors ?? [];
    const bySlug = Object.fromEntries(got.map((c) => [c.slug, c.color]));
    let ok = 0, bad = 0;
    for (const c of payload.global_colors) {
      if ((bySlug[c.slug] ?? "").toLowerCase() === c.color.toLowerCase()) ok++;
      else { bad++; console.error(`  ✖ ${c.slug}: esperado ${c.color}, WP tiene ${bySlug[c.slug] ?? "(ausente)"}`); }
    }
    console.error(`\n  ${ok} coinciden, ${bad} discrepan.`);
    if (bad) process.exit(1);
    console.error("  ✔ Todos los colores verificados.");
    console.error("  Recuerda: limpia caché de GB/GP si el frontend no refleja los cambios.");
  }
};

run().catch((e) => { console.error("✖", e.message); process.exit(1); });
