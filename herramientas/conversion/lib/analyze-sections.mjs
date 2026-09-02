/**
 * analyze-sections.mjs — Resume un frame de Figma en secciones para planificar
 * la librería de patrones (Enfoque 2).
 *
 * No convierte nada. Recorre el primer/segundo nivel del frame y produce:
 *  - la lista de secciones de primer nivel (candidatas a patrón de sección)
 *  - detección de estructuras REPETIDAS (p.ej. 3 tarjetas iguales) → 1 patrón
 *  - un resumen del contenido de cada sección (textos, imágenes, botones)
 *
 * Sirve para que tú y yo decidamos qué patrones crear, mirando datos reales.
 */

function summarizeContent(node, acc = { texts: [], images: 0, buttons: 0, depth: 0 }) {
  if (!node || typeof node !== "object") return acc;
  if (node.type === "TEXT" && node.characters) acc.texts.push(node.characters.slice(0, 40));
  if (node.type === "RECTANGLE" && Array.isArray(node.fills) && node.fills.some((f) => f.type === "IMAGE")) acc.images++;
  if (Array.isArray(node.fills) && node.fills.some((f) => f.type === "IMAGE")) acc.images++;
  // heurística de botón: frame pequeño con fill y un texto dentro
  const nm = (node.name || "").toLowerCase();
  if (/button|btn|cta/.test(nm)) acc.buttons++;
  if (Array.isArray(node.children)) node.children.forEach((c) => summarizeContent(c, acc));
  return acc;
}

/** Firma estructural de un nodo para detectar repeticiones (tarjetas iguales). */
function structuralSignature(node, depth = 0, maxDepth = 3) {
  if (!node || depth > maxDepth) return "";
  const kids = Array.isArray(node.children) ? node.children : [];
  const childSig = kids.map((c) => c.type + (c.type === "TEXT" ? "" : "")).join(",");
  return `${node.type}[${childSig}]{${kids.length}}`;
}

export function analyzeSections(frame) {
  const sections = Array.isArray(frame.children) ? frame.children : [];
  const result = {
    frameName: frame.name,
    frameSize: frame.absoluteBoundingBox ? { w: Math.round(frame.absoluteBoundingBox.width), h: Math.round(frame.absoluteBoundingBox.height) } : null,
    sectionCount: sections.length,
    sections: [],
  };

  for (const [i, sec] of sections.entries()) {
    const content = summarizeContent(sec);
    // Detectar hijos repetidos dentro de la sección (tarjetas/columnas)
    const kids = Array.isArray(sec.children) ? sec.children : [];
    const sigCounts = {};
    for (const k of kids) {
      const sig = structuralSignature(k);
      sigCounts[sig] = (sigCounts[sig] ?? 0) + 1;
    }
    const repeated = Object.entries(sigCounts).filter(([, n]) => n >= 2).map(([sig, n]) => ({ sig, times: n }));

    result.sections.push({
      index: i,
      name: sec.name || `(sección ${i + 1})`,
      type: sec.type,
      childCount: kids.length,
      content: { textsCount: content.texts.length, sampleTexts: content.texts.slice(0, 4), images: content.images, buttons: content.buttons },
      repeatedGroups: repeated,
      suggestedPattern: suggestName(sec.name, content, repeated),
    });
  }
  return result;
}

function suggestName(name, content, repeated) {
  const n = (name || "").toLowerCase();
  if (/hero|banner|masthead/.test(n)) return "hero";
  if (/feature|service|card|grid/.test(n) || repeated.length) return "card-grid";
  if (/cta|call.to.action|contact/.test(n)) return "cta";
  if (/footer/.test(n)) return "footer";
  if (/header|nav/.test(n)) return "header";
  if (/test|review|quote/.test(n)) return "testimonial";
  if (content.images >= 2 && content.textsCount < 4) return "gallery";
  return "section-generic";
}
