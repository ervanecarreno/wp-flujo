#!/usr/bin/env node
/**
 * extract.mjs — Etapa 1 del pipeline: extracción desde Figma.
 *
 * Uso:
 *   FIGMA_TOKEN=xxx node scripts/extract.mjs "<url-o-filekey>" [nombre-frame]
 *
 * Produce en ./extract/ :
 *   {frame}.node.json         árbol de nodos del frame
 *   {frame}.variables.json    variables locales resueltas (crudo + normalizado)
 *   {frame}.images.json       mapa imageRef -> URL
 *   {frame}.meta.json         fileKey, nodeId, fecha, para trazabilidad
 *
 * Si trabajas con el MCP oficial de Figma (Claude Code / Cursor), puedes
 * sustituir esta etapa por get_design_context + get_variable_defs y volcar
 * su salida a los mismos archivos.
 */
import fs from "node:fs";
import path from "node:path";
import { parseFigmaUrl, fetchNode, fetchLocalVariables, fetchImageFills } from "../lib/figma-client.mjs";
import { resolveVariables } from "../lib/tokens.mjs";

const [urlOrKey, frameNameArg] = process.argv.slice(2);
const token = process.env.FIGMA_TOKEN;

if (!urlOrKey) {
  console.error('Uso: FIGMA_TOKEN=xxx node scripts/extract.mjs "<url-o-filekey>" [nombre-frame]');
  process.exit(2);
}
if (!token) {
  console.error("Falta FIGMA_TOKEN en el entorno (Personal Access Token de Figma).");
  process.exit(2);
}

const parsed = parseFigmaUrl(urlOrKey) ?? { fileKey: urlOrKey, nodeId: null };
const outDir = path.resolve("extract");
fs.mkdirSync(outDir, { recursive: true });

const run = async () => {
  console.error(`→ Extrayendo file=${parsed.fileKey} node=${parsed.nodeId ?? "(primer frame)"}`);
  const node = await fetchNode(token, parsed.fileKey, parsed.nodeId);
  const frameName = (frameNameArg || node.name || "frame").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  const [meta, images] = await Promise.all([
    fetchLocalVariables(token, parsed.fileKey),
    fetchImageFills(token, parsed.fileKey),
  ]);
  const normalized = resolveVariables(meta ?? {});

  const write = (suffix, data) => {
    const p = path.join(outDir, `${frameName}.${suffix}.json`);
    fs.writeFileSync(p, JSON.stringify(data, null, 2));
    console.error(`  ✔ ${p}`);
  };

  write("node", node);
  write("variables", { raw: meta, normalized });
  write("images", images);
  write("meta", { fileKey: parsed.fileKey, nodeId: parsed.nodeId, frameName, extractedAt: new Date().toISOString() });

  console.error(`\nColores: ${normalized.colors.length} · Números: ${normalized.numbers.length} · Cadenas: ${normalized.strings.length}`);
  if (!meta) console.error("⚠ Sin acceso a variables: define tokens manualmente o usa el MCP de Figma.");
  console.error(`\nSiguiente: node scripts/map-tokens.mjs extract/${frameName}.variables.json`);
};

run().catch((e) => { console.error("✖", e.message); process.exit(1); });
