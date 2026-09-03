#!/usr/bin/env node
/**
 * nuevo-proyecto.js — levanta el esqueleto de un proyecto web de cliente con
 * el flujo Claude Design → Figma → Claude Code → WordPress ya montado.
 *
 * Por qué existe: el método y las herramientas YA se reproducen solos —este
 * plugin está instalado en Claude Code y sus skills se cargan en cualquier
 * carpeta. Lo que no se reproducía era el esqueleto: `design/`, el contrato,
 * el plugin del proyecto, la puerta de calidad. Se montaba a mano cada vez, y
 * cada vez se olvidaba algo. Los dos fallos que costaron esta semana
 * —los tokens que no llegaban al navegador y las fuentes declaradas y no
 * cargadas— eran los dos por lo mismo: faltaba una pieza del esqueleto.
 *
 * Así que el arreglo no es una nota en un checklist: viene hecho de fábrica.
 * El plugin que genera encola el CSS del contrato Y las fuentes, en frontend y
 * en el editor, desde el primer minuto.
 *
 * Uso:
 *   node herramientas/nuevo-proyecto.js "WEB Ayuntamiento de Tazacorte" \
 *     --sistema pergamino \
 *     --slug ayto-tazacorte \
 *     --sitio ayto-tazacorte \
 *     --puerto 10011 \
 *     [--destino "C:\TRABAJOS\WEB AYTO TAZACORTE"] \
 *     [--forzar]
 *
 *   --sistema  nombre del sistema de diseño (contrato y CSS se llaman así)
 *   --slug     identificador del plugin del proyecto en WordPress
 *   --sitio    carpeta del sitio en Local WP
 *   --puerto   WP_MYSQL_PORT de ese sitio en Local
 *
 * No escribe nada fuera de la carpeta de destino y se niega a pisar una que ya
 * tenga contenido, salvo con --forzar.
 *
 * Node, sin dependencias.
 */
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const RAIZ_PLUGIN = path.dirname(__dirname);

/* ── Argumentos ───────────────────────────────────────────────────────────── */

const args = process.argv.slice(2);
const nombre = args[0];
if (!nombre || nombre.startsWith("-")) {
  console.error('Uso: node herramientas/nuevo-proyecto.js "<Nombre del proyecto>" --sistema <x> --slug <x> --sitio <x> --puerto <n> [--destino <ruta>] [--forzar]');
  process.exit(2);
}
const opt = (n, def) => { const i = args.indexOf(n); return i !== -1 ? args[i + 1] : def; };
const forzar = args.includes("--forzar");

const sistema = opt("--sistema");
const slug = opt("--slug");
const sitio = opt("--sitio");
const puerto = opt("--puerto");

const faltan = [];
if (!sistema) faltan.push("--sistema");
if (!slug) faltan.push("--slug");
if (!sitio) faltan.push("--sitio");
if (!puerto) faltan.push("--puerto");
if (faltan.length) { console.error("Faltan: " + faltan.join(", ")); process.exit(2); }

for (const [etiqueta, valor] of [["--sistema", sistema], ["--slug", slug], ["--sitio", sitio]]) {
  if (!/^[a-z0-9-]+$/.test(valor)) {
    console.error(`✖ ${etiqueta} debe ir en minúsculas, sin espacios ni acentos: «${valor}»`);
    process.exit(2);
  }
}
if (!/^\d+$/.test(puerto)) { console.error("✖ --puerto debe ser un número."); process.exit(2); }

const destino = path.resolve(opt("--destino", path.join("C:", "TRABAJOS", nombre)));
const hoy = new Date().toLocaleDateString("es-ES");
const PREFIJO_PHP = slug.replace(/-/g, "_").toUpperCase();

/* ── Seguridad: no pisar trabajo ajeno ────────────────────────────────────── */

if (fs.existsSync(destino)) {
  const dentro = fs.readdirSync(destino).filter((f) => f !== ".git");
  if (dentro.length && !forzar) {
    console.error(`✖ ${destino} ya tiene contenido (${dentro.length} entradas). Usa --forzar si de verdad quieres escribir encima.`);
    process.exit(1);
  }
}

/* ── Ficheros ─────────────────────────────────────────────────────────────── */

const ficheros = {};

/* --- El contrato. Nombres congelados, valores de arranque. --------------- */

ficheros[`design/${sistema}.tokens.json`] = JSON.stringify({
  $metadata: {
    tokenSetOrder: ["core", "light"],
    description: `${sistema} — sistema de diseño de ${nombre}.`,
    renombres: { "font-family": "font" },
    /* El padding del contenido lo pone el TEMA, no el marcado. Si no sale de
       aquí sale de un número inventado en un panel de ajustes, y entonces el
       sitio tiene dos escalas de espaciado que nadie compara. Lo empuja
       `conversion/scripts/wp-push-tokens.mjs`. GeneratePress solo admite estos
       campos fijos: no existe una escala general que empujar. */
    wordpress: {
      spacing: {
        content_top: "core.space.xl", content_bottom: "core.space.xl",
        content_right: "core.space.md", content_left: "core.space.md",
        mobile_content_top: "core.space.lg", mobile_content_bottom: "core.space.lg",
        mobile_content_right: "core.space.sm", mobile_content_left: "core.space.sm",
      },
    },
  },
  core: {
    radius: { none: d("0px"), pill: d("999px") },
    size: { "control-md": d("40px"), "hit-target": d("44px") },
    space: { sm: d("16px"), md: d("32px"), lg: d("64px"), xl: d("96px") },
    "font-family": {
      display: { $type: "fontFamilies", $value: '"Georgia", serif' },
      text: { $type: "fontFamilies", $value: '"Helvetica Neue", Arial, sans-serif' },
    },
    "font-size": {
      "display-xl": d("48px"), "display-md": d("28px"),
      body: d("16px"), label: d("12px"),
    },
  },
  light: {
    bg: { page: c("#FFFFFF"), surface: c("#F4F4F2"), inverse: c("#161616") },
    text: {
      primary: c("#161616"), secondary: c("#4A4A4A"), muted: c("#6E6E6E"),
      inverse: c("#FFFFFF"), accent: c("#1F4E79"),
    },
    border: { subtle: c("#E2E2DE"), strong: c("#8E8E8E") },
    accent: { default: c("#1F4E79"), hover: c("#163A5A") },
    fill: { primary: c("#161616"), "on-primary": c("#FFFFFF") },
  },
}, null, 2) + "\n";

function d(v) { return { $type: "dimension", $value: v }; }
function c(v) { return { $type: "color", $value: v }; }

/* --- Reglas del proyecto ------------------------------------------------- */

ficheros["CLAUDE.md"] = `# ${nombre}

Creado el ${hoy} con \`herramientas/nuevo-proyecto.js\` del plugin **wp-generateblocks**.

WordPress de trabajo: **\`${sitio}\`** (Local WP). \`wp-cli\` necesita
\`WP_MYSQL_PORT=${puerto}\` para este sitio.

## Autoridad del diseño

Sistema **${sistema}**, único:

- \`design/${sistema}.tokens.json\` — **el contrato**. Nombres congelados, valores libres
- \`design/${sistema}.tokens.css\` — **generado**, no se edita a mano
- \`design/${sistema}.md\` — el documento del sistema
- \`design/wordpress-mapping.md\` — puente token → WP y componente → bloque → ACF
- \`tokens/map.json\` — el mapa de **este** proyecto

Reglas que no se negocian:

1. No inventes colores, tipografías ni espaciados que ya existan.
2. **Ningún HEX literal en el marcado.** Todo color entra por token.
3. **Ninguna pila tipográfica literal en el marcado.** Se usa \`var(--font-display)\` y
   \`var(--font-text)\`, nunca \`"Fraunces", Georgia, serif\` escrito a mano. Si la pila está en
   el marcado, cambiarla deja de ser una edición y pasa a ser una migración.
4. El CSS del contrato **se genera**: \`node <plugin>/herramientas/tokens-a-css.mjs\`. Editarlo a
   mano hace fallar la verificación, que es justo lo que se pretende.
5. Un cambio de valor va al JSON y se repropaga. Nunca al CSS del sitio.

## WordPress

Método y herramientas: plugin **\`wp-generateblocks\`**, ya instalado en Claude Code.
No los dupliques aquí.

- Solo bloques genéricos **V2**: \`element\`, \`text\`, \`media\`, \`shape\`, \`query\`.
- \`styles\` en **camelCase**, siempre.
- Importar con \`wp post create\`. Nunca \`wp_insert_post()\`: aplica \`wp_unslash()\` y destruye
  el escapado en silencio.
- Nada entra sin pasar \`validate-blocks.mjs\` y \`audit-gb.js\` con 0 errores.

## Antes de dar nada por bueno

\`\`\`
node verificar.mjs
\`\`\`

Corre la cadena entera: contrato sincronizado → validadores → round-trip contra WordPress →
**contrato publicado**. Ese último paso es el que comprueba que los tokens y las fuentes llegan
de verdad al navegador. **Declarar no es publicar**, y es el fallo que este flujo ya cometió dos
veces sin que ninguna otra capa lo viera.

**Este proyecto no depende de ningún otro proyecto.**
`;

/* --- Estado -------------------------------------------------------------- */

ficheros["ESTADO.md"] = `# ESTADO — ${nombre}

> **Fuente de verdad del estado del proyecto.** Al retomar, lee esto primero.
> Actualízalo al cerrar cada sesión.

**Creado:** ${hoy}. **Última actualización:** ${hoy}.

## Progreso

| Fase | Estado | Resultado |
|---|---|---|
| −1 · Contrato de diseño | ⬜ | Congelar nombres en \`design/${sistema}.tokens.json\` |
| 0 · Bootstrap del entorno | ⬜ | Local WP \`${sitio}\`, versiones de GP/GB/GB Pro, ¿subdirectorio? |
| 1 · Diseño | ⬜ | Claude Design y/o Figma con las variables nombradas |
| 2 · Tokens a WordPress | ⬜ | Plugin del proyecto activo, contrato publicado |
| 3 · Repo | ⬜ | git, \`.env.local\` fuera de git |
| 4 · Marcado | ⬜ | 0 HEX, 0 errores en los dos validadores |
| 5 · Plantillas y CPT | ⬜ | CPT por código, query loops |
| 6 · Animación | ⬜ | Después de los query loops, nunca antes |
| 7 · Puerta de calidad | ⬜ | \`node verificar.mjs\` + skill \`puerta-calidad-wordpress\` |
| 8 · Producción | ⬜ | \`wp search-replace --dry-run\` primero |

## Decisiones tomadas

_(fecha · decisión · motivo)_

## Riesgos abiertos

_(qué puede morder y qué lo vigila)_
`;

/* --- El plugin del proyecto. Aquí viven las dos lecciones. --------------- */

ficheros[`wp/${slug}.php`] = `<?php
/**
 * Plugin Name: ${nombre}
 * Description: Contrato de diseño y tipos de contenido de ${nombre}.
 * Version:     0.1.0
 * Requires PHP: 8.0
 *
 * Generado por herramientas/nuevo-proyecto.js del plugin wp-generateblocks.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Las fuentes del contrato.
 *
 * DECLARAR NO ES PUBLICAR. Que el marcado diga \`font-family\` no carga nada: sin
 * un @font-face o un enlace a un servicio de fuentes, el navegador cae al
 * respaldo y no avisa. Este flujo ya lo pagó una vez —47 declaraciones
 * repartidas entre dos familias, 0 @font-face, todo saliendo en Georgia—, así
 * que la carga viene puesta de fábrica.
 *
 * Pide SOLO los pesos que el diseño usa: cada peso extra es descarga que nadie ve.
 * Si prefieres auto-alojar en la Font Library de GeneratePress, sustituye esta
 * constante por esa vía y deja aquí una nota diciendo cuál se usa.
 */
const ${PREFIJO_PHP}_FUENTES = '';

/** Encola el contrato en el frontend. */
add_action(
	'wp_enqueue_scripts',
	static function (): void {
		${PREFIJO_PHP.toLowerCase()}_encolar_contrato( 'wp' );
	},
	5
);

/** Y en el editor, para que el lienzo se parezca al resultado. */
add_action(
	'enqueue_block_assets',
	static function (): void {
		if ( is_admin() ) {
			${PREFIJO_PHP.toLowerCase()}_encolar_contrato( 'editor' );
		}
	},
	5
);

function ${PREFIJO_PHP.toLowerCase()}_encolar_contrato( string $donde ): void {
	$css  = plugin_dir_path( __FILE__ ) . '${sistema}.tokens.css';
	$deps = array();

	if ( '' !== ${PREFIJO_PHP}_FUENTES ) {
		wp_enqueue_style( '${slug}-fuentes-' . $donde, ${PREFIJO_PHP}_FUENTES, array(), null );
		$deps[] = '${slug}-fuentes-' . $donde;
	}

	if ( ! file_exists( $css ) ) {
		return;
	}

	wp_enqueue_style(
		'${slug}-tokens-' . $donde,
		plugin_dir_url( __FILE__ ) . '${sistema}.tokens.css',
		$deps,
		(string) filemtime( $css )
	);
}

/**
 * Tipos de contenido.
 *
 * Por CÓDIGO, no por interfaz: así viajan con el repositorio. Los campos van con
 * register_post_meta(), que es donde ACF acaba escribiendo igualmente, de modo
 * que el sitio funciona aunque ACF no esté instalado todavía.
 */
add_action(
	'init',
	static function (): void {
		// register_post_type( '...', array( 'public' => true, 'show_in_rest' => true, ... ) );
		// register_post_meta( '...', '...', array( 'show_in_rest' => true, 'single' => true, 'type' => 'string' ) );
	}
);
`;

/* --- El punto de entrada de la verificación ------------------------------ */

const rutaPluginJs = RAIZ_PLUGIN.replace(/\\\\/g, "/").replace(/\\/g, "/");

ficheros["verificar.mjs"] = `#!/usr/bin/env node
/**
 * verificar.mjs — la cadena de comprobación de este proyecto, en un comando.
 *
 *   node verificar.mjs                 (todo lo que se pueda sin credenciales)
 *   node verificar.mjs --url http://${sitio}.local/una-pagina/
 *
 * Generado por herramientas/nuevo-proyecto.js. Es tuyo: edítalo.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const PLUGIN = ${JSON.stringify(rutaPluginJs)};
const SISTEMA = ${JSON.stringify(sistema)};
/* Ruta del sitio en Local WP. Ajustala si tu carpeta de Local esta en otro sitio. */
const SITIO = process.env.USERPROFILE + "/Local Sites/${sitio}/app/public";
const PUERTO = "${puerto}";

/* Las URLs publicadas de este proyecto. Añádelas según vayan existiendo. */
const URLS = [];

/* .env.local no está en git: de ahí salen las credenciales del round-trip. */
if (fs.existsSync(".env.local")) {
  for (const linea of fs.readFileSync(".env.local", "utf8").split(/\\r?\\n/)) {
    const m = linea.match(/^\\s*([A-Z_]+)\\s*=\\s*(.*)\\s*$/);
    if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

/* Tres desenlaces, no dos: 0 pasa · 1 FALLA · 2 no se pudo comprobar (el sitio
   parado, una credencial que falta). El 2 no es un fallo de fidelidad, pero
   tampoco es un aprobado: deja la cadena incompleta y se dice al final. */
let fallos = 0;
const noComprobado = [];

const paso = (titulo, cmd, args) => {
  console.log("\\n──────── " + titulo + " ────────");
  const r = spawnSync("node", [cmd, ...args], { stdio: "inherit" });
  if (r.status === 2) { noComprobado.push(titulo); return false; }
  if (r.status !== 0) fallos++;
  return r.status === 0;
};

/* 1. ¿El CSS del contrato corresponde al JSON? */
paso(
  "1 · Contrato sincronizado",
  PLUGIN + "/herramientas/tokens-a-css.mjs",
  ["design/" + SISTEMA + ".tokens.json", "--verificar", "design/" + SISTEMA + ".tokens.css"]
);

/* 2. Los dos validadores sobre cada marcado emitido. */
const marcados = fs.existsSync("build")
  ? fs.readdirSync("build").filter((f) => f.endsWith(".html")).map((f) => path.join("build", f))
  : [];

if (!marcados.length) {
  console.log("\\n──────── 2 · Validadores ────────\\n  ⏭ No hay build/*.html todavía.");
} else {
  for (const m of marcados) {
    paso("2 · validate-blocks · " + m, PLUGIN + "/herramientas/conversion/scripts/validate-blocks.mjs", [m]);
    paso("2 · audit-gb · " + m, PLUGIN + "/herramientas/audit-gb.js", [m]);
  }
}

/* 3. Round-trip: preguntarle a WordPress en vez de suponer. */
if (process.env.WP_URL && process.env.WP_USER && process.env.WP_APP_PASSWORD && marcados.length) {
  for (const m of marcados) {
    paso("3 · round-trip · " + m, PLUGIN + "/herramientas/conversion/scripts/wp-roundtrip.mjs", [m]);
  }
} else {
  console.log("\\n──────── 3 · Round-trip ────────\\n  ⏭ Omitido (sin credenciales en .env.local, o sin marcado).");
}

/* 3.5. El editor de verdad: la UNICA capa que ve el «Attempt Recovery». La
   validacion de bloques vive en el JavaScript del editor, no en REST ni en el
   marcado. Un bloque puede pasar los dos linters Y el round-trip y abrirse roto
   en WordPress. No pide ninguna contrasena. */
if (fs.existsSync(SITIO) && marcados.length) {
  for (const m of marcados) {
    paso("3.5 · editor real · " + m,
      PLUGIN + "/herramientas/conversion/scripts/qa-editor-check.mjs",
      ["--sitio", SITIO, "--puerto", PUERTO, "--file", m]);
  }
} else {
  console.log("\\n──────── 3.5 · Editor real ────────\\n  ⏭ Omitido (no encuentro " + SITIO + ", o no hay marcado).");
}

/* 4. ¿Llegó el contrato al navegador? El paso que caza «declarar no es publicar». */
const extra = process.argv.slice(2).filter((a) => a.startsWith("http"));
const idxUrl = process.argv.indexOf("--url");
if (idxUrl !== -1 && process.argv[idxUrl + 1]) extra.push(process.argv[idxUrl + 1]);
const objetivos = [...new Set([...URLS, ...extra])];

if (!objetivos.length) {
  console.log("\\n──────── 4 · Contrato publicado ────────\\n  ⏭ Sin URLs. Añádelas a URLS o pasa --url <url>.");
} else {
  for (const u of objetivos) {
    paso(
      "4 · contrato publicado · " + u,
      PLUGIN + "/herramientas/conversion/scripts/qa-contrato-publicado.mjs",
      [u, "--tokens", "design/" + SISTEMA + ".tokens.css"]
    );
  }
}

if (fallos) {
  console.log("\\n✖ " + fallos + " comprobación(es) fallidas. No entregues así.\\n");
  process.exit(1);
}
if (noComprobado.length) {
  console.log("\\n⚠ Cadena INCOMPLETA. No se pudo ejecutar: " + noComprobado.join(", ") + ".");
  console.log("  Lo que sí se ejecutó, pasó. Pero esto no es un visto bueno.\\n");
  process.exit(2);
}
console.log("\\n✔ Cadena completa superada.\\n");
`;

/* --- Documentos de diseño ------------------------------------------------ */

ficheros[`design/${sistema}.md`] = `# ${sistema} — sistema de diseño de ${nombre}

**Contrato:** \`${sistema}.tokens.json\`. Los **nombres** están congelados; los **valores**, no.
Cambiar un valor es una edición; cambiar un nombre es una migración.

## 1. Color

_(Pega aquí la tabla de tokens con su papel. Un token por papel, no por color.)_

## 2. Reglas

1. Ningún HEX literal en el marcado.
2. Ninguna pila tipográfica literal en el marcado: \`var(--font-display)\`, \`var(--font-text)\`.
3. _(Si hay secciones invertidas, decide aquí si se expresan cambiando de modo o de token.
   Cambiar de modo suele ser lo correcto: deja \`bg/inverse\` casi sin uso.)_

## 3. Contraste

| Par | Ratio medido | AA |
|---|---|---|
| | | |

**Mídelo, no lo supongas.** Un acento decorativo que no llega a 4,5:1 puede ser aceptable si
nunca lleva texto encima; escríbelo aquí explícitamente para que nadie lo use de otra forma.

## 4. Tipografía

| Papel | Token | Familia | Pesos que se usan |
|---|---|---|---|

**Los pesos declarados aquí son los que el plugin del proyecto carga**, ni uno más.
`;

ficheros["design/wordpress-mapping.md"] = `# Puente ${sistema} → WordPress

## 1. Cómo se publica el contrato

El CSS del contrato lo encola el plugin del proyecto (\`wp/${slug}.php\`) en el frontend y en el
editor. **No** se depende de los Global Colors de GeneratePress para esto: WordPress los expone
como \`--wp--preset--color--<slug>\`, **no** como el nombre corto que usa el marcado. Los Global
Colors se conservan, pero para lo que sirven: dar la paleta a los selectores del editor.

Comprobación: \`node verificar.mjs --url <url-real>\`.

## 2. Token → uso

| Token | Dónde se usa |
|---|---|

## 3. Componente → bloque → campos

| Componente de diseño | Bloque GB V2 | CPT / campos |
|---|---|---|

## 4. Tipografía — declarar no es cargar

**Vía en uso:** _(A: Font Library de GeneratePress, auto-alojada · B: servicio de fuentes
encolado desde el plugin del proyecto)_. Escribe cuál, porque las dos dejan rastro distinto.

Si es la vía A, los ficheros viven en \`wp-content/uploads/generatepress/fonts/<slug>/\` y
**no viajan con el repositorio**: hay que contarlos en el paso a producción, igual que las
imágenes. La opción \`generate_package_font_library\` solo guarda \`"activated"\`; no contiene
las fuentes.
`;

/* --- Material de proyecto ------------------------------------------------ */

ficheros["tokens/map.json"] = JSON.stringify({
  _nota: "Mapa de tokens de ESTE proyecto. La herramienta vive en el plugin; el mapa, aquí.",
  colors: {},
  dimensions: {},
}, null, 2) + "\n";

ficheros[".env.local.ejemplo"] = `# Copia esto a .env.local y rellena. .env.local NO va a git.
# Entrecomilla SIEMPRE los valores: las contraseñas de aplicación llevan espacios
# y sin comillas se truncan al leerlas desde un shell.
WP_URL="http://${sitio}.local"
WP_USER="tu-usuario"
WP_APP_PASSWORD="xxxx xxxx xxxx xxxx xxxx xxxx"
WP_MYSQL_PORT="${puerto}"
`;

ficheros[".gitignore"] = `# Credenciales
.env.local

# Artefactos de QA
qa-sent.html
qa-got.html
qa-*.png

# Sistema
Thumbs.db
.DS_Store
node_modules/
`;

ficheros["build/.gitkeep"] = "";

/* ── Escritura ────────────────────────────────────────────────────────────── */

for (const [rel, contenido] of Object.entries(ficheros)) {
  const destinoFichero = path.join(destino, rel);
  fs.mkdirSync(path.dirname(destinoFichero), { recursive: true });
  fs.writeFileSync(destinoFichero, contenido, "utf8");
}

/* El CSS del contrato es derivado: se genera, no se plantilla. */
execFileSync("node", [
  path.join(RAIZ_PLUGIN, "herramientas", "tokens-a-css.mjs"),
  path.join(destino, "design", `${sistema}.tokens.json`),
  "-o", path.join(destino, "design", `${sistema}.tokens.css`),
], { stdio: "inherit" });

/* ── Qué hacer ahora ──────────────────────────────────────────────────────── */

const n = Object.keys(ficheros).length + 1;
console.log(`
✔ ${nombre}
  ${destino}
  ${n} ficheros.

Lo siguiente, por orden:

  1. cd "${destino}" && git init
  2. Copia .env.local.ejemplo a .env.local y rellena (con comillas).
  3. Congela el contrato: edita design/${sistema}.tokens.json y regenera el CSS con
       node "${rutaPluginJs}/herramientas/tokens-a-css.mjs" design/${sistema}.tokens.json -o design/${sistema}.tokens.css
  4. Rellena ${PREFIJO_PHP}_FUENTES en wp/${slug}.php con SOLO los pesos que uses.
  5. Copia wp/ y design/${sistema}.tokens.css al sitio:
       <Local Sites>/${sitio}/app/public/wp-content/plugins/${slug}/
     y actívalo. Recuerda WP_MYSQL_PORT=${puerto} para wp-cli.
  6. Empuja el contrato a los ajustes del tema (paleta del editor y padding de contenido):
       node "${rutaPluginJs}/herramientas/conversion/scripts/wp-push-tokens.mjs" \
         design/${sistema}.tokens.json --sitio "<Local Sites>/${sitio}/app/public" --puerto ${puerto} --live
  7. node verificar.mjs

El método está en la skill 'flujo-wordpress-generateblocks' del plugin wp-generateblocks,
que Claude Code carga sola en esta carpeta. No hay nada que instalar.
`);
