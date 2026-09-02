/**
 * blockdiff.mjs — Diff CONSCIENTE DE BLOQUES para el round-trip de QA.
 *
 * El objetivo del round-trip: publicar el markup en WordPress, releer lo que
 * WP re-serializa y comparar. Si difieren, la diferencia ES la corrección que
 * hay que aplicar al emisor. Un diff de texto plano es inútil (todo en una
 * línea gigante); este parte el markup en bloques por uniqueId y señala
 * exactamente qué bloque y qué parte (delimitador JSON vs cuerpo HTML) cambió.
 */

/**
 * Parte el markup en una lista plana de bloques.
 * Cada entrada: { name, uniqueId, delimiter, open, close, index }
 *  - delimiter: el JSON crudo del <!-- wp:... {...} -->
 *  - fullOpen: el comentario de apertura completo
 */
export function parseBlocks(markup) {
  const blocks = [];
  const re = /<!--\s+wp:([a-z0-9\/-]+)\s+(\{[\s\S]*?\})\s*(\/?)-->/g;
  let m;
  while ((m = re.exec(markup))) {
    let uniqueId = null;
    const idm = m[2].match(/"uniqueId":"([0-9a-f]+)"/);
    if (idm) uniqueId = idm[1];
    blocks.push({
      name: m[1],
      uniqueId,
      json: m[2],
      selfClose: m[3] === "/",
      index: m.index,
      fullOpen: m[0],
    });
  }
  return blocks;
}

/** Normaliza espacios entre bloques (WP puede variar saltos de línea). */
export function normalizeInterblockWhitespace(markup) {
  return markup
    .replace(/-->\s*\n\s*\n\s*<!--/g, "-->\n\n<!--") // dobles saltos → uniformes
    .replace(/-->\s*\n\s*<!--/g, "-->\n<!--")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}

/**
 * Compara dos markups a nivel de bloque.
 * Empareja por uniqueId (o por orden si falta). Devuelve un array de drifts:
 *   { uniqueId, name, kind: 'json'|'missing'|'extra'|'body', sent, got }
 */
export function diffBlocks(sentMarkup, gotMarkup) {
  const sent = parseBlocks(sentMarkup);
  const got = parseBlocks(gotMarkup);
  const gotById = new Map();
  for (const b of got) if (b.uniqueId) gotById.set(b.uniqueId, b);

  const drifts = [];
  const seen = new Set();

  for (const s of sent) {
    const g = s.uniqueId ? gotById.get(s.uniqueId) : got[sent.indexOf(s)];
    if (!g) { drifts.push({ uniqueId: s.uniqueId, name: s.name, kind: "missing", sent: s.fullOpen, got: null }); continue; }
    seen.add(s.uniqueId);
    if (s.json !== g.json) {
      drifts.push({ uniqueId: s.uniqueId, name: s.name, kind: "json", sent: s.json, got: g.json, diff: charDiff(s.json, g.json) });
    }
  }
  for (const g of got) {
    if (g.uniqueId && !seen.has(g.uniqueId)) {
      // ¿es un id remapeado o realmente extra?
      drifts.push({ uniqueId: g.uniqueId, name: g.name, kind: "extra", sent: null, got: g.fullOpen });
    }
  }
  return drifts;
}

/** Localiza el primer punto de divergencia entre dos strings. */
export function charDiff(a, b) {
  let i = 0;
  const n = Math.min(a.length, b.length);
  while (i < n && a[i] === b[i]) i++;
  const ctx = 40;
  return {
    at: i,
    sent: a.slice(Math.max(0, i - ctx), i + ctx),
    got: b.slice(Math.max(0, i - ctx), i + ctx),
  };
}

/** Resumen legible de los drifts. */
export function formatDrifts(drifts) {
  if (!drifts.length) return "  ✔ Sin drift: WordPress re-serializa idéntico a lo enviado.";
  const lines = [`  ✖ ${drifts.length} bloque(s) con drift:`];
  for (const d of drifts) {
    if (d.kind === "missing") { lines.push(`    · [${d.name} ${d.uniqueId ?? "?"}] AUSENTE al releer (¿bloque descartado por WP?)`); continue; }
    if (d.kind === "extra") { lines.push(`    · [${d.name} ${d.uniqueId ?? "?"}] EXTRA al releer (WP lo añadió/dividió)`); continue; }
    lines.push(`    · [${d.name} ${d.uniqueId}] JSON difiere en pos ${d.diff.at}:`);
    lines.push(`        enviado: …${d.diff.sent}…`);
    lines.push(`        WP:      …${d.diff.got}…`);
  }
  return lines.join("\n");
}
