---
name: flujo-wordpress-generateblocks
description: Flujo de 8 fases para webs WordPress de cliente con GeneratePress + GenerateBlocks Pro V2 + ACF. Úsala en cuanto aparezca un proyecto WordPress de cliente (ayuntamiento, pyme), o si se menciona GeneratePress, GenerateBlocks, GB Pro, maquetar una home o una landing, patrones de bloques, o pasar un sitio a producción. Actívala sin esperar a que la pidan por su nombre.
version: 0.14.0
---

# Flujo WordPress + GenerateBlocks

Orden de prioridades del proyecto, y no es negociable: **velocidad → menos pasos → fiabilidad del
prototipo**. Cualquier propuesta que añada pasos tiene que justificarse contra esto.

El usuario se describe como **perfil no-desarrollador**: instrucciones paso a paso, el comando
exacto, explicado antes de ejecutarlo, sin jerga innecesaria. **Nunca inventes valores** —tokens,
breakpoints, IDs, rutas—: pregunta o compruébalo.

## Antes de nada: sitúa la fase

Pregunta o deduce en qué fase está el proyecto. No empieces a producir marcado si la fase 0 no se
ha hecho: es el error que costó caro en el proyecto Aridane.

## Punto de decisión obligatorio: qué tipo de conversión

**Pregúntalo siempre, en cuanto se vea que hay un diseño que llevar a WordPress.** No lo decidas
tú y no lo des por supuesto: condiciona la fase 2 (si hace falta hueco para el CSS en el tema hijo)
y toda la fase 4.

> ¿Qué tipo de conversión prefieres para esta página?
>
> **A · GenerateBlocks Pro V2** (la habitual) — llega estilada de una vez, sin instalar CSS.
> **B · Gutenberg nativo** — un solo CSS con tokens: cambiar un color cambia toda la página.

| | **A · GenerateBlocks Pro V2** | **B · Gutenberg nativo** |
|---|---|---|
| Al pegar solo los bloques | **ya estilada** | **sin estilos** hasta instalar su CSS |
| Pasos para verla puesta | 1 | 2 |
| Recolorear la marca | 124 HEX repartidos por 179 bloques | 1 token |
| Dependencia | requiere GB Pro activo | ninguna |

**Por defecto A**, que es la vía habitual del proyecto. Pero **si el cliente va a mantener o
reteñir la web, di lo de B antes de que elijan**: ahí el token gana de calle. Y si eligen A, pide
que los colores vayan como `var(--token)` en `styles`/`css`, no aplanados a HEX — eso cierra la
única desventaja real de A.

Cifras medidas contra un WordPress real: `docs/prueba-handoff.md`. El detalle operativo de la
importación, con sus dos trampas silenciosas, en [[importar-handoff-diseno]].

## Las 8 fases

| # | Fase | Lo que no puede fallar |
|---|---|---|
| 0 | **Bootstrap del WordPress vacío** (~10 min) | Va **antes** del diseño. Anota subdirectorio, breakpoint real de GP (768) vs GB (767), y carpeta de uploads. Sin estos datos el diseño se cierra a ciegas |
| 1 | **Diseño en HTML, handoff ya convertido, o Figma con variables** | **Regla revisada el 2/09/2026.** Antes decía "no partir de Figma", y era correcto **mientras el fichero no expusiera la paleta como variables**: sin ellas, leer Figma solo produce HEX aplanados. Ahora: partir de Figma **solo si** el fichero expone variables con nombre **y** existen plantillas de Code Connect. Es una comprobación, no una opinión: si la API devuelve `colors: []`, vuelve la regla anterior. Fijar el color como variables desde ya. **Aquí se pregunta el tipo de conversión** (ver arriba) |
| 2 | **Esqueleto** | `git init` en `wp-content/`, **tema hijo** con el contrato dentro (ver abajo), carpeta `/patterns/`. **CPTs: con ACF y solo si hacen falta** (ver abajo), con `acf-json/` activo. Y **exportar la configuración del tema**: no está en código (ver trampa 6) |
| 3 | **Repo** | Solo lo de la fase 2. Nunca core, `uploads/` ni plugins de terceros |
| 4 | **Generación de marcado, importación del handoff, o conversión desde Figma** | Imágenes **primero** con `wp media import --porcelain` para usar IDs reales. Color por clase CSS, jamás por el panel del bloque. Pasar el validador. Si el marcado ya viene hecho: `wp post create <fichero>`, **nunca** `wp_insert_post()` — ver [[importar-handoff-diseno]]. Si se convierte desde Figma, el toolkit está en `herramientas/conversion/` (ver su LEEME): `convert-frame` → `assemble.mjs` → **los dos** validadores |
| 5 | **Plantillas, noticias, CPT** | Los CPT ya están por código desde la fase 2; las secciones van a `/patterns` como PHP, no pegadas en la base de datos |
| 6 | **Animación con GSAP** | Va **después** de la fase 5, query loops ya montados. Animar antes y convertir luego a query loop rompe la animación. GB Pro no tiene animación por scroll: su panel Effects es solo hover/focus. Solo si el proyecto la necesita (igual que ACF): `node herramientas/animacion/instalar-gsap.js` instala una **biblioteca de clases ya lista** (`-reveal`, `-stagger`, `-words`, `-scroll-words`, `-zoom`, `-stack`, ver su LEEME), no una plantilla — animar una sección es poner la clase en el marcado, no escribir GSAP. Si hay una web de referencia, medirla primero con `herramientas/referencia/medir-referencia.mjs <url>` en vez de suponer el patrón (trampa 17/18); tras cualquier cambio en `wp/tema-hijo/`, `node herramientas/desplegar-tema.mjs --sitio "<...>"` (trampa 12). Si la biblioteca de clases no cubre el caso y hace falta escribir GSAP a mano (una animación fuera de las siete clases), consultar las skills oficiales vendorizadas — `gsap-scrolltrigger` para scroll, `gsap-core`/`gsap-timeline` para el resto — en vez de improvisar la API de memoria |
| 7 | **Puerta de calidad** | Contra staging con la **URL real**, subdirectorio incluido. Nunca contra un HTML local. Cadena de cinco puertas: `qa-run.mjs` (contrato publicado → validadores → round-trip → editor real → la página contra su diseño) más la skill `puerta-calidad-wordpress` |
| 8 | **Producción** | `wp search-replace --dry-run --skip-columns=guid` primero. Nunca editar URLs a mano. Reimportar la configuración del tema: el search-replace no la trae |

Detalle completo de cada fase, con las fuentes: `traspaso-2026-08-26/SETUP-RECOMENDADO.md` de este
plugin. El respaldo con nivel de confianza por afirmación está en
`traspaso-2026-08-26/investigacion/resultados-completos.md`.

## Nada de plugins de WordPress propios: todo al tema hijo

**Regla del usuario, explícita (4/09/2026): no quiere plugins de WordPress en sus proyectos.** Lo
que sea del sitio —contrato de diseño, CPTs, campos— va en el **tema hijo**, no en un plugin
propio. Hasta esa fecha este flujo prescribía lo contrario (CPTs en un plugin, por portabilidad);
la portabilidad de tema **no es un objetivo de estos proyectos**.

Cómo publicar el contrato desde el tema hijo, que es la parte con truco:

- **Frontend**: `wp_enqueue_style()` en `wp_enqueue_scripts` con prioridad 5, para ir antes que el
  CSS de GenerateBlocks, que es quien consume los `var(--token)`.
- **Editor**: por el **mecanismo nativo del tema**, no encolando a mano. GeneratePress declara
  `add_theme_support( 'editor-styles' )` y pasa su lista de hojas por el filtro
  **`generate_editor_styles`**; el tema hijo se añade ahí y WordPress lo carga en el lienzo con
  `add_editor_style()`. Verificable con
  `wp eval 'print_r($GLOBALS["editor_styles"]);'`.
  WordPress prefija esas hojas con `.editor-styles-wrapper`: para `:root { --token: … }` es
  inofensivo y de hecho es lo que se busca — el wrapper es ancestro de todos los bloques, las
  variables se heredan dentro del lienzo, y por eso aparecen en el panel «CSS Properties» de
  GenerateBlocks Pro.
- El CSS del contrato se **copia** al tema hijo desde `design/`; se sigue generando desde el JSON y
  no se edita a mano en ninguno de los dos sitios.

**Al cambiar el tema activo, comprueba lo que vive en `theme_mods`** (se guarda por tema, así que
no viaja del padre al hijo): `nav_menu_locations`, el logo, los widgets y el CSS adicional del
Personalizador (`custom_css_post_id`). `wp option get theme_mods_<tema> --format=json` antes y
después. Y si el WordPress está compartido con otro proyecto, recuerda que **el tema activo es
global**: el cambio afecta a todo el sitio.

### Y los CPT, con ACF — y solo si hacen falta

**Regla del usuario (4/09/2026):** los tipos de contenido **no se registran por código**. Se crean
con **ACF (Advanced Custom Fields, de WP Engine)**, que es además donde se rellenan sus campos.

**ACF se instala SOLO si de verdad hace falta un CPT.** No va en el esqueleto por defecto: un
proyecto de una landing o una home no necesita ninguno, y meterlo "por si acaso" es un plugin de
más. Es la única excepción a "nada de plugins de WordPress": ACF es de terceros y aporta la
interfaz de campos; lo que no se hace es escribir un plugin PROPIO.

Cuando toque:

1. Instalar ACF y crear el CPT desde su interfaz (registra CPT y taxonomías desde la 6.1).
2. Activar `acf-json/` en el tema hijo, para que la definición viaje con el repositorio y no se
   quede solo en la base de datos.
3. Los campos, en ACF. Nada de `register_post_meta()` a mano en paralelo: dos fuentes para lo
   mismo.

Caso real: el proyecto de referencia tenía un CPT registrado por código con **cero entradas** —una
pieza que no sostenía nada—. Se retiró en vez de migrarla. Antes de crear un CPT, comprueba que
alguien lo va a usar.

**Consecuencia asumida** (del contrato en el tema, no de los CPT, que ahora viven en ACF): cambiar
de tema deja el sitio sin los tokens hasta que se instale el tema hijo nuevo. Aceptado.

## Las dieciocho trampas ya pagadas

Todas verificadas en proyectos reales. No hay que volver a descubrirlas.

1. **Validar el marcado no detecta fallos del entorno.** Un fichero de bloques puede dar 0 errores
   sobre 179 bloques y tener 11 de 13 imágenes en 404 en producción, porque el WordPress vive en un
   subdirectorio. Comprobado: el validador da 0 errores sobre el fichero que estaba roto. De ahí
   que la fase 7 exista y sea obligatoria.
2. **GenerateBlocks resuelve a HEX literal el color elegido en su panel.** Confirmado por su propio
   soporte, incluso si el valor viene de theme.json. Si el color se elige bloque a bloque,
   "cambiar un color" deja de ser una edición. Siempre por clase CSS utilitaria.
3. **`wp media import` sin las extensiones `gd` y `exif` sube la imagen pero no genera los tamaños
   responsive, y no da ningún error.** Degradación silenciosa de `srcset`. Usa el envoltorio
   `herramientas/wp-cli/wp.cmd`, que ya las carga.
4. **La animación sobre query loops se rompe al cambiar el número de elementos.** Re-consultar el
   DOM y llamar a `ScrollTrigger.refresh()`; nunca una NodeList cacheada.
5. **Un desfase de breakpoint entre CSS y JS cuesta caro.** GP usa 768 y GB 767 por defecto: una
   sola fuente de verdad, anotada en la fase 0.
6. **Los Global Styles de GB Pro SÍ se pueden versionar** — el flujo dijo lo contrario hasta el
   28/08/2026 y era falso. Son el CPT `gblocks_styles`, expuesto en REST, con el selector en
   `post_title`, el orden de salida en `menu_order` y los estilos en `gb_style_data` (camelCase).
   Herramienta: `herramientas/global-styles.js`. **Y cambia cómo generar marcado**: si un componente
   se repite, defínelo como global style y emite los bloques con `globalClasses` en vez de estilos
   por bloque. Es lo que hace GB consigo mismo, y deja el marcado sin un solo HEX.
7. **La configuración del tema y la tipografía no viajan con el repo git: viven en la base de
   datos.** Verificado contra un WordPress real: en las opciones `generate_settings`,
   `generate_spacing_settings` y `generate_package_font_library`. El repo lleva el tema hijo, los
   CPT, `acf-json/` y `/patterns/`, así que el destino recibe la maqueta bien y la tipografía y los
   espaciados de fábrica. Hay script:

   ```
   node herramientas/config-tema.js exportar --path="<sitio>"                      (fase 2)
   node herramientas/config-tema.js importar --path="<sitio>"                      (informa, no escribe)
   node herramientas/config-tema.js importar --path="<sitio>" --confirmar          (fase 8, escribe)
   ```

   Exporta solo esas tres opciones; si encuentra otras `generate_*` las lista para que el usuario
   decida (`--incluir=`). **No las añadas por tu cuenta.** Al importar, sin `--confirmar` no
   escribe nada, y con `--confirmar` deja copia previa en `config-tema/copias-previas/`.

8. **Importar marcado por wp-cli deja el CSS de GenerateBlocks caducado.** GB no escribe los
   estilos en el marcado: los guarda en `uploads/generateblocks/style-<postID>.css` y lo rehace
   **al guardar desde el editor**. `wp post create` y `wp post update` no lo disparan. La página
   carga —con su estructura y su contenido— pero los bloques nuevos salen **sin estilo**, con la
   tipografía y los tamaños del tema. Medido: 95 bloques con `css` y **25 sin regla servida**.
   No lo ve ningún validador, ni el round-trip, ni el editor. Al final de la fase 4:

   ```
   node herramientas/gb-regenerar-css.mjs --sitio "<app/public>" --puerto <N> \n     --post <ID> --url <url> --marcado build/pagina.html
   ```

   **Y para el header/footer, `--elemento`, no `--post`.** Los Elementos de GeneratePress no
   tienen hoja propia: GB funde su CSS en el `style-<ID>.css` de la PÁGINA que los muestra. Con
   `--elemento <ID>` el script lee sus condiciones de visualización y resuelve él solo qué páginas
   regenerar (si le das el Elemento por `--post`, lo detecta y lo corrige avisando):

   ```
   node herramientas/gb-regenerar-css.mjs --sitio "<app/public>" --puerto <N> \n     --elemento <IDheader> --marcado build/header.html --post <IDpágina> --url <url> --marcado build/home.html
   ```

9. **Dos conversiones INDEPENDIENTES pueden generar el mismo `uniqueId`, y WordPress las fusiona
   en silencio.** `convert-frame` genera IDs deterministas a partir de un contador que arranca en
   0 cada vez. Si un Elemento GeneratePress reutilizable (header/footer) y la página que lo
   incluye se convierten en procesos Node **separados**, cada uno con su propio contador, pueden
   coincidir en el `uniqueId` de su enésimo nodo sin estilos propios. Es invisible en cada marcado
   por separado —cada uno valida y pasa el round-trip— y solo revienta cuando GenerateBlocks
   compila el CSS de la página real: compila por nombre de clase (`.gb-element-{id}`), y una regla
   pisa a la otra. Medido: el header de un proyecto perdía `justify-content` y `max-width` porque
   coincidía con el `uniqueId` de un componente de la home.

   **Arreglado de raíz el 3/09/2026**: `convertFrame()` namespaces el contador con el `id` del
   nodo Figma raíz por defecto (parámetro `namespace` para forzarlo a mano si hace falta). Cada
   frame Figma es un nodo distinto, así que dos conversiones independientes ya no comparten
   namespace y no pueden colisionar — sin que el proyecto de cliente tenga que acordarse de nada.
   El desplazamiento manual de contador (quemar N llamadas a `uid()` tras `resetUid()`) que se
   aplicaba antes en el proyecto cliente queda obsoleto.

10. **Un header de GB Pro sin bloque `classic-menu` no tiene menú móvil, y todo da verde.** GB Pro
    encola `classic-menu-style.css` **y `classic-menu.js`** solo cuando se renderiza un bloque
    `classic-menu` (`class-classic-menu.php`, `render_block()`). Sin él, el panel del overlay se ve
    en escritorio (segunda copia del menú, apilada) y la **hamburguesa no abre nada**, porque el JS
    que pone la clase `--toggled` no llega. Ningún validador lo ve: el marcado es correcto.

    **Regla:** un header con menú móvil lleva SIEMPRE un `classic-menu` apuntando a un menú real de
    WordPress (Apariencia → Menús; el id, con `wp menu list`). Los enlaces **no se escriben a mano**
    en el marcado. `buildSiteHeader()` de `convert-frame.mjs` exige la opción `menuId` y, si falta,
    avisa y cae a la conversión de contenedor normal.

    Corolario del mismo día: el `uniqueId` de `classic-menu-item`/`classic-sub-menu` **lo deriva GB
    del menú** (`mi`/`sm` + los 6 últimos del uniqueId del menú). Dejarles uno propio genera CSS
    con un selector que no existe y los estilos del menú no se aplican, en silencio. Se pasan como
    `itemStyles`/`subMenuStyles` a `classicMenu()`, que deriva los ids.

    Y para verificarlo: **pulsar el botón de verdad**. Simular la clase `--toggled` por JS tapó
    este fallo durante semanas. En este entorno `resize_window` no funciona; el ancho móvil se
    consigue con un `<iframe>` del mismo origen de 390px y clics de ratón reales.

11. **El `uniqueId` es posicional: mover o insertar una sección desplazaba TODAS las de detrás.**
    Hasta el 4/09/2026 `convertFrame()` compartía un solo contador para la página entera, así que
    reordenar dos secciones en Figma —o insertar una nueva en medio— cambiaba el `uniqueId` de
    todo lo que venía después, aunque no se hubiera tocado. Un cambio de maquetación de una línea
    salía como un diff de la página entera.

    **Ahora cada sección de primer nivel tiene su propio namespace** (`${namespace}/${id-de-figma}`
    en `convert-frame.mjs`; `resetUid("home/<nombre>")` por sección en scripts a mano como
    `build/home.mjs`). Reordenar, añadir o quitar una sección deja intactos los `uniqueId` de las
    demás — verificado con una página sintética y con ACELIA real (mismo conjunto de 160 ids tras
    reordenar). Detalle y la prueba en `herramientas/conversion/LEEME.md`.

    Lo que esto NO da: publicar solo un fragmento dentro de una página ya viva sin regenerar el
    resto. Sigue haciendo falta reconstruir y republicar la página entera — lo que cambia es que
    ese republicado ahora tiene un diff pequeño y localizado, no uno que parece tocarlo todo.

12. **Escribir en `wp/tema-hijo/` no publica nada: sigue sin copiarse al tema real de Local.**
    Verificado el 7/09/2026 en ACELIA. `instalar-gsap.js` (y cualquier edición manual de
    `functions.php` o `assets/` del tema hijo) escribe en la carpeta **versionada del repo**, no
    hay symlink con `wp-content/themes/<tema>/` dentro de `Local Sites/<sitio>/app/public/`. La
    instalación de GSAP del 4/09 se quedó tres días marcada como "hecha" en `ESTADO.md` sin que el
    sitio real tuviera ni el script encolado ni `assets/animations.js` — `node verificar.mjs` no lo
    detecta, porque no comprueba scripts encolados, solo el contrato de diseño y el marcado.

    **Regla:** después de tocar cualquier fichero de `wp/tema-hijo/` (no solo el contrato de
    diseño, que ya lo documentaba `acelia.tokens.css`), desplegarlo antes de darlo por publicado:

    ```
    node herramientas/desplegar-tema.mjs --sitio "<Local Sites>/<sitio>/app/public"
    ```

    Copia todo el árbol y pasa `php -l` sobre el `functions.php` ya copiado. Aun así, confirmar con
    `read_page`/JS en el navegador (`document.scripts`, no solo el DOM) que el script realmente se
    sirve, no solo que el fichero existe en disco.

13. **Una sección a sangre completa (full-bleed) no basta con `width:100%`.**
    Verificado el 7/09/2026 en Hedvig. GeneratePress envuelve TODO el sitio —cabecera incluida
    cuando no es un Elemento aparte— en `.site.grid-container`, con el ancho de "Container Width"
    del Personalizador (1400px de ejemplo). Una sección con `width:100%` hereda ESE ancho, no el
    del viewport: se queda con un margen blanco a los lados, con el fondo oscuro sin llegar a los
    bordes. Hace falta el truco clásico `width:100vw; position:relative; left:50%; right:50%;
    margin-left:-50vw; margin-right:-50vw` en la sección, **y además** quitarle `max-width` a
    `.site`/`.site-content`/`.entry-content` (inline, con `!important`: el Personalizador genera su
    propio CSS dinámico con más especificidad que un `.site-content` a secas).

14. **`sizes="auto"` de WordPress 6.7+ rompe imágenes `object-fit:cover` con `loading="lazy"`.**
    Verificado el 7/09/2026: una imagen de fondo con `object-fit:cover` y `width/height:100%` no se
    veía —parecía no cargar— con el hero completamente en blanco. WordPress añade su propio
    `sizes="auto, …"` a cualquier `<img loading="lazy">` (pensado para reducir CLS), y en Chrome
    eso puede fijar el ancho de LAYOUT de la imagen al de un candidato del `srcset` en vez del 100%
    que pide el CSS. Un `sizes` propio no basta: WordPress le antepone `auto,` igual. La salida es
    `loading="eager"` —el filtro solo se dispara con `lazy`— asumible en una landing de una
    pantalla; en una página larga, tocaría vivir con el `sizes` real o forzar la imagen fuera del
    filtro de otra forma.

15. **Un Elemento de GeneratePress necesita DOS metas, no una.** `_generate_block_type`
    (`site-header`, `site-footer`…) sin `_generate_element_type = block` **no se renderiza, sin
    ningún aviso** — ni error, ni el Element aparece en la página, aunque `_generate_element_display_conditions`
    esté bien puesto y `gb-regenerar-css.mjs` diga "el marcado no se renderiza en esta página".
    Verificado el 7/09/2026 en Hedvig; el ejemplo de ACELIA que sirvió de referencia debía llevar
    esta meta puesta a mano desde el editor, sin que quedara documentado.

16. **`overflow-x:hidden` va en `html`, no en `body`.** Necesario para recortar el desbordamiento
    horizontal que deja el truco de la sección a sangre completa (trampa 13) cuando hay barra de
    scroll vertical. Puesto en `body`, crea un contenedor de scroll PROPIO —por especificación,
    `overflow-y` pasa de `visible` a `auto` en cuanto `overflow-x` deja de ser `visible`— y la
    rueda del ratón deja de mover la página (el scroll pasa a vivir dentro de ese `body`, no en la
    ventana). En `html` recorta igual sin ese efecto secundario.

17. **Si hay web de referencia servida Y fichero de Figma, manda la WEB.** Verificado el 7/09/2026
    en Hedvig, y caro: la landing se construyó entera desde el Figma y salió con el titular
    equivocado en el Hero (el Figma pone ahí el que la web real usa en el CTA final), sin sección
    de CTA, sin footer (el Figma solo tiene la insignia de Framer), con el contenedor a 1280 en vez
    de 1120 y con seis tarjetas de la sección «Try it» reducidas a etiquetas sueltas. Nada de eso
    lo ve un validador: el marcado era válido y la página "parecía" bien.

    **Regla:** cuando el cliente da una URL de referencia, el Figma sirve para entender la
    intención, pero la fidelidad se mide contra la web servida. Y se MIDE, no se mira —con
    `herramientas/referencia/medir-referencia.mjs <url>` (nace de esta misma trampa, ver su
    entrada en `herramientas/LEEME.md`): en un comando da la paleta real, la escala tipográfica
    completa, contenedor y padding de cada sección, radios, paddings, y qué elementos tienen
    `opacity`/`transform`/`filter` puestos en línea — el estado inicial que dejan los motores tipo
    Framer antes de disparar el JS, y la pista de la trampa 18.

## Anotaciones de Figma: canal de instrucciones por sección

**Verificado el 7/09/2026.** El cliente/diseñador puede dejar una anotación de Dev Mode anclada a
una sección concreta de Figma, y Claude puede leerla — es el sitio correcto para la "referencia
real" que pide la fase 6 (animación), o cualquier nota que solo aplique a esa sección y no a la
página entera.

Requiere el MCP `plugin:figma:figma` **conectado y autorizado en esta sesión** (OAuth por
navegador, no un token permanente — se repite en cada sesión nueva si no queda cacheado). Si las
herramientas `use_figma`/`get_metadata` no aparecen, primero `mcp__plugin_figma_figma__authenticate`
y pedir al usuario que abra el enlace.

Para leerlas, un `use_figma` de solo lectura sobre el nodo o la página (las anotaciones pueden
estar en un nodo hijo, no en el frame raíz — recorrer con `findAll`):

```js
const node = await figma.getNodeByIdAsync('<nodeId>');
const conAnotacion = [node, ...node.findAll(() => true)]
  .filter(n => n.annotations && n.annotations.length > 0)
  .map(n => ({ id: n.id, name: n.name, annotations: n.annotations }));
return conAnotacion;
```

Esto es distinto de "Figma como fuente del marcado" (descartado, ver abajo): leer una anotación de
texto es una lectura puntual y barata, no extracción de árbol de nodos para generar bloques.

**Trampa 18, verificada el 7/09/2026 en Hedvig: leer la anotación no es lo mismo que ver la
animación.** Cuando la anotación da una URL de referencia ("mira cómo anima esta web"), la primera
versión de la fase 6 se escribió suponiendo el patrón más habitual (fundido + deslizamiento con
GSAP) sin entrar a esa URL — salió mal: la animación real de `hedvig.framer.website` en su sección
"Benefits" era apilamiento por **CSS puro** (`position:sticky`), sin una sola línea de GSAP.
**Regla:** cuando la anotación (o el usuario) da una referencia real, entrar a esa URL de verdad y
medirla — `node herramientas/referencia/medir-referencia.mjs <url>` da de una vez la lista de
elementos con `opacity`/`transform`/`filter` en línea (o su ausencia: sección "ANIMACIÓN" del
informe) y los `position:sticky`/`fixed` con su padre, que es justo lo que distingue "anima con
GSAP" de "es CSS puro" sin tener que scrollear a mano. Suponer el patrón "típico" de GSAP de este
flujo sin comprobarlo es exactamente el fallo que esta trampa registra.

## Descartado con fundamento — no volver a proponerlo

- **Figma como fuente del marcado.** El límite del MCP/REST se ata al plan del archivo del
  cliente, no al tuyo; la API de Variables exige Enterprise. Y habría que aplanar a literales
  igualmente. Como referencia visual, sí; como fuente, no.
- **GenerateCloud** ($99/año): solo renta gestionando muchos sitios con patrones compartidos.
- **theme.json en GeneratePress** (tema clásico): efecto real en frontend ambiguo hasta en la doc
  oficial. No construir nada encima sin verificarlo contra el sitio real.
- **WPCode para encolar scripts**: vive en la base de datos y no viaja entre entornos. Tema hijo.

## Vigencias con fecha de caducidad

- **WCAG 2.1 AA** es lo exigible hoy por el RD 1112/2018. EN 301 549 v4.1.1 (WCAG 2.2 AA) se
  esperaba en el DOUE hacia octubre de 2026: **comprobar la fecha actual** antes de cerrar una
  auditoría de accesibilidad.
- Litigio **ACF vs Secure Custom Fields** abierto (medida cautelar, no sentencia). Revisar antes de
  fijar ACF como dependencia a largo plazo.
- **WPackagist** pasó a WP Engine en marzo de 2026; relevante solo si se usa Composer.

## Skills hermanas

- `importar-handoff-diseno` — cuando el marcado **ya existe** y hay que meterlo en WordPress (fases 1 y 4)
- `generar-bloques-generateblocks` — al **producir** marcado de bloques (fase 4)
- `wp-cli-en-local` — para cualquier comando `wp` (fases 4, 7, 8)
- `puerta-calidad-wordpress` — antes de entregar o subir a producción (fase 7)
