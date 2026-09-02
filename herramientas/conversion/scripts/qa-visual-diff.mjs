#!/usr/bin/env node
/**
 * qa-visual-diff.mjs — QA nivel 3: diff visual píxel a píxel.
 *
 * Exporta el frame de Figma como PNG a escala fija, renderiza el permalink en
 * staging con Playwright al mismo ancho, y compara con pixelmatch. Produce un
 * PNG de diferencias y un porcentaje. Si supera el umbral, falla: la corrección
 * debe aplicarse SOLO a CSS/tokens, nunca a la estructura del patrón.
 *
 * Requiere: npm i (playwright, pixelmatch, pngjs) + npx playwright install chromium
 *
 * Uso:
 *   node scripts/qa-visual-diff.mjs <url-staging> --figma <fileKey> <nodeId> [--width 1440] [--threshold 1]
 *   node scripts/qa-visual-diff.mjs <url-staging> --ref referencia.png [--width 1440] [--threshold 1]
 *
 * Env (si usas --figma): FIGMA_TOKEN
 */
import fs from "node:fs";

let chromium, pixelmatch, PNG;
try {
  ({ chromium } = await import("playwright"));
  pixelmatch = (await import("pixelmatch")).default;
  ({ PNG } = await import("pngjs"));
} catch {
  console.error("Faltan dependencias. Ejecuta: npm i && npx playwright install chromium");
  process.exit(2);
}
import { fetchFramePng } from "../lib/figma-client.mjs";

const args = process.argv.slice(2);
const stagingUrl = args[0];
if (!stagingUrl || stagingUrl.startsWith("--")) { console.error("Uso: node scripts/qa-visual-diff.mjs <url-staging> --figma <fileKey> <nodeId> | --ref ref.png [--width N] [--threshold %]"); process.exit(2); }

const opt = (name, def) => { const i = args.indexOf(name); return i !== -1 ? args[i + 1] : def; };
const width = parseInt(opt("--width", "1440"), 10);
const threshold = parseFloat(opt("--threshold", "1")); // % de píxeles distintos tolerado
const scale = parseInt(opt("--scale", "2"), 10);

async function getReferencePng() {
  const refIdx = args.indexOf("--ref");
  if (refIdx !== -1) return fs.readFileSync(args[refIdx + 1]);
  const figIdx = args.indexOf("--figma");
  if (figIdx !== -1) {
    const fileKey = args[figIdx + 1], nodeId = args[figIdx + 2];
    const token = process.env.FIGMA_TOKEN;
    if (!token) { console.error("Falta FIGMA_TOKEN para --figma."); process.exit(2); }
    console.error("→ Exportando PNG del frame de Figma…");
    const url = await fetchFramePng(token, fileKey, nodeId, scale);
    const buf = Buffer.from(await (await fetch(url)).arrayBuffer());
    fs.writeFileSync("qa-figma-ref.png", buf);
    return buf;
  }
  console.error("Da --figma <fileKey> <nodeId> o --ref ref.png"); process.exit(2);
}

/** Ajusta ambas imágenes al mismo tamaño (recorta al mínimo común). */
function align(a, b) {
  const w = Math.min(a.width, b.width);
  const h = Math.min(a.height, b.height);
  const crop = (src) => {
    if (src.width === w && src.height === h) return src;
    const out = new PNG({ width: w, height: h });
    PNG.bitblt(src, out, 0, 0, w, h, 0, 0);
    return out;
  };
  return [crop(a), crop(b), w, h];
}

const run = async () => {
  const refBuf = await getReferencePng();
  const refPng = PNG.sync.read(refBuf);
  const renderWidth = Math.round(refPng.width / scale); // el PNG de Figma va a escala `scale`

  console.error(`→ Renderizando ${stagingUrl} a ${renderWidth || width}px…`);
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: renderWidth || width, height: 1080 },
    deviceScaleFactor: scale,
  });
  await page.goto(stagingUrl, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500); // fuentes/imágenes
  const shotBuf = await page.screenshot({ fullPage: true });
  await browser.close();
  fs.writeFileSync("qa-staging.png", shotBuf);
  const shotPng = PNG.sync.read(shotBuf);

  const [imgA, imgB, w, h] = align(refPng, shotPng);
  const diff = new PNG({ width: w, height: h });
  const mismatch = pixelmatch(imgA.data, imgB.data, diff.data, w, h, { threshold: 0.1 });
  fs.writeFileSync("qa-diff.png", PNG.sync.write(diff));

  const pct = (mismatch / (w * h)) * 100;
  console.error(`\n  Píxeles distintos: ${mismatch} de ${w * h} (${pct.toFixed(3)}%)`);
  console.error("  Artefactos: qa-figma-ref.png (o tu --ref), qa-staging.png, qa-diff.png");

  if (pct > threshold) {
    console.error(`\n  ✖ Supera el umbral de ${threshold}%. Corrige SOLO CSS/tokens (nunca la estructura del patrón) y repite.`);
    process.exit(1);
  }
  console.error(`\n  ✔ Dentro del umbral de ${threshold}%. Fidelidad aceptada.`);
};

run().catch((e) => { console.error("✖", e.message); process.exit(1); });
