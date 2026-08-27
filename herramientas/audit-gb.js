// Auditor de marcado GenerateBlocks V2 contra docs/metodo-generateblocks-v2.md §8
const fs = require('fs');

const FILE = process.argv[2];
const src = fs.readFileSync(FILE, 'utf8');

const PREFIX = {
  element: 'gb-element', text: 'gb-text', media: 'gb-media',
  shape: 'gb-shape', looper: 'gb-looper', 'loop-item': 'gb-loop-item',
  query: null, 'query-page-numbers': 'gb-query-page-numbers',
};

// ---------- 1. Escáner de comentarios de bloque ----------
function scan(s) {
  const out = [];
  const OPEN = '<!-- wp:generateblocks/';
  let i = 0;
  while ((i = s.indexOf(OPEN, i)) !== -1) {
    const start = i;
    let p = i + OPEN.length;
    let type = '';
    while (p < s.length && /[a-z-]/.test(s[p])) type += s[p++];
    while (s[p] === ' ') p++;
    let json = null, jsonStart = -1, jsonEnd = -1;
    if (s[p] === '{') {
      jsonStart = p;
      let depth = 0, inStr = false, esc = false;
      for (; p < s.length; p++) {
        const c = s[p];
        if (esc) { esc = false; continue; }
        if (c === '\\') { esc = true; continue; }
        if (inStr) { if (c === '"') inStr = false; continue; }
        if (c === '"') { inStr = true; continue; }
        if (c === '{') depth++;
        else if (c === '}') { depth--; if (depth === 0) { p++; break; } }
      }
      jsonEnd = p;
      json = s.slice(jsonStart, jsonEnd);
    }
    while (s[p] === ' ') p++;
    const selfClosing = s[p] === '/';
    if (selfClosing) p++;
    const close = s.indexOf('-->', p);
    if (close === -1) { i = start + OPEN.length; continue; }
    out.push({ type, json, raw: s.slice(start, close + 3), start, end: close + 3, selfClosing, jsonStart, jsonEnd });
    i = close + 3;
  }
  return out;
}

const blocks = scan(src);

// ---------- 2. buildCss idéntico al del método ----------
function buildCss(sel, styles) {
  const own = {}, nest = [];
  for (const k of Object.keys(styles)) {
    const v = styles[k];
    if (v && typeof v === 'object') nest.push([k, v]); else own[k] = v;
  }
  const decl = o => Object.keys(o).sort().map(k => k + ':' + o[k]).join(';');
  let out = Object.keys(own).length ? sel + '{' + decl(own) + '}' : '';
  for (const [k, v] of nest) {
    out += k[0] === '@' ? k + '{' + sel + '{' + decl(v) + '}}' : sel + k.slice(1) + '{' + decl(v) + '}';
  }
  return out;
}

// ---------- 3. Checks ----------
const issues = [];
const add = (sev, rule, id, msg, extra) => issues.push({ sev, rule, id, msg, extra });

const seenIds = new Map();
let counts = {};

for (const b of blocks) {
  counts[b.type] = (counts[b.type] || 0) + 1;
  if (!b.json) { add('ERR', 'json', b.type, 'bloque sin atributos JSON'); continue; }

  // --- 3a. Escapado (§3): ningún carácter crudo dentro del JSON ---
  const rawJson = b.json;
  const bad = [];
  if (rawJson.includes('&')) bad.push('& crudo (debe ser \\u0026)');
  if (rawJson.includes('<')) bad.push('< crudo (debe ser \\u003c)');
  if (rawJson.includes('>')) bad.push('> crudo (debe ser \\u003e)');
  if (rawJson.includes('--')) bad.push('-- crudo (debe ser \\u002d\\u002d) — CIERRA EL COMENTARIO HTML');

  let attrs;
  try { attrs = JSON.parse(rawJson); }
  catch (e) { add('ERR', 'json', b.type, 'JSON inválido: ' + e.message, rawJson.slice(0, 120)); continue; }

  const id = attrs.uniqueId || '(sin uniqueId)';
  for (const m of bad) add('ERR', 'escapado', id, m);

  // --- 3b. uniqueId único (§8) ---
  if (!attrs.uniqueId) add('ERR', 'uniqueId', b.type, 'falta uniqueId');
  else {
    if (seenIds.has(attrs.uniqueId)) add('ERR', 'uniqueId', id, 'uniqueId DUPLICADO (ya usado por ' + seenIds.get(attrs.uniqueId) + ')');
    else seenIds.set(attrs.uniqueId, b.type);
  }

  const pfx = PREFIX[b.type];

  // --- 3c. className no lleva la id-class (§2 regla 3) ---
  if (attrs.className != null) {
    if (typeof attrs.className !== 'string') add('ERR', 'className', id, 'className no es string');
    else if (pfx && attrs.className.includes(pfx + '-' + attrs.uniqueId))
      add('ERR', 'className', id, 'className CONTIENE la id-class: "' + attrs.className + '"');
  }

  // --- 3d. htmlAttributes objeto plano, nunca array (causa #1 de recovery) ---
  if ('htmlAttributes' in attrs) {
    const ha = attrs.htmlAttributes;
    if (Array.isArray(ha)) add('ERR', 'htmlAttributes', id, 'htmlAttributes es ARRAY — causa #1 de "Attempt Recovery"');
    else if (ha === null || typeof ha !== 'object') add('ERR', 'htmlAttributes', id, 'htmlAttributes no es objeto plano');
    else for (const [k, v] of Object.entries(ha)) {
      if (typeof v !== 'string') add('WARN', 'htmlAttributes', id, `htmlAttributes.${k} no es string (${typeof v})`);
    }
  }
  // src/alt/href de primer nivel (§8)
  for (const k of ['src', 'alt', 'href', 'target', 'rel']) {
    if (k in attrs) add('ERR', 'htmlAttributes', id, `"${k}" en primer nivel — debe ir dentro de htmlAttributes`);
  }

  // --- 3e. css coincide con styles, minificado y alfabético (§2 reglas 1 y 2) ---
  if (attrs.styles && Object.keys(attrs.styles).length) {
    if (!pfx) { /* query no imprime css */ }
    else {
      const sel = '.' + pfx + '-' + attrs.uniqueId;
      const expected = buildCss(sel, attrs.styles);
      const actual = attrs.css == null ? '' : String(attrs.css);
      if (actual !== expected) {
        add('ERR', 'css≠styles', id, 'css no coincide con styles',
          'esperado: ' + expected + '\n      actual:   ' + actual);
      }
    }
  } else if (attrs.css) {
    add('WARN', 'css≠styles', id, 'tiene css pero styles vacío');
  }

  // --- 3f. tipografía declarada (§8 último punto) ---
  if (attrs.styles) {
    const flat = JSON.stringify(attrs.styles);
    if (/"font-family"/.test(flat)) add('WARN', 'tipografia', id, 'declara font-family (el tema debería aportarla)');
  }
}

// ---------- 4. Checks sobre el cuerpo HTML ----------
// Empareja apertura/cierre para conocer el cuerpo de cada bloque
function bodies(s, blks) {
  const stack = [], res = [];
  const CLOSE = /<!-- \/wp:generateblocks\/([a-z-]+) -->/g;
  const events = [];
  for (const b of blks) if (!b.selfClosing) events.push({ kind: 'open', b });
  let m;
  while ((m = CLOSE.exec(s))) events.push({ kind: 'close', type: m[1], start: m.index, end: m.index + m[0].length });
  events.sort((a, b) => (a.kind === 'open' ? a.b.start : a.start) - (b.kind === 'open' ? b.b.start : b.start));
  for (const e of events) {
    if (e.kind === 'open') stack.push(e.b);
    else {
      const o = stack.pop();
      if (!o) { res.push({ orphanClose: e }); continue; }
      if (o.type !== e.type) res.push({ mismatch: [o.type, e.type], start: o.start });
      res.push({ b: o, body: s.slice(o.end, e.start), innerEnd: e.start });
    }
  }
  for (const leftover of stack) res.push({ unclosed: leftover });
  return res;
}

const pairs = bodies(src, blocks);
const bodyOf = new Map();
for (const p of pairs) {
  if (p.orphanClose) add('ERR', 'estructura', p.orphanClose.type, 'cierre huérfano en offset ' + p.orphanClose.start);
  if (p.mismatch) add('ERR', 'estructura', p.mismatch[0], 'cierre desemparejado: abre ' + p.mismatch[0] + ' cierra ' + p.mismatch[1]);
  if (p.unclosed) add('ERR', 'estructura', p.unclosed.type, 'bloque SIN CERRAR en offset ' + p.unclosed.start);
  if (p.b) bodyOf.set(p.b, p.body);
}

for (const b of blocks) {
  if (!b.json) continue;
  let attrs; try { attrs = JSON.parse(b.json); } catch { continue; }
  const id = attrs.uniqueId; const pfx = PREFIX[b.type];
  if (!pfx || !id) continue;
  const body = bodyOf.get(b);
  if (body == null) continue;

  // El HTML del cuerpo lleva id-class + clase base (§2 regla 4)
  const idClass = pfx + '-' + id;
  const openTag = body.match(/^\s*<([a-zA-Z0-9]+)([^>]*)>/);
  if (!openTag) {
    if (b.type !== 'query') add('WARN', 'cuerpo', id, 'no se detecta etiqueta de apertura en el cuerpo');
  } else {
    const [, tag, rest] = openTag;
    const cls = (rest.match(/class="([^"]*)"/) || [, ''])[1];
    if (!cls.includes(idClass)) add('ERR', 'cuerpo', id, `falta la id-class "${idClass}" en class="${cls}"`);
    if (!cls.split(/\s+/).includes(pfx)) add('ERR', 'cuerpo', id, `falta la clase base "${pfx}" en class="${cls}"`);
    if (attrs.tagName && tag !== attrs.tagName)
      add('ERR', 'cuerpo', id, `tagName="${attrs.tagName}" pero el cuerpo usa <${tag}>`);
    // htmlAttributes reflejados en el cuerpo
    if (attrs.htmlAttributes && !Array.isArray(attrs.htmlAttributes)) {
      for (const [k, v] of Object.entries(attrs.htmlAttributes)) {
        if (typeof v !== 'string') continue;
        const present = rest.includes(k + '="');
        if (!present) add('ERR', 'cuerpo', id, `htmlAttributes.${k} no aparece en el cuerpo`);
      }
    }
  }

  // content duplicado en atributo y cuerpo (§8)
  if (b.type === 'text') {
    const c = attrs.content;
    if (c == null) add('ERR', 'content', id, 'bloque text sin atributo content');
    else {
      const inner = body.replace(/^\s*<[^>]+>/, '').replace(/<\/[^>]+>\s*$/, '').trim();
      if (inner !== String(c).trim()) add('ERR', 'content', id, 'content NO coincide con el cuerpo', `attr: ${JSON.stringify(c)}\n      body: ${JSON.stringify(inner)}`);
    }
  }

  // element con tagName "a" debe contener un text, nunca texto plano (§8)
  if (b.type === 'element' && attrs.tagName === 'a') {
    const inner = body.replace(/^\s*<a[^>]*>/, '').replace(/<\/a>\s*$/, '');
    const stripped = inner.replace(/<!--[\s\S]*?-->/g, '').replace(/<[^>]+>/g, '').trim();
    const hasChildBlock = /<!-- wp:generateblocks\//.test(inner);
    if (stripped.length > 0 && !hasChildBlock)
      add('ERR', 'enlace', id, `element <a> con texto plano: "${stripped.slice(0, 50)}"`);
    else if (stripped.length > 0)
      add('WARN', 'enlace', id, `element <a> con texto suelto además de bloques hijos: "${stripped.slice(0, 50)}"`);
    if (!attrs.htmlAttributes || !attrs.htmlAttributes.href)
      add('WARN', 'enlace', id, 'element <a> sin href en htmlAttributes');
  }

  // shape: svg duplicado en atributo html y cuerpo
  if (b.type === 'shape') {
    if (!attrs.html) add('ERR', 'shape', id, 'shape sin atributo html');
    else {
      const norm = x => String(x).replace(/\s+/g, ' ').trim();
      const innerSvg = body.replace(/^\s*<span[^>]*>/, '').replace(/<\/span>\s*$/, '');
      if (norm(innerSvg) !== norm(attrs.html))
        add('ERR', 'shape', id, 'el SVG del cuerpo no coincide con el atributo html');
      if (!/currentColor/.test(attrs.html)) add('WARN', 'shape', id, 'SVG sin currentColor (no hereda el color)');
    }
  }
}

// ---------- 5. Etiquetas dinámicas (§5) ----------
const KNOWN = ['post_permalink','post_title','post_date','post_excerpt','featured_image','post_meta','term_list','post_author','post_id','site_url','author_avatar','post_content','term_permalink','term_title'];
const TAG = /\{\{\s*([a-z_]+)([^}]*)\}\}/g;
let t, tagsSeen = new Map();
while ((t = TAG.exec(src))) {
  const name = t[1], opts = t[2].trim();
  tagsSeen.set(t[0], (tagsSeen.get(t[0]) || 0) + 1);
  if (!KNOWN.includes(name)) add('WARN', 'dynamic-tag', name, `etiqueta dinámica desconocida: ${t[0]} — fallo SILENCIOSO si no existe`);
  if (opts && !/^([a-zA-Z]+:[^\s]+\s*)+$/.test(opts.replace(/,\s*/g, ',')))
    add('WARN', 'dynamic-tag', name, `opciones con sintaxis dudosa: ${t[0]}`);
}
// llaves sueltas
const single = src.match(/(?<!\{)\{[a-z_]+\s*[^}]*\}(?!\})/g);
if (single) for (const s2 of single.slice(0, 5)) add('WARN','dynamic-tag','-', `posible etiqueta con una sola llave: ${s2.slice(0,40)}`);

// ---------- 6. Salida ----------
const errs = issues.filter(i => i.sev === 'ERR');
const warns = issues.filter(i => i.sev === 'WARN');

console.log('=== BLOQUES ===');
console.log('Total:', blocks.length, '|', JSON.stringify(counts));
console.log('uniqueIds únicos:', seenIds.size);
console.log('\n=== ETIQUETAS DINÁMICAS ===');
for (const [k, v] of tagsSeen) console.log(' ', k, '×' + v);
console.log('\n=== ERRORES (' + errs.length + ') ===');
const byRule = {};
for (const i of errs) (byRule[i.rule] = byRule[i.rule] || []).push(i);
for (const [rule, list] of Object.entries(byRule)) {
  console.log(`\n-- ${rule} (${list.length}) --`);
  for (const i of list.slice(0, 40)) {
    console.log(`  [${i.id}] ${i.msg}`);
    if (i.extra) console.log('      ' + i.extra);
  }
  if (list.length > 40) console.log(`  … y ${list.length - 40} más`);
}
console.log('\n=== AVISOS (' + warns.length + ') ===');
const byRuleW = {};
for (const i of warns) (byRuleW[i.rule] = byRuleW[i.rule] || []).push(i);
for (const [rule, list] of Object.entries(byRuleW)) {
  console.log(`\n-- ${rule} (${list.length}) --`);
  for (const i of list.slice(0, 15)) {
    console.log(`  [${i.id}] ${i.msg}`);
    if (i.extra) console.log('      ' + i.extra);
  }
  if (list.length > 15) console.log(`  … y ${list.length - 15} más`);
}
