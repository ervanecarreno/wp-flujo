#!/usr/bin/env node
/**
 * qa-visual-diff.mjs — puerta 4/5: la página contra su diseño.
 *
 * Reescrito el 2/09/2026 después de MEDIR que la versión anterior no podía
 * funcionar. Comparaba un PNG exportado de Figma contra la página y fallaba si
 * el porcentaje de píxeles distintos pasaba de un umbral. Sobre el proyecto de
 * referencia dio **51,18%**, y no porque la página estuviera mal:
 *
 *   · Un PNG de Figma y un navegador no dibujan el texto igual. Ese diff mide
 *     hinting y suavizado, no diseño.
 *   · Y sobre todo: **en cuanto una sección mide diez píxeles de más, todo lo
 *     que va debajo cuenta como distinto.** El porcentaje no dice si el diseño
 *     se respetó; dice cuánto se ha desplazado el contenido en vertical. Medido:
 *     la primera fila distinta estaba en y=24, y a partir de ahí, 92%.
 *
 * Así que la comparación útil no es de píxeles: es **de secciones**. Se
 * renderizan el diseño y la página en el MISMO navegador, se miden las secciones
 * en orden y se informa de cuáles se desviaron y en cuánto. Eso es determinista,
 * inmune al suavizado, y señala dónde mirar. La primera vez que se ejecutó
 * encontró que la barra de navegación y el pie del diseño no se habían
 * implementado, y que el testimonio medía 112px contra los 359 del diseño.
 *
 * El diff de píxeles se sigue produciendo, pero como material para MIRAR
 * (diff.png), nunca como criterio de aprobado.
 *
 * Modos:
 *   --diseno <fichero.dc.html>    compara secciones contra el diseño. Es la puerta.
 *   --guardar-linea-base <png>    guarda una captura de la página
 *   --linea-base <png>            compara la página contra esa captura. Aquí sí
 *                                 manda el porcentaje: mismo motor, misma página,
 *                                 así que cualquier diferencia es un cambio real.
 *   --figma <fileKey> <nodeId>    exporta el frame para mirarlo. Requiere FIGMA_TOKEN.
 *
 * Opciones:
 *   --ancho N        anchura de renderizado (1440)
 *   --tolerancia N   % de desviación de altura admitido por sección (10)
 *   --umbral N       % de píxeles distintos admitido en --linea-base (0.1)
 *   --sel "<css>"    selector de las secciones de la página (".entry-content > section")
 *   --salida DIR     dónde dejar los PNG ("qa-visual")
 *
 * Salida: 0 = conforme · 1 = hay desvíos · 2 = no se pudo comparar.
 */
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const url = args[0];
if (!url || url.startsWith("--")) {
  console.error(`Uso:
  node qa-visual-diff.mjs <url> --diseno <fichero.dc.html> [--tolerancia 10] [--sel "<css>"]
  node qa-visual-diff.mjs <url> --guardar-linea-base qa/pagina.png
  node qa-visual-diff.mjs <url> --linea-base qa/pagina.png [--umbral 0.1]
  node qa-visual-diff.mjs <url> --figma <fileKey> <nodeId>     (requiere FIGMA_TOKEN)`);
  process.exit(2);
}
const opt = (n, def = null) => { const i = args.indexOf(n); return i !== -1 ? args[i + 1] : def; };

const diseno = opt("--diseno");
const lineaBase = opt("--linea-base");
const guardarLineaBase = opt("--guardar-linea-base");
const iFigma = args.indexOf("--figma");
const ancho = Number(opt("--ancho", "1440"));
const tolerancia = Number(opt("--tolerancia", "10"));
const umbral = Number(opt("--umbral", "0.1"));
const selPagina = opt("--sel", ".entry-content > section");
const selDiseno = opt("--sel-diseno", null);
const salidaDir = opt("--salida", "qa-visual");

let chromium, pixelmatch, PNG;
try {
  ({ chromium } = await import("playwright-core"));
  pixelmatch = (await import("pixelmatch")).default;
  ({ PNG } = await import("pngjs"));
} catch (e) {
  console.error("✖ Faltan dependencias. Desde la raíz del plugin:  npm install");
  console.error("  " + e.message.split("\n")[0]);
  process.exit(2);
}

let navegador = null;
for (const canal of ["chrome", "msedge"]) {
  try { navegador = await chromium.launch({ channel: canal, headless: true }); break; } catch { /* siguiente */ }
}
if (!navegador) { console.error("✖ No se pudo abrir ni Chrome ni Edge."); process.exit(2); }

fs.mkdirSync(salidaDir, { recursive: true });

/** Abre algo a anchura fija con las fuentes ya cargadas. */
async function abrir(destino, esFichero) {
  const pagina = await navegador.newPage({ viewport: { width: ancho, height: 1000 }, deviceScaleFactor: 1 });
  await pagina.goto(destino, { waitUntil: "networkidle", timeout: 60000 });
  if (esFichero) {
    /* Los .dc.html de Claude Design envuelven el contenido en elementos propios
       (`x-dc`, `helmet`) que el navegador no conoce: por defecto son en línea, y
       `helmet` lleva dentro el <link> de fuentes y un <style> que SÍ aplican,
       pero cuyo texto no debe pintarse. */
    await pagina.addStyleTag({ content: "x-dc{display:block}helmet{display:none}" });
    /* `support.js` construye el DOM del .dc.html de forma ASÍNCRONA. Medir sin
       esperar da un único hijo del body y el informe compara nueve secciones
       contra una. Se espera a que el árbol deje de crecer dos veces seguidas. */
    await pagina.waitForFunction(() => {
      const n = document.querySelectorAll("section, footer, article").length;
      const previo = window.__ultimoConteo ?? -1;
      window.__ultimoConteo = n;
      return n > 1 && n === previo;
    }, null, { timeout: 20000, polling: 400 }).catch(() => {});
  }
  /* Sin esperar a las fuentes se compara contra el respaldo tipográfico, y todo
     el informe sale desplazado por un motivo que no tiene que ver con el diseño. */
  await pagina.evaluate(() => document.fonts.ready);
  await pagina.waitForTimeout(600);
  return pagina;
}

const secciones = (pagina, selector) => pagina.evaluate((sel) => {
  /* En el lado del DISEÑO no hay un selector fijo: unos .dc.html envuelven el
     contenido en un div y otros cuelgan las secciones directamente de <x-dc>.
     Se prueba lo más específico primero y se descartan los nodos que no pintan
     nada —`helmet` lleva dentro el <link> de fuentes y un <style>—, que si no
     aparecen en el informe como secciones de 0px. */
  const IGNORAR = new Set(["HELMET", "SCRIPT", "STYLE", "LINK", "TEMPLATE"]);
  const utiles = (n) => [...n.children].filter((e) => !IGNORAR.has(e.tagName.toUpperCase()));
  /* Y hay un cuarto caso: `support.js` de Claude Design SUSTITUYE el <x-dc> por
     un <div> al ejecutarse, así que buscarlo no encuentra nada y todo el diseño
     queda como un único hijo del body. Se baja mientras haya un solo envoltorio.
     Sin esto el informe compara nueve secciones contra una. */
  let raiz = document.querySelector("x-dc") ?? document.body;
  for (let i = 0; i < 4; i++) {
    const hijos = utiles(raiz);
    if (hijos.length === 1 && hijos[0].children.length > 1) raiz = hijos[0];
    else break;
  }
  /* Si aun asi sale una sola seccion, el envoltorio no era el del contenido:
     `support.js` cambia el arbol y adivinarlo no es fiable. Se cae a lo
     explicito, que es lo que ya funciona en el lado de la pagina. */
  if (utiles(raiz).length < 2) {
    const porEtiqueta = [...document.querySelectorAll("section, footer")];
    if (porEtiqueta.length > 1) return porEtiqueta.map((e) => ({
      alto: Math.round(e.getBoundingClientRect().height),
      texto: (e.textContent || "").trim().replace(/\s+/g, " ").slice(0, 38),
    }));
  }
  const nodos = sel
    ? [...document.querySelectorAll(sel)]
    : [...raiz.children].filter((e) => !IGNORAR.has(e.tagName.toUpperCase()));
  return nodos.map((e) => ({
    alto: Math.round(e.getBoundingClientRect().height),
    texto: (e.textContent || "").trim().replace(/\s+/g, " ").slice(0, 38),
  }));
}, selector);

const captura = (pagina) => pagina.screenshot({ fullPage: true });

/* ── Emparejar secciones por CONTENIDO, no por posición ────────────────────
   Emparejar por índice es tentador y está mal: basta con que el diseño lleve
   una barra de navegación que la página no tiene para que todo se desplace un
   puesto y el informe compare secciones que no tienen nada que ver. Pasó a la
   primera. Se emparejan por el texto que encabeza cada sección, respetando el
   orden (subsecuencia común), que es lo que permite decir «esta falta» en vez
   de «todas están mal». */

const normaliza = (t) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
  .replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

/** Coeficiente de Dice sobre bigramas: 1 = idénticos, 0 = nada en común. */
function parecido(a, b) {
  const bigramas = (s) => { const g = new Set(); for (let i = 0; i < s.length - 1; i++) g.add(s.slice(i, i + 2)); return g; };
  const A = bigramas(normaliza(a)), B = bigramas(normaliza(b));
  if (!A.size || !B.size) return 0;
  let comunes = 0;
  for (const g of A) if (B.has(g)) comunes++;
  return (2 * comunes) / (A.size + B.size);
}

function emparejar(disenio, pagina, minimo = 0.45) {
  /* Programación dinámica clásica de subsecuencia común, con el parecido como
     puntuación en vez de la igualdad exacta. */
  const n = disenio.length, m = pagina.length;
  const punt = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      const s = parecido(disenio[i].texto, pagina[j].texto);
      punt[i][j] = Math.max(
        s >= minimo ? s + punt[i + 1][j + 1] : 0,
        punt[i + 1][j],
        punt[i][j + 1]
      );
    }
  }
  const salida = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    const s = parecido(disenio[i].texto, pagina[j].texto);
    if (s >= minimo && punt[i][j] === s + punt[i + 1][j + 1]) { salida.push({ d: disenio[i++], p: pagina[j++] }); }
    else if (punt[i + 1][j] >= punt[i][j + 1]) { salida.push({ d: disenio[i++], p: null }); }
    else { salida.push({ d: null, p: pagina[j++] }); }
  }
  while (i < n) salida.push({ d: disenio[i++], p: null });
  while (j < m) salida.push({ d: null, p: pagina[j++] });
  return salida;
}

try {
  /* ── Línea base: guardar ────────────────────────────────────────────────── */
  if (guardarLineaBase) {
    const p = await abrir(url, false);
    const buf = await captura(p);
    fs.mkdirSync(path.dirname(path.resolve(guardarLineaBase)), { recursive: true });
    fs.writeFileSync(guardarLineaBase, buf);
    const img = PNG.sync.read(buf);
    console.error(`\n✔ Línea base guardada: ${guardarLineaBase} (${img.width}×${img.height})`);
    console.error("  Desde ahora, --linea-base contra este fichero detecta cambios no buscados.\n");
    await navegador.close();
    process.exit(0);
  }

  const pag = await abrir(url, false);
  const pagBuf = await captura(pag);
  fs.writeFileSync(path.join(salidaDir, "pagina.png"), pagBuf);

  /* ── Línea base: comparar. Aquí el porcentaje SÍ manda ──────────────────── */
  if (lineaBase) {
    if (!fs.existsSync(lineaBase)) {
      console.error(`✖ No existe ${lineaBase}. Créala con --guardar-linea-base.`);
      await navegador.close(); process.exit(2);
    }
    const a = PNG.sync.read(fs.readFileSync(lineaBase));
    const b = PNG.sync.read(pagBuf);
    await navegador.close();
    const w = Math.min(a.width, b.width), h = Math.min(a.height, b.height);
    const rec = (s) => { const o = new PNG({ width: w, height: h }); PNG.bitblt(s, o, 0, 0, w, h, 0, 0); return o; };
    const dif = new PNG({ width: w, height: h });
    const n = pixelmatch(rec(a).data, rec(b).data, dif.data, w, h, { threshold: 0.1 });
    fs.writeFileSync(path.join(salidaDir, "diff.png"), PNG.sync.write(dif));
    const pct = (n / (w * h)) * 100;
    console.error(`\n  Línea base ${a.width}×${a.height} · ahora ${b.width}×${b.height}`);
    console.error(`  ${n.toLocaleString("es-ES")} píxeles distintos — ${pct.toFixed(3)}%`);
    console.error(`  PNG en ${salidaDir}/`);
    if (a.height !== b.height) console.error(`  ⚠ La altura cambió en ${Math.abs(a.height - b.height)}px.`);
    if (pct > umbral) { console.error(`\n✖ Supera el umbral del ${umbral}%. Algo cambió: mira diff.png.\n`); process.exit(1); }
    console.error(`\n✔ Dentro del umbral del ${umbral}%.\n`);
    process.exit(0);
  }

  /* ── Referencia de Figma: solo para mirar ───────────────────────────────── */
  if (iFigma !== -1) {
    const token = process.env.FIGMA_TOKEN;
    if (!token) { console.error("✖ Falta FIGMA_TOKEN."); await navegador.close(); process.exit(2); }
    const { fetchFramePng } = await import("../lib/figma-client.mjs");
    const enlace = await fetchFramePng(token, args[iFigma + 1], args[iFigma + 2], 1);
    const buf = Buffer.from(await (await fetch(enlace)).arrayBuffer());
    fs.writeFileSync(path.join(salidaDir, "figma.png"), buf);
    await navegador.close();
    console.error(`\n✔ ${salidaDir}/figma.png y ${salidaDir}/pagina.png, para mirarlos al lado.`);
    console.error("  No se calcula porcentaje a propósito: entre Figma y un navegador mide");
    console.error("  el motor de renderizado, no el diseño. Para una puerta, usa --diseno.\n");
    process.exit(0);
  }

  /* ── La puerta: secciones contra el diseño ──────────────────────────────── */
  if (!diseno) {
    console.error("✖ Da --diseno, --linea-base, --guardar-linea-base o --figma.");
    await navegador.close(); process.exit(2);
  }
  if (!fs.existsSync(diseno)) { console.error(`✖ No existe ${diseno}`); await navegador.close(); process.exit(2); }

  const dis = await abrir("file:///" + path.resolve(diseno).replace(/\\/g, "/"), true);
  const disBuf = await captura(dis);
  fs.writeFileSync(path.join(salidaDir, "diseno.png"), disBuf);

  const sD = await secciones(dis, selDiseno);
  const sP = await secciones(pag, selPagina);
  await navegador.close();

  /* Diff de píxeles, para mirar. Nunca para aprobar. */
  const a = PNG.sync.read(disBuf), b = PNG.sync.read(pagBuf);
  const w = Math.min(a.width, b.width), h = Math.min(a.height, b.height);
  const rec = (s) => { const o = new PNG({ width: w, height: h }); PNG.bitblt(s, o, 0, 0, w, h, 0, 0); return o; };
  const dif = new PNG({ width: w, height: h });
  pixelmatch(rec(a).data, rec(b).data, dif.data, w, h, { threshold: 0.1 });
  fs.writeFileSync(path.join(salidaDir, "diff.png"), PNG.sync.write(dif));

  console.error(`\n== ${path.basename(diseno)}  vs  ${url} ==`);
  console.error(`   diseño ${a.width}×${a.height} · página ${b.width}×${b.height}`);
  if (!sP.length) {
    console.error(`\n✖ El selector «${selPagina}» no encontró ninguna sección en la página.`);
    console.error("  Ajusta --sel: sin secciones no hay nada que comparar.\n");
    process.exit(2);
  }

  console.error(`\n   ${"diseño".padStart(7)} ${"página".padStart(7)} ${"Δ".padStart(7)}   sección`);
  console.error("   " + "─".repeat(72));

  const desvios = [];
  for (const { d, p } of emparejar(sD, sP)) {
    if (!p) {
      console.error(`   ${String(d.alto).padStart(7)} ${"—".padStart(7)} ${"falta".padStart(7)}   ${d.texto}`);
      desvios.push({ tipo: "falta", texto: d.texto, alto: d.alto });
      continue;
    }
    if (!d) {
      console.error(`   ${"—".padStart(7)} ${String(p.alto).padStart(7)} ${"sobra".padStart(7)}   ${p.texto}`);
      desvios.push({ tipo: "sobra", texto: p.texto, alto: p.alto });
      continue;
    }
    const delta = p.alto - d.alto;
    const pct = d.alto ? (Math.abs(delta) / d.alto) * 100 : 0;
    const fuera = pct > tolerancia;
    const marca = fuera ? "✖" : "·";
    console.error(`   ${String(d.alto).padStart(7)} ${String(p.alto).padStart(7)} ${((delta >= 0 ? "+" : "") + delta).padStart(7)} ${marca} ${d.texto}`);
    if (fuera) desvios.push({ tipo: "altura", texto: d.texto, disenio: d.alto, pagina: p.alto, delta, pct });
  }

  console.error(`\n   ${salidaDir}/diseno.png · pagina.png · diff.png`);
  console.error("   El diff de píxeles está para mirarlo, no para aprobar: en cuanto una");
  console.error("   sección se desplaza, todo lo de debajo sale distinto.");

  if (!desvios.length) {
    console.error(`\n✔ Las ${sD.length} secciones dentro de la tolerancia del ${tolerancia}%.\n`);
    process.exit(0);
  }
  const faltan = desvios.filter((d) => d.tipo === "falta").length;
  const sobran = desvios.filter((d) => d.tipo === "sobra").length;
  const alturas = desvios.filter((d) => d.tipo === "altura").length;
  console.error(`\n✖ ${desvios.length} desvío(s): ${alturas} de altura, ${faltan} sección(es) del diseño sin implementar, ${sobran} de más.`);
  console.error("  Corrige CSS y tokens. Si hay que mover bloques, revisa antes si el que");
  console.error("  está mal es el diseño: puede que la traducción sea correcta.\n");
  process.exit(1);
} catch (e) {
  console.error("✖ " + e.message.split("\n")[0]);
  try { await navegador.close(); } catch { /* ya cerrado */ }
  process.exit(2);
}
