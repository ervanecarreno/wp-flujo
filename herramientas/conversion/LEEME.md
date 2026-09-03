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
| `emit.mjs` | Emisores canónicos de GB V2: `element`, `text`, `media`, `shape`, `linkButton`. `CLASS_MODE` configurable |
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
| `qa-visual-diff.mjs` | 7 | Diff visual. **Requiere `playwright`, `pixelmatch` y `pngjs`** |
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
