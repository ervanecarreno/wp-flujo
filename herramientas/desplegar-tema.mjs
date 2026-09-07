#!/usr/bin/env node
/**
 * desplegar-tema.mjs — copia el tema hijo del repo al tema real de Local WP.
 *
 * Cierra la trampa 12 de la skill `flujo-wordpress-generateblocks`, pagada
 * en ACELIA el 7/09/2026: `wp/tema-hijo/` es la carpeta VERSIONADA del
 * proyecto, no el tema activo del sitio — no hay symlink entre
 * `wp/tema-hijo/` y `Local Sites/<sitio>/app/public/wp-content/themes/<tema>/`.
 * `instalar-gsap.js` (y cualquier edición manual de `functions.php` o
 * `assets/`) escribe solo en el repo. Sin este paso, la fase 6 se dio por
 * hecha en `ESTADO.md` durante TRES DÍAS sin que el sitio sirviera el
 * script, y `node verificar.mjs` no lo detectó: no comprueba scripts
 * encolados, solo el contrato de diseño y el marcado.
 *
 * Qué hace, en este orden:
 *   1. Lee el "Text Domain" de `wp/tema-hijo/style.css` — el slug que
 *      `nuevo-proyecto.js` ya fija al crear el proyecto.
 *   2. Copia TODO `wp/tema-hijo/` a
 *      `<sitio>/wp-content/themes/generatepress-<slug>/`
 *      (la convención de nombre fija de este flujo — ver `nuevo-proyecto.js`).
 *   3. `php -l` sobre el `functions.php` ya copiado: si el tema hijo tiene un
 *      error de sintaxis, mejor enterarse aquí que con la web caída.
 *
 * Qué NO hace: activar el tema, empujar el contrato a `generate_settings`,
 * ni regenerar el CSS de GenerateBlocks. Son pasos aparte porque tienen su
 * propia herramienta (`wp theme activate`, `wp-push-tokens.mjs`,
 * `gb-regenerar-css.mjs`) y no siempre hacen falta los tres juntos.
 *
 * Uso:
 *   node herramientas/desplegar-tema.mjs --sitio "<...>/app/public" [--tema-hijo wp/tema-hijo]
 *
 * Corre esto cada vez que toques algo dentro de `wp/tema-hijo/` — no solo
 * tras `instalar-gsap.js`: un cambio a mano en `functions.php` o en
 * `assets/animations.js` tampoco llega solo al sitio.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const args = process.argv.slice(2);
const opt = (n, def = null) => { const i = args.indexOf(n); return i !== -1 ? args[i + 1] : def; };

const sitio = opt("--sitio");
const temaHijo = path.resolve(opt("--tema-hijo", path.join("wp", "tema-hijo")));

if (!sitio) {
  console.error(`Uso: node herramientas/desplegar-tema.mjs --sitio "<...>/app/public" [--tema-hijo wp/tema-hijo]`);
  process.exit(2);
}
if (!fs.existsSync(path.join(sitio, "wp-load.php"))) {
  console.error(`✖ En esa ruta no hay un WordPress (no encuentro wp-load.php):\n  ${sitio}`);
  console.error(`  Tiene que acabar en app/public.`);
  process.exit(2);
}
const functionsPhp = path.join(temaHijo, "functions.php");
const styleCss = path.join(temaHijo, "style.css");
if (!fs.existsSync(functionsPhp) || !fs.existsSync(styleCss)) {
  console.error(`✖ ${temaHijo} no parece un tema hijo de este flujo (falta functions.php o style.css).`);
  process.exit(2);
}

const slug = fs.readFileSync(styleCss, "utf8").match(/Text Domain:\s*([a-z0-9-]+)/i)?.[1];
if (!slug) {
  console.error(`✖ ${styleCss} no tiene "Text Domain:" — no puedo deducir la carpeta del tema en Local.`);
  process.exit(2);
}

const nombreTema = `generatepress-${slug}`;
const destino = path.join(sitio, "wp-content", "themes", nombreTema);

fs.mkdirSync(destino, { recursive: true });
fs.cpSync(temaHijo, destino, { recursive: true, force: true });

const ficheros = [];
(function listar(dir, base) {
  for (const nombre of fs.readdirSync(dir)) {
    const abs = path.join(dir, nombre);
    const rel = path.join(base, nombre);
    if (fs.statSync(abs).isDirectory()) listar(abs, rel);
    else ficheros.push(rel);
  }
})(destino, "");
console.log(`✔ ${ficheros.length} fichero(s) copiados a:\n  ${destino}`);
for (const f of ficheros.sort()) console.log(`  · ${f}`);

/* php -l sobre el fichero YA COPIADO: comprueba lo que el sitio va a
 * ejecutar de verdad, no la fuente del repo (que podría no ser lo mismo si
 * la copia fallara a medias). */
const PHP = path.join(RAIZ, "herramientas", "wp-cli", "php.cmd");
if (fs.existsSync(PHP)) {
  const { spawnSync } = await import("node:child_process");
  const r = spawnSync(`"${PHP}" -l "${path.join(destino, "functions.php")}"`, { shell: true, encoding: "utf8" });
  const salida = (r.stdout || r.stderr || "").trim();
  if (r.status === 0) {
    console.log(`✔ functions.php: sin errores de sintaxis.`);
  } else {
    console.error(`✖ functions.php tiene un error de sintaxis:\n${salida}`);
    process.exit(1);
  }
} else {
  console.error(`⚠ No encuentro ${PHP} — no se pudo comprobar la sintaxis de functions.php.`);
}

console.log(`
Tema real: "${nombreTema}" en wp-content/themes/.

Si es la primera vez que se despliega este tema, falta activarlo:
  wp theme activate ${nombreTema} --path="${sitio}"
(con WP_MYSQL_PORT del sitio si wp-cli lo pide — ver la skill wp-cli-en-local)

Y comprueba en el navegador que lo nuevo se sirve de verdad — un fichero
copiado no es lo mismo que un fichero servido:
  document.scripts  (o los estilos, con document.styleSheets)
"declarar no es publicar" es la misma trampa de siempre, aplicada al tema.`);
