#!/usr/bin/env node
/**
 * medir-referencia.mjs — audita una web de referencia con MEDIDAS reales,
 * no con capturas de pantalla.
 *
 * Nace de la trampa 17/18 de la skill `flujo-wordpress-generateblocks`,
 * pagada en Hedvig el 7/09/2026 dos veces seguidas:
 *
 *   1. La landing se construyó leyendo el fichero de Figma en vez de la web
 *      real que el cliente dio como referencia. El Figma tenía copias de
 *      texto distintas y ni footer: salió con el titular del Hero
 *      equivocado, sin CTA final, sin footer, con el contenedor a 1280 en
 *      vez de 1120. Nada de eso lo ve un validador — el marcado era válido.
 *   2. Ya corregido eso, la animación de una sección se dio por el patrón
 *      más habitual de este flujo (GSAP, fundido + deslizamiento) sin
 *      entrar a ver la web de verdad. Era apilamiento por `position:sticky`,
 *      cero JS.
 *
 * Las dos veces la comprobación real fue la misma: abrir la URL con
 * `javascript_tool` y teclear `getComputedStyle`/`getBoundingClientRect` a
 * mano, sección por sección, docenas de llamadas. Este script hace esa
 * misma comprobación en un solo comando: escala tipográfica, contenedores,
 * paleta, radios, y — el motivo por el que existe la herramienta — qué
 * elementos tienen `opacity`/`transform`/`filter` puestos EN LÍNEA, que es
 * como los motores de animación tipo Framer/Fes  marcan el estado inicial
 * (oculto) antes de que dispare el JS. Verlos con el marcado servido, sin
 * haber scrolleado, ya dice qué anima y cómo — es justo lo que reveló que la
 * segunda vez no había GSAP en absoluto.
 *
 * Uso:
 *   node herramientas/referencia/medir-referencia.mjs <url> [--ancho 1440] [--salida datos.json]
 *
 * Lo que NO hace: decidir qué construir. Da los números; construir la
 * fidelidad sigue siendo un trabajo con criterio — pero ahora contra medidas,
 * no contra una impresión de la captura de pantalla.
 *
 * Requiere playwright-core (ya en package.json del plugin: `npm install`
 * una vez, sin descargar Chromium — usa el Chrome/Edge ya instalado).
 */
import fs from "node:fs";

const args = process.argv.slice(2);
const url = args[0];
if (!url || url.startsWith("--")) {
  console.error(`Uso: node herramientas/referencia/medir-referencia.mjs <url> [--ancho 1440] [--salida datos.json]`);
  process.exit(2);
}
const opt = (n, def = null) => { const i = args.indexOf(n); return i !== -1 ? args[i + 1] : def; };
const ancho = Number(opt("--ancho", "1440"));
const salida = opt("--salida");

let chromium;
try { ({ chromium } = await import("playwright-core")); }
catch (e) {
  console.error("✖ Falta playwright-core. Desde la raíz del plugin:  npm install");
  console.error("  " + e.message.split("\n")[0]);
  process.exit(2);
}

let navegador = null;
for (const canal of ["chrome", "msedge"]) {
  try { navegador = await chromium.launch({ channel: canal, headless: true }); break; } catch { /* siguiente */ }
}
if (!navegador) {
  console.error("✖ No se pudo abrir ni Chrome ni Edge. playwright-core usa el navegador ya instalado.");
  process.exit(2);
}

const pagina = await navegador.newPage({ viewport: { width: ancho, height: 1000 }, deviceScaleFactor: 1 });
console.error(`→ Abriendo ${url} a ${ancho}px de ancho…`);
try {
  await pagina.goto(url, { waitUntil: "networkidle", timeout: 60000 });
} catch (e) {
  console.error(`✖ No se pudo cargar: ${e.message.split("\n")[0]}`);
  await navegador.close();
  process.exit(2);
}
/* Fuentes cargadas antes de medir: si no, la escala tipográfica sale con
 * las métricas del respaldo, no las reales. */
await pagina.evaluate(() => document.fonts?.ready).catch(() => {});
await pagina.waitForTimeout(300);

/**
 * Todo el análisis corre DENTRO de la página (una sola llamada a evaluate:
 * cruzar cien elementos por el puente de depuración uno a uno es lo que hace
 * lenta y frágil la comprobación manual). Cada bloque está comentado con qué
 * mide y por qué esa forma de medirlo, no otra.
 */
/* eslint-disable no-undef */
const datos = await pagina.evaluate(() => {
  const num = (v) => Math.round(parseFloat(v) * 100) / 100;
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== "hidden";
  };

  /* ── Paleta: fondos que de verdad se ven, por área ocupada ────────────── */
  const fondos = new Map(); // color -> área total en px²
  document.querySelectorAll("*").forEach((el) => {
    if (!visible(el)) return;
    const bg = getComputedStyle(el).backgroundColor;
    if (!bg || bg === "rgba(0, 0, 0, 0)" || bg === "transparent") return;
    const r = el.getBoundingClientRect();
    fondos.set(bg, (fondos.get(bg) || 0) + r.width * r.height);
  });
  const paleta = [...fondos.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([color, area]) => ({ color, areaPx2: Math.round(area) }));

  /* ── Escala tipográfica: combinaciones reales, no solo tamaños ────────── */
  const tipos = new Map(); // "fs|fw|lh|ls|color" -> {n, ejemplo}
  document.querySelectorAll("*").forEach((el) => {
    if (el.children.length || !visible(el)) return; // solo hojas: el texto vive ahí
    const t = (el.textContent || "").trim();
    if (!t) return;
    const cs = getComputedStyle(el);
    const fs = num(cs.fontSize);
    if (fs < 10) return;
    const clave = [fs, cs.fontWeight, cs.lineHeight, cs.letterSpacing, cs.color].join("|");
    if (!tipos.has(clave)) {
      tipos.set(clave, {
        fontSize: fs, fontWeight: cs.fontWeight, lineHeight: cs.lineHeight,
        letterSpacing: cs.letterSpacing, color: cs.color, fontFamily: cs.fontFamily.split(",")[0].replace(/["']/g, ""),
        n: 0, ejemplo: t.slice(0, 50),
      });
    }
    tipos.get(clave).n++;
  });
  const escalaTipografica = [...tipos.values()].sort((a, b) => b.fontSize - a.fontSize);

  /* ── Radios y paddings más usados (moda, no todos) ────────────────────── */
  const conteo = (fn) => {
    const m = new Map();
    document.querySelectorAll("*").forEach((el) => {
      if (!visible(el)) return;
      const v = fn(getComputedStyle(el));
      if (!v || v === "0px") return;
      m.set(v, (m.get(v) || 0) + 1);
    });
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([v, n]) => ({ valor: v, n }));
  };
  const radios = conteo((cs) => cs.borderRadius);
  const paddings = conteo((cs) => cs.padding);
  const gaps = conteo((cs) => cs.gap);

  /* ── Secciones de primer nivel: contenedor, padding, fondo ────────────── */
  const raiz = document.querySelector("main") || document.body;
  const secciones = [...raiz.querySelectorAll("section, header, footer")]
    .filter((el) => visible(el) && el.getBoundingClientRect().height > 40)
    .map((el) => {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      /* El "contenedor de contenido" suele ser el hijo directo con menor
       * ancho que el padre — la caja centrada dentro de la sección a
       * sangre completa. */
      const hijo = [...el.children].find((h) => visible(h) && h.getBoundingClientRect().width < r.width - 10);
      const hr = hijo ? hijo.getBoundingClientRect() : null;
      return {
        tag: el.tagName.toLowerCase(),
        id: el.id || null,
        top: Math.round(r.top + window.scrollY),
        alturaPx: Math.round(r.height),
        anchoSeccionPx: Math.round(r.width),
        paddingSeccion: cs.padding,
        fondo: cs.backgroundColor,
        posicion: cs.position,
        anchoContenedorPx: hr ? Math.round(hr.width) : null,
        textoInicial: (el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 60),
      };
    });

  /* ── Animación: qué lleva opacity/transform/filter EN LÍNEA ───────────── *
   * Esto es lo importante. Un motor de animación por scroll dispara desde
   * JS y dice su plan escribiendo el estado inicial como estilo en línea
   * ANTES de que dispare — leerlo con la página recién cargada, sin haber
   * scrolleado ni un píxel, ya dice qué anima y con qué valores. Si no hay
   * NADA aquí, no hay animación con JS: es CSS (sticky, :hover, transición
   * simple) o no anima. */
  const animados = [];
  document.querySelectorAll("[style]").forEach((el) => {
    const s = el.getAttribute("style") || "";
    if (!/opacity\s*:\s*0|transform\s*:\s*(translate|scale|matrix)|filter\s*:\s*blur/.test(s)) return;
    const r = el.getBoundingClientRect();
    animados.push({
      top: Math.round(r.top + window.scrollY),
      tag: el.tagName.toLowerCase(),
      clase: (el.className || "").toString().slice(0, 40),
      estiloEnLinea: s.replace(/--[^;]+;\s*/g, "").slice(0, 140),
      texto: (el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 40),
    });
  });
  animados.sort((a, b) => a.top - b.top);

  /* ── position:sticky / fixed: cabeceras flotantes y candidatos a apilado ─
   * Varios sticky con el MISMO padre y sin hueco entre ellos (mira
   * `paddingSeccion`/`gap` del padre) es la huella del apilado de tarjetas
   * que salió en Hedvig — confírmalo con scroll real si ves varios aquí. */
  const posicionados = [];
  document.querySelectorAll("*").forEach((el) => {
    if (!visible(el)) return;
    const cs = getComputedStyle(el);
    if (cs.position !== "sticky" && cs.position !== "fixed") return;
    const r = el.getBoundingClientRect();
    posicionados.push({
      tag: el.tagName.toLowerCase(), clase: (el.className || "").toString().slice(0, 30),
      posicion: cs.position, top: cs.top, zIndex: cs.zIndex,
      anchoPx: Math.round(r.width), altoPx: Math.round(r.height),
      padreClase: (el.parentElement?.className || "").toString().slice(0, 30),
    });
  });

  return {
    viewport: { width: innerWidth, height: innerHeight },
    documento: { alturaPx: document.documentElement.scrollHeight },
    fondoBody: getComputedStyle(document.body).backgroundColor,
    paleta, escalaTipografica, radios, paddings, gaps, secciones, animados, posicionados,
  };
});
/* eslint-enable no-undef */

await navegador.close();

if (salida) {
  fs.writeFileSync(salida, JSON.stringify({ url, ancho, capturadoEn: new Date().toISOString(), ...datos }, null, 2));
  console.error(`✔ Datos completos en ${salida}`);
}

/* ── Resumen legible ─────────────────────────────────────────────────────── */
console.log(`\n== ${url} (${ancho}px) ==\n`);

console.log(`Documento: ${datos.documento.alturaPx}px de alto · fondo del body: ${datos.fondoBody}\n`);

console.log(`PALETA (por área ocupada):`);
for (const p of datos.paleta.slice(0, 8)) console.log(`  ${p.color}`);

console.log(`\nESCALA TIPOGRÁFICA (de mayor a menor, con nº de apariciones):`);
for (const t of datos.escalaTipografica.slice(0, 14)) {
  console.log(`  ${String(t.fontSize).padStart(3)}px  ${t.fontWeight}  lh:${t.lineHeight}  ls:${t.letterSpacing}  ${t.color}  ×${t.n}  «${t.ejemplo}»`);
}

console.log(`\nRADIOS más usados:      ${datos.radios.map((r) => `${r.valor} (×${r.n})`).join(", ") || "—"}`);
console.log(`PADDINGS más usados:    ${datos.paddings.map((r) => `${r.valor} (×${r.n})`).join(", ") || "—"}`);
console.log(`GAPS más usados:        ${datos.gaps.map((r) => `${r.valor} (×${r.n})`).join(", ") || "—"}`);

console.log(`\nSECCIONES (${datos.secciones.length}):`);
for (const s of datos.secciones) {
  console.log(`  y=${s.top}  h=${s.alturaPx}  <${s.tag}${s.id ? "#" + s.id : ""}>  contenedor:${s.anchoContenedorPx ?? "—"}px  padding:${s.paddingSeccion}  fondo:${s.fondo}`);
  console.log(`      «${s.textoInicial}»`);
}

if (datos.posicionados.length) {
  console.log(`\nPOSICIONADOS (sticky/fixed) — ${datos.posicionados.length}:`);
  for (const p of datos.posicionados) {
    console.log(`  <${p.tag} class="${p.clase}"> ${p.posicion} top:${p.top} z:${p.zIndex} ${p.anchoPx}×${p.altoPx}  padre:.${p.padreClase}`);
  }
  console.log(`  → si varios comparten padre y no hay hueco entre ellos, confirma con scroll real si es apilado (trampa 17/18).`);
}

if (datos.animados.length) {
  console.log(`\nANIMACIÓN — ${datos.animados.length} elemento(s) con estado inicial en línea:`);
  for (const a of datos.animados.slice(0, 30)) {
    console.log(`  y=${a.top}  <${a.tag} class="${a.clase}">  ${a.estiloEnLinea}`);
    if (a.texto) console.log(`      «${a.texto}»`);
  }
  if (datos.animados.length > 30) console.log(`  … y ${datos.animados.length - 30} más (usa --salida para verlos todos).`);
  console.log(`\n  Esto es lo que hay ANTES de disparar el scroll: si aquí no aparece transform/opacity`);
  console.log(`  en la sección que te interesa, esa sección no anima con JS — es CSS (sticky, hover…).`);
} else {
  console.log(`\nANIMACIÓN: ningún elemento con opacity/transform/filter en línea.`);
  console.log(`  O no anima nada por JS, o el motor pone el estado inicial por clase CSS, no en línea.`);
  console.log(`  Confirma haciendo scroll real y comparando getComputedStyle antes/después.`);
}

if (salida) console.log(`\nDatos completos (todas las secciones, toda la animación, toda la tipografía): ${salida}`);
