#!/usr/bin/env node
/**
 * Puerta de calidad de entorno — Fase 7 del flujo.
 *
 * Comprueba contra el SERVIDOR REAL lo que el validador de marcado no puede ver:
 * imágenes y enlaces que dan 404, y peso de imagen above-the-fold.
 *
 * Es la comprobación que habría detectado los 11 de 13 imágenes en 404 del proyecto
 * Aridane, donde el marcado daba 0 errores sobre 179 bloques.
 *
 * Node, sin dependencias. Requiere Node 18+ por usar fetch nativo (probado en v24).
 *
 *   node herramientas/puerta-calidad.js https://ejemplo.org/subdirectorio/
 *   node herramientas/puerta-calidad.js <url> --max-kb=200 --json
 */

const args = process.argv.slice(2);
const url = args.find((a) => !a.startsWith('--'));
const maxKb = Number((args.find((a) => a.startsWith('--max-kb=')) || '--max-kb=200').split('=')[1]);
const asJson = args.includes('--json');

if (!url) {
  console.error('Uso: node herramientas/puerta-calidad.js <url> [--max-kb=200] [--json]');
  console.error('');
  console.error('La URL tiene que ser la real del sitio desplegado, CON el subdirectorio si lo hay.');
  console.error('Ejecutarlo contra un HTML local no sirve: el subdirectorio es justo lo que rompe.');
  process.exit(2);
}

const UA = 'puerta-calidad/1.0 (+wp-generateblocks)';

/** Extrae los recursos y enlaces de un HTML sin depender de un parser de DOM. */
function extraer(html, base) {
  const encontrado = new Map(); // url absoluta -> Set de tipos

  const anotar = (raw, tipo) => {
    if (!raw) return;
    const v = raw.trim();
    if (!v || v.startsWith('#') || /^(data|javascript|mailto|tel):/i.test(v)) return;
    let abs;
    try {
      abs = new URL(v, base).href.split('#')[0];
    } catch {
      return;
    }
    if (!/^https?:/i.test(abs)) return;
    if (!encontrado.has(abs)) encontrado.set(abs, new Set());
    encontrado.get(abs).add(tipo);
  };

  // <img src> y <source src>
  for (const m of html.matchAll(/<(?:img|source)\b[^>]*?\bsrc\s*=\s*["']([^"']+)["']/gi)) {
    anotar(m[1], 'imagen');
  }
  // srcset: "url 320w, url 640w"
  for (const m of html.matchAll(/\bsrcset\s*=\s*["']([^"']+)["']/gi)) {
    for (const parte of m[1].split(',')) anotar(parte.trim().split(/\s+/)[0], 'imagen');
  }
  // imágenes de fondo en CSS en línea
  for (const m of html.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/gi)) {
    if (/\.(png|jpe?g|gif|webp|avif|svg)(\?|$)/i.test(m[1])) anotar(m[1], 'imagen');
  }
  // <link href>, saltando preconnect y dns-prefetch: son pistas para el navegador,
  // no recursos descargables, y comprobarlas produce 404 que no son fallos reales.
  for (const m of html.matchAll(/<link\b[^>]*>/gi)) {
    const tag = m[0];
    const rel = (tag.match(/\brel\s*=\s*["']([^"']+)["']/i) || [, ''])[1].toLowerCase();
    if (/\b(preconnect|dns-prefetch)\b/.test(rel)) continue;
    const href = (tag.match(/\bhref\s*=\s*["']([^"']+)["']/i) || [])[1];
    anotar(href, 'recurso');
  }
  // <script src>
  for (const m of html.matchAll(/<script\b[^>]*?\bsrc\s*=\s*["']([^"']+)["']/gi)) anotar(m[1], 'recurso');
  // <a href>
  for (const m of html.matchAll(/<a\b[^>]*?\bhref\s*=\s*["']([^"']+)["']/gi)) anotar(m[1], 'enlace');

  return encontrado;
}

async function comprobar(u) {
  // HEAD primero; algunos servidores no lo permiten, así que se reintenta con GET parcial.
  for (const metodo of ['HEAD', 'GET']) {
    try {
      const r = await fetch(u, {
        method: metodo,
        redirect: 'follow',
        headers: metodo === 'GET' ? { 'User-Agent': UA, Range: 'bytes=0-0' } : { 'User-Agent': UA },
      });
      if (metodo === 'HEAD' && (r.status === 405 || r.status === 501)) continue;
      const len = r.headers.get('content-length');
      return {
        status: r.status,
        bytes: len ? Number(len) : null,
        tipo: r.headers.get('content-type') || '',
        redirigido: r.redirected ? r.url : null,
      };
    } catch (e) {
      if (metodo === 'GET') return { status: 0, error: e.message, bytes: null, tipo: '' };
    }
  }
  return { status: 0, error: 'sin respuesta', bytes: null, tipo: '' };
}

/** Ejecuta los fetch en tandas para no saturar el servidor de destino. */
async function enTandas(items, tam, fn) {
  const salida = [];
  for (let i = 0; i < items.length; i += tam) {
    salida.push(...(await Promise.all(items.slice(i, i + tam).map(fn))));
  }
  return salida;
}

(async () => {
  if (!asJson) {
    console.log(`\n=== PUERTA DE CALIDAD ===`);
    console.log(`Página:            ${url}`);
    console.log(`Presupuesto imagen: ${maxKb} KB\n`);
  }

  let html;
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow' });
    if (!r.ok) {
      console.error(`ERROR: la página principal responde ${r.status}. No se puede continuar.`);
      process.exit(1);
    }
    html = await r.text();
  } catch (e) {
    console.error(`ERROR: no se puede descargar la página: ${e.message}`);
    process.exit(1);
  }

  const encontrado = extraer(html, url);
  const lista = [...encontrado.entries()].map(([u, tipos]) => ({ url: u, tipos: [...tipos] }));

  if (!asJson) console.log(`Comprobando ${lista.length} URLs distintas...\n`);

  const res = await enTandas(lista, 8, async (item) => ({ ...item, ...(await comprobar(item.url)) }));

  // 405 (metodo no permitido) no es un fallo: xmlrpc.php lo devuelve siempre.
  const roto = res.filter((r) => (r.status === 0 || r.status >= 400) && r.status !== 405);
  const hostPagina = new URL(url).host;
  const mismoHost = (r) => {
    try { return new URL(r.url).host === hostPagina; } catch { return false; }
  };
  const rotoPropio = roto.filter(mismoHost);
  const rotoExterno = roto.filter((r) => !mismoHost(r));
  const noPermitido = res.filter((r) => r.status === 405);
  const pesada = res.filter(
    (r) => r.tipos.includes('imagen') && r.bytes != null && r.bytes > maxKb * 1024
  );
  const redir = res.filter((r) => r.redirigido);

  if (asJson) {
    console.log(JSON.stringify({ url, maxKb, total: res.length, rotoPropio, rotoExterno, pesada, redir, noPermitido }, null, 2));
    process.exit(rotoPropio.length ? 1 : 0);
  }

  const kb = (b) => (b == null ? '?' : Math.round(b / 1024) + ' KB');

  console.log(`--- ROTAS EN TU PROPIO SITIO (${rotoPropio.length}) - ESTAS HAY QUE ARREGLARLAS ---`);
  if (!rotoPropio.length) console.log('  ninguna');
  for (const r of rotoPropio) {
    console.log(`  [${r.status || 'sin respuesta'}] ${r.tipos.join('+')} ${r.url}`);
    if (r.error) console.log(`         ${r.error}`);
  }

  console.log(`\n--- ROTAS HACIA FUERA (${rotoExterno.length}) - revisar, no siempre es culpa tuya ---`);
  if (!rotoExterno.length) console.log('  ninguna');
  for (const r of rotoExterno) {
    console.log(`  [${r.status || 'sin respuesta'}] ${r.tipos.join('+')} ${r.url}`);
    if (r.error) console.log(`         ${r.error}`);
  }

  console.log(`\n--- IMÁGENES POR ENCIMA DE ${maxKb} KB (${pesada.length}) ---`);
  if (!pesada.length) console.log('  ninguna');
  for (const r of pesada.sort((a, b) => b.bytes - a.bytes)) {
    console.log(`  ${kb(r.bytes).padStart(8)}  ${r.url}`);
  }

  if (redir.length) {
    console.log(`\n--- REDIRECCIONES (${redir.length}, informativo) ---`);
    for (const r of redir.slice(0, 10)) console.log(`  ${r.url}\n      -> ${r.redirigido}`);
    if (redir.length > 10) console.log(`  ... y ${redir.length - 10} más`);
  }

  console.log(`\n=== RESUMEN ===`);
  console.log(`  URLs comprobadas:   ${res.length}`);
  console.log(`  Rotas en tu sitio:  ${rotoPropio.length}   <- las que bloquean la entrega`);
  console.log(`  Rotas hacia fuera:  ${rotoExterno.length}`);
  console.log(`  Imágenes pesadas:   ${pesada.length}`);
  if (noPermitido.length) console.log(`  (${noPermitido.length} devolvieron 405: normal, ignoradas)`);

  console.log(`\n=== PASOS QUE ESTE SCRIPT NO CUBRE ===`);
  console.log(`Descargan software de internet la primera vez: pide permiso antes de ejecutarlos.`);
  console.log(`  Accesibilidad (WCAG 2.1 AA, obligatorio en webs de ayuntamiento):`);
  console.log(`    npx pa11y-ci ${url}`);
  console.log(`    npx @axe-core/cli ${url}`);
  console.log(`  Rendimiento (CLS <= 0.1, LCP <= 2,5 s):`);
  console.log(`    npx lhci autorun`);
  console.log(`  Salud de WordPress:`);
  console.log(`    herramientas\wp-cli\wp.cmd doctor check --all --path="<ruta del sitio>"`);
  console.log(`    (requiere: wp package install wp-cli/doctor-command)`);

  // Solo lo propio decide el resultado: no fallar una entrega por una web ajena caida.
  process.exit(rotoPropio.length ? 1 : 0);
})();
