#!/usr/bin/env node
/**
 * gb-regenerar-css.mjs — obliga a GenerateBlocks a rehacer el CSS de una página.
 *
 * La trampa que cierra, descubierta el 2/09/2026 y que afecta a todo el flujo:
 *
 *   **Importar marcado con wp-cli deja el CSS de GenerateBlocks caducado.**
 *
 * GB no escribe los estilos en el marcado: los guarda en
 * `wp-content/uploads/generateblocks/style-<postID>.css`, y lo regenera cuando
 * se guarda desde el editor. `wp post create` y `wp post update` no lo
 * disparan, así que la página queda servida con el CSS de la versión anterior.
 *
 * Y el fallo es silencioso de la peor manera: la página **carga**, con su
 * estructura y su contenido. Solo que los bloques nuevos salen sin estilo, con
 * la tipografía y los tamaños del tema. Medido en la landing del proyecto de
 * referencia: 95 bloques declaraban `css`, y **25 no tenían regla servida**. La
 * cita del testimonio salía en Manrope de 18px en vez de Fraunces de 36.
 *
 * No lo ve ningún validador —el marcado es correcto—, ni el round-trip, ni el
 * editor, ni la comprobación de tokens: los tokens resuelven, es la regla que
 * los usa la que no existe.
 *
 * Qué hace, en este orden:
 *   1. Borra `style-<postID>.css`. GB lo vuelve a escribir en la siguiente
 *      visita a la página.
 *   2. Sube `generateblocks_dynamic_css_time`, que es el `?ver=` del enlace:
 *      sin eso, quien tuviera la hoja en caché seguiría con la vieja.
 *   3. Pide la página una vez, para que GB lo escriba ya y no en la primera
 *      visita de otra persona.
 *   4. Comprueba que cada bloque con `css` tiene su regla servida.
 *
 * Uso:
 *   node herramientas/gb-regenerar-css.mjs --sitio "<app/public>" [--puerto N] \
 *     --post 49550 --url http://sitio.local/pagina/ [--marcado build/pagina.html]
 *
 *   Se pueden repetir --post/--url/--marcado en el mismo orden para varias páginas.
 *
 * Salida: 0 = todo servido · 1 = quedan bloques sin regla · 2 = no se pudo.
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const RAIZ = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const args = process.argv.slice(2);
const opt = (n, def = null) => { const i = args.indexOf(n); return i !== -1 ? args[i + 1] : def; };
const todos = (n) => args.reduce((a, v, i) => (v === n ? [...a, args[i + 1]] : a), []);

const sitio = opt("--sitio");
const puerto = opt("--puerto");
const posts = todos("--post");
const urls = todos("--url");
const marcados = todos("--marcado");

if (!sitio || !posts.length) {
  console.error(`Uso: node herramientas/gb-regenerar-css.mjs --sitio "<app/public>" [--puerto N] --post <ID> [--url <url>] [--marcado <fichero.html>]`);
  process.exit(2);
}
if (!fs.existsSync(sitio)) { console.error(`✖ No existe ${sitio}`); process.exit(2); }

const WP = path.join(RAIZ, "herramientas", "wp-cli", "wp.cmd");
function wp(trozos) {
  const env = { ...process.env };
  if (puerto) env.WP_MYSQL_PORT = String(puerto);
  /* Una sola cadena: la ruta de Local WP lleva espacios y el shell la partiría. */
  const r = spawnSync(`"${WP}" ${trozos} --path="${sitio}"`, { shell: true, env, encoding: "utf8" });
  if (r.status !== 0) {
    console.error("✖ wp-cli falló: " + (r.stderr || r.stdout || "").trim().split("\n")[0]);
    console.error("  Si dice «conexión denegada», arranca el sitio en Local WP.");
    process.exit(2);
  }
  return (r.stdout ?? "").trim();
}

/* ── 1. Borrar las hojas caducadas ────────────────────────────────────────── */

const dirCss = path.join(sitio, "wp-content", "uploads", "generateblocks");
let borradas = 0;
for (const id of posts) {
  const f = path.join(dirCss, `style-${id}.css`);
  if (fs.existsSync(f)) { fs.unlinkSync(f); borradas++; console.error(`  · borrada style-${id}.css`); }
  else console.error(`  · style-${id}.css no existía`);
}

/* ── 2. Atrasar el sello de tiempo ────────────────────────────────────────
   `generateblocks_dynamic_css_time` PARECE un rompe-cachés —es el `?ver=` del
   enlace— pero en el código de GB es un LIMITADOR DE FRECUENCIA:

       if ( 5 <= ( $current_time - $last_time ) ) { ...escribe el fichero... }

   Ponerlo a «ahora» hace justo lo contrario de lo que uno espera: GB se niega a
   escribir durante 5 segundos y la página sale SIN NADA de CSS. Pasó al primer
   intento. Se atrasa, y así el límite ya está cumplido; GB lo pondrá al día él
   mismo al escribir, y eso es lo que rompe la caché. */
wp(`option update generateblocks_dynamic_css_time ${Math.floor(Date.now() / 1000) - 60}`);
console.error("  · generateblocks_dynamic_css_time atrasado 60s (levanta el límite de escritura)");

/* ── 3. Pedir cada página para que GB reescriba ───────────────────────────── */

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36";
const bajar = async (u) => {
  const res = await fetch(u, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
};

/* Extrae los bloques del marcado contando llaves: el JSON lleva objetos
   anidados y una expresión regular no basta. */
function bloquesDe(marcado) {
  const salida = [];
  let i = 0;
  while ((i = marcado.indexOf("<!-- wp:generateblocks/", i)) !== -1) {
    const j = marcado.indexOf("{", i);
    if (j === -1) break;
    let d = 0, k = j, enCadena = false, escapado = false;
    for (; k < marcado.length; k++) {
      const c = marcado[k];
      if (escapado) { escapado = false; continue; }
      if (c === "\\") { escapado = true; continue; }
      if (enCadena) { if (c === '"') enCadena = false; continue; }
      if (c === '"') { enCadena = true; continue; }
      if (c === "{") d++;
      else if (c === "}") { d--; if (d === 0) { k++; break; } }
    }
    try { salida.push(JSON.parse(marcado.slice(j, k))); } catch { /* bloque raro: se ignora */ }
    i = k;
  }
  return salida;
}

let fallos = 0;

for (let n = 0; n < posts.length; n++) {
  const id = posts[n], url = urls[n], marcado = marcados[n];
  if (!url) { console.error(`\n  ⏭ post ${id}: sin --url, no se puede forzar ni comprobar.`); continue; }

  console.error(`\n→ ${url}`);
  let html;
  try { html = await bajar(url); }
  catch (e) { console.error(`  ✖ no se pudo pedir: ${e.message}`); fallos++; continue; }

  const f = path.join(dirCss, `style-${id}.css`);
  console.error(fs.existsSync(f) ? `  ✔ style-${id}.css reescrita (${fs.statSync(f).size} bytes)` : `  ⚠ style-${id}.css sigue sin existir`);

  /* ── 4. Comprobar que cada bloque con css tiene su regla ───────────────── */
  if (!marcado) continue;
  if (!fs.existsSync(marcado)) { console.error(`  ⚠ no existe ${marcado}, no se comprueba`); continue; }

  const conCss = [...new Set(bloquesDe(fs.readFileSync(marcado, "utf8")).filter((b) => b.css).map((b) => b.uniqueId))];
  let css = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]).join("\n");
  for (const m of html.matchAll(/<link\b[^>]*href=["']([^"']*generateblocks[^"']*\.css[^"']*)["']/gi)) {
    /* WordPress escribe los & como &#038;; sin decodificar se pide otra URL. */
    const enlace = m[1].replace(/&#0*38;|&amp;/g, "&");
    try { css += "\n" + await bajar(new URL(enlace, url).href); } catch { /* hoja inaccesible */ }
  }
  const sinRegla = conCss.filter((u) => !css.includes(u));
  if (sinRegla.length) {
    console.error(`  ✖ ${sinRegla.length} de ${conCss.length} bloques con css NO tienen regla servida`);
    console.error("      " + sinRegla.slice(0, 10).join(" "));
    fallos++;
  } else {
    console.error(`  ✔ los ${conCss.length} bloques con css tienen su regla servida`);
  }
}

console.error(fallos
  ? `\n✖ ${fallos} página(s) siguen sin su CSS completo.\n`
  : `\n✔ CSS regenerado (${borradas} hoja(s) borradas y reescritas).\n`);
process.exit(fallos ? 1 : 0);
