/**
 * validate.mjs — Núcleo del validador de markup GenerateBlocks v2 (importable).
 *
 * Extraído de scripts/validate-blocks.mjs para que la app local y otros
 * módulos lo usen sin spawn. El CLI sigue funcionando y ahora importa de aquí.
 * Calibrado contra los 18 patrones wp_block exportados del usuario.
 */
import { KEY_ORDER } from "./canonical.mjs";

export function validate(markup, allowedValues = null) {
  const errors = [];
  const push = (level, rule, msg, ctx) =>
    errors.push({ level, rule, msg, ctx: ctx?.slice(0, 120) });

  // --- Parseo de delimitadores de bloque
  const delimRe = /<!--\s+wp:([a-z0-9\/-]+)(?:\s+(\{[\s\S]*?\}))?\s+(\/)?-->/g;
  const closeRe = /<!--\s+\/wp:([a-z0-9\/-]+)\s+-->/g;

  const stack = [];
  let m;
  const combined = [];
  // Recolectar aperturas y cierres en orden
  const tokens = [];
  // '--' está escapado en JSON canónico, así que '-->' nunca aparece dentro
  // de los atributos: podemos cortar en el primer '-->'.
  const tokenRe = /<!--\s+(\/?)wp:([a-z0-9\/-]+)([\s\S]*?)-->/g;
  while ((m = tokenRe.exec(markup))) {
    let rest = m[3].trim();
    const selfClose = rest.endsWith("/");
    if (selfClose) rest = rest.slice(0, -1).trim();
    const json = rest.startsWith("{") ? rest : undefined;
    tokens.push({ close: m[1] === "/", name: m[2], json, selfClose, index: m.index });
  }
  if (!tokens.length) {
    push("error", "parse", "No se encontró ningún delimitador de bloque <!-- wp:... -->");
    return errors;
  }
  for (const t of tokens) {
    if (t.close) {
      const open = stack.pop();
      if (!open) push("error", "parse", `Cierre sin apertura: /wp:${t.name}`);
      else if (open.name !== t.name)
        push("error", "parse", `Cierre desbalanceado: esperaba /wp:${open.name}, encontró /wp:${t.name}`);
    } else if (!t.selfClose) {
      stack.push(t);
    }
  }
  for (const open of stack) push("error", "parse", `Bloque sin cerrar: wp:${open.name}`);

  // --- Comentarios HTML espurios (3.5)
  const strayRe = /<!--(?!\s+\/?wp:)([\s\S]*?)-->/g;
  while ((m = strayRe.exec(markup))) {
    push("error", "3.5", "Comentario HTML no permitido (solo delimitadores wp:)", m[0]);
  }

  // --- Validar cada JSON de atributos
  for (const t of tokens) {
    if (t.close || !t.json) continue;
    const where = `wp:${t.name}`;

    // 1.x escapes obligatorios en el JSON del delimitador
    if (/--/.test(t.json)) push("error", "1.1", `${where}: '--' literal en JSON; usar \\u002d\\u002d`, t.json.match(/.{0,40}--.{0,40}/)?.[0]);
    if (/&(?!amp;)/.test(t.json) && /&/.test(t.json)) push("error", "1.2", `${where}: '&' literal en JSON; usar \\u0026`, t.json.match(/.{0,40}&.{0,40}/)?.[0]);
    if (/[<>]/.test(t.json)) push("error", "1.3", `${where}: '<' o '>' literal en JSON; usar \\u003c / \\u003e`);
    if (/\\"/.test(t.json)) push("error", "1.x", `${where}: comilla escapada \\" en JSON; la forma canónica es \\u0022`);

    // Parsear (des-escapando unicode, JSON.parse ya lo hace)
    let attrs;
    try { attrs = JSON.parse(t.json); }
    catch (e) { push("error", "parse", `${where}: JSON de atributos inválido: ${e.message}`, t.json); continue; }

    // 3.1 htmlAttributes objeto plano
    if (attrs.htmlAttributes && Array.isArray(attrs.htmlAttributes))
      push("error", "3.1", `${where}: htmlAttributes debe ser objeto plano, no array`);

    // 3.2 href absoluto
    const href = attrs.htmlAttributes?.href;
    if (href && !/^(https?:\/\/|mailto:|tel:|#|\{\{)/.test(href))
      push("error", "3.2", `${where}: href debe ser URL absoluta: "${href}"`);

    // 3.4 orden de claves
    const order = KEY_ORDER[t.name];
    if (order) {
      const keys = Object.keys(attrs);
      const idx = keys.map((k) => order.indexOf(k));
      for (let i = 1; i < idx.length; i++) {
        if (idx[i] !== -1 && idx[i - 1] !== -1 && idx[i] < idx[i - 1]) {
          push("error", "3.4", `${where}: orden de claves no canónico: '${keys[i]}' debe ir antes de '${keys[i - 1]}' (orden: ${order.join(", ")})`);
          break;
        }
      }
    }

    // 2.x reglas del string css
    if (typeof attrs.css === "string") {
      const css = attrs.css;
      if (/\n/.test(css)) push("error", "2.7", `${where}: css debe ser una sola línea minificada`);
      if (/\btransition\s*:/.test(css) && !attrs.styles?.transition) push("warn", "2.2", `${where}: 'transition' en css sin entrada correspondiente en styles (el editor la regenera desde styles)`);
      if (/,\s+|\(\s+|\s+\)/.test(css)) push("error", "2.4", `${where}: espacios dentro de argumentos de función en css`, css.match(/.{0,30}(,\s+|\(\s+).{0,30}/)?.[0]);
      if (/\\[0-9a-fA-F]{2,6}/.test(css)) push("error", "2.5", `${where}: secuencia de escape CSS \\xxxx; usar el carácter literal`);
      if (/"/.test(css)) push("error", "1.4", `${where}: comillas dobles dentro de css; usar simples`);

      // 2.6 alfabetización por regla.
      // Excepciones observadas en patrones validados (emitidos por el editor):
      //  a) GB fusiona longhands en shorthand (padding, margin, border-*) y la
      //     coloca AL FINAL de la regla.
      //  b) Las reglas descendientes (p.ej. ".gb-shape-x svg") no siempre van
      //     alfabetizadas → solo aviso.
      const SHORTHAND_AT_END = new Set(["padding", "margin", "border", "border-top", "border-right", "border-bottom", "border-left", "border-radius", "inset", "gap", "color", "transition", "overflow"]);
      const ruleRe = /([^{}]+)\{([^{}]*)\}/g;
      let r;
      while ((r = ruleRe.exec(css))) {
        const sel = r[1].trim();
        const all = r[2].split(";").filter(Boolean).map((d) => d.split(":")[0].trim());
        const core = all.filter((p) => !SHORTHAND_AT_END.has(p));
        const sorted = [...core].sort();
        if (JSON.stringify(core) !== JSON.stringify(sorted)) {
          const isBase = /^\.gb-(element|text|media|shape|query|looper|loop-item|carousel|carousel-items|carousel-item|carousel-control|carousel-pagination)-[0-9a-f]+(::(before|after))?$/.test(sel) || sel.startsWith("@");
          push(isBase ? "error" : "warn", "2.6", `${where}: propiedades css no alfabetizadas en '${sel}' (${all.join(",")})`);
        }
      }

      // 2.3 hover en css: válido SOLO si existe la clave correspondiente en
      // styles (el editor la genera desde styles). Hover "huérfano" → error.
      if (/:hover/.test(css)) {
        const stylesStr = JSON.stringify(attrs.styles ?? {});
        if (!/:hover/.test(stylesStr))
          push("error", "2.3", `${where}: :hover en css sin clave correspondiente en styles`);
      }
    }

    // Modo estricto de tokens: color/espaciado literal que no venga del mapa.
    if (allowedValues && typeof attrs.css === "string") {
      const litColors = attrs.css.match(/#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)/g) ?? [];
      for (const lit of litColors) {
        const norm = lit.toLowerCase().replace(/\s+/g, "");
        if (!allowedValues.has(norm) && !/rgba?\(0,0,0,0\)|transparent|currentcolor/.test(norm))
          push("warn", "tokens", `${where}: color literal '${lit}' fuera del mapa de tokens; usar var(\\u002d\\u002d…)`);
      }
    }

    if (!attrs.uniqueId) push("warn", "id", `${where}: falta uniqueId`);
    else if (!/^[0-9a-f]{8}$/.test(attrs.uniqueId))
      push("warn", "id", `${where}: uniqueId '${attrs.uniqueId}' no tiene el formato hex de 8 típico de GB`);
  }

  // 3.6 líneas en blanco dentro de bloques vacíos
  if (/>\s*\n\s*\n\s*<\/(div|section|span|a|header|footer|main|aside)>\s*\n<!--\s+\/wp:/.test(markup))
    push("warn", "3.6", "Posible línea en blanco dentro de un bloque vacío (cierre no compacto)");

  return errors;
}

/** Construye el set de valores permitidos a partir de tokens/map.json. */
export function buildAllowedValues(map) {
  const allowed = new Set();
  for (const group of Object.values(map)) {
    if (typeof group !== "object" || group === null) continue;
    for (const entry of Object.values(group)) {
      if (entry && entry.value) allowed.add(String(entry.value).toLowerCase());
      if (entry && entry.px != null) allowed.add(`${entry.px}px`);
    }
  }
  return allowed;
}

/** Resumen agregado. */
export function summarize(errors) {
  return {
    errors: errors.filter((e) => e.level === "error").length,
    warnings: errors.filter((e) => e.level === "warn").length,
    items: errors,
  };
}
