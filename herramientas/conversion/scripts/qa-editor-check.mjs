#!/usr/bin/env node
/**
 * qa-editor-check.mjs — la única capa que ve el «Attempt Recovery».
 *
 * La validación de verdad de los bloques NO vive en REST ni en el marcado: vive
 * en el JavaScript del editor. Un bloque puede pasar los dos linters, sobrevivir
 * el round-trip de REST byte a byte, y aun así abrirse en el editor con el aviso
 * «este bloque contiene contenido inesperado o no válido». Eso es lo que
 * comprueba esto, y hasta hoy no se había ejecutado nunca en este flujo.
 *
 * Reescrito el 2/09/2026. La versión anterior tenía dos problemas de fondo:
 *
 *  1. **Pedía la contraseña real de login** —la de aplicación no vale para el
 *     formulario de wp-admin— y la metía en un campo del navegador. Ahora no
 *     hace falta ninguna: se le pide a WordPress que emita su propia cookie de
 *     sesión con `wp_generate_auth_cookie()` desde wp-cli, y se le inyecta al
 *     navegador. Nadie escribe una contraseña en ningún sitio.
 *  2. **Miraba clases del DOM** (`.block-editor-warning`), que cambian con cada
 *     versión de Gutenberg. Ahora se le pregunta al propio editor por su estado:
 *     `isValid === false` y `core/missing` son exactamente la condición que
 *     dispara el aviso de recuperación.
 *
 * Usa `playwright-core` sobre el Chrome que ya está instalado: no descarga
 * ningún navegador.
 *
 * Uso:
 *   node qa-editor-check.mjs --sitio "<ruta app/public>" --puerto <N> --file pagina.html
 *   node qa-editor-check.mjs --sitio "<ruta app/public>" --puerto <N> --post 49550
 *
 *   --tipo page|post   tipo del borrador que crea --file (por defecto page)
 *   --conservar        no borra el borrador creado, para mirarlo a mano
 *   --ver              abre el navegador con ventana en vez de sin ella
 *
 * Salida: 0 = el editor lo acepta y no lo reescribe · 1 = hay bloques inválidos
 *         o el editor reescribió el marcado · 2 = no se pudo comprobar.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { diffBlocks, formatDrifts, normalizeInterblockWhitespace } from "../lib/blockdiff.mjs";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ_PLUGIN = path.resolve(AQUI, "..", "..", "..");

const args = process.argv.slice(2);
const opt = (n, def = null) => { const i = args.indexOf(n); return i !== -1 ? args[i + 1] : def; };
const sitio = opt("--sitio");
const puerto = opt("--puerto");
const fichero = opt("--file");
const postId = opt("--post");
const tipo = opt("--tipo", "page");
const conservar = args.includes("--conservar");
const conVentana = args.includes("--ver");

if (!sitio || (!fichero && !postId)) {
  console.error(`Uso:
  node qa-editor-check.mjs --sitio "<ruta app/public>" [--puerto N] --file pagina.html [--tipo page|post]
  node qa-editor-check.mjs --sitio "<ruta app/public>" [--puerto N] --post <ID>`);
  process.exit(2);
}
if (!fs.existsSync(sitio)) { console.error(`✖ No existe ${sitio}`); process.exit(2); }

/* ── wp-cli ───────────────────────────────────────────────────────────────── */

const WP = path.join(RAIZ_PLUGIN, "herramientas", "wp-cli", "wp.cmd");
if (!fs.existsSync(WP)) { console.error(`✖ No encuentro wp-cli en ${WP}`); process.exit(2); }

/* Se pasa la orden como UNA cadena: la ruta de Local WP lleva espacios («Local
   Sites») y sin comillas el shell parte el --path en dos argumentos. */
function wp(trozos, { silencioso = true } = {}) {
  const env = { ...process.env };
  if (puerto) env.WP_MYSQL_PORT = String(puerto);
  const orden = `"${WP}" ${trozos} --path="${sitio}"`;
  const r = spawnSync(orden, { shell: true, env, encoding: "utf8" });
  if (r.status !== 0) {
    if (!silencioso) return { error: (r.stderr || r.stdout || "").trim() };
    console.error(`✖ wp-cli falló: ${orden}`);
    console.error((r.stderr || r.stdout || "").trim().split("\n").slice(0, 4).join("\n"));
    console.error("  Si dice «conexión denegada», arranca el sitio en Local WP.");
    if (!puerto) console.error("  Y comprueba --puerto: cada sitio de Local usa el suyo.");
    process.exit(2);
  }
  return { salida: (r.stdout ?? "").trim() };
}

function evalPhp(php) {
  const tmp = path.join(os.tmpdir(), `qa-editor-${process.pid}-${Date.now()}.php`);
  fs.writeFileSync(tmp, php, "utf8");
  try { return wp(`eval-file "${tmp}"`).salida; }
  finally { try { fs.unlinkSync(tmp); } catch { /* da igual */ } }
}

/* ── 1. Cookie de sesión, emitida por el propio WordPress ─────────────────── */

console.error("→ Pidiéndole a WordPress una cookie de sesión…");
/* No basta con la cookie `logged_in`: wp-admin valida con la de `auth`.
   `auth_redirect()` llama a wp_validate_auth_cookie('', '') y, con el esquema
   vacío, eso mira AUTH_COOKIE (o SECURE_AUTH_COOKIE bajo SSL), no LOGGED_IN.
   Y va en DOS rutas distintas, /wp-admin y el directorio de plugins. Se emite
   el juego completo, exactamente como hace wp_set_auth_cookie(). */
const crudo = evalPhp(`<?php
$admins = get_users( array( 'role' => 'administrator', 'number' => 1 ) );
if ( ! $admins ) { WP_CLI::error( 'no hay ningun administrador en este sitio' ); }
$user = $admins[0];
$exp  = time() + 3600;
$tok  = WP_Session_Tokens::get_instance( $user->ID )->create( $exp );

$seguro = ( 'https' === parse_url( admin_url(), PHP_URL_SCHEME ) );
$nombreAuth = $seguro ? SECURE_AUTH_COOKIE : AUTH_COOKIE;
$esquema    = $seguro ? 'secure_auth' : 'auth';

$auth     = wp_generate_auth_cookie( $user->ID, $exp, $esquema, $tok );
$loggedIn = wp_generate_auth_cookie( $user->ID, $exp, 'logged_in', $tok );

$cookies = array(
	array( 'nombre' => $nombreAuth,      'valor' => $auth,     'ruta' => ADMIN_COOKIE_PATH ),
	array( 'nombre' => $nombreAuth,      'valor' => $auth,     'ruta' => PLUGINS_COOKIE_PATH ),
	array( 'nombre' => LOGGED_IN_COOKIE, 'valor' => $loggedIn, 'ruta' => COOKIEPATH ? COOKIEPATH : '/' ),
);
if ( COOKIEPATH !== SITECOOKIEPATH ) {
	$cookies[] = array( 'nombre' => LOGGED_IN_COOKIE, 'valor' => $loggedIn, 'ruta' => SITECOOKIEPATH ? SITECOOKIEPATH : '/' );
}

echo json_encode( array(
	'cookies' => $cookies,
	'seguro'  => $seguro,
	'usuario' => $user->user_login,
	'admin'   => admin_url(),
) );
`);

let sesion;
/* De la PRIMERA llave a la última: wp-cli puede imprimir avisos delante, y el
   JSON lleva objetos anidados — buscar la última `{` cae dentro de uno de ellos. */
try { sesion = JSON.parse(crudo.slice(crudo.indexOf("{"), crudo.lastIndexOf("}") + 1)); }
catch { console.error("✖ No se pudo leer la cookie de sesión:\n" + crudo.slice(0, 300)); process.exit(2); }
console.error(`  ✔ sesión de «${sesion.usuario}» (${sesion.cookies.length} cookies), sin usar ninguna contraseña`);

/* ── 2. El borrador a examinar ────────────────────────────────────────────── */

let id = postId, creado = false, enviado;

if (fichero) {
  if (!fs.existsSync(fichero)) { console.error(`✖ No existe ${fichero}`); process.exit(2); }
  enviado = fs.readFileSync(fichero, "utf8");
  console.error(`→ Creando borrador (${tipo}) desde ${path.basename(fichero)}…`);
  /* `wp post create <fichero>` y NUNCA wp_insert_post(): ese aplica wp_unslash()
     y destruye el escapado de los atributos sin decir nada. */
  const r = wp(`post create "${path.resolve(fichero)}" --post_type=${tipo} --post_status=draft --post_title="QA editor ${new Date().toISOString()}" --porcelain`);
  id = r.salida.split("\n").pop().trim();
  if (!/^\d+$/.test(id)) { console.error("✖ No se obtuvo un ID: " + r.salida.slice(0, 200)); process.exit(2); }
  creado = true;
  console.error(`  ✔ borrador #${id}`);
} else {
  enviado = leerContenido(id);
}

function leerContenido(idPost) {
  const tmp = path.join(os.tmpdir(), `qa-editor-contenido-${process.pid}-${Date.now()}.html`);
  const env = { ...process.env };
  if (puerto) env.WP_MYSQL_PORT = String(puerto);
  /* Se redirige a fichero en vez de leer stdout: el marcado lleva acentos y
     comillas, y la consola de Windows los reescribe según su página de códigos. */
  const orden = `"${WP}" post get ${idPost} --field=content --path="${sitio}" > "${tmp}"`;
  const r = spawnSync(orden, { shell: true, env });
  if (r.status !== 0) { console.error(`✖ No se pudo leer el contenido del post ${idPost}`); process.exit(2); }
  try { return fs.readFileSync(tmp, "utf8"); }
  finally { try { fs.unlinkSync(tmp); } catch { /* da igual */ } }
}

function limpiar() {
  if (creado && !conservar) {
    wp(`post delete ${id} --force`, { silencioso: false });
    console.error(`  ✔ borrador #${id} eliminado (--conservar para dejarlo)`);
  } else if (creado) {
    console.error(`  ⏸ borrador #${id} conservado: ${sesion.admin}post.php?post=${id}&action=edit`);
  }
}

/* ── 3. Abrir el editor de verdad ─────────────────────────────────────────── */

let chromium;
try { ({ chromium } = await import("playwright-core")); }
catch {
  console.error(`✖ Falta playwright-core. Desde ${RAIZ_PLUGIN}:  npm install`);
  limpiar();
  process.exit(2);
}

let navegador = null;
for (const canal of ["chrome", "msedge"]) {
  try { navegador = await chromium.launch({ channel: canal, headless: !conVentana }); break; }
  catch { /* se prueba el siguiente */ }
}
if (!navegador) {
  console.error("✖ No se pudo abrir ni Chrome ni Edge. playwright-core usa el navegador ya instalado.");
  limpiar();
  process.exit(2);
}

let salida = 0;
try {
  const urlAdmin = `${sesion.admin}post.php?post=${id}&action=edit`;
  const host = new URL(sesion.admin).hostname;

  const contexto = await navegador.newContext({ viewport: { width: 1440, height: 900 } });
  await contexto.addCookies(sesion.cookies.map((c) => ({
    name: c.nombre, value: c.valor,
    domain: host, path: c.ruta || "/",
    httpOnly: true, secure: Boolean(sesion.seguro), sameSite: "Lax",
  })));
  const pagina = await contexto.newPage();

  const errores = [];
  pagina.on("pageerror", (e) => errores.push(String(e.message).slice(0, 160)));

  console.error(`→ Abriendo el editor de #${id}…`);
  await pagina.goto(urlAdmin, { waitUntil: "domcontentloaded", timeout: 60000 });

  if (/wp-login\.php/.test(pagina.url())) {
    console.error("✖ WordPress mandó al formulario de acceso: la cookie no fue aceptada.");
    console.error("  Suele ser que el dominio de la cookie no coincide con el de admin_url().");
    salida = 2;
  } else {
    /* Esperar a que el editor haya PARSEADO los bloques, no solo a que pinte. */
    await pagina.waitForFunction(
      () => window.wp?.data?.select("core/block-editor")?.getBlocks()?.length > 0,
      null, { timeout: 60000 }
    );

    /* Se le pregunta al editor por su estado en vez de mirar clases del DOM:
       `isValid === false` y `core/missing` SON la condición que dispara el
       aviso «Attempt Recovery». Las clases CSS cambian con cada Gutenberg. */
    const informe = await pagina.evaluate(() => {
      const malos = [];
      let total = 0;
      const recorrer = (bloques, ruta) => {
        for (const b of bloques) {
          total++;
          const aqui = `${ruta} > ${b.name}`;
          if (b.name === "core/missing" || b.isValid === false) {
            malos.push({
              nombre: b.name,
              uniqueId: b.attributes?.uniqueId ?? null,
              ruta: aqui.replace(/^ > /, ""),
              motivo: b.name === "core/missing" ? "bloque desconocido para el editor" : "marcado que no valida",
            });
          }
          if (b.innerBlocks?.length) recorrer(b.innerBlocks, aqui);
        }
      };
      recorrer(wp.data.select("core/block-editor").getBlocks(), "");
      return { total, malos };
    });

    console.error(`\n  ${informe.total} bloques cargados en el editor.`);
    if (informe.malos.length) {
      console.error(`  ✖ ${informe.malos.length} con problema — esto es el «Attempt Recovery»:`);
      for (const m of informe.malos.slice(0, 25)) {
        console.error(`      ${m.uniqueId ?? "(sin uniqueId)"}  ${m.motivo}`);
        console.error(`         ${m.ruta}`);
      }
      salida = 1;
    } else {
      console.error("  ✔ Ningún bloque marcado como inválido.");
    }

    /* Guardar desde el editor: eso RE-SERIALIZA. Si el editor entiende el
       marcado de otra forma, el marcado cambia aquí y en ningún sitio antes. */
    console.error("\n→ Guardando desde el editor para forzar la re-serialización…");
    await pagina.evaluate(() => wp.data.dispatch("core/editor").savePost());
    await pagina.waitForFunction(
      () => !wp.data.select("core/editor").isSavingPost(),
      null, { timeout: 60000 }
    ).catch(() => {});
    await pagina.waitForTimeout(1500);

    const devuelto = leerContenido(id);
    const drifts = diffBlocks(
      normalizeInterblockWhitespace(enviado),
      normalizeInterblockWhitespace(devuelto)
    );
    console.error("\n" + formatDrifts(drifts));
    if (drifts.length) salida = 1;

    if (errores.length) {
      console.error(`\n  ⚠ ${errores.length} error(es) de JavaScript en la página:`);
      for (const e of [...new Set(errores)].slice(0, 5)) console.error("      " + e);
    }
  }

  await contexto.close();
} catch (e) {
  console.error("✖ " + e.message.split("\n")[0]);
  salida = 2;
} finally {
  await navegador.close();
  limpiar();
}

console.error(
  salida === 0 ? "\n✔ El editor acepta el marcado y no lo reescribe.\n"
  : salida === 1 ? "\n✖ El editor no está conforme. Corrige antes de entregar.\n"
  : "\n⚠ No se pudo comprobar.\n"
);
process.exit(salida);
