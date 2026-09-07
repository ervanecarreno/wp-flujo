# ESTADO — flujo WordPress + GenerateBlocks

> **Fuente de verdad del estado del proyecto.** Al retomar, lee esto primero: ni el README ni la
> memoria de Claude Code lo sustituyen. Actualízalo al cerrar cada sesión de trabajo.

**Última actualización:** 7/09/2026.

---

## Cerrado el 7/09/2026: trampa 17 — la animación de una anotación se comprueba en la URL, no se supone

La primera versión de la fase 6 en Hedvig (ver más abajo) leyó la anotación de Figma ("mira cómo
anima `hedvig.framer.website`") pero no entró a esa URL — asumió el patrón GSAP más habitual del
flujo (fundido + deslizamiento) y salió mal: el usuario corrigió que había que ver la web real. Se
entró de verdad, se hizo scroll y se midió con `getComputedStyle` mientras se cambiaba
`window.scrollTo`: la sección "Benefits" de esa web no usa GSAP en absoluto — es apilamiento por
CSS puro (`position:sticky`, tarjetas sin hueco entre ellas, cada una tapando a la anterior por
orden del DOM). Corregido en Hedvig y documentado como trampa 17 de la skill (0.10.0→0.11.0):
cuando una referencia da una URL, se entra a esa URL y se mide, no se supone el patrón típico.

## Cerrado el 7/09/2026: primera landing real completa (Hedvig), cuatro trampas nuevas (13-16)

ACELIA se descartó (era una prueba, palabras del usuario) y se limpió por completo de
`figma-staging` (páginas, Elementos, menú, medios, tema — vía wp-cli, uno por uno). En su lugar se
montó **Hedvig**, una landing de 8 secciones completa a partir del fichero de Figma de la anotación
(`hyAMxyeACYAZF32olj6sZU`), primera vez que el flujo se corre de principio a fin sobre un diseño
real de Figma sin handoff previo: contrato medido nodo a nodo por MCP (sin variables con nombre en
el fichero, así que el color va aplanado), imágenes descargadas con `download_assets`, marcado
íntegro a mano con `emit.mjs`, header/footer como Elementos de GeneratePress, y la animación GSAP
de la anotación (fase 6) aplicada a las 3 tarjetas reales de "Benefits". `node verificar.mjs`
completo en verde. Detalle en `WEB HEDVIG/ESTADO.md`.

**Cuatro trampas nuevas, verificadas de verdad contra el sitio (13-16 de la skill, 0.9.0→0.10.0):**
secciones a sangre completa dentro de GeneratePress (necesitan el truco 100vw **y** quitarle
`max-width` a `.site`, no solo `width:100%` en la sección); `sizes="auto"` de WordPress 6.7+
rompiendo imágenes `object-fit:cover` con `loading="lazy"` (arreglo: `eager`); un Elemento de
GeneratePress que no se renderiza —sin ningún aviso— si le falta `_generate_element_type=block`
además de `_generate_block_type`; y `overflow-x:hidden` en `body` en vez de `html`, que le da a
`body` su propio contenedor de scroll y la rueda del ratón deja de mover la página.

## Cerrado el 7/09/2026: primera animación GSAP real, y trampa nueva (doce)

Prueba real de principio a fin en `WEB ACELIA` (Local WP `figma-staging`): la anotación de Figma
leída antes (ver la entrada de MCP más abajo) apuntaba a `hedvig.framer.website` como referencia de
animación. Se implementó esa animación —fundido + deslizamiento por scroll, con `GSAP`+
`ScrollTrigger`— en la sección "Expertise" de ACELIA (la más parecida en forma a la sección
"Benefits" de la anotación), publicada y verificada contra el sitio real: `node verificar.mjs`
completo en verde tras el cambio.

**Trampa 12, nueva en la skill (0.8.0→0.9.0):** `wp/tema-hijo/` de un proyecto es la carpeta
versionada del repo, no el tema activo de Local — no hay symlink. `instalar-gsap.js` había escrito
GSAP ahí el 4/09, pero nunca se copió al tema real; la fase 6 de ACELIA llevó tres días marcada
como "hecha" sin que el sitio sirviera el script, y `node verificar.mjs` no lo detecta (no
comprueba scripts encolados). Corregido en ACELIA copiando `functions.php` y `assets/` al tema de
Local. Documentado en la skill y en la cabecera de `instalar-gsap.js`.

## Cerrado el 7/09/2026: MCP de Figma conectado, y anotaciones de Dev Mode como canal de instrucciones

**El MCP de Figma (`plugin:figma:figma`) ya conecta y autoriza** desde esta máquina — el
`docs/rutas-de-conversion.md` del 28/08 lo daba por no disponible; ya no es cierto. La conexión es
por OAuth **por sesión** (`mcp__plugin_figma_figma__authenticate`, enlace en el navegador), no un
token que quede guardado entre sesiones.

**Probado de verdad:** el usuario dejó una anotación de Dev Mode en la sección "Section - Benefits"
del fichero `hyAMxyeACYAZF32olj6sZU` ("Prueba de animaciones"), y se leyó literal con `use_figma`
(`node.annotations`, recorriendo con `findAll` porque la anotación no estaba en el frame raíz sino
en una sección hija). Contenido real, no simulado: un saludo de prueba con un enlace de referencia
de animación GSAP.

Documentado como capacidad del flujo, no como caso puntual: sección nueva "Anotaciones de Figma:
canal de instrucciones por sección" en la skill `flujo-wordpress-generateblocks` (0.7.0→0.8.0), y
la fase 6 de su tabla ya la referencia como tercera opción de "referencia real" junto a Smart
Animate y una URL. `docs/rutas-de-conversion.md` actualizado con la corrección de disponibilidad
del MCP, dejando claro que no cambia la conclusión sobre Variables/extracción de marcado — es un
canal distinto y más barato (lectura puntual de un nodo, no extracción de árbol).

---

## Cerrada el 2/09/2026 la puerta 4/5, y una trampa mayor por el camino

### La puerta visual no podía funcionar como estaba

Comparaba un PNG de Figma contra la página y fallaba por porcentaje de píxeles. **Medido: 51,18%
con la página correcta.** Dos motivos, y el segundo mata la idea:

1. Un PNG de Figma y un navegador no dibujan el texto igual: eso mide hinting y suavizado.
2. **En cuanto una sección mide diez píxeles de más, todo lo que va debajo cuenta como distinto.**
   La primera fila discrepante estaba en `y=24`, y a partir de ahí, 92%. El número no dice si el
   diseño se respetó: dice cuánto se ha desplazado el contenido.

Reescrita para comparar **secciones**, no píxeles: se renderizan el `.dc.html` de Claude Design y
la página en el **mismo navegador** y se miden las alturas en orden. Determinista, inmune al
suavizado, y señala dónde mirar. En su primera ejecución encontró que la barra de navegación y el
pie del diseño **no se habían implementado**.

Las secciones se emparejan **por contenido, no por posición** (subsecuencia común con parecido de
bigramas). Emparejar por índice está mal y se vio a la primera: una sección de más al principio
desplazaba todo el informe.

El diff de píxeles se sigue produciendo, pero como material para mirar. Y hay un tercer modo,
`--linea-base`, que sí es una puerta por porcentaje: misma página, mismo motor, umbral 0,1%.

### La trampa: importar por wp-cli deja el CSS caducado

Buscando por qué el testimonio medía 112px contra los 359 del diseño apareció algo bastante peor,
y afecta a **todo el flujo**:

**GenerateBlocks no escribe los estilos en el marcado.** Los guarda en
`uploads/generateblocks/style-<postID>.css` y lo rehace **al guardar desde el editor**.
`wp post create` y `wp post update` no lo disparan.

Y falla de la peor manera: **la página carga**, con su estructura y su contenido, pero los bloques
nuevos salen sin estilo, con la tipografía del tema. Medido en la landing: **95 bloques declaraban
`css` y 25 no tenían regla servida**; la cita salía en Manrope de 18px en vez de Fraunces de 36.

No lo ve ninguna otra capa, y no por descuido: el marcado es correcto, el round-trip devuelve lo
mismo que se envió, el editor genera su CSS al vuelo, y los tokens resuelven — lo que falta es la
**regla que los usa**.

Herramienta nueva: **`herramientas/gb-regenerar-css.mjs`**. Y una octava trampa en la skill.

**El detalle que cuesta encontrar:** `generateblocks_dynamic_css_time` parece un rompe-cachés
—es el `?ver=` del enlace— pero en el código de GB es un **limitador de frecuencia**
(`if ( 5 <= ( $current_time - $last_time ) )`). Ponerlo a «ahora» hace lo contrario de lo que uno
espera: GB se niega a escribir cinco segundos y la página sale **sin nada** de CSS. Me pasó al
primer intento. Hay que **atrasarlo**.

Tras regenerar, el testimonio pasó de 112 a 413px.

### Estado de la cadena

Las cinco puertas se ejecutan. La 4/5 informa de **6 desvíos de altura y 2 secciones del diseño
sin implementar** en la landing: diferencias reales entre el diseño de Claude Design y lo
construido, acumuladas en el paso Figma → código. Es el primer informe de fidelidad de verdad que
da este flujo.

Plugin en **0.10.0**.

---

## Ejecutado por primera vez el 2/09/2026: `qa-editor-check.mjs`

La capa que ve el **«Attempt Recovery»** existía desde agosto y **no se había ejecutado nunca**.
Al ejecutarla encontró **tres fallos reales** en el marcado del proyecto de referencia, y ninguno
lo veía ninguna otra capa:

| | validate-blocks | audit-gb | round-trip | **editor real** |
|---|---|---|---|---|
| `text` con `tagName="blockquote"` | ✔ | ✔ | ✔ | **✖ inválido** |
| `query` sin etiqueta envolvente en el cuerpo | ✔ | ✔ | ✔ | **✖ inválido** |
| `looper` con clase base de más | ✔ | ✔ | ✔ | ✖ drift al guardar |

El primero estaba **publicado**: el testimonio de la landing salía roto para cualquiera que
abriera la página en WordPress. La validación de bloques vive en el JavaScript del editor, no en
REST ni en el marcado, y sin abrir el editor no hay forma de verlo.

**Reescrito, y en dos cosas de fondo:**

1. **Ya no pide contraseñas.** La versión anterior necesitaba la contraseña real de login —la de
   aplicación no vale para el formulario de wp-admin— y la escribía en un campo del navegador.
   Ahora WordPress emite su propia cookie de sesión con `wp_generate_auth_cookie()` desde wp-cli.
   Son **tres** cookies: wp-admin valida con la de `auth`, no con la de `logged_in`, y en dos
   rutas distintas.
2. **Le pregunta al editor, no al DOM.** Antes buscaba `.block-editor-warning`, una clase CSS que
   cambia con cada Gutenberg. Ahora lee `isValid === false` y `core/missing`, que **son** la
   condición del aviso. Y eso importa: cuando un bloque es inválido, Gutenberg **conserva su
   marcado intacto**, así que al guardar no hay drift. Comprobado. Comparar marcado nunca lo
   habría visto.

Usa `playwright-core` sobre el Chrome ya instalado —**14 MB**, sin descargar navegador—, la única
dependencia de todo el plugin.

### Lo que el editor enseñó sobre el emisor

`emit.mjs` llevaba desde agosto un comentario pidiendo esto: *«looper/loop-item se tratan como
text/shape por analogía, pero NO están calibrados contra un export real»*. Ya está calibrado, y
salieron **distintos entre sí**: `looper` va sin clase base, `loop-item` con ella.

Y una lección de método por el camino: **inferí dos veces y las dos me equivoqué.** Deduje de un
`loop-item` sin estilos del corpus que no llevaba clase base, y el editor lo desmintió. Antes,
construí tres pruebas con texto suelto dentro de un `element` y un `loop-item` —que es inválido
siempre— y saqué conclusiones de un experimento roto. Lo que decidió fue medir cada variante por
separado contra el editor real.

Cambios en `emit.mjs`: salvaguarda de etiquetas prohibidas (`blockquote`, medida), lista de
etiquetas válidas para `text` (287 bloques del corpus), etiqueta envolvente en el cuerpo del
`query`, `queryType` fuera —el editor lo descarta— y `looper` sin clase base.

**Resultado**: las tres páginas del proyecto de referencia pasan la cadena entera. 131 bloques,
0 inválidos, 0 drift. Y `qa-run.mjs` la ejecuta completa por primera vez, porque además resultó
que **nunca había funcionado en Windows**: construía las rutas con `URL.pathname` y salía
`C:\C:\TRABAJOS\…`.

Plugin en **0.9.0**.

---

## Reescrito el 2/09/2026: `wp-push-tokens.mjs`

Tenía tres cosas mal, y una de las tres resultó no ser lo que parecía.

1. **Leía un payload copiado a mano.** Otro espejo del contrato sin nada que lo sincronizara —
   la misma familia de fallo que el CSS. Ahora lee el `.tokens.json` directamente.
2. **Solo tenía el canal de abilities**, que aquí no funciona, y su documentación prometía un
   respaldo por wp-cli que no existía. El canal por defecto pasa a ser wp-cli; abilities queda
   en `--via abilities` y su mensaje de error lleva el diagnóstico medido.
3. **No escribía el padding de contenido.**

**Lo que resultó no ser un fallo:** «solo empuja colores». Comprobado leyendo un export real de
`generate_spacing_settings`: es un conjunto **fijo** de campos del chrome —padding de cabecera y
contenido, anchos de barra lateral, padding de widgets—, números sueltos en px. **GeneratePress
no tiene dónde recibir una escala de espaciado ni un radio.** El script no se quedaba corto: el
tema no da más. Lo que faltaba era conectar los campos que sí existen, y por mapeo explícito en
`$metadata.wordpress.spacing` del contrato, nunca por adivinación.

**El hueco de fidelidad real estaba ahí:** el proyecto de referencia tenía **128/32 px
inventados** en el panel de ajustes mientras el contrato decía otra cosa. Dos escalas de
espaciado en el mismo sitio y nada que las comparase. Tras empujar, y verificado releyendo la
base de datos: 96/32 salidos del contrato. `nuevo-proyecto.js` ya genera ese mapeo.

**Dos cosas más que salieron por el camino:**

- El aplanador del contrato estaba a punto de existir dos veces. Se sacó a
  `herramientas/lib-contrato.mjs`, que ahora usan `tokens-a-css.mjs` y `wp-push-tokens.mjs`.
  `tokens-a-css.js` pasó a `.mjs` para poder compartirlo; actualizadas todas las referencias.
- **Se cayó en la trampa que la propia skill `wp-cli-en-local` avisa:** el `--path` con espacios
  («Local Sites») partido por el shell, y wp-cli diciendo que en `C:/Users/David/Local/` no hay
  WordPress. Documentada en el código, esta vez con el porqué.

Plugin en **0.8.0**.

---

## Cerrado el 2/09/2026: los dos validadores, calibrados contra el corpus

La tarea llevaba abierta desde agosto —«unificar los dos validadores»— y se resolvió **midiendo**.

El criterio: `herramientas/corpus-gb/` son **25 exports reales de GenerateBlocks, 742 bloques**,
traídos de `figma-gb-pipeline` porque calibran herramienta, no proyecto. GB los produjo y GB los
acepta: **si una regla salta ahí, la regla está mal.** Y hay una segunda forma de estar mal,
saltar *igual* sobre los dos conjuntos, porque entonces no distingue nada. Herramienta nueva:
`herramientas/calibrar-validadores.mjs`, que normaliza por bloque y da veredicto por regla.

**Lo que midió:**

| | Errores falsos | Avisos sobre marcado válido |
|---|---|---|
| `validate-blocks.mjs` | **0** | 81 |
| `audit-gb.js` | **0** | **847**, en 6 categorías |

Ninguno producía errores falsos: como puertas, los dos eran seguros, y eso confirma la decisión de
conservar los dos. Pero las seis categorías de aviso saltaban a tasas **iguales o mayores** sobre
la salida del propio GB que sobre la nuestra. 847 avisos sobre marcado correcto no se leen:
enseñan a ignorar el informe.

**Dos reglas tenían arreglo real:** la de llaves sueltas de `dynamic-tag`, que confundía cualquier
declaración CSS con una etiqueta (125 falsos, 25 de 25 ficheros) y ahora exige un nombre de
etiqueta conocido; y la de `text` sin `content`, que avisaba aunque el bloque llevara hijos — y
que hubo que afinar **dos** veces, porque un `text` con solo un `<svg>` no está vacío y el corpus
tenía justo ese caso.

**Cuatro no lo tenían y bajaron a un tercer nivel, `nota`**, fuera del informe por defecto y
visible con `--todo`: `cuerpo`, `css≠styles`, `shape` y `enlace`. Igual la mitad `warn` de la
regla 2.6 de `validate-blocks.mjs`: su mitad `error` sí está validada (0 disparos sobre 742
bloques), pero la de selectores descendientes medía **quién escribió el fichero**, no si está
bien — nosotros alfabetizamos y GB no.

**Resultado: 0 disparos de los dos sobre los dos conjuntos, sin perder una sola detección real.**
Comprobado por regresión con marcado roto a propósito: escapado crudo, `htmlAttributes` como
array, `uniqueId` duplicado, `:hover` sin clave en `styles`, etiqueta de una llave y un `text` de
verdad vacío. Los seis siguen saltando. Y en ese mismo fichero se ve por qué siguen siendo dos:
`validate-blocks.mjs` fue el único que vio el `:hover`, y `audit-gb.js` el único que vio el
`uniqueId` duplicado y la etiqueta de una llave.

**Regla nueva del método:** una regla no entra por parecer razonable. Pasa por
`calibrar-validadores.mjs` y demuestra que distingue.

Plugin en **0.7.0**.

---

## Añadido el 2/09/2026: el flujo ya se reproduce en un proyecto nuevo

La pregunta era «¿cómo repito esto en un proyecto real: hago un plugin, una extensión, una app?».
La respuesta resultó ser que **no hay que construir nada nuevo**: `wp-generateblocks` ya es un
plugin de Claude Code, habilitado en los settings globales (`enabledPlugins`), y sus skills se
cargan solas en cualquier carpeta de la máquina. El método se reproduce solo.

**Lo que no se reproducía era el esqueleto del proyecto**, montado a mano tres veces. Y no es un
detalle de comodidad: los dos fallos de esta semana —los tokens que no llegaban al navegador y las
fuentes declaradas y no cargadas— eran los dos por una pieza del esqueleto que faltaba. Un arreglo
que vive en un checklist se olvida; uno que viene de fábrica, no.

**Tres piezas nuevas:**

1. **`herramientas/nuevo-proyecto.js`** — genera los 12 ficheros del punto de partida. El plugin
   de WordPress que emite **encola el CSS del contrato y las fuentes**, en frontend y en el editor,
   desde el primer minuto. Las dos lecciones vienen hechas.
2. **`herramientas/tokens-a-css.mjs`** — el CSS del contrato pasa a ser una **derivada** del JSON,
   no una segunda fuente. La cabecera del CSS del primer proyecto decía *«espejo exacto del JSON:
   si cambias uno, cambia el otro»*, y **ya habían divergido**: el JSON decía `Fraunces` y el CSS
   `"Fraunces", Georgia, serif`. La pila de respaldo es parte del contrato y estaba en un solo
   lado. `--verificar` dice en qué línea difieren.
3. **`verificar.mjs`** en cada proyecto — la cadena entera en un comando: contrato sincronizado →
   los dos validadores → round-trip → contrato publicado.

**Dos comandos** para no tener que recordar rutas: `/wp-nuevo-proyecto` y `/wp-verificar`.

**Y una distinción que faltaba en todo el flujo: hay tres desenlaces, no dos.**
`0` pasa · `1` **falla** · `2` **no se pudo comprobar** (el sitio parado, una credencial que falta).
Confundir el 2 con el 0 es entregar creyendo que la cadena pasó entera; confundirlo con el 1 es
parar la cadena por algo que no es un fallo de fidelidad. Ahora `qa-run.mjs` y `verificar.mjs`
siguen adelante, lo apuntan, y **cierran con «cadena INCOMPLETA»**. Antes de esto,
`qa-contrato-publicado.mjs` se estrellaba con un volcado de pila cuando el sitio de Local estaba
parado.

`qa-contrato-publicado.mjs` entra además como **paso 0/5 de `qa-run.mjs`**, y va primero a
propósito: si los tokens o las fuentes no resuelven, el resto de las puertas da verde sobre una
página que se ve mal.

Plugin en **0.6.0**.

---

## Añadido el 2/09/2026: la puerta que faltaba — «declarar no es publicar»

Segunda revisión de `C:\TRABAJOS\figma-gb-pipeline`, buscando qué más mejora la **fidelidad de
la conversión**. Resultado: el código útil ya estaba promovido, pero **el método no lo ejecutaba**,
y faltaba una capa entera.

**Lo que sí faltaba: `herramientas/conversion/scripts/qa-contrato-publicado.mjs`** (nuevo).

Comprueba sobre la página **servida** que cada `var(--token)` del marcado tiene definición real y
que cada familia tipográfica declarada tiene un `@font-face` que la cargue. Node, sin
dependencias, un segundo.

Existe porque el flujo cometió **el mismo fallo dos veces en dos semanas**, y ninguna capa lo vio:

| | Declarado y verificado | Lo que recibía el navegador |
|---|---|---|
| Colores | 14 Global Colors empujados, comprobados uno a uno | WP los expone como `--wp--preset--color--X`. **0 definiciones** de `--bg-page` y compañía |
| Tipografía | `Fraunces` ×16, `Public Sans` ×31 | **0 `@font-face`, 0 enlaces a Google Fonts.** Todo en Georgia |

Ninguna capa existente lo cubría, y no por descuido: el validador mira el **marcado**, el
round-trip mira lo que **WordPress guarda**, y la puerta de calidad mira **enlaces, imágenes y
accesibilidad**. Ninguno mira si lo que el marcado *referencia* existe en el navegador.

**Verificado por regresión**, no por argumento: desactivando el plugin del proyecto de prueba, la
puerta cantó **24 referencias sin resolver y las 2 familias**, con las cifras exactas (16 y 31);
reactivado, sale limpia. Distingue el token usado sin respaldo —que rompe— del que lleva
`var(--x, valor)`, que solo degrada.

Integrada como **paso 0** de la skill `puerta-calidad-wordpress` (ahora 0.2.0, seis pasos).

**Lo que la revisión también dejó claro:**

1. **`wp-roundtrip.mjs` es el árbitro para unificar los dos validadores.** No es un tercer linter:
   los dos existentes codifican una *creencia* sobre lo que WordPress hace al guardar; el
   round-trip **se lo pregunta**. Medido: con `>` y `&` crudos, WP devolvió `\u003e` — confirmó con
   sus propios bytes la regla 1.3 de `validate-blocks.mjs`. Cuando dos reglas discrepen, gana la
   que sobreviva al round-trip. Y sobre la landing real de la prueba: **0 drift en 95 bloques**,
   que valida de paso el orden canónico de claves de `canonical.mjs`.
2. **Dos entradas del LEEME describían mal su script.** `fidelity-check.mjs` no comprueba «color y
   tipografía»: comprueba `sizingH:FILL`, `clipsContent` y `textAlign`, y **solo funciona en la
   ruta `convert-frame`**, porque trabaja sobre sus `fidelityRecords`. En la ruta de autoría con
   `emit.mjs` —la que se usó en la prueba— no es aplicable. Corregido.
3. **`qa-editor-check.mjs` sigue sin ejecutarse y es el que más falta hará.** La validación real de
   GenerateBlocks (*«Attempt Recovery»*) vive en el editor JS, no en REST: ni los linters ni el
   round-trip la ven. Pide `playwright` y la contraseña de login real. **No instalado**; queda
   como la siguiente pieza a montar.

---

## Cerrado el 2/09/2026: la traducción Figma → GenerateBlocks, dentro del plugin

**La laguna que este documento reconocía —*"el plugin no cubre la traducción Figma →
GenerateBlocks, empieza cuando el marcado ya existe"*— queda cerrada.**

Promovido a `herramientas/conversion/` el toolkit que vivía en `C:\TRABAJOS\figma-gb-pipeline`:
11 módulos en `lib/` y 11 scripts. Node ≥18, sin dependencias salvo el diff visual.

**El motivo es de arquitectura, no de comodidad.** `figma-gb-pipeline` es un **proyecto**, con
remoto propio en GitHub y material de proyecto dentro. Un proyecto de cliente debe depender del
**plugin**, nunca de otro proyecto. Se detectó al plantear la web de la Fundación Santa Cruz de La
Palma: la ruta de conversión que se le iba a proponer la ataba a ese repo.

Solo se ha traído herramienta. Queda fuera todo lo que es material de proyecto —el handoff,
`patterns/`, `pages/`, `tokens/`, `app/`, `bridge-plugin/`—; cada cliente crea los suyos.

**Pieza clave que entra:** `lib/convert-frame.mjs`, que convierte un frame de Figma en bloques.
Con ella el flujo cubre por primera vez de Figma a WordPress sin salto manual.

**Los dos validadores conviven a propósito.** Enfrentados al mismo fichero real: los dos dan
**0 errores**; `audit-gb.js` da 23 avisos y `validate-blocks.mjs` 1. Ninguno domina — `audit-gb.js`
caza `shape` sin `html`, pero tiene un falso positivo (confunde declaraciones CSS con etiquetas
dinámicas: 5 de sus 23 avisos). Reparto: `validate-blocks.mjs` es el pre-check del pipeline,
`audit-gb.js` sigue siendo la puerta del método §8. Unificarlos queda como tarea abierta, con
método escrito.

Plugin a **0.5.0**.

---

## ⏭ LO SIGUIENTE (pendiente al retomar)

### 1. Decidir sobre las rutas de conversión (medido, falta decidir)

Comparadas las tres rutas contra un WordPress real. Informe: `docs/rutas-de-conversion.md`.

**El cuello de botella no es la herramienta: es que la paleta del diseño no existe como variables
en Figma** (la API devuelve `colors: []`). De ahí todo lo demás:

| Ruta | Fidelidad del color medida |
|---|---|
| 1 · Handoff (integrado ya en el plugin) | **exacta** — 47 elementos en `#EE743B` |
| 2 · MCP de Figma | **no disponible**: no hay MCP conectado ni en el registro |
| 3 · `figma-gb-pipeline` | tokens perfectos, **colores del tema equivocado** (0 elementos en naranja) |

**Lo que hay que decidir:** si se hace el mapeo de tokens que le falta al pipeline
(`scripts/wp-push-tokens.mjs` + `tokens/map.json`, que solo tiene `#ffffff` y `#000000`). Con ese
paso hecho, la ruta 3 da fidelidad exacta **y** un solo token para recolorear. Sin él, produce un
marcado impecable con la paleta equivocada, que es peor que aplanar a HEX porque parece correcto.

**Y una corrección que afecta al handoff:** escribe `styles` en kebab-case y GenerateBlocks lo
escribe en **camelCase**. Renderiza bien (GB usa `css` tal cual), pero si alguien abre uno de esos
bloques en el editor y lo toca, GB regenera el `css` desde `styles` y esas claves no son las que
espera. Hay que pedir camelCase a Claude Design.

Páginas de prueba levantadas en `figma-staging` (borrar cuando ya no hagan falta):
`/aridane-gb/` · `/aridane-nativa/` · `/ruta3-pipeline/` · `/ruta3b-pipeline-tokens/`

### 2. Probar `config-tema.js` de punta a punta

Sigue pendiente de ayer: necesita un WordPress con GeneratePress arrancado en Local. Lo escrito y
verificado hoy es la sintaxis, los argumentos, el puerto de MySQL y la detección del sitio parado.

```
node herramientas/config-tema.js exportar --path="<sitio>"
node herramientas/config-tema.js importar --path="<otro>" --confirmar
```

---

## Cerrado el 28/08/2026 (noche): los Global Styles, rescatados

**El flujo daba los Global Styles de GB Pro por no versionables. Era falso.** Comprobado
contra GenerateBlocks Pro 2.7.0: son el CPT `gblocks_styles`, **expuesto en la API REST**
(`rest_base: gblocks_styles`) y manejable por wp-cli.

| Dónde | Qué |
|---|---|
| `post_title` | el selector |
| `menu_order` | el orden de salida del CSS = la especificidad |
| `gb_style_css` | el CSS compilado de esa regla |
| `gb_style_data` | el objeto de estilos en camelCase, igual que `styles` de un bloque |

Herramienta nueva: **`herramientas/global-styles.js`**, exportar/importar **idempotente**
(compara la estructura del JSON, no la cadena; probado: 13 estilos, 0 cambios al reimportar).

**Y cambia cómo generar marcado.** Si un componente se repite, va como global style y el
bloque lleva `globalClasses` sin `styles` propios — que es lo que hace GB en sus exports, y
la razón de que la id-class no siempre esté. Deja el marcado **sin un solo HEX literal**.

Documentado en el método §7 bis, la fase 4 de `SETUP-RECOMENDADO.md`, la trampa 6 de la skill
del flujo y `herramientas/LEEME.md`. Plugin a **0.4.0**.

---

## Cerrado el 28/08/2026 (noche): el validador, recalibrado contra GB real

`herramientas/audit-gb.js` daba **714 errores sobre 732 bloques escritos por GenerateBlocks
mismo**. Eran suyos, no del marcado. Cuatro reglas equivocadas:

1. Comparaba `styles` con `css` sin convertir camelCase a kebab-case. GB escribe `styles` en
   camelCase (1423 claves frente a 75) y `css` en kebab (532 bloques, 0 en camel).
2. Exigía que `css` fuera una serialización exacta de `styles`. **GB no serializa: optimiza.**
   Colapsa longhands en shorthand, quita espacios de `rgba()` y `clamp()`. No es reconstruible.
   Ahora es aviso; con `--estricto` vuelve a ser error, para marcado propio.
3. Exigía la clase base `gb-<tipo>`: el 60% de los cuerpos reales no la lleva.
4. Exigía la id-class siempre: los bloques sin `styles` propios salen con `class=""`.

Además ahora lee **exports `wp_block` en JSON**, que es como GB exporta los patrones, y
recurre bien en las claves anidadas (`@media` dentro de un selector descendiente daba
`[object Object]`).

**Resultado: 0 errores sobre los 732 bloques de referencia.** Método §8 reescrito con las
cuatro reglas correctas y la tabla de claves anidadas.

---

## Cerrado el 28/08/2026 (tarde): el escapado, corregido del todo

**Corrección de la corrección de ayer, y esta vez leída del código del core.**

`serialize_block_attributes()` en `wp-includes/blocks.php` hace **seis** sustituciones:
`\\`, `--`, `<`, `>`, `&` y la comilla **ya escapada**. La distinción que lo decide todo: esa
última se aplica **solo a la comilla de dentro de un valor**; las **estructurales** del JSON se
dejan literales. Aplicarla a todas invalida el JSON y el bloque se guarda vacío.

Qué estaba mal y qué se ha hecho:

| | |
|---|---|
| La tabla de hasta el 27/08 | ambigua: leída al pie de la letra escapaba todas las comillas |
| La corrección del 27/08 | segura pero **no canónica** (4 sustituciones), y con el mecanismo equivocado: culpaba a `kses`, y en realidad es JSON inválido |
| Hoy | las seis del core, con la distinción explícita, y el historial escrito en `docs/metodo-generateblocks-v2.md` §3 |

**La verificación adversarial de la investigación original ya lo señalaba bien** (nota 63 de
`investigacion/resultados-completos.md`) y se pasó por alto al escribir la corrección del 27.

Además: `herramientas/audit-gb.js` **ya avisa** cuando el escapado no es el canónico
(`escapado-no-canonico`). No es error —el bloque funciona— pero al reguardar desde el editor
WordPress reescribe el marcado y el contenido cambia de bytes sin que nadie lo edite.

**Hallazgo nuevo de la prueba de pegado:** `wp_insert_post()` con el contenido tal cual **destruye
el escapado en silencio**. Espera el contenido escapado con barras y aplica `wp_unslash()`, así que
le quita la barra a todos los escapes unicode: 543 eliminadas en un fichero de 179 bloques, con el
JSON todavía válido y por tanto **sin un solo aviso**. La regla es importar con
`wp post create <fichero>`, que además no aplica `kses` y salva el SVG en línea. Escrito en la
fase 4 de `SETUP-RECOMENDADO.md` y en la skill de bloques.

Actualizado en: `docs/metodo-generateblocks-v2.md` §3, la skill `generar-bloques-generateblocks`
(checklist y explicación), fase 4 y erratas de `SETUP-RECOMENDADO.md`, los dos HTML publicados,
`audit-gb.js` y la memoria `leccion-colores-generateblocks`. Plugin a **0.1.3**.

---

### Cerrado hoy (28/08/2026)


- **La laguna de portabilidad de la configuración del tema, resuelta.** `herramientas/config-tema.js`
  exporta `generate_settings`, `generate_spacing_settings` y `generate_package_font_library` a JSON
  versionable y las reimporta en el destino. Exporta **solo esas tres**: lo demás que encuentra en
  la base de datos lo lista para que lo decida Javier, no lo asume. Importar exige `--confirmar` y
  deja copia previa.
- **`wp.cmd` ya resuelve el puerto de MySQL de Local** por la variable `WP_MYSQL_PORT`. Era el
  papelito suelto de ayer: Local da a cada sitio un puerto propio y sin eso wp-cli da "conexión
  denegada" aunque el sitio esté arrancado. `config-tema.js` lo saca solo de `sites.json`.
- **Hallazgo, con consecuencia real:** `wp core version` **lee un fichero, no la base de datos**,
  así que funciona igual con el sitio parado. La primera versión del script lo usaba como prueba de
  conexión, daba el sitio por bueno y luego reportaba las tres opciones como "no existen" — un
  falso negativo perfecto, del mismo tipo que los que este flujo existe para evitar. Ahora
  comprueba con `wp option get siteurl`. Documentado en `herramientas/wp-cli/LEEME.md`.
- **Las dos correcciones de orden, ya escritas en el flujo.** La del CPT por código en la fase 2 ya
  estaba; la de GSAP después de los query loops estaba implícita en la fase 6 y ahora es explícita
  también en la fase 5, donde se decide el orden de trabajo.
- Documentado en: fases 2, 5 y 8 de `SETUP-RECOMENDADO.md`, la skill
  `flujo-wordpress-generateblocks` (nueva trampa 6, y las fases 2/6/8 de su tabla),
  `herramientas/LEEME.md` (con la sección de `puerta-calidad.js`, que faltaba) y
  `herramientas/wp-cli/LEEME.md`. Plugin subido a **0.1.2** para que `/plugin` lo detecte.
- **La versión visual del flujo, al día.** `traspaso-2026-08-26/setup-recomendado.html` republicado
  con la configuración del tema en las fases 2 y 8, y el orden query loops → animación en la 5.
  Misma URL de siempre (no cambia el enlace):
  https://claude.ai/code/artifact/e0637e21-fdca-432a-b83e-133b1362bef4

### Sigue abierto, sin urgencia

- **`conversion/scripts/wp-push-tokens.mjs` no tiene el *fallback* que promete.** Su docstring
  describe una "estrategia dual" (abilities MCP, y si no, endpoint REST de opciones), pero solo la
  primera esta implementada, y ese canal no funciona contra WP 7.0. Hay que anadir la via wp-cli
  (`update_option('generate_settings', ...)`), que es la que funciono.

  **Medido con precision el 2/09/2026** contra `figma-staging` (WP 7.0, GeneratePress 3.6.1,
  plugin `mcp-abilities-generatepress` 1.1.24 activo): las abilities **si estan registradas** —
  `wp_get_abilities()` devuelve 49, incluida `generatepress/update-settings`. Lo que falla es la
  exposicion por REST: en el MISMO proceso y con el mismo administrador,
  `rest_do_request('/wp-abilities/v1/abilities')` devuelve solo 2, ambas de `core`. No es orden de
  carga, ni permisos, ni autenticacion. El plugin declara `Requires at least: 6.9`: probable cambio
  de contrato en el controlador REST de 7.0.
- **Dato nuevo para unificar los validadores.** En la misma prueba, un marcado con comillas dobles
  dentro del atributo `css` (pilas de fuente tipo `"Fraunces", Georgia, serif`) rompia el JSON del
  bloque: `validate-blocks.mjs` lo paro con 12 errores y **`audit-gb.js` dio 0 errores**. Sumado al
  caso inverso ya registrado (audit-gb caza `shape` sin `html`), queda confirmado que ninguno domina
  y que hay que pasar los dos hasta unificarlos.

- Las dos reglas de validador que la investigación recomienda y no están: fallar ante un HEX de
  marca literal, y comprobar contra un WordPress real que cada `wp-image-{ID}` existe.
- **Unificar los dos validadores.** Desde la promoción del 2/09 conviven `audit-gb.js` y
  `conversion/scripts/validate-blocks.mjs`. Método para resolverlo, no opinar: correr los dos
  contra el corpus de 732 bloques y quedarse con la unión de reglas verdaderas. Detalle y
  medición en `herramientas/conversion/LEEME.md`.
- El clic literal en el CSS Editor de GB Pro 2.6 desde la UI (el experimento usó la API REST, el
  mismo camino que usa el editor al guardar, pero no ese botón concreto).

---

## Qué es este repo

El flujo de trabajo definitivo para webs WordPress de cliente (GeneratePress + GenerateBlocks
Pro V2 + ACF), y las herramientas que lo hacen ejecutable. **No** es un proyecto de cliente
concreto.

## Dónde está cada cosa

| Ruta | Qué es |
|---|---|
| `traspaso-2026-08-26/SETUP-RECOMENDADO.md` | El flujo de 8 fases, sintetizado y accionable. **Empieza aquí.** |
| `traspaso-2026-08-26/investigacion/resultados-completos.md` | El respaldo: 7 temas, cada afirmación con fuente y verificación adversarial (130 KB) |
| `.claude-memory/` | Memoria persistente de Claude Code, versionada con el repo (ver más abajo) |
| `herramientas/` | Validadores Node sin dependencias: `audit-gb.js` (checklist §8), `audit-cross.js` (marcado vs CSS/JS/assets), `fix-gb.js` (generador, ojo a su constante `PEND`) |
| `docs/metodo-generateblocks-v2.md` | El método de referencia para generar bloques GB V2, con el checklist del §8 |
| `docs/AUDITORIA-aridane.md` | Caso de estudio: la auditoría que descubrió los fallos de entorno |
| `herramientas/global-styles.js` | Fases 2, 4 y 8: exporta e importa los Global Styles de GB (CPT `gblocks_styles`). Idempotente |
| `docs/rutas-de-conversion.md` | Las 3 rutas de conversión comparadas y medidas: handoff, MCP de Figma y figma-gb-pipeline |
| `docs/prueba-handoff.md` | Evidencia medida de la importación de un handoff: escapado, kses, fidelidad visual y las dos trampas |
| `docs/recorrido-proyecto-ejemplo.html` | Ejemplo trabajado: un proyecto ficticio de principio a fin, para ver cómo se interactúa con el plugin. Publicado en https://claude.ai/code/artifact/a607bb4e-69c8-40ef-87d9-282674329393 |
| `verificacion/roundtrip-escapado-wp.js` | Prueba que `var(--color)` sobrevive al escapado de WP |
| `skills/` | Las 5 skills del plugin (ver README) |
| `.claude-plugin/` | Manifiestos del plugin y del marketplace |
| `.claude/settings.json` | Hook `Stop`: versiona la memoria automáticamente |
| `herramientas/commit-memoria.sh` | El script del hook. Defensivo: calla si no hay cambios o no es un repo |
| `herramientas/wp-cli/` | `wp.cmd` y `php.cmd`: usan el PHP y wp-cli que trae Local, sin instalar nada. Ver su LEEME |
| `herramientas/puerta-calidad.js` | Fase 7: comprueba URLs rotas y peso de imagen contra el servidor real |
| `herramientas/config-tema.js` | Fases 2 y 8: exporta e importa la configuración del tema y la tipografía, que viven en la base de datos y no viajan con el repo |
| `config-heredada/` | Config de Claude Code de la máquina anterior, como referencia (sin secretos, verificado) |

## Estado actual

La **investigación está cerrada**: los 7 temas tienen investigación y verificación adversarial.
Lo que queda no es investigar, es convertir el documento en herramienta.

Decidido el 27/08/2026: se empaqueta como **plugin de Claude Code que contiene skills**, no como
una skill suelta. Motivo: lo que se perdió al cambiar de máquina no fue el texto (la skill de
cuenta se sincronizó sola) sino los *scripts*; y los hooks —capacidad exclusiva de plugin— son lo
único que puede hacer que validar no dependa de acordarse.

### Etapas

| # | Etapa | Estado |
|---|---|---|
| 1 | Retirar la skill de cuenta `web-para-wordpress` | **pendiente y es tuya**: no se edita desde el repo. Su descripción empuja a `theme.json` y ACF Blocks, contra la investigación, y ahora compite con las skills del plugin. Desactívala en la gestión de skills de la cuenta |
| 2 | Verificar `wp-cli` y `php` de Local WP | **HECHA** (27/08/2026) — PHP 8.2.29 y WP-CLI 2.12.0, con envoltorios propios en `herramientas/wp-cli/` |
| 3 | Recuperar el validador Node (`herramientas/`) | **HECHA** (27/08/2026) — recuperado, integrado y probado |
| 4 | Esqueleto del plugin | **HECHA** (27/08/2026) — `.claude-plugin/plugin.json` y `marketplace.json`, con la estructura verificada contra plugins reales |
| 5 | Skills del plugin | **HECHA** — 5 skills: flujo, importación de handoff (28/08), generación de bloques, wp-cli en Local y puerta de calidad. Sin duplicar los docs: apuntan a ellos |
| 6 | Puerta de calidad como script ejecutable | **HECHA** (27/08/2026) — `herramientas/puerta-calidad.js`, sin dependencias. Cubre los pasos 1 y 2 de los 5 |
| 7 | Hooks | **HECHA** (27/08/2026) — hook `Stop` en `.claude/settings.json` que commitea `.claude-memory` solo si cambió. Requiere reiniciar Claude Code una vez para que se cargue |
| — | `wp doctor` instalado | **HECHA** (27/08/2026) — fijado a la versión `2.3.0`, compatible con WP-CLI 2.12.0 |
| — | Experimento `var(--color)` en GenerateBlocks | **HECHA** (27/08/2026) — resuelto de extremo a extremo, con un bug de documentación encontrado y corregido de propina. Ver Hallazgos abajo |

### Bloqueos abiertos

Ninguno bloqueante. Condición operativa a recordar: los comandos de wp-cli que tocan la base de
datos exigen que el sitio esté **arrancado** en Local (*Start site*).

`wp doctor` **ya instalado** (27/08/2026). La rama `dev-main` exige WP-CLI ^3.0 y tenemos 2.12.0:
hubo que fijar la versión compatible con `wp package install wp-cli/doctor-command:2.3.0`, no la
última. Verificado: `wp doctor list` responde con las 16 comprobaciones disponibles.

Detectado al probarlo: pasar por `cmd //c "..."` desde Git Bash puede partir un `--path` con
espacios en argumentos sueltos (pasó de verdad con la ruta de "Local Sites"). Usar siempre
PowerShell para comandos de wp-cli contra un sitio real.

**El plugin instalado no se actualiza solo con `/plugin → Update`.** Detectado el 27/08/2026: el
menú compara por número de versión de `.claude-plugin/plugin.json`, no por contenido ni por SHA de
git. Con la versión sin cambiar, `Update` respondía *"already at the latest version"* aunque el
contenido real hubiera cambiado (pasó con el commit del bug de escapado). **Subir el `version` de
`plugin.json` en cada cambio real** a `skills/` o `herramientas/` para que `/plugin` lo detecte, y
recordar que además pide reiniciar Claude Code para aplicarlo.

### Hallazgos del 27/08/2026 (al integrar las herramientas)

- **`var(--color)` sí sobrevive de extremo a extremo — experimento RESUELTO.** Probado contra un
  WordPress real (figma-staging, sandbox puntual, ver más abajo): un bloque con
  `background-color:var(--color-x)` guardado vía REST (el mismo camino que el editor al pulsar
  "Actualizar") llega intacto hasta el CSS que GenerateBlocks genera de verdad en el frontend
  (`wp-content/uploads/generateblocks/style-{ID}.css`), sin aplanar a HEX. El color se sigue
  aplicando por clase CSS en el flujo por defecto (no cambia), pero ya no hay que evitar `var()`
  por miedo al escapado.
- **Bug encontrado y corregido: el quinto escape de comillas rompe el guardado real.**
  `docs/metodo-generateblocks-v2.md` §3 documentaba 5 escapes JSON, incluyendo `"` → `\u0022`.
  Con ese escape, el `kses` de WordPress no reconoce el comentario como bloque de Gutenberg
  legítimo y lo guarda VACÍO — `parse_blocks()` devuelve atributos vacíos, sin error visible.
  Con los **cuatro** escapes correctos (`\u002d\u002d`, `\u003c`, `\u003e`, `\u0026`) y comillas
  literales, el bloque sobrevive perfecto. `herramientas/audit-gb.js` nunca exigió el quinto
  escape, así que el validador siempre fue correcto — el error estaba solo en la documentación
  (ya corregida en `docs/metodo-generateblocks-v2.md` §3 y §8, en la skill
  `generar-bloques-generateblocks`, en la memoria `leccion-colores-generateblocks`, y con un
  addendum fechado en `traspaso-2026-08-26/investigacion/resultados-completos.md`).
- **Metodología del experimento**, por si hay que repetirlo: sitio `figma-staging` (de
  figma-gb-pipeline, usado como sandbox puntual con permiso explícito del usuario — un post de
  prueba creado y borrado, sin tocar ficheros ni git de ese proyecto). Conectar wp-cli exige el
  puerto MySQL específico del sitio (`\AppData\Roaming\Local\sites.json`, campo
  `services.mysql.ports.MYSQL`; en este caso 10011) vía
  `php -c php.ini -d mysqli.default_port=<puerto> wp-cli.phar ...` — el `php.ini` del plugin no
  lo sabe porque cada sitio usa un puerto distinto. Para simular el guardado del editor sin tocar
  credenciales: `wp eval-file` con `wp_set_current_user(1)` + `WP_REST_Request` +
  `rest_do_request()` en el propio proceso de wp-cli, contra el mismo endpoint que usa Gutenberg.
  El diagnóstico decisivo fue `parse_blocks($post->post_content)`: atributos vacíos = el JSON no
  decodificó, sea cual sea el motivo.
- **El validador da 0 errores sobre el fichero que estaba roto en producción.** Ejecutado contra
  el HTML v1 de Aridane (el de las 11 imágenes en 404): 0 errores / 42 avisos. No es un fallo del
  validador — es la demostración de que valida CONTENIDO, no ENTORNO, y de por qué la fase 7 tiene
  que existir. Define exactamente qué deben añadir las dos reglas nuevas.

### Descartado (no volver a perseguirlo)

- **Proyecto Aridane**: era una prueba. Lo único reutilizable son los scripts de `herramientas/`
  y el checklist de 10 reglas de `AUDITORIA.md`.
- **`figma-gb-pipeline`** (en `C:\TRABAJOS`): otro proyecto, sin relación con este flujo.
- **Figma como fuente del marcado**: descartado con fundamento; ver la memoria
  `decision-saltar-figma`.

## Separación de proyectos

En `C:\TRABAJOS` conviven **dos proyectos sin relación**, y no deben mezclarse:

| Carpeta | Proyecto | Git |
|---|---|---|
| `wp-flujo` | **este**: flujo WordPress + GenerateBlocks | git local, **sin remoto por decisión del usuario** |
| `figma-gb-pipeline` | otro: pipeline Figma → GeneratePress/GB. Contiene `METROPOLIS Design System-handoff` | git propio con remoto en GitHub |

**Nunca abrir Claude Code en `C:\TRABAJOS`**, solo en la carpeta del proyecto. Cada carpeta tiene
su silo de memoria nombrado por su ruta; abrir en la raíz crea un tercer silo que contamina los
dos. Ocurrió entre el 21 y el 26/08/2026 y se limpió el 27/08/2026.

`_archivo/` guarda lo que no es de ningún proyecto.

## Cómo retomar en una máquina nueva

La ruta de trabajo **tiene que ser exactamente `C:\TRABAJOS\wp-flujo`**. La carpeta de memoria de
Claude Code se nombra a partir de la ruta, así que una ruta distinta deja la memoria huérfana —
fue exactamente lo que pasó el 27/08/2026.

1. Copia la carpeta `wp-flujo` **completa** (incluido su `.git`) a `C:\TRABAJOS\wp-flujo` en la
   máquina nueva. No hay remoto git —decisión del 27/08/2026—, así que el traslado es una copia
   de carpeta, no un `clone`. El historial y la memoria viajan dentro.
2. Enlazar la memoria (junction, no necesita permisos de administrador):

   ```powershell
   $m = "$env:USERPROFILE\.claude\projects\C--TRABAJOS-wp-flujo"
   New-Item -ItemType Directory -Force -Path $m | Out-Null
   New-Item -ItemType Junction -Path "$m\memory" -Target "C:\TRABAJOS\wp-flujo\.claude-memory"
   ```
3. Abrir Claude Code en `C:\TRABAJOS\wp-flujo` y decir *"lee ESTADO.md y la memoria"*.

Al terminar de trabajar: `git add -A && git commit`. Sin remoto, no hay `push` — eso lleva proyecto
**y** memoria dentro del propio commit, listo para copiar la carpeta a otra máquina.
