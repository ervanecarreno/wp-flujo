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

**Consecuencia de diseño:** no busques el bloque "card" ni el bloque "grid". Una card es un `element` con `styles`, y una rejilla es un `element` con `display:grid`. Un botón sin icono es un `element` con `tagName: "a"` que contiene un `text` con `tagName: "span"` — nunca un `element` con texto suelto dentro. Un botón **con icono** tiene una forma más compacta y también válida: ver «Botones y enlaces con icono», debajo del bloque `shape`.

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

### Botones y enlaces con icono: el atributo `icon`, con la forma correcta de HTML

**Corregido el 22/09/2026.** La primera versión de esta sección recomendaba meter el SVG
a mano dentro de `content`, con una clase inventada, evitando el atributo `icon` del
bloque. Eso funcionaba, pero por el motivo equivocado, y tenía un coste real: el icono
quedaba invisible para el editor —era texto, no un icono— así que nadie podía cambiarlo
desde el panel visual sin tocar código. La forma correcta usa el atributo NATIVO.

**El `block.json` real del bloque `text` declara dos selectores distintos:**
`icon` es `{"source":"html","selector":".gb-shape"}` y `content` es
`{"selector":".gb-text"}`. Dos selectores, así que ninguno de los dos puede ser el
elemento raíz completo — tienen que ser dos `<span>` HERMANOS dentro de la raíz, y la
raíz misma se queda solo con su id-class, SIN la clase base `gb-text` (esa clase base
ahora vive en el span del texto, no en el contenedor). Medido con `qa-editor-check.mjs`
sobre cinco variantes aisladas del mismo botón: cualquier combinación que ponga la clase
base en la raíz falla, sin excepción; sin ella, con los dos spans, valida siempre.

```
<!-- wp:generateblocks/text {"uniqueId":"cta001","tagName":"a","htmlAttributes":{"href":"/contacto"},"styles":{"display":"inline-flex","alignItems":"center","columnGap":"12px",".gb-shape":{"width":"14px","height":"14px"}},"css":"…"} -->
<a class="gb-text-cta001" href="/contacto"><span class="gb-shape"><svg …>…</svg></span><span class="gb-text">Contacto</span></a>
<!-- /wp:generateblocks/text -->
```

Ni `icon` ni `content` se serializan en el JSON del comentario — ambos tienen
`source:"html"`, Gutenberg los deriva del cuerpo al parsear (es la misma razón por la
que `content` a secas nunca se serializa). `iconLocation` SÍ va en el JSON cuando vale
`"after"` (icono detrás del texto): no tiene `source`, no hay forma de derivarlo del
HTML. Con `"before"` (el valor por defecto) sobra.

**Por qué compensa usar `icon` en vez de seguir metiendo el SVG en `content`:** con el
SVG registrado antes en la **Icon Library** de GB Pro (`generateblocks_svg_icons` —
prima de la Asset Library de formas, `generateblocks_svg_shapes`, mismo mecanismo: un
catálogo del editor, no una referencia dinámica), el icono queda seleccionable desde el
panel visual del bloque sin pegar código. Un SVG a mano en `content` da el mismo
resultado visual, pero el editor no lo reconoce como icono. Se registra con
`node herramientas/gb-asset-library.mjs --sitio "<…>" --catalogo icons --grupo "<nombre>" --carpeta <dir> --confirmar`
— el mismo script que la Asset Library de formas, con `--catalogo icons` en vez del
valor por defecto.

**El trade-off real, para elegir con conocimiento de causa:** la skill externa vendorizada
`wpgaurav/generateblocks-skills` (`BETA/skills-v2026.09.18/`, revisada el 22/09/2026) NUNCA
usa el atributo `icon` en sus propios ejemplos — su convención para «botón con icono» es
siempre `element(a)` > `shape` + `text`, tres bloques. No es que lo hayan probado y les
fallara —no hay indicio de eso en su documentación—, simplemente priorizan otra cosa: con
tres bloques, el icono y el texto son cada uno un bloque de Gutenberg independiente,
seleccionable y editable por separado en el árbol del editor. Con `icon` en un solo `text`,
esa granularidad se pierde —es un bloque, no tres— a cambio de que el icono sea
seleccionable desde SU PROPIO panel (el picker de la Icon Library). Para un botón fijo del
tema (los de este proyecto) la compacidad gana; para un patrón que un cliente vaya a tocar
bloque a bloque en el editor, puede compensar más la granularidad de los tres bloques.

**La alternativa de «todo en `content`, sin usar `icon`» sigue siendo válida y sigue
haciendo falta cuando hay MÁS de dos piezas** —por ejemplo, un año, un título y un icono
en la misma fila: el mecanismo de `icon`/`content` solo tiene sitio para dos selectores,
así que un tercer trozo de contenido no cabe ahí y hay que escribirlo todo dentro de
`content`, con clases propias. Esa vía no usa el atributo `icon` en ningún momento, así
que no le aplica la restricción de la clase base: la raíz conserva su clase normal.

**Y un enlace que es SOLO un icono —sin ninguna palabra, como un icono de red social—
no puede llevar `icon` tampoco: ahí hace falta el patrón de tres bloques**, `element(a)`
> `shape(svg)`. Un `text` cuyo `content` queda vacío (todo el contenido es el icono) no
valida. La diferencia entre los tres casos es exactamente cuántas piezas de contenido
hay y si alguna es texto visible — no la versión de GB: se midió aparte, aislado, que
esto falla igual en la versión ESTABLE (2.4/2.7) que en los betas 2.5/2.8, corrigiendo
una atribución anterior que lo daba por un problema exclusivo de los betas.

### Interpretar un botón desde Figma o desde HTML — tres reglas, medidas contra un proyecto real

Añadido el 23/09/2026, sobre lo aprendido montando los botones de un proyecto de cliente (traps
31-34 de la skill). Aplica igual si el marcado lo escribes a mano leyendo un `.dc.html`/Figma, o si
lo genera `herramientas/conversion/lib/convert-frame.mjs` — el código ya implementa las tres.

**1. El nombre de la capa no basta.** Una instancia de un botón del sistema de diseño casi nunca se
llama "Button": se llama por su etiqueta ("Contacto", "Escríbenos"). La señal que SÍ lo delata,
tenga el nombre que tenga: texto + un icono pequeño y redondo al lado, dentro de un contenedor con
relleno sólido o borde visible. Un texto suelto sin fill ni stroke sigue sin ser un botón — esa
distinción es a propósito, evita convertir un enlace de lista en una caja que nunca existió en el
diseño.

**2. El icono casi siempre viene dentro de una INSIGNIA, no suelto.** Lo que se ve junto al texto no
suele ser el SVG en sí: es un círculo con fill propio que lo envuelve un nivel más adentro. El
círculo se pinta con CSS —tamaño, fondo, color— en el selector `.gb-shape` del propio `styles`; lo
de DENTRO del círculo es el `icon` de verdad.

```js
text({
  tagName: "a", content: "Contacto", icon: FLECHA_DIAG, iconLocation: "after",
  htmlAttributes: { href: "/contacto" },
  styles: {
    backgroundColor: "var(--color-gold)", borderRadius: "999px", /* … */
    ".gb-shape": {                              // la INSIGNIA, no el icono
      display: "flex", alignItems: "center", justifyContent: "center",
      width: "38px", height: "38px", borderRadius: "999px",
      backgroundColor: "var(--color-ink)", color: "var(--color-paper)",
    },
  },
});
```

**3. Ese glifo, dentro de la insignia, suele ser un CARÁCTER («↗»), no un SVG — y hay que
sustituirlo.** Un carácter suelto se pinta como emoji de color en cuanto ninguna familia
tipográfica del contrato lo trae dibujado, que es casi siempre. Nunca se copia el carácter al
marcado: se cambia por un SVG equivalente. Tres ya verificados en producción, en
`build/iconos.mjs` de un proyecto real:

```js
const FLECHA_DIAG = svg('<path d="M7 17 L17 7" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M9.5 7 H17 V14.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>'); // ↗
const FLECHA_DER  = svg('<path d="M4 12 H19" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M13 6 L19 12 L13 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>'); // →
const PLAY        = svg('<path d="M8 5 L19 12 L8 19 Z" fill="currentColor"/>'); // ▶
```

No es una lista cerrada: es la lista de lo comprobado. Un glifo nuevo se añade con su propio SVG
verificado, nunca uno parecido a ojo.

**Y el orden texto/icono nunca se asume ni se copia del `.dc.html` — se lee del componente real.**
Es la causa del único bug de verdad de este apartado: el `.dc.html` de origen traía el icono ANTES
del texto en varios botones y se escribió así a mano sin comprobarlo, pero el componente maestro de
Figma llevaba siempre el orden Texto → Insignia. Regla del proyecto — si Figma y el HTML discrepan,
gana Figma — aplicada aquí a la letra. Escribiendo a mano: mira el orden real de los hijos del
componente en Figma. Convirtiendo con el pipeline: ya lo hace solo, comparando la posición
horizontal real del icono contra la del texto (`absoluteBoundingBox.x`), nunca asumiendo `"before"`
por defecto.

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

### 5 bis. Las etiquetas dinámicas fuera de un bucle

Las mismas etiquetas valen en una plantilla de página suelta, sin `query`: ahí resuelven contra la entrada que se está sirviendo. Es lo que convierte un Elemento de GeneratePress en una plantilla reutilizable (ver el apartado «Plantillas de contenido» de la skill `flujo-wordpress-generateblocks`).

Tres cosas que hay que saber antes de usarlas, las tres medidas el 22/09/2026:

1. **Son REQUERIDAS por defecto.** Si la etiqueta devuelve cadena vacía, GenerateBlocks **no pinta el bloque entero**, no solo el hueco. Es el condicional que el marcado no tiene —«si el campo está vacío, no lo imprimas» sale gratis—, pero también significa que un valor legítimamente vacío tumba el bloque. Caso real: `{{featured_image key:alt}}` sin texto alternativo se llevaba la imagen por delante. Se apaga por etiqueta: `{{featured_image key:alt|required:false}}`.

   Corolario de composición: los adornos de un campo opcional (un filete, una comilla) van en un `::before` del **mismo** bloque, no en un bloque hermano. Si no, el adorno se queda solo cuando el campo está vacío.

2. **No hay etiqueta para `post_content`.** El catálogo es título, extracto, fecha, permalink, imagen destacada, metas, términos y datos del autor, y ahí se acaba. El contenido de la entrada se imprime con `<!-- wp:generatepress/dynamic-content {"contentType":"post-content"} /-->`, que sale envuelto en `<div class="dynamic-entry-content">` — ese es el selector al que apunta el `styles` del `element` que lo contiene.

3. **`{{post_excerpt}}` se inventa un extracto** recortando el cuerpo a 55 palabras si el campo está vacío, porque pasa por `get_the_excerpt()`. Para el campo en crudo, una etiqueta propia con `get_post_field( 'post_excerpt', $id )`.

**Registrar etiquetas propias** es la vía buena para meter marcado calculado en PHP dentro de un bloque, mejor que un shortcode: el estilo se queda entero en el `styles` del bloque —visible para los linters y para el contrato— y la función solo emite marcado semántico.

```php
add_action( 'init', function () {                   // prioridad 20: GB registra las suyas en 10
    new GenerateBlocks_Register_Dynamic_Tag( [
        'title' => 'Migas de pan', 'tag' => 'mis_migas', 'type' => 'post',
        'supports' => [], 'return' => fn(): string => mis_migas_html(),
    ] );
}, 20 );
```

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

## 7 bis. Global Styles: la forma canónica de no repetir estilos

**Verificado el 28/08/2026 contra GenerateBlocks Pro 2.7.0.** Un Global Style es una regla CSS con
nombre. Vive en el tipo de contenido `gblocks_styles`, uno por selector:

| Dónde | Qué |
|---|---|
| `post_title` | el selector, p.ej. `.gbp-card` |
| `menu_order` | el **orden de salida** del CSS, que es la especificidad, de arriba abajo |
| `gb_style_selector` (postmeta) | el selector |
| `gb_style_css` (postmeta) | el CSS compilado de esa regla |
| `gb_style_data` (postmeta) | el objeto de estilos **en camelCase**, misma forma que `styles` de un bloque |

Todo junto se compila a la opción `generateblocks_style_css` y al fichero
`wp-content/uploads/generateblocks/style-global.css`.

**Es versionable**, y esto corrige lo que este flujo daba por cerrado: el CPT **sí está expuesto en
la API REST** (`rest_base: gblocks_styles`) y se maneja bien por wp-cli. Herramienta:
`herramientas/global-styles.js` (exportar/importar, idempotente).

### Cómo usarlo al generar marcado

Si un componente se repite, **no lo estiles bloque a bloque**. Defínelo una vez como global style y
emite los bloques así:

```json
{"uniqueId":"17a2a47f","tagName":"div","globalClasses":["gbp-card"]}
```

Sin `styles`, sin `css`. El bloque sale con `class=""` en el cuerpo y **eso es correcto** — es
justo lo que hace GenerateBlocks en sus propios exports, y la razón de que la id-class no siempre
esté (ver §8).

Lo que se gana: el marcado se queda **sin un solo HEX literal**, y "cambia el color de las tarjetas"
vuelve a ser una edición en un sitio en vez de una revisión de N bloques.

### Las dos capas de tokens

Los global styles referencian variables (`var(--accent-3)`, `var(--gb-container-width)`), que las
define **GeneratePress** en sus Global Colors. Son dos capas y hay que montar las dos:

1. **GeneratePress** → la paleta y los anchos, como Global Colors del tema (`generate_settings`,
   que se lleva `herramientas/config-tema.js`).
2. **GenerateBlocks** → los componentes, como Global Styles (`herramientas/global-styles.js`).

Si falta la capa 1, los global styles resuelven a la paleta que tenga el tema puesto — y la página
sale con los colores equivocados sin dar ningún error. Verificado.

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
- [ ] Todo `element` con `tagName: "a"` contiene un `text`, nunca texto plano. (No aplica
      cuando el enlace en sí ES un `text` con `tagName: "a"` — ver «Botones y enlaces con
      icono» en §2.)
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
