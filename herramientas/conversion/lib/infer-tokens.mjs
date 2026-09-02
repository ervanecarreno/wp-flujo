/**
 * infer-tokens.mjs — Camino C: inferencia de tokens desde el árbol de nodos.
 *
 * Cuando el Figma no tiene Variables, recorremos el árbol descargado
 * (node.json) y recopilamos los valores REALES usados: colores de fills,
 * paddings, itemSpacing, cornerRadius, y tipografía (familia/peso/tamaño/
 * interlineado). Se agrupan por frecuencia y se proponen como CANDIDATOS.
 *
 * IMPORTANTE (respeta "no inventes valores"): esto NO decide tokens, propone
 * candidatos con su frecuencia y ejemplos de uso para que el humano los
 * apruebe/renombre. La salida es material de revisión, no tokens finales.
 */
import { rgba } from "./canonical.mjs";

function rgbaKey(color, opacity = 1) {
  const a = (color.a ?? 1) * opacity;
  return rgba({ r: color.r, g: color.g, b: color.b, a });
}

/** Recorre el árbol acumulando ocurrencias. */
export function inferFromNode(root) {
  const colors = new Map();   // css -> { count, uses:Set(nodeName) }
  const spacing = new Map();  // px -> { count, props:Set }
  const radius = new Map();   // px -> count
  const fonts = new Map();    // "family|weight|size|lh" -> { count, sample }
  const bump = (map, key, meta) => {
    const e = map.get(key) ?? { count: 0, uses: new Set(), props: new Set() };
    e.count++;
    if (meta?.use) e.uses.add(meta.use);
    if (meta?.prop) e.props.add(meta.prop);
    if (meta?.sample && !e.sample) e.sample = meta.sample;
    map.set(key, e);
  };

  const walk = (node) => {
    if (!node || typeof node !== "object") return;

    // Colores de fills sólidos (fondos y texto)
    if (Array.isArray(node.fills)) {
      for (const f of node.fills) {
        if (f.type === "SOLID" && f.visible !== false && f.color) {
          bump(colors, rgbaKey(f.color, f.opacity ?? 1), { use: node.name || node.type });
        }
      }
    }
    // Strokes (bordes)
    if (Array.isArray(node.strokes)) {
      for (const s of node.strokes) {
        if (s.type === "SOLID" && s.color) bump(colors, rgbaKey(s.color, s.opacity ?? 1), { use: (node.name || "") + " (borde)" });
      }
    }
    // Espaciados (auto-layout)
    for (const [prop, key] of [["paddingTop", "padding"], ["paddingBottom", "padding"], ["paddingLeft", "padding"], ["paddingRight", "padding"], ["itemSpacing", "gap"]]) {
      const v = node[prop];
      if (typeof v === "number" && v > 0) bump(spacing, v, { prop: key });
    }
    // Radios
    if (typeof node.cornerRadius === "number" && node.cornerRadius > 0) bump(radius, node.cornerRadius, {});
    if (Array.isArray(node.rectangleCornerRadii)) node.rectangleCornerRadii.forEach((r) => { if (r > 0) bump(radius, r, {}); });

    // Tipografía
    if (node.type === "TEXT" && node.style) {
      const st = node.style;
      const key = `${st.fontFamily ?? "?"}|${st.fontWeight ?? "?"}|${st.fontSize ?? "?"}|${Math.round(st.lineHeightPx ?? 0)}`;
      bump(fonts, key, { sample: (node.characters ?? "").slice(0, 24) });
    }

    if (Array.isArray(node.children)) node.children.forEach(walk);
  };
  walk(root);

  // Serializar ordenado por frecuencia
  const colorList = [...colors.entries()]
    .map(([css, e]) => ({ value: css, count: e.count, uses: [...e.uses].slice(0, 5) }))
    .sort((a, b) => b.count - a.count);

  const spacingList = [...spacing.entries()]
    .map(([px, e]) => ({ px, rem: px / 16, count: e.count, props: [...e.props] }))
    .sort((a, b) => b.count - a.count || a.px - b.px);

  const radiusList = [...radius.entries()]
    .map(([px, e]) => ({ px, rem: px / 16, count: e.count }))
    .sort((a, b) => b.count - a.count || a.px - b.px);

  const fontList = [...fonts.entries()]
    .map(([k, e]) => { const [family, weight, size, lh] = k.split("|"); return { family, weight: +weight, size: +size, lineHeight: +lh, count: e.count, sample: e.sample }; })
    .sort((a, b) => b.size - a.size || b.count - a.count);

  return { colors: colorList, spacing: spacingList, radius: radiusList, fonts: fontList };
}

/**
 * Propone slugs para los colores según su rol inferido (heurística de
 * luminancia + frecuencia), en el esquema base/contrast/accent de GeneratePress.
 * Marca todo como _needsReview:true — el humano confirma.
 */
export function proposeColorSlugs(colorList) {
  const lum = (hex) => {
    const m = hex.match(/^#([0-9a-f]{6})$/i);
    if (!m) return 0.5;
    const n = parseInt(m[1], 16);
    const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  };
  // Ordena: los claros → base*, los oscuros → contrast*, los saturados/medios → accent*
  const saturation = (hex) => {
    const m = hex.match(/^#([0-9a-f]{6})$/i); if (!m) return 0;
    const n = parseInt(m[1], 16); const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b); return mx === 0 ? 0 : (mx - mn) / mx;
  };
  const light = [], dark = [], accent = [];
  for (const c of colorList) {
    if (!/^#[0-9a-f]{6}$/i.test(c.value)) { accent.push(c); continue; }
    const l = lum(c.value), s = saturation(c.value);
    if (s > 0.4 && l > 0.2 && l < 0.85) accent.push(c);
    else if (l > 0.6) light.push(c);
    else dark.push(c);
  }
  const assign = (arr, base) => arr.map((c, i) => ({ ...c, slug: i === 0 ? base : `${base}-${i + 1}`, _needsReview: true }));
  return [...assign(light, "base"), ...assign(dark, "contrast"), ...assign(accent, "accent")];
}
