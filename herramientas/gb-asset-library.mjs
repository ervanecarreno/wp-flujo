#!/usr/bin/env node
/**
 * gb-asset-library.mjs — registra SVG en los catálogos de GenerateBlocks Pro.
 *
 * DOS catálogos, mismo mecanismo por debajo, un solo script (`--catalogo`):
 *
 *   · `shapes` (por defecto) — la Asset Library, `generateblocks_svg_shapes`.
 *     Alimenta el picker del bloque `shape` (una forma suelta).
 *   · `icons` — la Icon Library, `generateblocks_svg_icons`. Alimenta el
 *     picker del atributo `icon` del bloque `text` (el icono de un botón).
 *     No existía un registrador genérico para esta antes del 23/09/2026: cada
 *     proyecto que lo necesitaba lo reinventaba a mano dentro de su propia
 *     carpeta `build/` — ver la nota de «Botones y enlaces con icono» en
 *     `docs/metodo-generateblocks-v2.md` §2.
 *
 * La trampa que cierra, encontrada el 22/09/2026 (trampa 25 de la skill):
 *
 *   **Un `.svg` metido como bloque `media` congela su color y lo esconde.**
 *
 * Un `<img src="…​.svg">` no hereda `currentColor`: lo que el fichero lleve
 * dentro es lo que se ve. Y el HEX queda FUERA del marcado, así que ningún
 * linter lo mira. En el caso real, dos piezas de marca llevaban `fill="#FFFFFF"`
 * —blanco puro, que no estaba en el contrato de 6 colores— y llevaban semanas
 * servidas así con toda la cadena de validación en verde.
 *
 * La salida es meter el SVG inline (en un bloque `shape`, o en el atributo
 * `icon` de un `text`). Pero antes conviene CATALOGARLO: es el sitio donde las
 * piezas de marca quedan a mano para el cliente, que puede insertarlas desde
 * el selector del bloque sin pegar código. Este script hace ese paso, que en
 * la interfaz es subir los ficheros uno a uno a mano.
 *
 * Cómo funciona por dentro (verificado leyendo el plugin, 22/09/2026):
 *   · Cada catálogo guarda su opción de WordPress como un array de grupos
 *     `{ group, group_id, shapes|icons: [ { id, name, shape|icon } ] }` — la
 *     clave del array y del campo cambia (`shapes`/`shape` vs `icons`/`icon`),
 *     el resto es idéntico.
 *   · El filtro `generateblocks_pro_add_custom_svg_shapes` (o su equivalente
 *     de iconos) las mete en la función que GB core expone al editor.
 *   · **Es un catálogo del editor, no una referencia dinámica**: al elegir una
 *     pieza, su SVG se COPIA inline en el bloque. Registrar aquí no cambia
 *     ninguna página ya montada.
 *
 * Uso:
 *   node herramientas/gb-asset-library.mjs --sitio "<app/public>" [--puerto N] [--catalogo shapes|icons] --listar
 *
 *   node herramientas/gb-asset-library.mjs --sitio "<app/public>" --puerto 10011 \
 *     [--catalogo icons] --grupo "Pergamino" --carpeta design/assets/iconos     (informa, no escribe)
 *
 *   node herramientas/gb-asset-library.mjs --sitio "<app/public>" --puerto 10011 \
 *     [--catalogo icons] --grupo "Pergamino" --carpeta design/assets/iconos --confirmar   (escribe)
 *
 *   --catalogo shapes|icons   qué catálogo tocar. Por defecto `shapes` (compatible
 *                             con el uso de antes de esta opción).
 *   --svg <fichero>       en vez de --carpeta; se puede repetir.
 *   --a-current-color     sustituye los `fill`/`stroke` de color fijo por
 *                         `currentColor` antes de registrar. Solo tiene sentido
 *                         en piezas de un solo color (iconos, logos planos):
 *                         en un SVG multicolor lo aplana. Sin esta opción, el
 *                         script se limita a AVISAR de los HEX que encuentre.
 *   --quitar-grupo <n>    borra ese grupo entero (necesita --confirmar).
 *
 * Como `config-tema.js`: sin `--confirmar` no escribe nada, solo cuenta lo que
 * haría. Al escribir, fusiona por grupo — los demás grupos no se tocan, y una
 * forma que ya existía con el mismo nombre conserva su `id`, para que las
 * páginas que ya la usen no se queden huérfanas.
 *
 * Salida: 0 = hecho · 1 = nada que hacer · 2 = no se pudo.
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const RAIZ = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const args = process.argv.slice(2);
const opt = (n, def = null) => { const i = args.indexOf(n); return i !== -1 ? args[i + 1] : def; };
const flag = (n) => args.includes(n);

const sitio = opt("--sitio");
const puerto = opt("--puerto");
const grupo = opt("--grupo");
const carpeta = opt("--carpeta");
const quitarGrupo = opt("--quitar-grupo");
const confirmar = flag("--confirmar");
const listar = flag("--listar");
const aCurrentColor = flag("--a-current-color");
const catalogoNombre = opt("--catalogo", "shapes");

/* Lo único que distingue un catálogo del otro: la opción de WordPress donde
   vive, y el nombre de la clave del array/del campo dentro de cada grupo. El
   resto —fusionar por grupo, conservar el id de lo que ya existía, avisar de
   HEX y de peso— es exactamente el mismo código para los dos. */
const CATALOGOS = {
  shapes: { opcion: "generateblocks_svg_shapes", clave: "shapes", campo: "shape", etiqueta: "Asset Library", singular: "forma" },
  icons: { opcion: "generateblocks_svg_icons", clave: "icons", campo: "icon", etiqueta: "Icon Library", singular: "icono" },
};
const CAT = CATALOGOS[catalogoNombre];

/* `--svg` repetible. */
const svgsSueltos = [];
for (let i = 0; i < args.length; i++) if (args[i] === "--svg") svgsSueltos.push(args[++i]);

if (!sitio || !CAT || (!listar && !grupo && !quitarGrupo)) {
  console.error(`Uso: node herramientas/gb-asset-library.mjs --sitio "<app/public>" [--puerto N] [--catalogo shapes|icons] --listar
     o:  node herramientas/gb-asset-library.mjs --sitio "<app/public>" [--puerto N] [--catalogo shapes|icons] \\
           --grupo "<nombre>" (--carpeta <dir> | --svg <fichero>…) [--a-current-color] [--confirmar]
     o:  node herramientas/gb-asset-library.mjs --sitio "<app/public>" [--puerto N] [--catalogo shapes|icons] \\
           --quitar-grupo "<nombre>" --confirmar

  --catalogo por defecto es "shapes" (la Asset Library de formas sueltas). Usa
  "icons" para la Icon Library que alimenta el atributo \`icon\` del bloque text
  — ver «Botones y enlaces con icono» en docs/metodo-generateblocks-v2.md §2.

  Sin --confirmar no escribe nada: dice lo que haria.`);
  process.exit(2);
}
if (!fs.existsSync(sitio)) { console.error(`✖ No existe ${sitio}`); process.exit(2); }

const WP = path.join(RAIZ, "herramientas", "wp-cli", "wp.cmd");
function wp(trozos, { permiteFallo = false } = {}) {
  const env = { ...process.env };
  if (puerto) env.WP_MYSQL_PORT = String(puerto);
  /* Una sola cadena: la ruta de Local WP lleva espacios y el shell la partiría. */
  const r = spawnSync(`"${WP}" ${trozos} --path="${sitio}"`, { shell: true, env, encoding: "utf8" });
  if (r.status !== 0) {
    if (permiteFallo) return null;
    console.error("✖ wp-cli falló: " + (r.stderr || r.stdout || "").trim().split("\n")[0]);
    console.error("  Si dice «conexión denegada», arranca el sitio en Local WP.");
    process.exit(2);
  }
  return (r.stdout ?? "").trim();
}

/* La opción no existe hasta que alguien guarda algo en la librería: que falte
   es normal, no un error. */
function leerGrupos() {
  const crudo = wp(`option get ${CAT.opcion} --format=json`, { permiteFallo: true });
  if (!crudo) return [];
  try {
    const v = JSON.parse(crudo);
    return Array.isArray(v) ? v : Object.values(v);
  } catch { return []; }
}

function escribirGrupos(grupos) {
  const tmp = path.join(RAIZ, `.gb-asset-library-${catalogoNombre}.tmp.json`);
  fs.writeFileSync(tmp, JSON.stringify(grupos), "utf8");
  try {
    /* Por fichero, no por argumento: los SVG llevan comillas y el shell los
       destrozaría en cuanto el logo pase de unos cientos de bytes. */
    wp(`option update ${CAT.opcion} --format=json < "${tmp}"`);
  } finally {
    fs.rmSync(tmp, { force: true });
  }
}

/* `sanitize_key()` de WordPress deja solo [a-z0-9_-]. El `uniqid()` de PHP es
   hex de 13; aquí se imita con tiempo + azar, que para un id de catálogo vale. */
const idUnico = (nombre) =>
  (nombre.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9_-]/g, "") || CAT.singular)
  + "-" + Date.now().toString(16) + Math.floor(Math.random() * 0x1000).toString(16);

const idGrupo = (nombre) => nombre.toLowerCase().replace(/ /g, "-");

/* Nombre legible a partir del fichero: `icono-instagram.svg` → «Icono instagram». */
const nombreDesdeFichero = (f) => {
  const base = path.basename(f, ".svg").replace(/[-_]+/g, " ").trim();
  return base.charAt(0).toUpperCase() + base.slice(1);
};

const RE_HEX = /#[0-9A-Fa-f]{6}\b|#[0-9A-Fa-f]{3}\b/g;

/* Solo toca `fill=` y `stroke=` con color fijo. `fill="none"` se respeta: es
   estructural, no color. Y no toca `stop-color` de un degradado, que aplanarlo
   sí rompería el dibujo. */
const pasarACurrentColor = (svg) =>
  svg.replace(/\b(fill|stroke)="(#[0-9A-Fa-f]{3,8}|rgba?\([^)]*\))"/g, '$1="currentColor"');

/* ── Listar ──────────────────────────────────────────────────────────────── */
if (listar) {
  const grupos = leerGrupos();
  if (!grupos.length) { console.log(`La ${CAT.etiqueta} no tiene ningún ${CAT.singular} registrado.`); process.exit(1); }
  for (const g of grupos) {
    console.log(`\n· ${g.group}  (${g.group_id})`);
    for (const s of g[CAT.clave] ?? []) {
      console.log(`    ${s.name.padEnd(28)} ${String(s[CAT.campo]?.length ?? 0).padStart(7)} B   id=${s.id}`);
    }
  }
  console.log("");
  process.exit(0);
}

/* ── Quitar un grupo ─────────────────────────────────────────────────────── */
if (quitarGrupo) {
  const grupos = leerGrupos();
  const quedan = grupos.filter((g) => g.group !== quitarGrupo);
  if (quedan.length === grupos.length) {
    console.log(`No hay ningún grupo llamado «${quitarGrupo}» en la ${CAT.etiqueta}.`);
    process.exit(1);
  }
  if (!confirmar) {
    console.log(`Quitaría el grupo «${quitarGrupo}» de la ${CAT.etiqueta}. Repite con --confirmar.`);
    process.exit(0);
  }
  escribirGrupos(quedan);
  console.log(`✔ Grupo «${quitarGrupo}» quitado de la ${CAT.etiqueta}.`);
  process.exit(0);
}

/* ── Registrar ───────────────────────────────────────────────────────────── */
const ficheros = carpeta
  ? fs.readdirSync(carpeta).filter((f) => f.toLowerCase().endsWith(".svg")).sort().map((f) => path.join(carpeta, f))
  : svgsSueltos;

if (!ficheros.length) { console.error("✖ No hay ningún .svg que registrar (usa --carpeta o --svg)."); process.exit(2); }

const grupos = leerGrupos();
const existente = grupos.find((g) => g.group === grupo);
const previas = existente?.[CAT.clave] ?? [];

const piezas = [];
const avisos = [];

for (const f of ficheros) {
  if (!fs.existsSync(f)) { console.error(`✖ No existe ${f}`); process.exit(2); }
  let svg = fs.readFileSync(f, "utf8").trim();
  const nombre = nombreDesdeFichero(f);
  const bytes = Buffer.byteLength(svg);

  const hex = [...new Set(svg.match(RE_HEX) ?? [])];
  if (hex.length && aCurrentColor) {
    svg = pasarACurrentColor(svg);
    const quedan = [...new Set(svg.match(RE_HEX) ?? [])];
    avisos.push(`  ${nombre}: ${hex.join(" ")} → currentColor` + (quedan.length ? `  (quedan ${quedan.join(" ")}, míralos a mano)` : ""));
  } else if (hex.length) {
    avisos.push(`  ${nombre}: lleva color fijo (${hex.join(" ")}). Si es de un solo color, --a-current-color lo hereda del token del bloque.`);
  }

  /* El peso importa: inline, cada uso mete el SVG entero en el post_content.
     199 KB fue el caso que obligó a dejar un decorativo como `media`. */
  if (bytes > 50 * 1024) {
    avisos.push(`  ${nombre}: pesa ${(bytes / 1024).toFixed(0)} KB. Inline infla el post_content de cada página que lo use; valora dejarlo como media() con svgDeliberado.`);
  }

  /* Un nombre que ya estaba conserva su id: las páginas que lo usen siguen
     apuntando a la misma pieza. */
  const previa = previas.find((s) => s.name === nombre);
  piezas.push({ id: previa?.id ?? idUnico(nombre), name: nombre, [CAT.campo]: svg });
}

const nuevos = grupos.filter((g) => g.group !== grupo);
nuevos.push({ group: grupo, group_id: idGrupo(grupo), [CAT.clave]: piezas });

const yaEstaban = piezas.filter((s) => previas.some((p) => p.name === s.name)).length;
console.log(`\nGrupo «${grupo}» (${CAT.etiqueta}) — ${piezas.length} ${CAT.singular}(s): ${yaEstaban} actualizada(s), ${piezas.length - yaEstaban} nueva(s).`);
for (const s of piezas) console.log(`  · ${s.name.padEnd(28)} ${String(Buffer.byteLength(s[CAT.campo])).padStart(7)} B`);
if (avisos.length) { console.log("\nAvisos:"); for (const a of avisos) console.log(a); }

if (!confirmar) {
  console.log("\nNo se ha escrito nada. Repite con --confirmar.\n");
  process.exit(0);
}

escribirGrupos(nuevos);
console.log(`\n✔ Registradas en la ${CAT.etiqueta}. Se ven en Dashboard → GenerateBlocks → Asset Library.`);
console.log(`  Recuerda: esto es el CATÁLOGO del editor. No cambia ninguna página ya montada —`);
console.log(
  catalogoNombre === "icons"
    ? `  para usarlas hay que elegirlas desde el atributo \`icon\` de un bloque text, y el SVG se copia inline.\n`
    : `  para usarlas hay que insertarlas, y el SVG se copia inline en el bloque shape.\n`
);
