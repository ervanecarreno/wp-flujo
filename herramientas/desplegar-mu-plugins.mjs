#!/usr/bin/env node
/**
 * desplegar-mu-plugins.mjs — copia los mu-plugins del repo al WordPress real.
 *
 * Es el hermano de `desplegar-tema.mjs`, y existe por el mismo motivo y con el mismo
 * fallo detrás. `COMO-TRABAJAMOS.md` reparte el código en dos sitios —«el aspecto va al
 * tema hijo, el comportamiento y los tipos de contenido van a un mu-plugin»— pero el
 * flujo solo tenía desplegador para UNO de los dos. El resultado, la primera vez que un
 * proyecto usó de verdad la mitad que faltaba (Fundación SC La Palma, 22/09/2026), fue
 * una carpeta `wp/mu-plugins/` versionada, revisada y comentada que el sitio no cargaba:
 * `wp-content/mu-plugins/` estaba vacía y no hay ningún error que lo diga. Es
 * exactamente la trampa 12 («declarar no es publicar»), aplicada a la otra mitad.
 *
 * Qué hace:
 *   1. Copia TODO `wp/mu-plugins/` a `<sitio>/wp-content/mu-plugins/`.
 *   2. `php -l` sobre cada `.php` YA COPIADO. Y esto importa más aquí que en el tema: un
 *      mu-plugin con un error de sintaxis tumba el sitio ENTERO, portada y escritorio
 *      incluidos, porque WordPress los carga antes que nada y no hay forma de
 *      desactivarlo desde la interfaz. Si algo no compila, este script lo dice antes de
 *      que lo diga una pantalla en blanco.
 *
 * Qué NO hace: borrar del destino lo que ya no esté en el repo. Un mu-plugin puede haber
 * llegado ahí por otra vía (otro proyecto, el hosting, un plugin que se instala solo), y
 * borrar a ciegas lo que no reconoce sería peor que dejarlo.
 *
 * Uso:
 *   node herramientas/desplegar-mu-plugins.mjs --sitio "<...>/app/public" [--origen wp/mu-plugins]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const args = process.argv.slice(2);
const opt = (n, def = null) => { const i = args.indexOf(n); return i !== -1 ? args[i + 1] : def; };

const sitio = opt("--sitio");
const origen = path.resolve(opt("--origen", path.join("wp", "mu-plugins")));

if (!sitio) {
  console.error(`Uso: node herramientas/desplegar-mu-plugins.mjs --sitio "<...>/app/public" [--origen wp/mu-plugins]`);
  process.exit(2);
}
if (!fs.existsSync(path.join(sitio, "wp-load.php"))) {
  console.error(`✖ En esa ruta no hay un WordPress (no encuentro wp-load.php):\n  ${sitio}`);
  console.error(`  Tiene que acabar en app/public.`);
  process.exit(2);
}
if (!fs.existsSync(origen)) {
  console.error(`✖ No existe ${origen}. Si este proyecto no tiene mu-plugins, no hace falta este paso.`);
  process.exit(2);
}

const destino = path.join(sitio, "wp-content", "mu-plugins");
fs.mkdirSync(destino, { recursive: true });
fs.cpSync(origen, destino, { recursive: true, force: true });

const copiados = [];
(function listar(dir, base) {
  for (const nombre of fs.readdirSync(dir)) {
    const abs = path.join(dir, nombre);
    const rel = path.join(base, nombre);
    if (fs.statSync(abs).isDirectory()) listar(abs, rel);
    else copiados.push(rel);
  }
})(origen, "");

console.log(`✔ ${copiados.length} fichero(s) copiados a:\n  ${destino}`);
for (const f of copiados.sort()) console.log(`  · ${f}`);

const PHP = path.join(RAIZ, "herramientas", "wp-cli", "php.cmd");
if (!fs.existsSync(PHP)) {
  console.error(`⚠ No encuentro ${PHP} — no se pudo comprobar la sintaxis. Hazlo antes de recargar el sitio.`);
  process.exit(0);
}

const { spawnSync } = await import("node:child_process");
let fallos = 0;
for (const rel of copiados.filter((f) => f.endsWith(".php"))) {
  const r = spawnSync(`"${PHP}" -l "${path.join(destino, rel)}"`, { shell: true, encoding: "utf8" });
  if (r.status !== 0) {
    fallos++;
    console.error(`✖ ${rel} tiene un error de sintaxis:\n${(r.stdout || r.stderr || "").trim()}`);
  }
}

if (fallos) {
  console.error(`\n✖ ${fallos} mu-plugin(s) no compilan. NO recargues el sitio hasta arreglarlo:`);
  console.error(`  un mu-plugin roto tumba también el escritorio, y no se puede desactivar desde la interfaz.`);
  process.exit(1);
}

console.log(`✔ Todos los .php compilan.

Los mu-plugins se activan SOLOS: no hay nada que activar ni que pulsar. Compruébalo
pidiéndole al sitio un dato que solo pueda salir de ellos —una meta registrada, un CPT en
"wp post-type list"— y no dando por hecho que están porque el fichero esté copiado.`);
