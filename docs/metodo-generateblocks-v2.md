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

Este es el punto donde falla casi cualquier generador. **No hay que deducirlo: WordPress lo hace en
una función concreta de su código**, `serialize_block_attributes()` en `wp-includes/blocks.php`.
Leída del core el 28/08/2026, hace **seis** sustituciones después de codificar el JSON:

| En el JSON | Se escribe | Dónde aparece en la práctica |
|---|---|---|
| `\\` (barra invertida ya escapada) | `\u005c` | rara: `content:"\2014"` y similares |
| `--` | `\u002d\u002d` | **cualquier `var(--x)`**, comentarios CSS, guiones dobles en texto |
| `<` | `\u003c` | SVG en línea, HTML dentro de un valor |
| `>` | `\u003e` | igual |
| `&` | `\u0026` | el selector `&:hover`, o sea casi todos los bloques interactivos |
| `\"` (comilla **ya escapada**) | `\u0022` | atributos del SVG en línea: `viewBox="0 0 24 24"` |

```js
const BS = String.fromCharCode(92);
const esc = (j) => j
  .split(BS + BS).join(BS + 'u005c')
  .split('--').join(BS + 'u002d' + BS + 'u002d')
  .split('<').join(BS + 'u003c')
  .split('>').join(BS + 'u003e')
  .split('&').join(BS + 'u0026')
  .split(BS + '"').join(BS + 'u0022');
```

### La distinción que lo decide todo: qué comilla

La última sustitución **no es «escapar las comillas»**. Es `\"` → `\u0022`: solo la comilla que
ya viene escapada, es decir la que está **dentro de un valor**. Las comillas **estructurales** del
JSON —las que delimitan claves y valores— **se dejan literales**.

```
BIEN   {"uniqueId":"x1","html":"\u003csvg viewBox=\u00220 0 24 24\u0022/\u003e"}
MAL    {\u0022uniqueId\u0022:\u0022x1\u0022, ... }        <- JSON inválido, atributos vacíos
```

**Aplicarla a todas las comillas rompe el guardado.** Verificado el 28/08/2026 con
`node medidas/escapado-tres-variantes.js`: destruye las comillas estructurales, el JSON deja de
parsear y `parse_blocks()` devuelve los atributos vacíos. El bloque se guarda como
`<!-- wp:generateblocks/element -->` sin nada dentro, **sin ningún mensaje de error**.

### Historial de este apartado, porque ha cambiado dos veces

| Fecha | Qué decía | Veredicto |
|---|---|---|
| hasta el 27/08 | cinco sustituciones, tabla con `"` → `\u0022` sin matizar cuál | **ambigua**: leída al pie de la letra produce el caso MAL de arriba |
| 27/08 | cuatro sustituciones, «comillas literales» | **segura pero no canónica**: produce JSON válido que WordPress acepta, pero no coincide con el core y le faltan `\\` y `\"` |
| 28/08 (esta) | las seis del core, con la distinción de qué comilla | leída del código de WordPress |

La corrección del 27/08 daba además una explicación equivocada del mecanismo: culpaba al filtro
`kses` de WordPress. **No es kses**: es que el JSON no es válido, que es más simple y más tonto.

Consecuencia práctica de quedarse en las cuatro: al reguardar desde el editor, WordPress reescribe
el marcado a su forma canónica y el contenido cambia de bytes sin que nadie lo haya editado.

### `var(--color)` funciona, y esto no lo cambia

**Verificado el 27/08/2026 contra un WordPress real** (figma-staging, PHP 8.2.29 / WP-CLI 2.12.0,
GenerateBlocks Pro 2.7.0): con el escapado correcto, un `var(--color-x)` en `styles`/`css` sobrevive
intacto al guardado vía REST, al `parse_blocks()` de WordPress y al CSS que GenerateBlocks genera
en el frontend (`wp-content/uploads/generateblocks/style-{ID}.css`), sin aplanar a HEX.

Por tanto **no hay que evitar las variables CSS**, y cualquier documento que recomiende aplanar los
colores a HEX literales por culpa del escapado está desactualizado.

**Qué sigue sin probar:** que un marcado con solo las cuatro sustituciones se reescriba a la forma
canónica al reguardarlo desde el editor visual. Es lo que dice el código del core, pero no se ha
ejecutado con el editor abierto.

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

**Recalibrado el 28/08/2026 contra 732 bloques de 25 exports reales de GenerateBlocks.** Tres reglas
de la versión anterior eran falsas: `herramientas/audit-gb.js` daba errores sobre marcado que GB
mismo había escrito. Ahora pasa esos 732 bloques con **0 errores**.

- [ ] **`styles` en camelCase, `css` en kebab-case.** Es lo que hace GB: `marginBottom` en `styles`,
      `margin-bottom` en `css`. Medido: 1423 claves camelCase frente a 75 kebab, y 0 bloques con
      `css` en camel. Escribir `styles` en kebab es lo que hacen algunos generadores y **no es
      canónico**: si alguien abre ese bloque en el editor y lo toca, GB regenera el `css` desde
      `styles` y esas claves no son las que espera.
- [ ] **No intentes que `css` sea una serialización exacta de `styles`: GB lo OPTIMIZA.** Colapsa
      longhands en shorthand (`padding-top/right/bottom/left` → `padding:16rem 4rem`), quita los
      espacios de dentro de `rgba()` y `clamp()`, y ordena los bloques anidados a su manera.
      Comparar carácter a carácter solo tiene sentido con marcado generado por este mismo flujo
      (`audit-gb.js --estricto`); con marcado exportado de WordPress da falsos positivos.
- [ ] **La id-class solo hace falta si el bloque tiene CSS propio.** Un bloque sin `styles`, o
      estilado con una clase global de GB Pro, sale con `class=""` y es correcto.
- [ ] **La clase base `gb-<tipo>` no es obligatoria.** El 60% de los cuerpos de los exports reales
      solo lleva la id-class.
- [ ] Ningún `className` contiene la id-class.
- [ ] Las seis sustituciones de escapado del core aplicadas (ver §3), con las comillas
      **estructurales** del JSON literales.
- [ ] `src`/`alt`/`href` dentro de `htmlAttributes`, no en el primer nivel.
- [ ] `htmlAttributes` es un objeto plano, nunca un array (causa nº 1 de "Attempt Recovery").
- [ ] Todo `element` con `tagName: "a"` contiene un `text`, nunca texto plano.
- [ ] Los `uniqueId` son únicos y deterministas.
- [ ] Los breakpoints que cruzan bloques están en el CSS externo, no intentados con `styles`.
- [ ] Ninguna tipografía declarada si el tema ya la define.

**Claves anidadas dentro de `styles`** — las cuatro formas que emite GB, y cómo se traducen:

| Clave | CSS que produce |
|---|---|
| `@media (max-width:767px)` | `@media(...){ SEL{...} }` |
| `&:is(:hover, :focus)` | `SEL:is(:hover, :focus){...}` — el `&` se sustituye, sin espacio |
| `svg` | `SEL svg{...}` — descendiente, **con** espacio |
| `.gb-shape svg` | `SEL .gb-shape svg{...}` |

Si el editor dice *"este bloque contiene contenido inesperado o no válido"*, en la práctica es el
escapado (§3) o `htmlAttributes` como array. **Intentar recuperación de bloque** arregla y deja el
marcado canónico para esa instalación — y sirve de verificación: si tras recuperar y guardar el HTML
no cambia, tu generador serializa como GB.

**La única verificación que de verdad cierra el asunto** es pegar el marcado en un WordPress real y
comprobar con `parse_blocks()` que ningún bloque vuelve sin atributos. El validador de fichero no
puede ver eso (ver `docs/prueba-handoff.md`).

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
