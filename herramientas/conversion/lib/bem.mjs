/**
 * Nombres de clase BEM para el marcado que genera este flujo.
 *
 * EL PROBLEMA QUE RESUELVE
 *
 * GenerateBlocks identifica cada bloque con un hash: `gb-element-7042abea`. Sirve para
 * colgarle sus estilos y para nada más — no dice qué es, y cambia si el bloque se
 * regenera. Así que cuando hay que apuntar a un bloque desde fuera (un snippet de CSS,
 * una animación de GSAP, una prueba de Playwright) no hay a qué agarrarse, y lo que se
 * acaba haciendo es inventar una clase a mano para ese caso. Pasó en el proyecto piloto:
 * el carrusel de la cronología necesitó un `gb-year-item` y un `data-year-row-for`
 * puestos a dedo para que un snippet pudiera sincronizar los años. Funciona, pero cada
 * quien inventa lo suyo y no hay convención.
 *
 * Eso importa especialmente en el reparto A/B de `COMO-TRABAJAMOS.md`: A entrega los
 * bloques y B pone el comportamiento encima. B necesita asideros estables sobre marcado
 * que no ha escrito él.
 *
 * LA CONVENCIÓN
 *
 *     wpf-bloque__elemento--modificador
 *
 * BEM de manual, con prefijo `wpf-` (de wp-flujo). El prefijo va con guion y en
 * minúsculas a propósito, y no como `WPflujo_`: un `_` suelto se confunde de un vistazo
 * con el `__` que BEM usa para el elemento, y el resto del ecosistema ya va así —
 * `gb-` en GenerateBlocks y `gbp-` en GB Pro, que además usa BEM en sus propias clases
 * (`gb-accordion__toggle-icon`). Ser el tercero en la misma familia es más barato de leer
 * que introducir una cuarta forma.
 *
 * DÓNDE VAN: en el atributo `className` del bloque, que es el que WordPress reserva para
 * «clases CSS adicionales». No en el marcado a pelo — una clase que está en el HTML pero
 * no en los atributos, el editor la adopta como `className` propio al guardar y provoca
 * drift (está medido y documentado en `classList()` de `emit.mjs`). Medido el 22/09/2026
 * con `qa-editor-check.mjs` sobre una sonda de diez casos —element, text, shape y media,
 * con y sin estilos, con `globalClasses`, con dos clases a la vez—: el editor las acepta
 * todas y re-serializa idéntico. El orden que sale es
 * `[base] [globalClasses] [gb-tipo-id] [className]`.
 */

/** Palabras que no aportan nada a un nombre de clase y lo alargan. */
const VACIAS = new Set(["el", "la", "los", "las", "un", "una", "de", "del", "y", "e", "o",
  "a", "al", "en", "con", "por", "para", "su", "sus"]);

/* Los nombres que Figma pone solo porque algo tiene que poner. Un «Frame 12» no es un
 * nombre: es la ausencia de uno, y hay que tratarlo igual que una capa sin nombrar.
 * El patrón es el mismo que ya usa `gbp-global-styles.mjs` para lo suyo — misma lista,
 * para que las dos partes del flujo coincidan en qué consideran «sin nombre». */
const GENERICOS = /^(frame|group|rectangle|vector|ellipse|component|instance|slice|union|subtract|mask\s*group|capa|layer)\s*\d*$/i;

/** ¿Este nombre de capa dice algo, o es el relleno que pone Figma? */
export function esGenerico(nombre) {
  const n = String(nombre ?? "").trim();
  return !n || GENERICOS.test(n);
}

/**
 * Pasa un nombre de capa a un trozo de clase utilizable.
 *
 * Está pensado para lo que sale de verdad de Figma en este flujo: nombres en español,
 * con acentos, espacios y separadores tipo `·` («Panel · Súmate y apoya», «H1 · slogan»,
 * «Hito · 1493»). Quita acentos, pasa a minúsculas, tira las palabras vacías y se queda
 * con las `maxPalabras` primeras — un nombre de clase largo no es más expresivo, solo
 * más incómodo.
 *
 *   «Panel · Súmate y apoya»  → `panel-sumate-apoya`
 *   «La ciudad y sus valores» → `ciudad-valores`
 *   «Equipo de trabajo»       → `equipo-trabajo`
 */
export function slug(nombre, { maxPalabras = 3 } = {}) {
  if (!nombre) return "";
  const limpio = String(nombre)
    .normalize("NFD").replace(/[̀-ͯ]/g, "")  // fuera acentos
    .toLowerCase()
    .replace(/[·/|,.:]+/g, " ")
    .replace(/[^a-z0-9\s-]/g, " ")
    .trim();
  if (!limpio) return "";

  const palabras = limpio.split(/[\s-]+/).filter(Boolean);
  /* Las vacías se quitan solo si queda algo: «La candidatura» no puede quedarse en nada,
     y un nombre que sea solo artículos es mejor dejarlo tal cual que borrarlo. */
  const sinVacias = palabras.filter((p) => !VACIAS.has(p));
  const utiles = sinVacias.length ? sinVacias : palabras;
  return utiles.slice(0, maxPalabras).join("-");
}

/**
 * El rol de un bloque que NO tiene nombre de capa, deducido de lo que sí se sabe de él:
 * su tipo de bloque y su etiqueta. Es lo que da un nombre corto y legible a los muchos
 * contenedores anónimos que trae cualquier diseño — en la Home del proyecto piloto son
 * 187 de 290 bloques, casi dos tercios.
 *
 * Se deduce del ROL, no de la posición, y la diferencia importa: un nombre sacado del
 * índice entre hermanos cambia en cuanto alguien inserta algo más arriba, y entonces la
 * clase deja de servir justo para lo único que servía. El rol aguanta.
 */
export function rolDe(tipoBloque, tagName, styles = {}) {
  if (tipoBloque === "shape") return "icono";
  if (tipoBloque === "media") return "imagen";
  if (tipoBloque === "text") {
    if (/^h[1-6]$/.test(tagName)) return "titulo";
    if (tagName === "a") return "enlace";
    if (tagName === "li") return "item";
    return "texto";
  }
  // element y compañía: manda la etiqueta, y si es un `div` pelado, su disposición.
  switch (tagName) {
    case "section": return "seccion";
    case "header": return "cabecera";
    case "footer": return "pie";
    case "nav": return "nav";
    case "article": return "tarjeta";
    case "figure": return "figura";
    case "aside": return "lateral";
    case "ul": case "ol": return "lista";
    case "li": return "item";
    case "a": return "enlace";
    default: break;
  }
  if (styles.display === "flex" || styles.display === "inline-flex") {
    return styles.flexDirection === "column" ? "col" : "fila";
  }
  if (styles.display === "grid") return "rejilla";
  return "caja";
}

/**
 * Fábrica de nombres BEM para un bloque.
 *
 * El marcado de este flujo se construye de dentro hacia fuera —cuando se ejecuta un
 * `text()`, el `element()` que lo va a contener todavía no existe—, así que el emisor no
 * puede deducir solo a qué bloque BEM pertenece cada hijo. Esta fábrica lo resuelve sin
 * magia: se declara una vez por sección y se va usando.
 *
 *     const b = bem("Súmate y apoya");
 *     b()                      → "wpf-sumate-apoya"
 *     b("panel")               → "wpf-sumate-apoya__panel"
 *     b("panel", "claro")      → "wpf-sumate-apoya__panel--claro"
 *     b(null, "invertido")     → "wpf-sumate-apoya--invertido"
 *     b("panel", ["claro", "ancho"]) → "wpf-sumate-apoya__panel wpf-sumate-apoya__panel--claro wpf-sumate-apoya__panel--ancho"
 *
 * Con varios modificadores devuelve la clase base MÁS las modificadas, que es como BEM
 * espera que se usen: el modificador no sustituye al bloque, se le suma.
 */
export function bem(nombreBloque, { prefijo = "wpf" } = {}) {
  const base = `${prefijo}-${slug(nombreBloque)}`;
  return function clase(elemento, modificadores) {
    const raiz = elemento ? `${base}__${slug(elemento)}` : base;
    if (!modificadores) return raiz;
    const lista = (Array.isArray(modificadores) ? modificadores : [modificadores])
      .map((m) => slug(m, { maxPalabras: 2 }))
      .filter(Boolean);
    if (!lista.length) return raiz;
    return [raiz, ...lista.map((m) => `${raiz}--${m}`)].join(" ");
  };
}

/**
 * La clase de un bloque anónimo, a partir de su sección y su rol.
 *
 * `seccion` sale del namespace que el build ya declara con `resetUid("home/hero")` — o
 * sea que el contexto no hay que inventarlo, ya está puesto. `n` desambigua cuando hay
 * varios del mismo rol en la misma sección.
 *
 *     claseDerivada("home/hero", "element", "div", { display: "flex" })     → "wpf-hero__fila"
 *     claseDerivada("home/hero", "element", "div", { display: "flex" }, 2)  → "wpf-hero__fila-2"
 *
 * AVISO, y va en serio: estas clases son para LEER el marcado, no para apuntar desde CSS
 * o JS. El número depende de cuántos hermanos del mismo rol haya antes, así que insertar
 * un bloque puede correrlo. Si hay que agarrarse a algo de forma estable, la capa se
 * nombra en Figma y se usa `bem()`, que depende del nombre y no de la posición. El
 * sistema convierte nombres en clases; no puede inventar una estabilidad que el diseño
 * no tiene.
 */
export function claseDerivada(namespace, tipoBloque, tagName, styles = {}, n = 1, { prefijo = "wpf" } = {}) {
  /* Del namespace interesa el último tramo: «home/hero» → «hero». */
  const seccion = slug(String(namespace || "").split("/").filter(Boolean).pop() || "");
  const rol = rolDe(tipoBloque, tagName, styles);
  const sufijo = n > 1 ? `-${n}` : "";
  return seccion ? `${prefijo}-${seccion}__${rol}${sufijo}` : `${prefijo}-${rol}${sufijo}`;
}
