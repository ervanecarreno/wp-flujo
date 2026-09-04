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
 * **Los Elementos de GeneratePress no tienen hoja propia.** GB funde el CSS del
 * header + el del footer + el de la página en el `style-<ID>.css **de la
 * PÁGINA**. Pasarle el ID de un Elemento borra un fichero que no existe y no
 * arregla nada. Por eso hay `--elemento <ID>`: lee sus condiciones de
 * visualización (`_generate_element_display_conditions`), resuelve en qué
 * páginas se muestra y regenera esas. Si le pasas un Elemento por `--post`, lo
 * detecta y lo trata como `--elemento`, avisando.
 *
 * Uso:
 *   node herramientas/gb-regenerar-css.mjs --sitio "<app/public>" [--puerto N] \
 *     --post 49550 --url http://sitio.local/pagina/ [--marcado build/pagina.html]
 *
 *   node herramientas/gb-regenerar-css.mjs --sitio "<app/public>" --puerto 10011 \
 *     --elemento 49650 --marcado build/header.html
 *
 *   `--post`/`--elemento` se pueden repetir; `--url` y `--marcado` se enganchan
 *   al último que se haya escrito antes, así que el orden en la línea de
 *   comandos es el que manda. Con `--elemento` el `--url` sobra: se deduce.
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

const sitio = opt("--sitio");
const puerto = opt("--puerto");

/* `--url` y `--marcado` se enganchan al último `--post`/`--elemento` escrito.
   Es lo que la gente teclea de forma natural, y evita el emparejamiento por
   posición de la versión anterior (tres listas paralelas que había que
   mantener en el mismo orden, fácil de descuadrar). */
const entradas = [];
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === "--post" || a === "--elemento") { entradas.push({ tipo: a.slice(2), id: args[++i], url: null, marcado: null }); continue; }
  if (a !== "--url" && a !== "--marcado") continue;
  if (!entradas.length) { console.error(`✖ ${a} va DESPUÉS de un --post o --elemento.`); process.exit(2); }
  entradas.at(-1)[a.slice(2)] = args[++i];
}

if (!sitio || !entradas.length) {
  console.error(`Uso: node herramientas/gb-regenerar-css.mjs --sitio "<app/public>" [--puerto N] --post <ID> [--url <url>] [--marcado <fichero.html>]
     o:  node herramientas/gb-regenerar-css.mjs --sitio "<app/public>" [--puerto N] --elemento <ID> [--marcado <fichero.html>]

  --post      ID de una PÁGINA (la que se ve en el navegador).
  --elemento  ID de un Elemento de GeneratePress (header/footer). Resuelve solo
              en qué páginas se muestra: los Elementos no tienen hoja propia.`);
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

const wpJson = (trozos, def = null) => { try { return JSON.parse(wp(trozos)); } catch { return def; } };

/* ── 0. Resolver los Elementos a las páginas donde se muestran ─────────────
   Las condiciones de GeneratePress viven en `_generate_element_display_conditions`
   y su vocabulario es amplio (`general:site`, `post:<tipo>` con o sin objeto,
   archivos, taxonomías, roles…). Reimplementar `GeneratePress_Conditions::show_data()`
   aquí sería frágil, así que se resuelven las reglas que de verdad se usan en
   header/footer y, ante cualquier otra, se cae a «todas las páginas»: regenerar
   de más no rompe nada, solo tarda. Lo que NO se hace es callarse — se dice
   cuál no se supo interpretar. */
const TOPE_PAGINAS = 60;

const paginasPublicadas = (tipos = "page,post") =>
  (wpJson(`post list --post_type=${tipos} --post_status=publish --fields=ID,url --format=json`, []) ?? [])
    .map((p) => ({ id: String(p.ID), url: p.url }));

function tipoDePost(id) {
  return wp(`post get ${id} --field=post_type`).trim();
}

function resolverElemento(id) {
  const titulo = wp(`post get ${id} --field=post_title`).trim();
  const condiciones = wpJson(`post meta get ${id} _generate_element_display_conditions --format=json`, []) ?? [];
  const reglas = (Array.isArray(condiciones) ? condiciones : [condiciones]).filter(Boolean);

  const destinos = new Map();
  const sinResolver = [];
  const meter = (lista) => lista.forEach((p) => destinos.set(p.id, p));

  for (const c of reglas) {
    const regla = c?.rule ?? "";
    const objeto = c?.object ? String(c.object) : "";
    if (regla === "general:site" || regla === "general:singular") { meter(paginasPublicadas()); continue; }
    if (regla === "general:front_page") {
      const portada = wp("option get page_on_front").trim();
      if (portada && portada !== "0") meter(paginasPublicadas().filter((p) => p.id === portada));
      continue;
    }
    if (regla.startsWith("post:") && !regla.includes(":taxonomy:")) {
      const tipo = regla.slice(5);
      const todas = paginasPublicadas(tipo);
      meter(objeto ? todas.filter((p) => p.id === objeto) : todas);
      continue;
    }
    sinResolver.push(regla || "(sin regla)");
  }

  if (sinResolver.length) {
    console.error(`  ⚠ «${titulo}» (${id}): no sé interpretar ${sinResolver.join(", ")} — se regeneran TODAS las páginas por si acaso.`);
    meter(paginasPublicadas());
  }

  const lista = [...destinos.values()];
  console.error(`  · «${titulo}» (${id}) se muestra en ${lista.length} página(s)`);
  return lista.slice(0, TOPE_PAGINAS);
}

/* Un `--post` que en realidad es un Elemento es el error que motivó todo esto:
   se corrige solo, en vez de borrar un fichero inexistente y decir que todo va
   bien. */
const objetivos = new Map(); // id → { id, url, marcados:Set }
const anotar = (id, url, marcado) => {
  const o = objetivos.get(id) ?? { id, url, marcados: new Set() };
  if (url) o.url = url;
  if (marcado) o.marcados.add(marcado);
  objetivos.set(id, o);
};

console.error("");
for (const e of entradas) {
  let { tipo, id, url, marcado } = e;
  if (tipo === "post" && tipoDePost(id) === "gp_elements") {
    console.error(`  ⚠ ${id} es un Elemento de GeneratePress, no una página: los Elementos no tienen hoja propia. Se resuelve como --elemento.`);
    tipo = "elemento";
  }
  if (tipo === "elemento") { for (const p of resolverElemento(id)) anotar(p.id, p.url, marcado); continue; }
  anotar(id, url, marcado);
}

const posts = [...objetivos.keys()];

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
   anidados y una expresión regular no basta.
   Ojo al prefijo: `wp:generateblocks` a secas, SIN la barra, para que entren
   también los `generateblocks-pro/…`. Hasta el 4/09/2026 exigía la barra y los
   bloques Pro (site-header, navigation, menu-container, classic-menu…) no se
   comprobaban: un header entero podía quedarse sin CSS y la línea final seguía
   diciendo «todos los bloques tienen su regla servida». */
function bloquesDe(marcado) {
  const salida = [];
  let i = 0;
  while ((i = marcado.indexOf("<!-- wp:generateblocks", i)) !== -1) {
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

for (const { id, url, marcados } of objetivos.values()) {
  if (!url) { console.error(`\n  ⏭ post ${id}: sin --url, no se puede forzar ni comprobar.`); continue; }

  console.error(`\n→ ${url}`);
  let html;
  try { html = await bajar(url); }
  catch (e) { console.error(`  ✖ no se pudo pedir: ${e.message}`); fallos++; continue; }

  const f = path.join(dirCss, `style-${id}.css`);
  console.error(fs.existsSync(f) ? `  ✔ style-${id}.css reescrita (${fs.statSync(f).size} bytes)` : `  ⚠ style-${id}.css sigue sin existir`);

  /* ── 4. Comprobar que cada bloque con css tiene su regla ───────────────── */
  if (!marcados.size) continue;

  /* El CSS servido se baja UNA vez por página, aunque se comprueben varios
     marcados (típico: la página + su header + su footer). */
  let css = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]).join("\n");
  for (const m of html.matchAll(/<link\b[^>]*href=["']([^"']*generateblocks[^"']*\.css[^"']*)["']/gi)) {
    /* WordPress escribe los & como &#038;; sin decodificar se pide otra URL. */
    const enlace = m[1].replace(/&#0*38;|&amp;/g, "&");
    try { css += "\n" + await bajar(new URL(enlace, url).href); } catch { /* hoja inaccesible */ }
  }

  for (const marcado of marcados) {
    const etiqueta = marcados.size > 1 ? ` (${path.basename(marcado)})` : "";
    if (!fs.existsSync(marcado)) { console.error(`  ⚠ no existe ${marcado}, no se comprueba`); continue; }

    const bloques = bloquesDe(fs.readFileSync(marcado, "utf8"));
    const conCss = [...new Set(bloques.filter((b) => b.css).map((b) => b.uniqueId))];

    /* Un Elemento puede resolver a páginas donde al final NO se pinta (una
       condición que este script interpretó de más, o una exclusión que no
       entiende). Ahí, «faltan todas las reglas» sería una falsa alarma: si no
       aparece NI UN uniqueId en el HTML servido, es que el Elemento no está en
       esta página, y no hay nada que comprobar. */
    const ids = [...new Set(bloques.map((b) => b.uniqueId).filter(Boolean))];
    if (ids.length && !ids.some((u) => html.includes(u))) {
      console.error(`  ⏭ el marcado${etiqueta} no se renderiza en esta página; no se comprueba`);
      continue;
    }

    const sinRegla = conCss.filter((u) => !css.includes(u));
    if (sinRegla.length) {
      console.error(`  ✖ ${sinRegla.length} de ${conCss.length} bloques con css NO tienen regla servida${etiqueta}`);
      console.error("      " + sinRegla.slice(0, 10).join(" "));
      fallos++;
    } else {
      console.error(`  ✔ los ${conCss.length} bloques con css tienen su regla servida${etiqueta}`);
    }
  }
}

console.error(fallos
  ? `\n✖ ${fallos} página(s) siguen sin su CSS completo.\n`
  : `\n✔ CSS regenerado (${borradas} hoja(s) borradas y reescritas).\n`);
/* Se marca el código y se deja que Node termine solo. Con `process.exit()` en
   caliente, las conexiones que `fetch` deja abiertas hacen que libuv aborte en
   Windows con «Assertion failed: !(handle->flags & UV_HANDLE_CLOSING)». El
   trabajo ya estaba hecho, pero un aviso así en una herramienta de QA resta
   confianza a todo lo demás que imprime. */
process.exitCode = fallos ? 1 : 0;
