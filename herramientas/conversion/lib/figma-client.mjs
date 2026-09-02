/**
 * figma-client.mjs — Cliente de EXTRACCIÓN de Figma (solo lectura).
 *
 * Rescatado y modernizado desde figma-logic.ts del proyecto anterior.
 * Responsabilidad única: traer del API de Figma el árbol de nodos, las
 * variables locales y el mapa de imágenes. NO convierte ni decide diseño.
 *
 * Requiere un Personal Access Token con scopes:
 *   file_content:read   (nodos)
 *   file_variables:read (variables — Enterprise; si no, se omiten con aviso)
 */

const API = "https://api.figma.com/v1";

export function parseFigmaUrl(raw) {
  const clean = String(raw).trim();
  const m = clean.match(/figma\.com\/(?:file|design|proto)\/([A-Za-z0-9_-]+)/);
  if (!m) return null;
  let nodeId = null;
  try {
    const url = new URL(clean.includes("://") ? clean : `https://${clean}`);
    const p = url.searchParams.get("node-id");
    if (p) nodeId = p.includes(":") ? p : p.replace(/-(?=\d)/, ":");
  } catch { /* ignore */ }
  return { fileKey: m[1], nodeId };
}

function errHint(status, body) {
  let bodyErr = "";
  try { bodyErr = JSON.parse(body)?.err ?? ""; } catch { /* body no es JSON */ }
  if (status === 403 && /expired/i.test(bodyErr)) return "403: el token de Figma caducó. Genera uno nuevo en Figma → Settings → Security → Personal access tokens.";
  if (status === 403 && bodyErr) return `403: ${bodyErr}`;
  if (status === 403) return "403: token sin scope suficiente (file_content:read / file_variables:read) o sin acceso al archivo (¿SSO de organización?).";
  if (status === 404) return "404: archivo o nodo no encontrado. Revisa el file-key / node-id.";
  if (status === 401) return "401: token inválido o expirado.";
  return `Error ${status}: ${String(body).slice(0, 200)}`;
}

async function get(path, token) {
  const res = await fetch(`${API}${path}`, { headers: { "X-Figma-Token": token } });
  if (!res.ok) throw new Error(errHint(res.status, await res.text().catch(() => "")));
  return res.json();
}

/**
 * Verifica que el token es válido pidiendo el usuario actual. OJO: este endpoint exige
 * el scope "Users" (current_user:read), distinto de "file_content:read" que usa el resto
 * del pipeline — un token con solo file_content:read da 403 aquí aunque funcione perfecto
 * para extraer frames. Úsalo solo como comprobación best-effort secundaria.
 */
export async function pingToken(token) {
  const me = await get("/me", token);
  return { handle: me.handle, email: me.email, imgUrl: me.img_url };
}

/** Verifica el token contra un archivo concreto usando el mismo scope que la extracción real (file_content:read). */
export async function pingFile(token, fileKey) {
  const json = await get(`/files/${fileKey}?depth=1`, token);
  return { fileName: json.name };
}

/** Trae el frame (o el primer frame del archivo si no se da nodeId). */
export async function fetchNode(token, fileKey, nodeId) {
  if (nodeId) {
    const json = await get(`/files/${fileKey}/nodes?ids=${encodeURIComponent(nodeId)}&geometry=paths`, token);
    const key = Object.keys(json.nodes ?? {})[0];
    const doc = json.nodes?.[key]?.document;
    if (!doc) throw new Error("Nodo no encontrado; ¿el node-id es un frame?");
    return doc;
  }
  const json = await get(`/files/${fileKey}?depth=5&geometry=paths`, token);
  const frame = json.document?.children?.[0]?.children?.[0];
  if (!frame) throw new Error("El archivo no tiene frames en la primera página.");
  return frame;
}

/**
 * Variables locales (Figma Variables API). Devuelve estructura cruda
 * { meta: { variables, variableCollections } } o null si no hay acceso.
 */
export async function fetchLocalVariables(token, fileKey) {
  try {
    const json = await get(`/files/${fileKey}/variables/local`, token);
    return json.meta ?? null;
  } catch (e) {
    console.error(`⚠ variables no disponibles (${e.message}). Se continuará sin la capa de variables nombradas.`);
    return null;
  }
}

/** Mapa imageRef → URL temporal de descarga. */
export async function fetchImageFills(token, fileKey) {
  try {
    const json = await get(`/files/${fileKey}/images`, token);
    return json.meta?.images ?? {};
  } catch (e) {
    console.error(`⚠ no se pudieron obtener las imágenes de Figma (${e.message}).`);
    return {};
  }
}

/**
 * SVG real de nodos vectoriales (iconos/formas). Devuelve mapa nodeId → markup
 * SVG crudo (sin limpiar; la limpieza/normalización la hace convert-frame.mjs).
 * El endpoint /images de Figma da URLs temporales de render; hay que
 * descargar cada una para obtener el markup real.
 */
export async function fetchSvgExports(token, fileKey, nodeIds) {
  const ids = [...new Set(nodeIds)].filter(Boolean);
  const svgs = {};
  if (!ids.length) return svgs;
  const CHUNK = 50; // evita URLs demasiado largas
  for (let i = 0; i < ids.length; i += CHUNK) {
    const chunk = ids.slice(i, i + CHUNK);
    let json;
    try {
      json = await get(`/images/${fileKey}?ids=${encodeURIComponent(chunk.join(","))}&format=svg`, token);
    } catch (e) {
      console.error(`⚠ no se pudieron exportar SVGs de Figma (${e.message}).`);
      continue;
    }
    const urls = json.images ?? {};
    for (const id of chunk) {
      const url = urls[id];
      if (!url) continue;
      try {
        const res = await fetch(url);
        if (res.ok) svgs[id] = await res.text();
      } catch { /* se avisará como vector sin SVG en la conversión */ }
    }
  }
  return svgs;
}

/** PNG del frame a escala fija (para el diff visual de QA). */
export async function fetchFramePng(token, fileKey, nodeId, scale = 2) {
  const json = await get(`/images/${fileKey}?ids=${encodeURIComponent(nodeId)}&format=png&scale=${scale}`, token);
  const url = Object.values(json.images ?? {})[0];
  if (!url) throw new Error("No se pudo renderizar el PNG del frame.");
  return url;
}
