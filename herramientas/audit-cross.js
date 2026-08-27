// Pasada 2: coherencia entre el marcado, el CSS externo, el JS y los assets
const fs = require('fs');
const path = require('path');

const ROOT = process.argv[2];
const GB = path.join(ROOT, 'wordpress/generateblocks');
const html = fs.readFileSync(path.join(GB, 'home-1b-generateblocks.html'), 'utf8');
const css = fs.readFileSync(path.join(GB, 'home-1b-gb-extra.css'), 'utf8');
const js = fs.readFileSync(path.join(GB, 'slider-animado.js'), 'utf8');

// --- ids presentes en el marcado ---
const idClasses = new Set();
for (const m of html.matchAll(/class="([^"]*)"/g))
  for (const c of m[1].split(/\s+/)) if (c.startsWith('gb-')) idClasses.add(c);

// --- clases "de autor" (ar-*) en className ---
const authorClasses = new Set();
for (const m of html.matchAll(/"className":"([^"]*)"/g))
  for (const c of m[1].split(/\s+/)) if (c && !c.startsWith('gb-')) authorClasses.add(c);
for (const m of html.matchAll(/class="([^"]*)"/g))
  for (const c of m[1].split(/\s+/)) if (c && !c.startsWith('gb-')) authorClasses.add(c);

console.log('=== CLASES DE AUTOR EN EL MARCADO ===');
console.log([...authorClasses].sort().join(' ') || '(ninguna)');

// --- selectores del CSS externo ---
const noComments = css.replace(/\/\*[\s\S]*?\*\//g, '');
const selectors = new Set();
for (const m of noComments.matchAll(/(^|\}|\{)\s*([^{}@]+?)\s*\{/g)) {
  const sel = m[2].trim();
  if (!sel || sel.startsWith('@')) continue;
  for (const part of sel.split(',')) selectors.add(part.trim());
}

const referenced = new Set();
for (const s of selectors) for (const m of s.matchAll(/\.([A-Za-z0-9_-]+)/g)) referenced.add(m[1]);

console.log('\n=== CSS EXTERNO → CLASES REFERENCIADAS ===');
const gbRefs = [...referenced].filter(c => c.startsWith('gb-')).sort();
const arRefs = [...referenced].filter(c => !c.startsWith('gb-')).sort();
console.log('gb-*:', gbRefs.join(' ') || '(ninguna)');
console.log('otras:', arRefs.join(' ') || '(ninguna)');

console.log('\n=== HUÉRFANOS ===');
let orphans = 0;
for (const c of gbRefs) if (!idClasses.has(c)) { console.log('  ✗ CSS apunta a "' + c + '" que NO existe en el marcado'); orphans++; }
for (const c of arRefs) {
  const known = ['ar-hero-search','wp-block-search__input','wp-block-search__button','wp-block-search','slider-animado','gb-loop-item'];
  if (!authorClasses.has(c) && !c.startsWith('wp-')) { console.log('  ✗ CSS apunta a "' + c + '" que NO existe en el marcado'); orphans++; }
}
if (!orphans) console.log('  (ninguno)');

// --- clases de autor sin CSS ---
console.log('\n=== CLASES DE AUTOR SIN REGLA CSS ===');
let unstyled = 0;
for (const c of [...authorClasses].sort()) {
  if (c.startsWith('wp-') || c.startsWith('gb-')) continue;
  if (!referenced.has(c)) { console.log('  ⚠ "' + c + '" está en el marcado pero el CSS externo no la estila'); unstyled++; }
}
if (!unstyled) console.log('  (ninguna)');

// --- bloques que no son GenerateBlocks ---
console.log('\n=== BLOQUES NO-GB EN EL ARCHIVO ===');
const core = new Set();
for (const m of html.matchAll(/<!-- wp:([a-z0-9-]+\/[a-z0-9-]+|[a-z0-9-]+)\s/g))
  if (!m[1].startsWith('generateblocks/')) core.add(m[1]);
console.log([...core].sort().join(', ') || '(ninguno)');

// --- parámetros de las queries ---
console.log('\n=== QUERIES ===');
for (const m of html.matchAll(/<!-- wp:generateblocks\/query (\{.*?\}) -->/g)) {
  try { const a = JSON.parse(m[1]); console.log(' ', a.uniqueId, JSON.stringify(a.query)); } catch { console.log('  (no parseable)'); }
}

// --- imágenes referenciadas ---
console.log('\n=== IMÁGENES REFERENCIADAS ===');
const imgs = new Set();
for (const m of html.matchAll(/(?:src|background-image)"?:"?[^"]*?(\/wp-content\/uploads\/[^")\s]+)/g)) imgs.add(m[1]);
for (const m of html.matchAll(/url\((\/wp-content\/uploads\/[^)]+)\)/g)) imgs.add(m[1]);
const assets = fs.readdirSync(path.join(ROOT, 'assets'));
for (const u of [...imgs].sort()) {
  const base = path.basename(u);
  const have = assets.includes(base);
  console.log(`  ${have ? '✓' : '✗'} ${u}${have ? '' : '   ← NO está en assets/'}`);
}
console.log('\n  assets/ sin usar:', assets.filter(a => ![...imgs].some(u => path.basename(u) === a)).join(', ') || '(ninguno)');

// --- JS del slider: ¿qué clase busca? ---
console.log('\n=== SLIDER JS ===');
const sel = [...js.matchAll(/querySelectorAll?\(\s*['"]([^'"]+)['"]/g)].map(m => m[1]);
console.log('  selectores que busca:', [...new Set(sel)].join(' | '));
for (const s of new Set(sel)) {
  const cls = [...s.matchAll(/\.([A-Za-z0-9_-]+)/g)].map(m => m[1]);
  for (const c of cls) {
    const present = idClasses.has(c) || authorClasses.has(c);
    if (!present) console.log(`  ✗ el JS busca ".${c}" que NO existe en el marcado`);
  }
}
