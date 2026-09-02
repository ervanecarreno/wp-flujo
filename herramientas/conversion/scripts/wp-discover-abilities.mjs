#!/usr/bin/env node
/**
 * wp-discover-abilities.mjs — Descubre el namespace y las rutas REST reales
 * de la Abilities API en tu WordPress, en vez de adivinarlas.
 *
 * Motivo: mcp-abilities-generatepress usa wp_register_ability() del plugin
 * "Abilities API" (WordPress/abilities-api), que expone sus propias rutas
 * REST bajo un namespace propio. La forma exacta de la ruta de ejecución
 * ("run"/"execute"/"invoke") puede variar entre versiones del plugin, así
 * que este script la lee del índice REST en vivo (fuente de verdad, igual
 * que hacemos con la forma canónica de los bloques).
 *
 * Uso:
 *   node scripts/wp-discover-abilities.mjs
 *
 * Env: WP_URL, WP_USER, WP_APP_PASSWORD
 */
const { WP_URL, WP_USER, WP_APP_PASSWORD } = process.env;
if (!WP_URL) { console.error("Falta WP_URL en el entorno (.env)."); process.exit(2); }
const auth = WP_USER && WP_APP_PASSWORD ? "Basic " + Buffer.from(`${WP_USER}:${WP_APP_PASSWORD}`).toString("base64") : null;

async function getJson(url) {
  const res = await fetch(url, { headers: auth ? { Authorization: auth } : {} });
  const text = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status} en ${url}: ${text.slice(0, 300)}`);
  try { return JSON.parse(text); } catch { throw new Error(`Respuesta no-JSON de ${url} (¿URL de WP correcta? ¿permalinks activos?): ${text.slice(0, 200)}`); }
}

const run = async () => {
  console.error(`→ Consultando ${WP_URL}/wp-json/ …`);
  const index = await getJson(`${WP_URL}/wp-json/`);
  const namespaces = index.namespaces ?? [];
  console.error(`  Namespaces encontrados: ${namespaces.join(", ")}`);

  const abilityNs = namespaces.filter((n) => /abilit/i.test(n));
  if (!abilityNs.length) {
    console.error("\n  ✖ No se encontró ningún namespace con 'abilities'.");
    console.error("    Verifica que el plugin 'Abilities API' (WordPress/abilities-api) esté instalado Y activado,");
    console.error("    además de 'mcp-abilities-generatepress'. Sin el primero, el segundo no expone nada.");
    process.exit(1);
  }
  console.error(`\n  ✔ Namespace(s) de abilities: ${abilityNs.join(", ")}`);

  for (const ns of abilityNs) {
    console.error(`\n→ Rutas bajo /${ns}:`);
    const nsIndex = await getJson(`${WP_URL}/wp-json/${ns}`);
    const routes = Object.keys(nsIndex.routes ?? {});
    for (const r of routes) {
      const methods = nsIndex.routes[r].methods ?? [];
      console.error(`    ${methods.join(",").padEnd(18)} ${r}`);
    }
    // Heurística: busca la ruta que parece "ejecutar" una habilidad concreta
    const runRoute = routes.find((r) => /\{.*\}.*\/(run|execute|invoke)/i.test(r)) ??
                      routes.find((r) => /\{.*\}$/.test(r) && (nsIndex.routes[r].methods ?? []).includes("POST"));
    if (runRoute) {
      console.error(`\n  → Candidata a ruta de ejecución: ${runRoute}`);
      console.error(`    Ajusta ABILITY_ENDPOINT en scripts/wp-push-tokens.mjs y wp-roundtrip.mjs a este patrón.`);
    }
  }

  // Si hay auth, intenta listar las abilities registradas (confirma que
  // mcp-abilities-generatepress SÍ registró las suyas).
  if (auth) {
    try {
      const listUrl = `${WP_URL}/wp-json/${abilityNs[0]}/abilities`;
      console.error(`\n→ Listando abilities registradas (${listUrl})…`);
      const list = await getJson(listUrl);
      const items = Array.isArray(list) ? list : list.abilities ?? [];
      const gp = items.filter((a) => String(a.id ?? a.name ?? "").includes("generatepress") || String(a.id ?? a.name ?? "").includes("generateblocks"));
      console.error(`  Total abilities: ${items.length}. De GeneratePress/GenerateBlocks: ${gp.length}`);
      gp.slice(0, 10).forEach((a) => console.error(`    · ${a.id ?? a.name}`));
      if (!gp.length) console.error("  ⚠ No aparecen abilities de generatepress/generateblocks: revisa que el plugin esté activo sin errores en Plugins.");
    } catch (e) {
      console.error(`  (no se pudo listar abilities: ${e.message})`);
    }
  }
};

run().catch((e) => { console.error("✖", e.message); process.exit(1); });
