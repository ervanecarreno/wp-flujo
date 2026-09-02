/**
 * tokens.mjs — Resolución y clasificación de variables de Figma en tokens.
 *
 * Toma la estructura cruda de /variables/local y produce registros normalizados
 * que luego map-tokens reparte en DOS CAPAS:
 *   - Sitio (GeneratePress): Global Colors, ancho de contenedor, escala tipográfica.
 *   - Componente (GB Pro Global Styles / Global Classes).
 *
 * Regla dura: cada token queda ligado a su nombre de variable de Figma. Si
 * después el ensamblaje encuentra un valor literal que no proviene de un token,
 * el validador (modo estricto) lo rechaza. Aquí NO se inventa nada.
 */
import { rgba } from "./canonical.mjs";

/** Convierte un color resuelto de Figma {r,g,b,a} a hex/rgba canónico. */
export function figmaColorToCss(v) {
  if (!v || typeof v !== "object") return null;
  return rgba({ r: v.r ?? 0, g: v.g ?? 0, b: v.b ?? 0, a: v.a ?? 1 });
}

/** Normaliza el nombre de una variable Figma a un slug css-safe. */
export function toSlug(name) {
  return String(name)
    .replace(/[\/]+/g, "-")        // "color/base/3" -> "color-base-3"
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

const COLOR_TYPES = new Set(["COLOR"]);
const NUM_TYPES = new Set(["FLOAT"]);

/**
 * Devuelve { colors:[], numbers:[], strings:[] } con registros:
 *   { name, slug, resolvedType, value, cssValue, collection, modeName }
 * Resuelve solo el modo por defecto de cada colección (el primero).
 */
export function resolveVariables(meta) {
  const out = { colors: [], numbers: [], strings: [] };
  if (!meta?.variables) return out;

  const collections = meta.variableCollections ?? {};
  const defaultMode = (collectionId) => {
    const c = collections[collectionId];
    return c?.defaultModeId ?? Object.keys(c?.modes ?? {})[0] ?? c?.modes?.[0]?.modeId;
  };
  const modeName = (collectionId, modeId) => {
    const c = collections[collectionId];
    const modes = Array.isArray(c?.modes) ? c.modes : Object.values(c?.modes ?? {});
    return modes.find((m) => m.modeId === modeId)?.name ?? "default";
  };

  const varsById = {};
  for (const [id, v] of Object.entries(meta.variables)) varsById[id] = v;

  // Resuelve alias (VARIABLE_ALIAS) hasta un valor concreto.
  const resolveValue = (variable, modeId, depth = 0) => {
    if (depth > 10) return null;
    const val = variable.valuesByMode?.[modeId] ?? Object.values(variable.valuesByMode ?? {})[0];
    if (val && typeof val === "object" && val.type === "VARIABLE_ALIAS") {
      const target = varsById[val.id];
      if (!target) return null;
      const tMode = defaultMode(target.variableCollectionId);
      return resolveValue(target, tMode, depth + 1);
    }
    return val;
  };

  for (const v of Object.values(meta.variables)) {
    if (v.remote) continue; // solo variables locales
    const modeId = defaultMode(v.variableCollectionId);
    const value = resolveValue(v, modeId);
    const rec = {
      name: v.name,
      slug: toSlug(v.name),
      resolvedType: v.resolvedType,
      value,
      collection: collections[v.variableCollectionId]?.name ?? "",
      modeName: modeName(v.variableCollectionId, modeId),
    };
    if (COLOR_TYPES.has(v.resolvedType)) {
      rec.cssValue = figmaColorToCss(value);
      if (rec.cssValue) out.colors.push(rec);
    } else if (NUM_TYPES.has(v.resolvedType)) {
      rec.cssValue = typeof value === "number" ? value : null;
      out.numbers.push(rec);
    } else {
      out.strings.push(rec);
    }
  }
  return out;
}

/**
 * Mapea los colores resueltos al esquema de Global Colors de GeneratePress.
 * Si los nombres de Figma ya siguen base/contrast/accent, se respetan; si no,
 * se propone un slug derivado y se marca `needsReview` para tu validación manual.
 */
const GP_KNOWN = ["base", "base-2", "base-3", "contrast", "contrast-2", "contrast-3", "accent", "accent-2", "accent-3"];

export function toGeneratePressGlobalColors(colors) {
  const seen = new Map();
  const result = [];
  for (const c of colors) {
    // Intenta reducir "color-base-3" -> "base-3"
    let slug = c.slug.replace(/^colou?r-/, "").replace(/^palette-/, "");
    const needsReview = !GP_KNOWN.includes(slug);
    if (seen.has(slug)) slug = `${slug}-${seen.get(slug) + 1}`;
    seen.set(slug, (seen.get(slug) ?? 0) + 1);
    result.push({
      slug,
      color: c.cssValue,
      name: c.name,
      _figmaVar: c.name,
      _needsReview: needsReview,
    });
  }
  return result;
}

/** Heurística de clasificación de números por nombre de variable. */
export function classifyNumbers(numbers) {
  const buckets = { spacing: [], radius: [], fontSize: [], lineHeight: [], containerWidth: [], other: [] };
  for (const n of numbers) {
    const s = n.slug;
    if (/container|content-?width|wide/.test(s)) buckets.containerWidth.push(n);
    else if (/radius|rounded|corner/.test(s)) buckets.radius.push(n);
    else if (/line-?height|leading/.test(s)) buckets.lineHeight.push(n);
    else if (/font-?size|text-?size|type/.test(s)) buckets.fontSize.push(n);
    else if (/space|spacing|gap|pad|margin|gutter/.test(s)) buckets.spacing.push(n);
    else buckets.other.push(n);
  }
  return buckets;
}
