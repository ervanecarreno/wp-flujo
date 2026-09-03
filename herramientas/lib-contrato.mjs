/**
 * lib-contrato.mjs — lectura del contrato de diseño (`<sistema>.tokens.json`).
 *
 * Lo usan `tokens-a-css.mjs` y `conversion/scripts/wp-push-tokens.mjs`. Está
 * aparte por la misma razón por la que el CSS del contrato pasó a generarse: dos
 * copias de la misma lógica divergen, y aquí divergir significa que el CSS y lo
 * que se empuja a WordPress dejen de describir el mismo sistema sin que nada avise.
 *
 * Formato: W3C / Tokens Studio. Un token es un objeto con `$value`; todo lo demás
 * es agrupación.
 *
 * Nombres CSS: la ruta unida por guiones (`space.md` → `--space-md`). Dos escapes:
 *   · `$metadata.renombres` — renombra el primer tramo (`font-family` → `font`)
 *   · `"$css"` dentro del token — manda sobre todo lo demás
 */
import fs from "node:fs";

/**
 * @param {string} ruta  fichero .tokens.json
 * @returns {{meta:object, orden:string[], tokens:Array, porNombre:Map, colisiones:Array}}
 */
export function leerContrato(ruta) {
  const doc = JSON.parse(fs.readFileSync(ruta, "utf8"));
  const meta = doc.$metadata ?? {};
  const renombres = meta.renombres ?? {};
  const orden = meta.tokenSetOrder ?? Object.keys(doc).filter((k) => !k.startsWith("$"));
  /* `$metadata.modos` mapea nombre de set → selector CSS. Un set que aparezca ahí
     no va a `:root`: va a su selector, y REDEFINE los mismos nombres de token.
     Es la forma CSS de lo que en Figma son los modos de una colección, y evita la
     alternativa mala: duplicar cada token en una versión «inversa» que hay que
     acordarse de usar. Un diseño que alterna secciones claras y oscuras lo
     necesita; uno que no, simplemente no declara `modos`. */
  const modos = meta.modos ?? {};

  const tokens = [];

  const nombreCss = (rutaToken, override) => {
    if (override) return override.startsWith("--") ? override : "--" + override;
    const tramos = rutaToken.split(".");
    if (renombres[tramos[0]]) tramos[0] = renombres[tramos[0]];
    return "--" + tramos.filter(Boolean).join("-");
  };

  const recorrer = (nodo, set, prefijo) => {
    for (const [clave, valor] of Object.entries(nodo)) {
      if (clave.startsWith("$")) continue;
      if (!valor || typeof valor !== "object") continue;
      const rutaToken = prefijo ? prefijo + "." + clave : clave;
      if ("$value" in valor) {
        tokens.push({
          set,
          ruta: rutaToken,
          nombre: nombreCss(rutaToken, valor.$css),
          valor: valor.$value,
          tipo: valor.$type ?? null,
          grupo: rutaToken.split(".")[0],
          selector: modos[set] ?? ":root",
          esModo: Boolean(modos[set]),
        });
      } else {
        recorrer(valor, set, rutaToken);
      }
    }
  };

  const setsAusentes = [];
  for (const set of orden) {
    if (!doc[set]) { setsAusentes.push(set); continue; }
    recorrer(doc[set], set, "");
  }

  /* Índices para resolver alias `{core.space.md}` por ruta larga o corta. */
  const porRuta = new Map();
  for (const t of tokens) { porRuta.set(t.set + "." + t.ruta, t); porRuta.set(t.ruta, t); }

  /* Dos tokens distintos con el mismo nombre CSS son un error: uno pisaría al
     otro en silencio. Pero se compara DENTRO de cada selector: que `bg/page`
     exista en el modo claro y en el oscuro no es una colisión, es exactamente
     para lo que sirven los modos. */
  const colisiones = [];
  const porSelector = new Map();
  for (const t of tokens) {
    if (!porSelector.has(t.selector)) porSelector.set(t.selector, new Map());
    const vistos = porSelector.get(t.selector);
    if (vistos.has(t.nombre) && vistos.get(t.nombre) !== t.ruta) {
      colisiones.push({ nombre: t.nombre, a: vistos.get(t.nombre), b: t.ruta, selector: t.selector });
    }
    vistos.set(t.nombre, t.ruta);
  }

  /* Un modo que redefine un token que la base no declara deja un hueco: fuera de
     ese modo, `var()` no resuelve. Es la misma familia del fallo «declarar no es
     publicar», así que se detecta aquí. */
  const enBase = new Set(tokens.filter((t) => !t.esModo).map((t) => t.nombre));
  const huerfanos = [...new Set(tokens.filter((t) => t.esModo && !enBase.has(t.nombre)).map((t) => t.nombre))];

  return { meta, orden, tokens, porRuta, colisiones, setsAusentes, modos, huerfanos };
}

/**
 * Sustituye `{ruta.al.token}` por `var(--nombre)`.
 * @returns {{texto:string, sinResolver:string[]}}
 */
export function resolverAlias(valor, porRuta) {
  const sinResolver = [];
  const texto = String(valor).replace(/\{([^}]+)\}/g, (todo, ref) => {
    const destino = porRuta.get(ref.trim());
    if (!destino) { sinResolver.push(ref.trim()); return todo; }
    return "var(" + destino.nombre + ")";
  });
  return { texto, sinResolver };
}

/**
 * Los colores del contrato, listos para `generate_settings.global_colors`.
 *
 * El `slug` es el nombre CSS sin los dos guiones: así el color que el editor
 * ofrece en su paleta se llama igual que el token, y quien lo elija a mano en el
 * panel de un bloque escribe el mismo nombre que el marcado.
 *
 * **Esto NO publica el contrato.** WordPress expone estos colores como
 * `--wp--preset--color--<slug>`, no como `--<slug>`. Sirven para la paleta del
 * editor; el contrato llega al navegador por el CSS que encola el plugin del
 * proyecto. Confundir las dos cosas costó una tarde el 2/09/2026.
 */
export function coloresGlobales(tokens) {
  return tokens
    /* Solo la base: los modos redefinen los MISMOS nombres, y meterlos daría
       slugs duplicados en la paleta del editor —el último ganaría, en silencio. */
    .filter((t) => !t.esModo)
    .filter((t) => t.tipo === "color" || /^#|^rgb|^hsl/i.test(String(t.valor)))
    .map((t) => ({
      name: t.ruta.replace(/\./g, "/"),
      slug: t.nombre.replace(/^--/, ""),
      color: String(t.valor),
    }));
}
