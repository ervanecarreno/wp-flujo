# Conversión Figma → GenerateBlocks

Cierra la laguna que este flujo tenía reconocida: *"El plugin no cubre la traducción
Figma → GenerateBlocks. Empieza cuando el marcado ya existe."*

**Promovido el 2/09/2026 desde `C:\TRABAJOS\figma-gb-pipeline`.** Ese repo es un **proyecto**,
con su propio remoto en GitHub y el handoff del design system de Metrópolis dentro. Estas piezas
son **herramienta**, no proyecto, así que su sitio es aquí: un proyecto de cliente invoca el
plugin, nunca otro proyecto.

Node ≥ 18, **sin dependencias** salvo donde se indica.

---

## Qué hay

### `lib/` — el núcleo

| Fichero | Qué hace |
|---|---|
| `canonical.mjs` | Serialización canónica de atributos de bloque: los escapes unicode de `serialize_block_attributes()`, CSS alfabetizado y minificado, orden de claves, utilidades (`rgba`, `pxToRem`) |
| `emit.mjs` | Emisores canónicos de GB V2: `element`, `text`, `media`, `shape`, `linkButton`, carousel/accordion/tabs (GB Pro), y desde el 3/09/2026 **Site Header / Navigation** (`siteHeader`, `navigation`, `menuToggle`, `menuContainer`, `classicMenu`+`classicMenuItem`+`classicSubMenu` — ver abajo). `CLASS_MODE` configurable |
| `convert-frame.mjs` | **La pieza que faltaba**: convierte un frame de Figma en bloques |
| `figma-client.mjs` | Cliente REST de Figma: nodos, variables locales, rellenos de imagen, PNG del frame |
| `tokens.mjs` · `infer-tokens.mjs` | Resolución de variables de Figma a tokens, e inferencia cuando no hay variables |
| `gbp-global-styles.mjs` | Global Styles de GB Pro (CPT `gblocks_styles`) |
| `validate.mjs` | Reglas del linter estático |
| `blockdiff.mjs` | Diferencia entre dos marcados de bloques, para el round-trip |
| `fidelity-check.mjs` | Comprueba que `sizingH:FILL`, `clipsContent` y `textAlign` de Figma se reflejan de verdad en los estilos emitidos. Cada regla nació de un bug real. **Solo sirve en la ruta `convert-frame`**, porque trabaja sobre sus `fidelityRecords` |
| `analyze-sections.mjs` | Trocea una página en secciones |

### `scripts/` — la línea de comandos

| Script | Fase | Qué hace |
|---|---|---|
| `extract.mjs` | 1 | Extrae un frame de Figma |
| `map-tokens.mjs` | 2 | Construye el mapa de tokens |
| `wp-push-tokens.mjs` | 2 | Lee **el contrato** y escribe los Global Colors y los campos de espaciado que el contrato mapee. Canal por defecto: **wp-cli** |
| `wp-discover-abilities.mjs` | 2 | Descubre qué admite el WordPress de destino |
| `assemble.mjs` | 4 | Patrón validado + manifest de slots + contenido → página. `--reid` remapea `uniqueId` |
| `validate-blocks.mjs` | 4 | Linter estático (ver abajo) |
| `qa-contrato-publicado.mjs` | 7 | **Descarga la página servida y comprueba que cada `var(--token)` y cada familia tipográfica resuelve de verdad.** Sin dependencias |
| `wp-roundtrip.mjs` | 7 | Guarda en WP, relee y compara bloque a bloque: le pregunta a WordPress en vez de suponer |
| `qa-fidelity-check.mjs` | 7 | Reconvierte un frame extraído y aplica las reglas de `fidelity-check.mjs`. Requiere `extract/` |
| `qa-editor-check.mjs` | 7 | **Abre el wp-admin de verdad y le pregunta al editor si los bloques son válidos.** Sin contraseñas. Requiere `playwright-core` (`npm install` en la raíz) |
| `qa-visual-diff.mjs` | 7 | **Compara la página con su diseño, sección a sección.** También línea base para regresión. Requiere `npm install` |
| `qa-run.mjs` | 7 | Lanza la batería de QA |

Uso, desde la raíz del plugin:

```bash
node herramientas/conversion/scripts/validate-blocks.mjs pagina.html
node herramientas/conversion/scripts/assemble.mjs patron.html manifest.json contenido.json --reid
```

---

## Los dos validadores: por qué siguen siendo dos

Este plugin tiene ahora **dos** linters de marcado GB, y **no se ha elegido uno a ciegas**.
Enfrentados al mismo fichero real (`patterns/hero-home/pattern.html`) el 2/09/2026:

| | Errores | Avisos |
|---|---|---|
| `herramientas/audit-gb.js` | **0** | 23 |
| `herramientas/conversion/scripts/validate-blocks.mjs` | **0** | 1 |

Coinciden en lo que importa —0 errores— y difieren en la sensibilidad. Ninguno domina al otro:

- **`audit-gb.js` caza cosas que el otro no**: por ejemplo `shape` sin atributo `html`.
- **`audit-gb.js` tiene una clase de falso positivo**: 5 de sus 23 avisos son
  `dynamic-tag · posible etiqueta con una sola llave`, disparados por **declaraciones CSS**
  (`{display:inline-flex;margin-bottom:3rem}`), no por etiquetas dinámicas.
- `validate-blocks.mjs` está calibrado contra 18 patrones exportados; `audit-gb.js`, contra
  **732 bloques** de 25 exports reales de GenerateBlocks. Ese corpus es el que manda.

**Reparto mientras tanto:**

- `validate-blocks.mjs` es el **pre-check del pipeline**: se ejecuta dentro de la conversión,
  antes de emitir.
- `audit-gb.js` es la **puerta**, la del método §8. Nada entra en WordPress sin pasarla.

### Resuelto el 2/09/2026: calibrados contra el corpus

La tarea llevaba abierta desde agosto. Se resolvió midiendo, no opinando.

El criterio: `herramientas/corpus-gb/` son **25 exports reales de GenerateBlocks, 742 bloques**.
GB los produjo y GB los acepta. **Si una regla salta ahí, la regla está mal.** Y hay una segunda
forma de estar mal: saltar *igual* sobre los dos conjuntos, porque entonces no distingue nada.
Herramienta: `herramientas/calibrar-validadores.mjs`, que normaliza por bloque —los ficheros van
de 8 a 156 bloques— y da veredicto por regla.

**Primera medición:**

| | Errores falsos | Avisos sobre marcado válido |
|---|---|---|
| `validate-blocks.mjs` | **0** | 81 (regla 2.6) |
| `audit-gb.js` | **0** | **847**, en 6 categorías |

Ninguno de los dos producía un error falso: como puertas, los dos eran seguros. Pero las seis
categorías de aviso de `audit-gb.js` saltaban a tasas iguales o **mayores** sobre la salida del
propio GB que sobre la nuestra. Un informe con 847 avisos sobre marcado correcto no se lee: enseña
a ignorarlo, y el día que aparezca uno de verdad pasa desapercibido.

**Dos reglas tenían arreglo real, y se arreglaron:**

- **`dynamic-tag`, llaves sueltas.** Buscaba `/\{[a-z_]+[^}]*\}/`, que es también la forma de
  cualquier declaración CSS: `{background-color:var(--accent)}`. 125 disparos, todos falsos, en
  25 de 25 ficheros. Ahora exige un **nombre de etiqueta conocido**; ninguna propiedad CSS se
  llama `post_title`, así que la regla pasó a ser exacta. Cero falsos, y sigue cazando el
  `{post_title}` de una sola llave, que falla en silencio.
- **`content`, text sin contenido.** Avisaba siempre, aunque el bloque llevara hijos. Se afinó a
  «no hay hijos» — y luego hubo que afinarla otra vez: un `text` con solo un `<svg>` **no está
  vacío**, y el corpus tenía justo ese caso. Vacío es que dentro de la envolvente no quede nada.

**Cuatro no tenían arreglo, y bajaron de rango.** Se conservan —a veces describen algo cierto—
pero fuera del informe por defecto, en un tercer nivel **`nota`**, visible con `--todo`:
`cuerpo` (la clase base que GB tampoco emite), `css≠styles` (GB optimiza el CSS y reconstruirlo
carácter a carácter no es posible), `shape` sin `html`, y `enlace` con texto suelto.

Igual la mitad `warn` de la regla **2.6** de `validate-blocks.mjs`: alfabetización en selectores
descendientes. Su mitad `error` —selectores base— sí está validada, 0 disparos sobre los 742
bloques. La otra mitad medía **quién escribió el fichero**, no si está bien: nosotros alfabetizamos
y GB no.

**Resultado: 0 disparos de cualquiera de los dos sobre los dos conjuntos**, sin perder una sola
detección real. Comprobado por regresión con marcado roto a propósito: escapado crudo,
`htmlAttributes` como array, `uniqueId` duplicado, `:hover` sin clave en `styles`, etiqueta de una
llave y un `text` de verdad vacío — los seis siguen saltando.

**Y siguen siendo dos a propósito**, ahora con la prueba delante: en ese mismo fichero roto,
`validate-blocks.mjs` fue el único que vio el `:hover` sin clave en `styles`, y `audit-gb.js` el
único que vio el `uniqueId` duplicado y la etiqueta de una llave. Ninguno domina al otro. Se
ejecutan los dos, y ahora los dos callan cuando no hay nada que decir.

**Regla para el futuro:** una regla nueva no entra por parecer razonable. Pasa por
`calibrar-validadores.mjs` y demuestra que distingue.

**Y ya hay árbitro para esa unificación: `wp-roundtrip.mjs`.** Los dos validadores codifican una
*creencia* sobre lo que WordPress hace al guardar. El round-trip no cree: publica un borrador,
lo relee con `context=edit` y compara. Medido el 2/09/2026 sobre marcado con `>` y `&` crudos,
WordPress devolvió `>` — o sea, confirmó con sus propios bytes la regla 1.3 de
`validate-blocks.mjs`. Cuando las dos reglas discrepen, la que gana es la que sobrevive al
round-trip, no la que mejor suene.

---

## `qa-visual-diff.mjs` — la página contra su diseño, sección a sección

La versión anterior comparaba un PNG de Figma contra la página y fallaba si el porcentaje de
píxeles distintos pasaba de un umbral. **Se midió, y no podía funcionar:** sobre el proyecto de
referencia dio **51,18%** con la página correcta.

Por dos motivos, y el segundo es el que mata la idea:

1. Un PNG de Figma y un navegador no dibujan el texto igual. Ese porcentaje mide hinting y
   suavizado, no diseño.
2. **En cuanto una sección mide diez píxeles de más, todo lo que va debajo cuenta como distinto.**
   Medido: la primera fila discrepante estaba en `y=24` y a partir de ahí, 92%. El número no dice
   si el diseño se respetó; dice cuánto se ha desplazado el contenido en vertical.

Así que la comparación útil no es de píxeles: es **de secciones**. Se renderizan el diseño
(`.dc.html` de Claude Design) y la página en el **mismo navegador**, y se miden las secciones:

```
    diseño  página       Δ   sección
        85       —   falta   Zafra Museo del Plátano El museo…
       625     557     -68 ✖ Tazacorte · Isla de La Palma…
       359     413     +54 ✖ «Mi abuelo cortaba en esta misma…
       195       —   falta   Zafra · Museo del Plátano [DIRECCIÓN]…
```

Eso es determinista, inmune al suavizado, y **señala dónde mirar**. En su primera ejecución
encontró que la barra de navegación y el pie del diseño no se habían implementado.

**Las secciones se emparejan por contenido, no por posición.** Emparejar por índice es tentador y
está mal: basta con que el diseño lleve una barra de navegación que la página no tiene para que
todo se desplace un puesto y el informe compare secciones que no tienen nada que ver. Pasó a la
primera. Se usa una subsecuencia común con parecido de bigramas sobre el texto de cada sección.

### Los tres modos, que no son equivalentes

| | Qué compara | ¿Sirve de puerta? |
|---|---|---|
| `--diseno <fichero.dc.html>` | diseño y página, mismo navegador | **Sí.** Es la puerta 4/5 |
| `--linea-base <png>` | la página contra una captura anterior de sí misma | **Sí**, para regresión. Umbral 0,1% |
| `--figma <key> <node>` | exporta el frame para mirarlo al lado | No. No calcula porcentaje a propósito |

---

## `qa-editor-check.mjs` — la única capa que ve el «Attempt Recovery»

La validación de bloques **no vive en REST ni en el marcado: vive en el JavaScript del editor**.
Un bloque puede pasar los dos linters, sobrevivir el round-trip byte a byte, y aun así abrirse
en WordPress con *«este bloque contiene contenido inesperado o no válido»*. El cliente entra a
editar su página y se encuentra eso.

Esta capa existía desde agosto y **no se había ejecutado nunca**. Al ejecutarla, el 2/09/2026,
encontró tres fallos reales en el marcado del proyecto de referencia. Ninguno lo veía ninguna
otra capa:

| | validate-blocks | audit-gb | round-trip REST | **editor real** |
|---|---|---|---|---|
| `text` con `tagName="blockquote"` | ✔ | ✔ | ✔ | **✖ inválido** |
| `query` sin etiqueta envolvente en el cuerpo | ✔ | ✔ | ✔ | **✖ inválido** |
| `looper` con clase base de más | ✔ | ✔ | ✔ | ✖ drift al guardar |

```bash
node herramientas/conversion/scripts/qa-editor-check.mjs   --sitio "<ruta app/public>" --puerto <N> --file pagina.html
```

### Sin contraseñas

La versión anterior pedía la **contraseña real de login** —la de aplicación no vale para el
formulario de wp-admin— y la escribía en un campo del navegador. Ahora no hace falta ninguna: se
le pide a WordPress que emita su propia cookie de sesión con `wp_generate_auth_cookie()` desde
wp-cli, y se le inyecta al navegador.

Son **tres** cookies, no una: wp-admin valida con la de `auth`, no con la de `logged_in`
(`auth_redirect()` mira `AUTH_COOKIE`), y va en dos rutas distintas. Es exactamente lo que hace
`wp_set_auth_cookie()`.

### Le pregunta al editor, no al DOM

La versión anterior buscaba `.block-editor-warning`, una clase CSS que cambia con cada Gutenberg.
Ahora se lee el estado del propio editor: `isValid === false` y `core/missing` **son** la
condición que dispara el aviso de recuperación.

Eso importa por un motivo concreto: cuando un bloque es inválido, **Gutenberg conserva su marcado
intacto**, así que al guardar no hay drift. Comprobado. La comparación de marcado sola nunca lo
habría visto.

### Usa el navegador que ya tienes

`playwright-core` sobre el Chrome instalado, con Edge de reserva: **14 MB**, y no descarga ningún
navegador. Se instala con `npm install` en la raíz del plugin; es la única dependencia de todo
esto.

---

## `wp-push-tokens.mjs` — lo que GeneratePress sí puede recibir

Reescrito el 2/09/2026. Lo que había fallaba en tres cosas:

1. **Leía un payload copiado a mano** (`tokens/generatepress-global-colors.json`): otro espejo
   del contrato que nadie mantenía. Ahora lee el `.tokens.json` directamente.
2. **Solo tenía el canal de abilities**, que aquí no funciona, y prometía en su documentación un
   respaldo que no existía. El canal por defecto pasa a ser **wp-cli**, que es el que funciona;
   abilities queda en `--via abilities`, con el diagnóstico medido en el mensaje de error.
3. **No tocaba el padding de contenido.** Ese sí era un hueco de fidelidad.

```bash
node herramientas/conversion/scripts/wp-push-tokens.mjs design/x.tokens.json   --sitio "<Local Sites>/<sitio>/app/public" --puerto <N> [--live]
```

Sin `--live` no escribe: enseña exactamente lo que haría, color a color.

### Lo que NO puede hacer, que también hay que saberlo

**GeneratePress no tiene dónde recibir una escala de espaciado ni un radio.**
`generate_spacing_settings` es un conjunto **fijo** de campos del chrome —padding de cabecera y
de contenido, anchos de barra lateral, padding de widgets—, todos números sueltos en px. No hay
un `--space-xl` que empujar. Así que «solo escribía colores» **no era un fallo del script**: es
la forma del tema. Lo que sí faltaba era conectar los campos que sí existen.

Por eso el mapeo es **explícito y por proyecto**, nunca por adivinación. En el contrato:

```json
"$metadata": {
  "wordpress": {
    "spacing": {
      "content_top": "core.space.xl",  "content_bottom": "core.space.xl",
      "content_right": "core.space.md", "content_left": "core.space.md"
    }
  }
}
```

Medido en el proyecto de referencia: el sitio tenía **128/32 px inventados** en el panel de
ajustes mientras el contrato decía otra cosa. Tras empujar, 96/32 salidos del contrato. Es el
tipo de desviación que no rompe nada y que nadie mira.

`nuevo-proyecto.js` ya genera ese mapeo, así que un proyecto nuevo nace con el chrome del tema
saliendo del contrato.

### Y esto sigue sin publicar el contrato

Los Global Colors dan la paleta al **editor**. WordPress los expone como
`--wp--preset--color--<slug>`, no como `--<slug>`. El contrato llega al navegador por el CSS que
encola el plugin del proyecto, y quien lo comprueba es `qa-contrato-publicado.mjs`. El script lo
recuerda por escrito cada vez que se ejecuta, porque confundir las dos cosas ya costó una tarde.

---

## Nivel 0: el contrato publicado

`qa-contrato-publicado.mjs` es nuevo, del 2/09/2026, y cubre un hueco que **ninguna de las otras
capas veía**: el validador mira el marcado, el round-trip mira lo que WordPress guarda, y la
puerta de calidad mira enlaces, imágenes y accesibilidad. Ninguno mira si lo que el marcado
*referencia* existe de verdad en el navegador.

Nació de dos fallos reales cometidos con dos semanas de diferencia, y son el mismo fallo:

| | Lo declarado | Lo publicado |
|---|---|---|
| Colores | 14 Global Colors empujados y verificados uno a uno | WP los expone como `--wp--preset--color--X`, no como `--X`. **0 definiciones reales** |
| Tipografía | `Fraunces` 16 veces, `Public Sans` 31 | **0 `@font-face`, 0 enlaces a Google Fonts.** Todo salía en Georgia |

**Declarar no es publicar.** Y ninguna de las dos cosas da error en ningún sitio: el navegador
coge otra cosa y calla.

```bash
node herramientas/conversion/scripts/qa-contrato-publicado.mjs <url-real> [--tokens x.tokens.css]
```

Descarga la página servida y todas sus hojas de estilo, y resuelve cada referencia:

- **Tokens** — cada `var(--x)` contra las definiciones reales. Distingue el que se usa **sin
  respaldo** (rompe, hace fallar la puerta) del que siempre lleva `var(--x, valor)` (degrada;
  se informa pero no bloquea, que es el caso de los internos de GP y GB).
- **Tipografía** — la primera familia de cada pila contra los `@font-face` que la página carga
  de verdad, incluidos los que vienen de la hoja de Google Fonts, que se descarga.
- **`--tokens`** — además, exige que el fichero de contrato entero esté publicado, no solo lo
  que esta página resulta usar.

Dos detalles que costaron un rato y que conviene no volver a pisar:

1. **Se compara el nombre completo, nunca por subcadena.** `--bg-page` "aparece" dentro de
   `--wp--preset--color--bg-page`: contar así fue lo que dio por buena una definición inexistente.
2. **Hay que decodificar las entidades del `href`.** WordPress escribe los `&` de una URL como
   `&#038;`; el navegador los decodifica y hay que hacer lo mismo, o se pide una hoja truncada.
   Falso positivo real: parecía que Public Sans no cargaba, y sí cargaba.

Verificado por regresión el 2/09/2026: desactivando el plugin del proyecto, la puerta cantó
**24 referencias sin resolver y las 2 familias**, con las cifras exactas (16 y 31). Reactivado,
sale limpia.

---

## Lo que NO se ha traído

De `figma-gb-pipeline` queda fuera todo lo que es proyecto y no herramienta:

- `METROPOLIS Design System-handoff/` — material de un proyecto
- `patterns/`, `pages/`, `tokens/`, `ai-requests/` — datos de ese proyecto
- `app/`, `bridge-plugin/`, `wp-cli-bridge/` — su interfaz y sus puentes propios
- `config.json` — su configuración

Cada proyecto de cliente crea los suyos en su propia carpeta.

---

## La trampa de las unidades relativas

Descubierta el 3/09/2026 cotejando la implementación con una captura de la web **real** pegada en
Figma. Es probablemente el hallazgo de fidelidad más rentable de todos, porque explica de golpe
desviaciones en cinco secciones.

**Un contrato escrito en `em`/`rem` no es portable si la raíz no forma parte del contrato.**

El diseño estaba escrito sobre una raíz de 16px. GeneratePress sirve **18px**. Resultado: cada
valor salía un **12,5% mayor** —padding de 72 donde el diseño dice 64, imágenes de 633 donde dice
563— y las secciones se desviaban entre 86 y 216 píxeles. Nada avisaba: la página se veía bien,
solo que no era el diseño.

**El contrato va en píxeles.** El mismo número significa lo mismo en el diseño, en Figma —que ni
siquiera tiene `em`— y en WordPress.

### Pero no todo `em` se convierte igual

Convertir en bloque multiplicando por 16 rompió otras tres secciones, y por un motivo que conviene
tener claro:

| Propiedad | Contra qué se mide `em` | Qué hacer |
|---|---|---|
| `padding`, `gap`, `width`, `height` | el font-size del elemento (normalmente 16) | a px |
| `max-width` de un **titular** | el font-size **de ese titular** (48, 60, 68…) | a px, pero multiplicando por SU tamaño |
| `letter-spacing` | el font-size del propio texto | **dejarlo en `em`** |

`max-width: 13.8125em` en un `h2` de 48px son **663px**, no 221. Multiplicarlo por 16 dejó tres
titulares a un cuarto de su ancho y el texto se partió en el triple de líneas.

Y `letter-spacing: -0.06em` en `em` es exactamente lo que se quiere: el ajuste óptico crece con la
letra. Pasarlo a px lo congela en el valor de un cuerpo de 16 y en un titular de 68 desaparece.

### El resultado, medido

| | Antes | Después |
|---|---|---|
| Secciones exactas al píxel | 0 | **5** |
| Secciones fuera de tolerancia | 4 | 2 |

**Cómo se detecta:** la puerta 4/5 (`qa-visual-diff.mjs --diseno`). Sin ella esto no se ve, porque
la página carga, valida y se sirve perfectamente — solo que con otras medidas.

---

## Site Header / Navigation — el header/menú YA NO se construye a mano

Hasta el 3/09/2026, un header con menú se convertía como un `element` genérico con `<ul><li>` y,
en el mejor de los casos, un `display:none` a un breakpoint elegido a mano — sin ningún menú
alternativo para tablet/móvil (medido en `WEB ACELIA/build/header.mjs`: el menú simplemente
desaparecía por debajo de 860px). GenerateBlocks Pro V2 tiene bloques dedicados para esto que
resuelven la parte móvil de fábrica, y ahora `emit.mjs` sabe emitirlos:

| Función | Bloque WP | Qué es |
|---|---|---|
| `siteHeader()` | `generateblocks-pro/site-header` | Contenedor que reemplaza el header por defecto de GP |
| `navigation()` | `generateblocks-pro/navigation` | El menú: `htmlAttributes` lleva `data-gb-mobile-breakpoint` y `data-gb-mobile-menu-type` (p.ej. `"full-overlay"`) — el comportamiento móvil lo resuelve GB en el front, sin JS propio |
| `menuToggle()` | `generateblocks-pro/menu-toggle` | El botón hamburguesa (icono SVG incluido, igual al que genera GB) |
| `menuContainer()` | `generateblocks-pro/menu-container` | El panel que agrupa lo que se muestra/oculta al abrir el menú — hijos con `className:"gb-menu-show-on-toggled"` / `"gb-menu-hide-on-toggled"` |
| `classicMenu()` + `classicMenuItem()` + `classicSubMenu()` | `generateblocks-pro/classic-menu(-item\|-sub-menu)` | Referencia a un **menú real de WordPress por ID** (`menu:"5"`). **Bloque dinámico**: no lleva HTML propio en `post_content` — WordPress renderiza el `<ul>/<li>` real en tiempo de render |

**Verificado byte a byte** contra un export real de WordPress (post 49656 "Site header ejemplo
Claude", patrón oficial de patterns.generatepress.com, leído del `post_content` vía wp-cli, no del
panel del editor) — ver el comentario largo en `emit.mjs` junto a cada función.

**De paso salieron dos bugs reales en código YA existente**, ambos corregidos y confirmados contra
el mismo export:

1. **Orden de clases**: `className` (el atributo "clases CSS adicionales" del panel de WP) va
   SIEMPRE al final, DESPUÉS del id class — nunca mezclado con `globalClasses`, que va ANTES. La
   función compartida `classList()` los trataba igual; ya no.
2. **`media()` no soportaba `linkHtmlAttributes`** (envolver la imagen en un `<a>`, típico del
   logo del header) aunque `canonical.mjs` ya reservaba el hueco en `KEY_ORDER` desde antes. Añadido.

**Una discrepancia NO adoptada, a propósito:** ese export trae `"styles":{}` explícito en dos
bloques `text` sin estilo propio. El corpus real de 742 bloques (`herramientas/corpus-gb/`,
calibrado abriendo el editor de verdad) dice que se omite por completo cuando no hay estilos. Un
solo pattern pegado no pesa lo mismo que 742 bloques calibrados con el editor — se deja como
estaba. Si algún día hace falta zanjarlo de verdad: abrir este mismo post en el editor real y ver
si lo conserva o lo limpia al guardar.

**Detección automática desde Figma (4/09/2026)**: `convert-frame.mjs` ya reconoce el frame de
navegación **por nombre de capa** —`nav`, `navbar`, `navigation`, `navegación`, `menú`— en primer
nivel de página, y lo convierte solo a esta estructura (misma que se validó a mano en ACELIA).

**"header" NO está en la lista, y es deliberado.** Medido contra las extracciones reales: en el
vocabulario de las librerías que usan estos diseños (Relume/Webflow), `Header / N` es una **sección
hero**, no la cabecera del sitio. Comprobado: `Header / 5 /` (home-4) y `Header / 30 /` (hero-01)
son titular + párrafo + botones; `Navbar / 9 /` (home-4) sí es el menú real (`Link One`…`Link Four`
+ Mega Menu). Con "header" en la lista, los heros se convertían en cabeceras con hamburguesa.

Dos detalles que costaron una pasada cada uno, ya resueltos:

- El grupo de escritorio **conserva el layout exacto del frame de Figma**, no una fila impuesta:
  `Navbar / 9 /` es VERTICAL (fila de contenido + mega menú debajo), y forzarle una fila horizontal
  ponía el mega menú *al lado* del contenido.
- El grupo de escritorio se oculta con su propio `@media (max-width:767px)`, no con
  `gb-menu-hide-on-toggled` (esa clase solo actúa sobre descendientes de `.gb-menu-container`).

Verificado end-to-end contra `home-4.node.json` (página real completa, 282 bloques, 0 errores y 0
avisos en los dos linters): publicada en WordPress real, el `navigation` sale con
`data-gb-mobile-breakpoint="767px"`, GB genera solo sus reglas de breakpoint, la hamburguesa queda
oculta en escritorio y el panel móvil aparece al activar el estado abierto.

---

## flex-wrap vs. grid — `convert-frame.mjs` ya no colapsa todo a flex-wrap

Hasta el 4/09/2026, cualquier fila de Figma salía siempre como `display:flex`, sin ninguna regla
responsive (el propio fichero lo avisaba: "un solo frame Desktop no define responsive... las
reglas Mobile/Tablet reales deben definirse aparte"). Vale para una fila de chips que envuelve de
forma natural, pero una cuadrícula real de tarjetas de igual ancho con flex no alinea columnas ni
colapsa en tablet/móvil.

**Dos rondas de medición, no un criterio elegido a priori:**

1. **Primera ronda** (contra `herramientas/corpus-gb/`, 742 bloques YA CONVERTIDOS, y
   `WEB ACELIA/home.mjs`, código a mano): la señal de partida fue
   `layoutMode:"HORIZONTAL" + layoutWrap:"WRAP"`, calcada del CSS de salida (`flexWrap:"wrap"`).
2. **Segunda ronda — la que manda, contra Figma de verdad**: 15 extracciones REALES de
   `C:\TRABAJOS\figma-gb-pipeline\extract\*.node.json` (proyectos de cliente ya extraídos con
   `figma-client.mjs`). **`layoutWrap:"WRAP"` no aparece NI UNA VEZ** en esas 15 extracciones —
   todas usan `"NO_WRAP"`. Los diseñadores no usan el wrap nativo de Figma para construir
   cuadrículas; arman filas fijas a mano (`home-1.node.json`: `"Row"` HORIZONTAL con 3 `"Card"`
   hijos DIRECTOS de 416px). Por eso el criterio real ya NO exige `layoutWrap:"WRAP"` — exige la
   estructura plana que sí ocurre en la práctica: **fila HORIZONTAL con 3+ hijos DIRECTOS de ancho
   uniforme (±2px) y ≥150px** (el umbral de 150px evita atrapar filas de iconos/chips/logos
   pequeños — cota práctica, no medida contra un corpus de iconos).

Sobre el ancho variable → flex: eso sigue viniendo de `WEB ACELIA/home.mjs` (chips de etiquetas).
Sobre las columnas y el colapso responsive (N → mitad en tablet `@media max-width:1024px` → 1 en
móvil `@media max-width:767px`, MISMOS breakpoints que `gbp-section`/`gbp-footer` en
`gbp-global-styles.mjs`): eso sigue viniendo del corpus de 742 bloques, primera ronda — la segunda
ronda solo corrigió CUÁNDO disparar el criterio, no CÓMO se ve el resultado.

**Caso real detectado y explícitamente NO resuelto**: varios extractos (`home-4/5/6/8/home3`)
arman una cuadrícula 2×2 vía anidamiento — una fila `"Blogs"` HORIZONTAL con solo 2 `"Column"`
hijos (632px), cada Column apilando 2 Cards VERTICAL. Con solo 2 hijos directos, el criterio (3+)
NO dispara ahí a propósito: aplanar esto a un grid de verdad significaría reescribir el árbol DOM
(sacar las 4 tarjetas de dentro de las 2 columnas y ponerlas como hijas directas de la fila), no
solo cambiar CSS — es un cambio de mayor riesgo, fuera de alcance sin confirmarlo antes. Se queda
en flex, exactamente como antes de este cambio.

Los hijos de un contenedor grid dejan de recibir `flexGrow`/`flexBasis` (no pintan nada en grid) y
en su lugar reciben `width:100%` para rellenar su celda, igual que ya hacían los hijos de un
contenedor sin flex.

**Excepción medida (primera ronda) y NO implementada a propósito**: una fila de 6 logos pequeños
del corpus se queda en 2 columnas en móvil en vez de bajar a 1 (`logos.html`) — items muy
pequeños, ya cubiertos en la práctica por el umbral de 150px de arriba, que los excluye del todo
del criterio de grid (se quedan en flex).

## Apilado en móvil — la versión móvil se INTERPRETA desde el Desktop

**Regla del usuario (4/09/2026, explícita)**: "normalmente son flex alineados en vertical en
versión móvil". Sus diseños no traen frames de móvil aparte —comprobado: las 23 extracciones reales
del histórico son todas de 1440px—, así que la versión móvil hay que interpretarla desde el
auto-layout del Desktop.

Ahora toda fila HORIZONTAL recibe `@media (max-width:767px) { flex-direction: column }`, **con un
guardarraíl medido**: solo si la fila de verdad no cabe en un móvil, es decir si la suma de anchos
de sus hijos + huecos supera 360px (ancho de contenido de un móvil real). Así una fila de 3 iconos
de 40px se queda en horizontal —apilarla sería absurdo— y una fila de 3 tarjetas de 416px se
apila. La medida sale del propio Figma.

No se tocan `alignItems` ni `justifyContent` al apilar: cambiarlos sería inventar intención de
diseño que el frame Desktop no expresa. Medido sobre `home-4.node.json` (página real completa):
23 filas reciben el apilado, y las que no llegan al umbral se quedan como estaban.

---

**Verificado contra Figma real, de principio a fin, el 4/09/2026**: se tomó la fila real
`"Row"` (3 Cards) de `home-1.node.json`, se convirtió con `convertFrame()`, pasó los dos linters
(`validate-blocks.mjs`, `audit-gb.js`, 0 errores/avisos), se publicó como post real en
`figma-staging` y se vio en el navegador — 3 columnas iguales, alineadas, con las 3 reglas
(base + 1024px + 767px) presentes en el CSS realmente servido. El post de prueba se borró tras
verificar.

**Pasado por el editor real el 4/09/2026** (`qa-editor-check.mjs`, la única capa que ve el
«Attempt Recovery»), sobre las tres funciones nuevas a la vez —navegación nativa, grids y apilado
en móvil— y sobre el contenido vivo del proyecto de referencia:

| Qué | Bloques | Inválidos | Drift al guardar |
|---|---|---|---|
| `home-4.node.json` convertida entera (nav + 3 grids + 25 apilados) | 339 | 0 | ninguno |
| Elemento «ACELIA Site Header» (bloques Site Header/Navigation nuevos) | 31 | 0 | ninguno |
| Elemento «ACELIA Site Footer» | 31 | 0 | ninguno |
| Página «ACELIA Home» | 160 | 0 | ninguno |

Que los bloques Pro nuevos (`site-header`, `navigation`, `menu-toggle`, `menu-container`) carguen
en el editor sin marcarse inválidos y se re-serialicen idénticos confirma de la forma más fuerte
disponible que el orden de claves de `KEY_ORDER` y la canónica de `emit.mjs` son correctos: es
justo lo que ninguno de los dos linters ni el round-trip de REST podían garantizar.

Sigue sin probarse un caso con el umbral de 150px (grid) o de 360px (apilado) justo al límite.
