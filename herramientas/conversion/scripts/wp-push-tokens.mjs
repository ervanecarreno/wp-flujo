#!/usr/bin/env node
/**
 * wp-push-tokens.mjs — lleva el contrato de diseño a los ajustes de GeneratePress.
 *
 * Reescrito el 2/09/2026. Lo que había hacía tres cosas mal:
 *
 *  1. **Leía un payload copiado a mano** (`tokens/generatepress-global-colors.json`),
 *     otro espejo del contrato que nadie mantenía sincronizado. Ahora lee el
 *     contrato directamente. Un solo fichero manda.
 *  2. **Solo tenía el canal de abilities**, que en este entorno no funciona:
 *     `wp_get_abilities()` devuelve 49 —`generatepress/update-settings` incluida—
 *     pero `rest_do_request('/wp-abilities/v1/abilities')` devuelve 2, las dos de
 *     `core`, con el mismo usuario y en el mismo proceso. Su documentación
 *     prometía un respaldo que no existía. Ahora el canal por defecto es wp-cli,
 *     que es el que funciona, y abilities queda como opción.
 *  3. **No tocaba el padding de contenido.** Y eso sí es un hueco de fidelidad:
 *     el sitio maquetaba sus márgenes con 128/32 px inventados mientras el
 *     contrato decía otra cosa.
 *
 * ── Lo que este script NO puede hacer, y conviene saberlo ──────────────────
 *
 * **GeneratePress no tiene dónde recibir una escala de espaciado ni un radio.**
 * `generate_spacing_settings` es un conjunto FIJO de campos del chrome —padding
 * de cabecera, de contenido, anchos de barra lateral, padding de widgets—, todos
 * números sueltos en px. No hay `--space-xl` que valga. Por eso solo se escriben
 * los campos que el contrato mapee EXPLÍCITAMENTE, y nunca por adivinación.
 *
 * **Y esto no publica el contrato.** WordPress expone los Global Colors como
 * `--wp--preset--color--<slug>`, no como `--<slug>`, que es el nombre que usa el
 * marcado. Sirven para la paleta del editor. El contrato llega al navegador por
 * el CSS que encola el plugin del proyecto, y quien lo comprueba es
 * `qa-contrato-publicado.mjs`. Confundir las dos cosas costó una tarde.
 *
 * ── Mapeo explícito del espaciado ──────────────────────────────────────────
 *
 * En el contrato, dentro de `$metadata`:
 *
 *   "wordpress": {
 *     "spacing": {
 *       "content_top": "core.space.xl",  "content_bottom": "core.space.xl",
 *       "content_right": "core.space.md", "content_left": "core.space.md"
 *     }
 *   }
 *
 * La clave es el campo de `generate_spacing_settings`; el valor, la ruta de un
 * token del contrato. GP los guarda como números en px, así que el token tiene
 * que estar en px.
 *
 * ── Uso ────────────────────────────────────────────────────────────────────
 *
 *   node wp-push-tokens.mjs design/x.tokens.json --sitio "<ruta app/public>" [--puerto N]
 *   node wp-push-tokens.mjs design/x.tokens.json --sitio "..." --puerto 10011 --live --verificar
 *   node wp-push-tokens.mjs design/x.tokens.json --via abilities --live   (WP_URL/WP_USER/WP_APP_PASSWORD)
 *
 * Sin `--live` no escribe: enseña exactamente lo que haría.
 *
 * Node, sin dependencias.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { leerContrato, coloresGlobales } from "../../lib-contrato.mjs";

const RAIZ_PLUGIN = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

const args = process.argv.slice(2);
const contrato = args[0];
if (!contrato || contrato.startsWith("-")) {
  console.error(`Uso:
  node wp-push-tokens.mjs <x.tokens.json> --sitio "<ruta app/public>" [--puerto N] [--live] [--verificar]
  node wp-push-tokens.mjs <x.tokens.json> --via abilities [--live] [--verificar]`);
  process.exit(2);
}
const opt = (n, def = null) => { const i = args.indexOf(n); return i !== -1 ? args[i + 1] : def; };
const live = args.includes("--live");
const verificar = args.includes("--verificar");
const via = opt("--via", "wp-cli");
const sitio = opt("--sitio");
const puerto = opt("--puerto");

/* ── 1. Leer el contrato ──────────────────────────────────────────────────── */

if (!fs.existsSync(contrato)) { console.error(`✖ No existe ${contrato}`); process.exit(2); }
const { meta, tokens, porRuta, colisiones } = leerContrato(contrato);

if (colisiones.length) {
  for (const c of colisiones) console.error(`✖ Colisión de nombre ${c.nombre}: «${c.a}» y «${c.b}».`);
  console.error("  Un contrato con colisiones no se empuja: uno pisaría al otro en silencio.");
  process.exit(1);
}

const colores = coloresGlobales(tokens);
if (!colores.length) { console.error("✖ El contrato no tiene ningún token de color."); process.exit(1); }

/* ── 2. Espaciado: solo lo mapeado a mano ─────────────────────────────────── */

const mapaSpacing = meta.wordpress?.spacing ?? {};
const spacing = {};
const spacingMal = [];

for (const [campo, ruta] of Object.entries(mapaSpacing)) {
  const t = porRuta.get(ruta);
  if (!t) { spacingMal.push(`${campo}: la ruta «${ruta}» no existe en el contrato`); continue; }
  const m = String(t.valor).match(/^(-?\d+(?:\.\d+)?)px$/);
  if (!m) { spacingMal.push(`${campo}: «${ruta}» vale «${t.valor}» y GeneratePress guarda números en px`); continue; }
  spacing[campo] = Number(m[1]);
}
if (spacingMal.length) {
  for (const m of spacingMal) console.error("✖ " + m);
  process.exit(1);
}

/* ── 3. Qué se va a hacer ─────────────────────────────────────────────────── */

console.log(`\nContrato: ${path.basename(contrato)}  (${tokens.length} tokens)`);
console.log(`  ${colores.length} colores → generate_settings.global_colors`);
for (const c of colores) console.log(`      ${c.slug.padEnd(18)} ${c.color}   (${c.name})`);

if (Object.keys(spacing).length) {
  console.log(`  ${Object.keys(spacing).length} campos → generate_spacing_settings`);
  for (const [k, v] of Object.entries(spacing)) console.log(`      ${k.padEnd(18)} ${v}px   (${mapaSpacing[k]})`);
} else {
  console.log(`  espaciado: nada que escribir.`);
  console.log(`      GeneratePress no tiene una escala de espaciado, solo campos fijos del chrome.`);
  console.log(`      Para fijar alguno, mapéalo en $metadata.wordpress.spacing del contrato.`);
}

console.log(`\n  Recuerda: esto da la paleta al EDITOR. No publica el contrato en el navegador —`);
console.log(`  eso lo hace el CSS que encola el plugin del proyecto. Compruébalo con`);
console.log(`  qa-contrato-publicado.mjs.`);

if (!live) {
  console.log(`\n⏸ Simulación. Añade --live para escribir de verdad.\n`);
  process.exit(0);
}

/* ── 4a. Canal wp-cli (el que funciona) ───────────────────────────────────── */

function porWpCli() {
  if (!sitio) { console.error("\n✖ Falta --sitio \"<ruta a app/public>\"."); process.exit(2); }
  if (!fs.existsSync(sitio)) { console.error(`\n✖ No existe ${sitio}`); process.exit(2); }

  const wp = path.join(RAIZ_PLUGIN, "herramientas", "wp-cli", "wp.cmd");
  if (!fs.existsSync(wp)) { console.error(`\n✖ No encuentro el envoltorio de wp-cli en ${wp}`); process.exit(2); }

  /* El PHP se escribe a un temporal y se ejecuta con `wp eval-file`. Va por
     fichero y no por `wp eval` en una línea para que las comillas del JSON no
     tengan que sobrevivir a dos capas de shell de Windows. */
  const php = `<?php
$colores  = json_decode( <<<'JSON'
${JSON.stringify(colores, null, 2)}
JSON
, true );
$spacing = json_decode( <<<'JSON'
${JSON.stringify(spacing, null, 2)}
JSON
, true );

$ajustes = get_option( 'generate_settings', array() );
$antes   = isset( $ajustes['global_colors'] ) ? count( $ajustes['global_colors'] ) : 0;
$ajustes['global_colors'] = $colores;
update_option( 'generate_settings', $ajustes );

if ( ! empty( $spacing ) ) {
	$esp = get_option( 'generate_spacing_settings', array() );
	foreach ( $spacing as $k => $v ) { $esp[ $k ] = $v; }
	update_option( 'generate_spacing_settings', $esp );
}

// Releer de la base de datos, no fiarse del array en memoria.
$comp = get_option( 'generate_settings', array() );
$hay  = array();
foreach ( $comp['global_colors'] as $c ) { $hay[ $c['slug'] ] = $c['color']; }
$ok = 0; $mal = 0;
foreach ( $colores as $c ) {
	if ( isset( $hay[ $c['slug'] ] ) && strtolower( $hay[ $c['slug'] ] ) === strtolower( $c['color'] ) ) { $ok++; }
	else { $mal++; WP_CLI::warning( $c['slug'] . ': esperado ' . $c['color'] . ', hay ' . ( isset( $hay[ $c['slug'] ] ) ? $hay[ $c['slug'] ] : '(ausente)' ) ); }
}

$espMal = 0;
if ( ! empty( $spacing ) ) {
	$compEsp = get_option( 'generate_spacing_settings', array() );
	foreach ( $spacing as $k => $v ) {
		if ( ! isset( $compEsp[ $k ] ) || (string) $compEsp[ $k ] !== (string) $v ) {
			$espMal++;
			WP_CLI::warning( $k . ': esperado ' . $v . ', hay ' . ( isset( $compEsp[ $k ] ) ? $compEsp[ $k ] : '(ausente)' ) );
		}
	}
}

if ( $mal || $espMal ) { WP_CLI::error( "colores: $ok bien, $mal mal | espaciado: $espMal mal" ); }
WP_CLI::success( "global_colors: $antes -> " . count( $comp['global_colors'] ) . ", verificados $ok | espaciado: " . count( $spacing ) . " campos" );
`;

  const tmp = path.join(os.tmpdir(), `wp-push-tokens-${process.pid}.php`);
  fs.writeFileSync(tmp, php, "utf8");
  try {
    const env = { ...process.env };
    if (puerto) env.WP_MYSQL_PORT = String(puerto);
    console.error(`\n→ Escribiendo por wp-cli en ${sitio}`);
    /* Hay que entrecomillar a mano lo que lleve espacios: la ruta de Local WP
       los lleva SIEMPRE («Local Sites»), y sin comillas el shell parte el --path
       en dos argumentos — wp-cli se queda con «C:/Users/David/Local/» y dice que
       ahí no hay WordPress. Es la trampa que la skill wp-cli-en-local ya avisaba.
       Se pasa la orden como UNA cadena, no como cadena + array: mezclar las dos
       cosas con shell:true está obsoleto desde Node 22 (DEP0190). */
    const orden = `"${wp}" eval-file "${tmp}" --path="${sitio}"`;
    const r = spawnSync(orden, { stdio: "inherit", env, shell: true });
    if (r.status !== 0) {
      console.error("\n✖ wp-cli falló. Si dice «conexión denegada», arranca el sitio en Local WP.");
      if (!puerto) console.error("  Y comprueba --puerto: cada sitio de Local usa el suyo (WP_MYSQL_PORT).");
      process.exit(1);
    }
  } finally {
    try { fs.unlinkSync(tmp); } catch { /* da igual */ }
  }
}

/* ── 4b. Canal abilities (cuando funcione) ────────────────────────────────── */

async function porAbilities() {
  const { WP_URL, WP_USER, WP_APP_PASSWORD } = process.env;
  if (!WP_URL || !WP_USER || !WP_APP_PASSWORD) {
    console.error("\n✖ Faltan WP_URL / WP_USER / WP_APP_PASSWORD.");
    process.exit(2);
  }
  const auth = "Basic " + Buffer.from(`${WP_USER}:${WP_APP_PASSWORD}`).toString("base64");
  const llamar = async (slug, input) => {
    const res = await fetch(`${WP_URL}/wp-json/wp-abilities/v1/abilities/${slug}/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: auth },
      body: JSON.stringify({ input }),
    });
    const texto = await res.text();
    if (!res.ok) throw new Error(`${slug} → HTTP ${res.status}: ${texto.slice(0, 250)}`);
    try { return JSON.parse(texto); } catch { return { raw: texto }; }
  };

  console.error(`\n→ Escribiendo por la Abilities API en ${WP_URL}`);
  try {
    const entrada = { global_colors: colores };
    if (Object.keys(spacing).length) entrada.spacing_settings = spacing;
    const r = await llamar("generatepress/update-settings", entrada);
    console.error("  ✔", r.message ?? JSON.stringify(r).slice(0, 200));
  } catch (e) {
    console.error("  ✖ " + e.message);
    console.error(`
  Este canal falla en WordPress 7.0 con mcp-abilities-generatepress 1.1.24, y
  está medido: wp_get_abilities() devuelve 49 abilities, generatepress/
  update-settings entre ellas, pero el controlador REST solo expone 2, las dos
  de core, con el mismo usuario administrador y en el mismo proceso. El plugin
  declara "Requires at least: 6.9".

  Usa el canal por defecto:  --sitio "<ruta app/public>" --puerto <N>`);
    process.exit(1);
  }

  if (verificar) {
    const back = await llamar("generatepress/get-settings", {});
    const got = back.global_colors ?? back.result?.global_colors ?? [];
    const hay = Object.fromEntries(got.map((c) => [c.slug, c.color]));
    let ok = 0, mal = 0;
    for (const c of colores) {
      if ((hay[c.slug] ?? "").toLowerCase() === c.color.toLowerCase()) ok++;
      else { mal++; console.error(`  ✖ ${c.slug}: esperado ${c.color}, WP tiene ${hay[c.slug] ?? "(ausente)"}`); }
    }
    console.error(`  ${ok} coinciden, ${mal} discrepan.`);
    if (mal) process.exit(1);
  }
}

/* ── 5. Adelante ──────────────────────────────────────────────────────────── */

if (via === "abilities") {
  await porAbilities();
} else if (via === "wp-cli") {
  porWpCli();   /* verifica siempre por dentro: releer de la BD es gratis */
} else {
  console.error(`✖ --via desconocido: «${via}». Usa wp-cli (por defecto) o abilities.`);
  process.exit(2);
}

console.log(`
Si el frontend no refleja el cambio, limpia la caché de GP/GB.
Y recuerda que esto NO publica el contrato: eso se comprueba con
  node herramientas/conversion/scripts/qa-contrato-publicado.mjs <url> --tokens <x.tokens.css>
`);
