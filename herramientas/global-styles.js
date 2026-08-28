#!/usr/bin/env node
/**
 * Los Global Styles de GenerateBlocks, versionables en git.
 *
 * Un Global Style es una regla CSS con nombre, guardada en el tipo de contenido
 * `gblocks_styles`. Cada uno tiene selector, CSS compilado y el objeto de estilos en
 * camelCase (la misma forma que el atributo `styles` de un bloque). El ORDEN importa:
 * GenerateBlocks saca el CSS de arriba abajo, y eso es la especificidad.
 *
 * Verificado el 28/08/2026 contra GenerateBlocks Pro 2.7.0. **Esto corrige la conclusión
 * anterior del flujo**, que daba los Global Styles por no versionables: el CPT sí está
 * expuesto en la API REST (`rest_base: gblocks_styles`) y se maneja bien por wp-cli.
 *
 * Para qué sirve de verdad: define los componentes del diseño UNA vez como global styles
 * (`.emsa-card`, `.emsa-btn--primary`) y emite los bloques con `globalClasses` en vez de
 * estilos por bloque. Así el marcado queda sin un solo HEX y hay un único sitio donde
 * cambiar las cosas.
 *
 * Node, sin dependencias. El sitio tiene que estar ARRANCADO en Local.
 *
 *   node herramientas/global-styles.js exportar --path="<sitio>"
 *   node herramientas/global-styles.js importar --path="<sitio>"              (solo informa)
 *   node herramientas/global-styles.js importar --path="<sitio>" --confirmar  (escribe)
 */

const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const args = process.argv.slice(2);
const accion = args.find((a) => !a.startsWith('--'));
const opt = (n, def) => {
  const a = args.find((x) => x.startsWith('--' + n + '='));
  return a ? a.slice(n.length + 3) : def;
};
const rutaSitio = opt('path');
const fichero = path.resolve(opt('fichero', 'global-styles.json'));
const confirmar = args.includes('--confirmar');

if (accion !== 'exportar' && accion !== 'importar') {
  console.error('Uso:');
  console.error('  node herramientas/global-styles.js exportar --path="<sitio>" [--fichero=global-styles.json]');
  console.error('  node herramientas/global-styles.js importar --path="<sitio>" [--fichero=...] --confirmar');
  console.error('');
  console.error('Sin --confirmar, importar solo simula y te dice qué haría.');
  process.exit(2);
}
if (!rutaSitio) {
  console.error('ERROR: falta --path="<ruta del WordPress>".');
  process.exit(2);
}
if (!fs.existsSync(path.join(rutaSitio, 'wp-load.php'))) {
  console.error('ERROR: en esa ruta no hay un WordPress (no encuentro wp-load.php):');
  console.error('  ' + rutaSitio);
  process.exit(2);
}

/** El puerto de MySQL propio que Local da a cada sitio (mismo mecanismo que config-tema.js). */
function puertoDeLocal(rutaWp) {
  const f = path.join(process.env.APPDATA || '', 'Local', 'sites.json');
  if (!fs.existsSync(f)) return null;
  let sitios;
  try {
    sitios = JSON.parse(fs.readFileSync(f, 'utf8'));
  } catch {
    return null;
  }
  const norm = (p) => path.resolve(p.replace(/^~/, os.homedir())).toLowerCase();
  const objetivo = norm(rutaWp);
  for (const s of Object.values(sitios)) {
    if (!s || !s.path) continue;
    if (objetivo.startsWith(norm(s.path))) {
      const p = s.services?.mysql?.ports?.MYSQL;
      if (Array.isArray(p) && p.length) return String(p[0]);
    }
  }
  return null;
}

const puerto = puertoDeLocal(rutaSitio);
const WP = path.join(__dirname, 'wp-cli', 'wp.cmd');
const PHP = path.join(__dirname, 'wp-cli', 'global-styles.php');

for (const [f, que] of [[WP, 'el envoltorio de wp-cli'], [PHP, 'el script PHP']]) {
  if (!fs.existsSync(f)) {
    console.error('ERROR: no encuentro ' + que + ': ' + f);
    process.exit(2);
  }
}

const entrecomillar = (a) => (/[\s"&()^|<>]/.test(a) ? '"' + a.replace(/"/g, '\\"') + '"' : a);

function wp(argumentos) {
  const linea = [WP, ...argumentos, '--path=' + rutaSitio].map(entrecomillar).join(' ');
  const r = spawnSync(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', linea], {
    windowsVerbatimArguments: true,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    env: puerto ? { ...process.env, WP_MYSQL_PORT: puerto } : process.env,
  });
  return {
    ok: r.status === 0,
    salida: (r.stdout || '').trim(),
    error: (r.stderr || '').trim() || (r.error ? r.error.message : ''),
  };
}

const esFalloDeBd = (t) => /mysqli_real_connect|establishing a database|2002|1045|denegad/i.test(t || '');

// `wp core version` lee un fichero, no la base de datos: no sirve para comprobar la conexión.
const bd = wp(['option', 'get', 'siteurl']);
if (!bd.ok) {
  console.error('');
  if (esFalloDeBd(bd.error)) {
    console.error('ERROR: la base de datos del sitio no responde. Arráncalo en Local (Start site).');
    if (puerto) console.error('El puerto de MySQL es el ' + puerto + ', ya lo estoy usando: está parado.');
  } else {
    console.error('ERROR: wp-cli no puede trabajar con ese sitio.');
    console.error(bd.error || '(sin mensaje)');
  }
  process.exit(1);
}

console.log('=== GLOBAL STYLES DE GENERATEBLOCKS ===');
console.log('  Sitio:    ' + rutaSitio + (puerto ? '   (MySQL en el puerto ' + puerto + ')' : ''));
console.log('  Fichero:  ' + fichero);
console.log('');

if (accion === 'exportar') {
  const r = wp(['eval-file', PHP, 'exportar', fichero]);
  console.log(r.salida || r.error);
  if (!r.ok) process.exit(1);
  console.log('');
  console.log('=== SIGUIENTE PASO ===');
  console.log('  git add ' + path.relative(process.cwd(), fichero).replace(/\\/g, '/'));
  console.log('  git commit -m "Global styles de GenerateBlocks"');
  console.log('');
  console.log('El ORDEN del array es la especificidad: GB saca el CSS de arriba abajo.');
  console.log('Si reordenas ese fichero, cambias qué regla gana. No lo hagas sin querer.');
} else {
  if (!fs.existsSync(fichero)) {
    console.error('ERROR: no existe ' + fichero);
    console.error('Exporta primero, o indica el fichero con --fichero=<ruta>.');
    process.exit(2);
  }
  const r = wp(['eval-file', PHP, 'importar', fichero, ...(confirmar ? [] : ['dry'])]);
  console.log(r.salida || r.error);
  if (!r.ok) process.exit(1);
  if (!confirmar) {
    console.log('');
    console.log('=== NO SE HA ESCRITO NADA ===');
    console.log('Esto crea y modifica estilos globales del sitio destino, y afecta a TODAS las');
    console.log('páginas que usen esas clases. Si es lo que quieres, repite con --confirmar.');
    console.log('');
    console.log('Antes de confirmar, exporta los actuales para tener con qué volver atrás:');
    console.log('  node herramientas/global-styles.js exportar --path="<sitio>" --fichero=copia-previa.json');
  } else {
    console.log('');
    console.log('=== COMPRUÉBALO EN EL NAVEGADOR ===');
    console.log('El CSS global se regenera en la primera visita al frontend. Si ves lo de antes,');
    console.log('recarga con Ctrl+F5.');
  }
}
