#!/usr/bin/env node
/**
 * Portabilidad de la configuracion del tema — Fase 2 del flujo.
 *
 * La configuracion de GeneratePress y la tipografia NO viven en codigo: viven en la base de
 * datos, en tres opciones de WordPress. El repo git versiona el tema hijo, los CPT, acf-json/
 * y /patterns/, pero no esto: al migrar de Local a produccion (o entre maquinas) el diseno
 * llega con la maqueta correcta y la tipografia y los espaciados de fabrica.
 *
 * Verificado el 27/08/2026 contra un WordPress real:
 *   generate_settings               toda la configuracion del tema
 *   generate_spacing_settings       espaciados
 *   generate_package_font_library   la tipografia
 *
 * Este script las exporta a JSON versionable y las reimporta en el destino.
 *
 * Node, sin dependencias. Requiere que el sitio este ARRANCADO en Local (toca la base de datos).
 *
 *   node herramientas/config-tema.js exportar --path="C:\Users\David\Local Sites\web\app\public"
 *   node herramientas/config-tema.js importar --path="<sitio destino>" --confirmar
 */

const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

// ---------------------------------------------------------------- que se exporta

/**
 * Las tres unicas comprobadas contra un WordPress real. Nada mas se exporta por defecto:
 * lo que se encuentre y no este aqui se informa para que lo decidas tu, no se asume.
 */
const NUCLEO = [
  { nombre: 'generate_settings', que: 'configuracion del tema' },
  { nombre: 'generate_spacing_settings', que: 'espaciados' },
  { nombre: 'generate_package_font_library', que: 'tipografia' },
];

/** Patrones de busqueda para descubrir lo que hay en la base de datos y no se lleva. */
const BUSQUEDAS = ['generate_*', 'generateblocks_*', 'theme_mods_*'];

/**
 * Nunca se exportan aunque las pidas con --incluir: son estado local del sitio, no
 * configuracion. Llevarselas rompe el destino en vez de configurarlo.
 */
const PROHIBIDAS = [
  {
    nombre: 'generateblocks_dynamic_css_posts',
    motivo: 'indice de CSS por post; se regenera solo, y apunta a IDs de este sitio',
  },
];

/** Avisos para opciones que si puedes llevarte, pero sabiendo lo que arrastran. */
const AVISOS = {
  theme_mods_: 'lleva IDs de adjunto (logo, favicon): los IDs no coinciden entre sitios',
  generate_package_: 'activacion de modulos de GP Premium: revisa que el destino tenga licencia',
};

// ---------------------------------------------------------------- argumentos

const args = process.argv.slice(2);
const accion = args.find((a) => !a.startsWith('--'));
const opt = (n, def) => {
  const a = args.find((x) => x.startsWith('--' + n + '='));
  return a ? a.slice(n.length + 3) : def;
};
const rutaSitio = opt('path');
const dir = path.resolve(opt('dir', 'config-tema'));
const confirmar = args.includes('--confirmar');
const lista = (n) => {
  const v = opt(n, '');
  return v ? v.split(',').map((s) => s.trim()).filter(Boolean) : [];
};
const incluir = lista('incluir');
const excluir = lista('excluir');

if (accion !== 'exportar' && accion !== 'importar') {
  console.error('Uso:');
  console.error('  node herramientas/config-tema.js exportar --path="<ruta del sitio>" [--dir=config-tema]');
  console.error('  node herramientas/config-tema.js importar --path="<ruta del sitio>" [--dir=config-tema] --confirmar');
  console.error('');
  console.error('Extras: --incluir=opcion1,opcion2   --excluir=opcion1');
  console.error('');
  console.error('La ruta es la del WordPress: ...\\Local Sites\\<sitio>\\app\\public');
  console.error('El sitio tiene que estar ARRANCADO en Local: esto lee y escribe en la base de datos.');
  process.exit(2);
}

if (!rutaSitio) {
  console.error('ERROR: falta --path="<ruta del WordPress>".');
  process.exit(2);
}
if (!fs.existsSync(path.join(rutaSitio, 'wp-load.php'))) {
  console.error('ERROR: en esa ruta no hay un WordPress (no encuentro wp-load.php):');
  console.error('  ' + rutaSitio);
  console.error('Tiene que acabar en \\app\\public.');
  process.exit(2);
}

// ---------------------------------------------------------------- puerto de MySQL de Local

/**
 * Local da a cada sitio un puerto de MySQL propio. Sin el, wp-cli falla con "conexion
 * denegada" aunque el sitio este arrancado. Se saca de sites.json y se le pasa a wp.cmd
 * por la variable WP_MYSQL_PORT.
 */
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
      const p = s.services && s.services.mysql && s.services.mysql.ports && s.services.mysql.ports.MYSQL;
      if (Array.isArray(p) && p.length) return String(p[0]);
    }
  }
  return null;
}

const puerto = puertoDeLocal(rutaSitio);

// ---------------------------------------------------------------- llamada a wp-cli

const WP = path.join(__dirname, 'wp-cli', 'wp.cmd');
if (!fs.existsSync(WP)) {
  console.error('ERROR: no encuentro el envoltorio de wp-cli: ' + WP);
  process.exit(2);
}

const entrecomillar = (a) => (/[\s"&()^|<>]/.test(a) ? '"' + a.replace(/"/g, '\\"') + '"' : a);

/** Ejecuta wp-cli. Devuelve {ok, salida, error}. No lanza: el que llama decide. */
function wp(argumentos, entrada) {
  const linea = [WP, ...argumentos, '--path=' + rutaSitio].map(entrecomillar).join(' ');
  const r = spawnSync(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', linea], {
    windowsVerbatimArguments: true,
    encoding: 'utf8',
    input: entrada,
    maxBuffer: 64 * 1024 * 1024,
    env: puerto ? { ...process.env, WP_MYSQL_PORT: puerto } : process.env,
  });
  return {
    ok: r.status === 0,
    salida: (r.stdout || '').trim(),
    error: (r.stderr || '').trim() || (r.error ? r.error.message : ''),
  };
}

/** Reconoce el fallo de "la base de datos no responde", que no es lo mismo que "no existe". */
const esFalloDeBd = (texto) => /mysqli_real_connect|establishing a database|2002|1045|denegad/i.test(texto || '');

function abortarPorBd(mensaje) {
  console.error('');
  console.error('ERROR: la base de datos del sitio no responde.');
  console.error(mensaje || '');
  console.error('');
  console.error('Arranca el sitio en Local (boton Start site) y repite el comando.');
  console.error(
    puerto
      ? 'El puerto de MySQL del sitio es el ' + puerto + ', ya lo estoy usando: el problema es que esta parado.'
      : 'Ademas, no he encontrado el puerto de este sitio en sites.json de Local.'
  );
  process.exit(1);
}

/**
 * Comprueba que se puede trabajar con el sitio y devuelve la version de WordPress.
 *
 * Ojo: 'core version' lee un fichero, NO la base de datos, asi que funciona igual con el
 * sitio parado. Para saber si la base de datos responde hay que pedirle una opcion.
 */
function comprobarConexion() {
  const bd = wp(['option', 'get', 'siteurl']);
  if (!bd.ok) {
    if (esFalloDeBd(bd.error)) abortarPorBd(bd.error);
    console.error('ERROR: wp-cli no puede trabajar con ese sitio.');
    console.error(bd.error || '(sin mensaje)');
    process.exit(1);
  }
  const v = wp(['core', 'version']);
  return v.ok ? v.salida : '(version no determinada)';
}

// ---------------------------------------------------------------- descubrimiento

/** Lista los nombres de opcion que hay en la base de datos para los patrones de BUSQUEDAS. */
function descubrir() {
  const nombres = new Set();
  for (const patron of BUSQUEDAS) {
    const r = wp(['option', 'list', '--search=' + patron, '--field=option_name', '--format=json']);
    if (!r.ok || !r.salida) continue;
    try {
      for (const n of JSON.parse(r.salida)) nombres.add(n);
    } catch {
      for (const n of r.salida.split(/\r?\n/)) if (n.trim()) nombres.add(n.trim());
    }
  }
  return [...nombres].sort();
}

function avisoDe(nombre) {
  for (const [pref, texto] of Object.entries(AVISOS)) if (nombre.startsWith(pref)) return texto;
  return null;
}

const prohibida = (n) => PROHIBIDAS.find((p) => p.nombre === n);

// ---------------------------------------------------------------- exportar

function exportar() {
  const version = comprobarConexion();
  console.log('=== EXPORTAR configuracion del tema ===');
  console.log('  Sitio:      ' + rutaSitio);
  console.log('  WordPress:  ' + version + (puerto ? '   (MySQL en el puerto ' + puerto + ')' : ''));
  console.log('  Destino:    ' + dir);
  console.log('');

  const tema = wp(['theme', 'list', '--status=active', '--field=name']);
  const temaActivo = tema.ok ? tema.salida : '(no determinado)';

  const aExportar = [
    ...NUCLEO.map((o) => ({ ...o, origen: 'nucleo' })),
    ...incluir.map((n) => ({ nombre: n, que: 'anadida con --incluir', origen: 'incluir' })),
  ].filter((o) => !excluir.includes(o.nombre));

  for (const o of aExportar) {
    const p = prohibida(o.nombre);
    if (p) {
      console.log('  OMITIDA  ' + o.nombre);
      console.log('           no se exporta nunca: ' + p.motivo);
    }
  }

  fs.mkdirSync(dir, { recursive: true });

  const exportadas = [];
  const ausentes = [];

  for (const o of aExportar) {
    if (prohibida(o.nombre)) continue;
    const r = wp(['option', 'get', o.nombre, '--format=json']);
    if (!r.ok && esFalloDeBd(r.error)) abortarPorBd(r.error);
    if (!r.ok || !r.salida) {
      ausentes.push(o.nombre);
      console.log('  AUSENTE  ' + o.nombre + '   (' + o.que + ') - no existe en este sitio');
      continue;
    }
    let valor;
    try {
      valor = JSON.parse(r.salida);
    } catch {
      console.error('  ERROR    ' + o.nombre + ' devolvio algo que no es JSON valido. No lo escribo.');
      process.exitCode = 1;
      continue;
    }
    // Formateado legible a proposito: el diff de git tiene que poder leerse.
    fs.writeFileSync(path.join(dir, o.nombre + '.json'), JSON.stringify(valor, null, 2) + '\n', 'utf8');
    const claves = valor && typeof valor === 'object' ? Object.keys(valor).length : 0;
    console.log('  OK       ' + o.nombre + '   (' + o.que + ')' + (claves ? ' - ' + claves + ' claves' : ''));
    const aviso = avisoDe(o.nombre);
    if (aviso) console.log('           AVISO: ' + aviso);
    exportadas.push(o.nombre);
  }

  // Lo que hay en la base de datos y no se lleva: se informa, no se decide por ti.
  const enBd = descubrir();
  const noLlevadas = enBd.filter((n) => !exportadas.includes(n) && !prohibida(n));

  const manifiesto = {
    generadoPor: 'herramientas/config-tema.js',
    fecha: new Date().toISOString(),
    sitioOrigen: rutaSitio,
    wordpress: version,
    temaActivo,
    exportadas,
    ausentes,
    noExportadas: noLlevadas,
    prohibidas: PROHIBIDAS.map((p) => p.nombre),
  };
  fs.writeFileSync(path.join(dir, 'MANIFIESTO.json'), JSON.stringify(manifiesto, null, 2) + '\n', 'utf8');

  console.log('');
  console.log('--- TAMBIEN HAY ESTO EN LA BASE DE DATOS, Y NO SE LLEVA (' + noLlevadas.length + ') ---');
  if (!noLlevadas.length) console.log('  nada mas');
  for (const n of noLlevadas) {
    const aviso = avisoDe(n);
    console.log('  ' + n + (aviso ? '\n      ' + aviso : ''));
  }
  console.log('');
  console.log('Si alguna de esas hace falta:  --incluir=' + (noLlevadas[0] || 'nombre_de_la_opcion'));
  console.log('');
  console.log('=== SIGUIENTE PASO ===');
  console.log('  git add ' + path.relative(process.cwd(), dir).replace(/\\/g, '/'));
  console.log('  git commit -m "Configuracion del tema y tipografia"');
  console.log('  En el destino:  node herramientas/config-tema.js importar --path="<destino>" --confirmar');

  if (!exportadas.length) {
    console.error('');
    console.error('ERROR: no se ha exportado ninguna opcion. Revisa que el tema sea GeneratePress.');
    process.exit(1);
  }
}

// ---------------------------------------------------------------- importar

function importar() {
  if (!fs.existsSync(dir)) {
    console.error('ERROR: no existe la carpeta ' + dir);
    console.error('Exporta primero, o indica donde esta con --dir=<carpeta>.');
    process.exit(2);
  }

  const ficheros = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.json') && f !== 'MANIFIESTO.json')
    .filter((f) => !excluir.includes(f.replace(/\.json$/, '')))
    .filter((f) => !prohibida(f.replace(/\.json$/, '')));

  if (!ficheros.length) {
    console.error('ERROR: no hay ningun JSON de opciones en ' + dir);
    process.exit(2);
  }

  const version = comprobarConexion();
  console.log('=== IMPORTAR configuracion del tema ===');
  console.log('  Origen:     ' + dir);
  console.log('  Sitio:      ' + rutaSitio);
  console.log('  WordPress:  ' + version + (puerto ? '   (MySQL en el puerto ' + puerto + ')' : ''));
  console.log('');

  let manifiesto = null;
  try {
    manifiesto = JSON.parse(fs.readFileSync(path.join(dir, 'MANIFIESTO.json'), 'utf8'));
  } catch {
    manifiesto = null;
  }
  if (manifiesto) {
    console.log('  Exportado el ' + manifiesto.fecha + ' desde ' + manifiesto.sitioOrigen);
    console.log('  Tema de origen: ' + manifiesto.temaActivo);
    const tema = wp(['theme', 'list', '--status=active', '--field=name']);
    if (tema.ok && manifiesto.temaActivo && tema.salida !== manifiesto.temaActivo) {
      console.log('  AVISO: aqui el tema activo es "' + tema.salida + '", no "' + manifiesto.temaActivo + '".');
    }
    console.log('');
  }

  console.log('--- SE VA A SOBRESCRIBIR ESTO (' + ficheros.length + ') ---');
  for (const f of ficheros) {
    const nombre = f.replace(/\.json$/, '');
    const actual = wp(['option', 'get', nombre, '--format=json']);
    const nuevo = fs.readFileSync(path.join(dir, f), 'utf8');
    let estado;
    if (!actual.ok || !actual.salida) estado = 'no existe aqui: se creara';
    else {
      let a, b;
      try {
        a = JSON.stringify(JSON.parse(actual.salida));
        b = JSON.stringify(JSON.parse(nuevo));
      } catch {
        a = '1';
        b = '2';
      }
      estado = a === b ? 'identica: no cambia nada' : 'distinta: se sobrescribe';
    }
    console.log('  ' + nombre.padEnd(34) + estado);
    const aviso = avisoDe(nombre);
    if (aviso) console.log('      AVISO: ' + aviso);
  }

  if (!confirmar) {
    console.log('');
    console.log('=== NO SE HA ESCRITO NADA ===');
    console.log('Esto sobrescribe la configuracion del tema del sitio destino, y eso no se');
    console.log('deshace solo. Si es lo que quieres, repite el comando anadiendo --confirmar');
    console.log('(se guarda copia de lo actual antes de tocar nada).');
    process.exit(0);
  }

  // Copia de seguridad de lo que hay ahora, antes de sobrescribir.
  const sello = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const copia = path.join(dir, 'copias-previas', sello);
  fs.mkdirSync(copia, { recursive: true });
  for (const f of ficheros) {
    const nombre = f.replace(/\.json$/, '');
    const actual = wp(['option', 'get', nombre, '--format=json']);
    if (actual.ok && actual.salida) fs.writeFileSync(path.join(copia, f), actual.salida + '\n', 'utf8');
  }
  console.log('');
  console.log('  Copia de lo anterior en: ' + copia);
  console.log('');

  let fallos = 0;
  for (const f of ficheros) {
    const nombre = f.replace(/\.json$/, '');
    const contenido = fs.readFileSync(path.join(dir, f), 'utf8');
    // El valor va por la entrada estandar: en la linea de comandos de Windows no cabe.
    const r = wp(['option', 'update', nombre, '--format=json'], contenido);
    if (r.ok) console.log('  OK       ' + nombre);
    else {
      fallos++;
      console.log('  FALLO    ' + nombre + '   ' + (r.error || '(sin mensaje)'));
    }
  }

  wp(['cache', 'flush']);

  console.log('');
  console.log('=== COMPRUEBALO EN EL NAVEGADOR ===');
  console.log('Abre el sitio y confirma tipografia, colores y espaciados. El CSS del tema se');
  console.log('regenera al vuelo, pero si ves lo de antes, recarga con Ctrl+F5.');
  console.log('');
  console.log('Para volver atras:');
  console.log('  node herramientas/config-tema.js importar --dir="' + copia + '" --path="' + rutaSitio + '" --confirmar');

  if (fallos) process.exit(1);
}

accion === 'exportar' ? exportar() : importar();
