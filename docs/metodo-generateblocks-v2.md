# Cómo generar bloques de GenerateBlocks Pro V2 — método de referencia

Documento para un proyecto de código que genere marcado de GenerateBlocks V2. Recoge las reglas que hicieron falta para convertir una portada completa (179 bloques, 8 secciones) a marcado pegable en el editor sin errores de validación.

---

## 1. Solo cinco bloques hacen todo

GenerateBlocks V2 no tiene un bloque por patrón visual. Tiene primitivas:

| Bloque | Para qué | Etiqueta HTML |
|---|---|---|
| `generateblocks/element` | Contenedores, rejillas, enlaces, `<li>`, secciones | la que digas en `tagName` |
| `generateblocks/text` | Cualquier texto: título, párrafo, `<span>` | `tagName` |
| `generateblocks/media` | Imágenes | `img` |
| `generateblocks/shape` | SVG en línea (iconos) | `span` envolviendo el SVG |
| `generateblocks/query` + `looper` + `loop-item` | Contenido dinámico | — |

**Consecuencia de diseño:** no busques el bloque "card" ni el bloque "grid". Una card es un `element` con `styles`, y una rejilla es un `element` con `display:grid`. Un botón es un `element` con `tagName: "a"` que contiene un `text` con `tagName: "span"` — nunca un `element` con texto suelto dentro.

---

## 2. Anatomía de un bloque

```
<!-- wp:generateblocks/element {ATRIBUTOS_JSON} -->
<TAG class="gb-element-UNIQUEID gb-element">
  … hijos …
</TAG>
<!-- /wp:generateblocks/element -->
```

Atributos obligatorios:

```json
{
  "uniqueId": "hero001",
  "tagName": "section",
  "styles": { "display": "flex", "padding-top": "80px" },
  "css": ".gb-element-hero001{display:flex;padding-top:80px}",
  "className": "gb-element"
}
```

Cuatro reglas que rompen la validación si se incumplen:

1. **`styles` y `css` deben coincidir.** `styles` es la fuente para el editor; `css` es lo que se imprime en la página. Si difieren, el editor pinta una cosa y el frontend otra.
2. **`css` va minificado y con las propiedades en orden alfabético.** Es como GB lo serializa; si tu orden es distinto, al abrir y guardar el bloque WordPress lo reescribe y marca el bloque como modificado.
3. **`className` NO incluye la id-class.** Va `"gb-element"`, no `"gb-element-hero001 gb-element"`. La id-class solo existe en el HTML del cuerpo.
4. **El HTML del cuerpo SÍ incluye las dos.** `class="gb-element-hero001 gb-element"`, en ese orden.

Para `text` el prefijo es `gb-text-`, para `media` `gb-media-`, para `shape` `gb-shape-`, y el `looper` usa `gb-looper-`.

### Bloque `text`

El contenido va **duplicado**: en el atributo `content` y en el cuerpo.

```
<!-- wp:generateblocks/text {"uniqueId":"hero005","tagName":"h1","content":"Los Llanos, La Palma viva","styles":{…},"css":"…","className":"gb-text"} -->
<h1 class="gb-text-hero005 gb-text">Los Llanos, La Palma viva</h1>
<!-- /wp:generateblocks/text -->
```

### Bloque `media`

`src` y `alt` van dentro de `htmlAttributes`, no como atributos de primer nivel.

```
<!-- wp:generateblocks/media {"uniqueId":"pgo019","tagName":"img","htmlAttributes":{"src":"/wp-content/uploads/banner.jpeg","alt":"PGO"},"styles":{…},"css":"…","className":"gb-media"} -->
<img class="gb-media-pgo019 gb-media" src="/wp-content/uploads/banner.jpeg" alt="PGO"/>
<!-- /wp:generateblocks/media -->
```

### Bloque `shape`

El SVG va en el atributo `html` y repetido en el cuerpo. Usa `stroke="currentColor"` para que herede el color del bloque.

```
<!-- wp:generateblocks/shape {"uniqueId":"serv201","html":"<svg …>…</svg>","styles":{"color":"#EE743B","display":"inline-flex"},"css":".gb-shape-serv201{color:#EE743B;display:inline-flex}","className":"gb-shape"} -->
<span class="gb-shape-serv201 gb-shape"><svg …>…</svg></span>
<!-- /wp:generateblocks/shape -->
```

⚠️ Requiere usuario con permiso `unfiltered_html` (administrador). WordPress elimina el SVG a cualquier otro perfil, y el bloque queda vacío sin avisar.

---

## 3. Escapado del JSON en el comentario de bloque

Este es el punto donde falla casi cualquier generador. El JSON vive dentro de un comentario HTML, así que hay **cuatro** sustituciones obligatorias **después** de `JSON.stringify`:

| Carácter | Se escribe |
|---|---|
| `&` | `\u0026` |
| `<` | `\u003c` |
| `>` | `\u003e` |
| `--` | `\u002d\u002d` |

```js
const esc = j => j
  .split('--').join('\u002d\u002d')
  .split('<').join('\u003c')
  .split('>').join('\u003e')
  .split('&').join('\u0026');
```

**Las comillas `"` se dejan literales.** No van a `\u0022`. Es un error de una versión anterior de
este documento, corregido el 27/08/2026 tras verificarlo contra un WordPress real (ver más abajo):
escapar las comillas rompe el guardado. WordPress sanea el contenido al guardar (vía REST, que es
la misma ruta que usa el editor de bloques al pulsar "Actualizar") y su filtro de `kses` solo
reconoce un comentario de bloque como legítimo si el JSON de dentro tiene comillas literales — si
no, no lo detecta como bloque de Gutenberg y borra silenciosamente todo el interior del comentario,
dejando `<!-- wp:generateblocks/element -->` sin atributos. `herramientas/audit-gb.js` nunca exigió
este escape (solo comprueba los cuatro de la tabla), así que el validador siempre fue correcto — el
error estaba solo aquí, en la documentación.

**`--` → `\u002d\u002d` sigue siendo obligatorio**, y ya no hace falta evitar `var(--color)` por
su culpa: **verificado el 27/08/2026 contra un WordPress real** (figma-staging, PHP 8.2.29 / WP-CLI
2.12.0, GenerateBlocks Pro 2.7.0) que con los cuatro escapes correctos y comillas literales, un
`var(--color-x)` en `styles`/`css` sobrevive **intacto**: el guardado vía REST, el `parse_blocks()`
de WordPress, y el CSS que GenerateBlocks genera de verdad en el frontend
(`wp-content/uploads/generateblocks/style-{ID}.css`) contienen exactamente
`background-color:var(--color-x)`, sin aplanar a HEX.

**Qué sigue sin probar:** este experimento usó la API REST directamente (el mismo camino que sigue
el editor al guardar), no un clic real en el editor visual de GB Pro. Es una diferencia menor — la
capa de saneado de WordPress es la misma en los dos casos — pero si algo cambia al comprobarlo con
el editor abierto de verdad, anotarlo aquí.

**`&` → `\u0026`**: aparece en el selector de hover (`&:hover`), así que sale en casi todos los bloques interactivos.

---

## 4. Estados y media queries dentro de `styles`

GB V2 admite anidamiento en `styles`. La clave determina qué se genera:

```json
"styles": {
  "background": "#EE743B",
  "transition": "background 160ms ease",
  "&:hover": { "background": "#D65E24" },
  "@media (max-width: 767px)": { "padding": "16px" }
}
```

Compilación:

- clave que empieza por `&` → `SELECTOR:hover{…}` (se quita el `&` y se concatena)
- clave que empieza por `@` → `@media …{SELECTOR{…}}`
- el resto → propiedades del propio selector

```js
function buildCss(sel, styles){
  const own = {}, nest = [];
  for (const k of Object.keys(styles)) {
    const v = styles[k];
    (v && typeof v === 'object') ? nest.push([k, v]) : own[k] = v;
  }
  const decl = o => Object.keys(o).sort().map(k => k + ':' + o[k]).join(';');
  let out = Object.keys(own).length ? sel + '{' + decl(own) + '}' : '';
  for (const [k, v] of nest) {
    out += k[0] === '@'
      ? k + '{' + sel + '{' + decl(v) + '}}'
      : sel + k.slice(1) + '{' + decl(v) + '}';
  }
  return out;
}
```

**Límite real:** GB no genera selectores descendentes (`.padre .hijo`). Todo lo que necesite un descendiente —los breakpoints que reordenan varias rejillas a la vez, el estilo de un bloque de core anidado— tiene que ir a una hoja de estilos aparte, apuntando a las id-classes (`.gb-element-serv005`). En la conversión real eso dejó unas 100 líneas de CSS externo frente a ~98 KB de estilos dentro de los bloques.

---

## 5. Contenido dinámico: query / looper / loop-item

Los tres bloques son una cadena fija, uno dentro del otro:

```
<!-- wp:generateblocks/query {"uniqueId":"qlis001","query":{"post_type":"post","posts_per_page":3,"offset":1,"orderby":"date","order":"DESC"}} -->
<!-- wp:generateblocks/looper {"uniqueId":"qlis002","tagName":"div","styles":{"display":"grid","grid-template-columns":"repeat(3,1fr)","gap":"20px"},"css":"…","className":"gb-looper"} -->
<div class="gb-looper-qlis002 gb-looper">
<!-- wp:generateblocks/loop-item {"uniqueId":"qlis003","tagName":"div","styles":{},"css":"","className":"gb-loop-item"} -->
<div class="gb-loop-item-qlis003 gb-loop-item">
  … la plantilla de UN item …
</div>
<!-- /wp:generateblocks/loop-item -->
</div>
<!-- /wp:generateblocks/looper -->
<!-- /wp:generateblocks/query -->
```

- `query` no imprime HTML: solo lleva los parámetros de `WP_Query`.
- `looper` es el contenedor de la rejilla o la lista.
- `loop-item` es la plantilla que se repite; dentro va la card completa.

Etiquetas dinámicas dentro de `loop-item` (van en `content`, en `htmlAttributes.href` o en `htmlAttributes.src`):

```
{{post_permalink}}
{{post_title}}
{{post_date dateFormat:j F, Y}}
{{post_excerpt length:28}}
{{featured_image size:large}}
{{post_meta key:mi_campo}}
{{term_list taxonomy:category}}
```

**Patrón útil:** un destacado + una lista sin repetirlo son dos `query` distintos, el primero con `posts_per_page: 1` y el segundo con `posts_per_page: 3, offset: 1`.

---

## 6. Estrategia de `uniqueId`

Los ids tienen que ser únicos en toda la página y estables entre generaciones (si cambian, el CSS externo que los referencia deja de funcionar). Esquema que funcionó:

```
sección(4) + índice de repetición(1) + rol(1)
hero001   → sección hero, elemento suelto
serv200   → servicios, card 0, wrapper
serv201   → servicios, card 0, icono
serv202   → servicios, card 0, título
serv310   → servicios, card 1, wrapper
```

Nada de ids aleatorios ni de hashes: la regeneración debe dar el mismo resultado byte a byte para poder versionar el archivo y hacer diff.

---

## 7. Cuándo NO usar un bloque GB

Mezclar bloques de core es legítimo y a veces mejor. En la portada real se dejó `core/search` para el buscador del hero: replicarlo con `element` + `text` habría exigido reimplementar el formulario y perder la integración con la búsqueda de WordPress.

Criterio: si el bloque de core aporta **funcionalidad de servidor** (búsqueda, formulario, navegación, comentarios), úsalo y estílalo desde el CSS externo con una clase propia (`className: "ar-hero-search"`). Si es solo maquetación, hazlo con GB.

---

## 8. Checklist de validación antes de entregar

- [ ] Cada `css` coincide exactamente con su `styles` (minificado, alfabético).
- [ ] Ningún `className` contiene la id-class.
- [ ] Todos los HTML del cuerpo llevan `gb-<tipo>-<id>` + `gb-<tipo>`.
- [ ] Las cuatro sustituciones de escapado aplicadas (`--`, `<`, `>`, `&`); comillas SIN escapar (ver §3).
- [ ] `src`/`alt`/`href` dentro de `htmlAttributes`, no en el primer nivel.
- [ ] `content` duplicado en atributo y cuerpo para todos los `text`.
- [ ] Todo `element` con `tagName: "a"` contiene un `text`, nunca texto plano.
- [ ] Los `uniqueId` son únicos y deterministas.
- [ ] Los breakpoints que cruzan bloques están en el CSS externo, no intentados con `styles`.
- [ ] Ninguna tipografía declarada si el tema ya la define.

Si el editor dice *"este bloque contiene contenido inesperado o no válido"*, casi siempre es el punto 1 o el 4. **Intentar recuperación de bloque** arregla y deja el marcado ya canónico para esa instalación — sirve como verificación: si tras recuperar y guardar el HTML no cambia, el generador serializa igual que GB.

---

## 9. Arquitectura del generador

Lo que hizo la conversión manejable fue no escribir el marcado a mano, sino cinco funciones constructoras y componer con ellas:

```js
EL(id, tag, styles, opts, kids)   // element
TX(id, tag, content, styles)      // text
MD(id, src, alt, styles)          // media
SH(id, svgPath, size, color)      // shape
QUERY(qid, query, lid, styles, item)  // query + looper + loop-item
```

Más objetos de estilo reutilizables (`CARD`, `SECTION`, `INNER`, `H2`, `HOVER_LIFT`) que se combinan con `Object.assign`. Así una sección de seis cards son seis iteraciones de un `map`, y cambiar el radio de todas las cards es una línea.

Nota práctica de implementación: si el generador construye las secciones con expresiones muy anidadas (spread + template literals + ternarios dentro de argumentos de función), algunos entornos fallan al parsear. Extraer cada trozo a una constante intermedia y usar `Array.prototype.map` con `function(){}` en lugar de arrow functions anidadas resuelve el problema sin cambiar el resultado.
