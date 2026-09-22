---
name: flujo-wordpress-generateblocks
description: Flujo de 8 fases para webs WordPress de cliente con GeneratePress + GenerateBlocks Pro V2, dentro del protocolo de colaboración A/B de COMO-TRABAJAMOS.md. Úsala en cuanto aparezca un proyecto WordPress de cliente (ayuntamiento, pyme), o si se menciona GeneratePress, GenerateBlocks, GB Pro, maquetar una home o una landing, patrones de bloques, o pasar un sitio a producción. Actívala sin esperar a que la pidan por su nombre.
version: 0.22.0
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
| 2 | **Esqueleto** | `git init` en `wp-content/`, **tema hijo** con el contrato dentro (ver abajo), carpeta `/patterns/` y **`wp/mu-plugins/`, que nace con el proyecto aunque esté vacío** — si no, la mitad de B acaba en `functions.php` por inercia. **CPTs: por código ahí, y solo si hacen falta; antes, comprueba si la jerarquía de páginas ya lo da** (ver abajo). Y **exportar la configuración del tema**: no está en código (ver trampa 6) |
| 3 | **Repo** | Solo lo de la fase 2. Nunca core, `uploads/` ni plugins de terceros |
| 4 | **Generación de marcado, importación del handoff, o conversión desde Figma** | Imágenes **primero** con `wp media import --porcelain` para usar IDs reales. Color por clase CSS, jamás por el panel del bloque. Pasar el validador. Si el marcado ya viene hecho: `wp post create <fichero>`, **nunca** `wp_insert_post()` — ver [[importar-handoff-diseno]]. Si se convierte desde Figma, el toolkit está en `herramientas/conversion/` (ver su LEEME): `convert-frame` → `assemble.mjs` → **los dos** validadores |
| 5 | **Plantillas, noticias, CPT** | Los CPT ya están por código desde la fase 2; las secciones van a `/patterns` como PHP, no pegadas en la base de datos |
| 6 | **Animación con GSAP** | Va **después** de la fase 5, query loops ya montados. Animar antes y convertir luego a query loop rompe la animación. GB Pro no tiene animación por scroll: su panel Effects es solo hover/focus. Solo si el proyecto la necesita (igual que los CPT): `node herramientas/animacion/instalar-gsap.js` instala una **biblioteca de clases ya lista** (`-reveal`, `-stagger`, `-words`, `-scroll-words`, `-zoom`, `-stack`, ver su LEEME), no una plantilla — animar una sección es poner la clase en el marcado, no escribir GSAP. Si hay una web de referencia, medirla primero con `herramientas/referencia/medir-referencia.mjs <url>` en vez de suponer el patrón (trampa 17/18); tras cualquier cambio en `wp/tema-hijo/`, `node herramientas/desplegar-tema.mjs --sitio "<...>"` (trampa 12). Si la biblioteca de clases no cubre el caso y hace falta escribir GSAP a mano (una animación fuera de las siete clases), consultar las skills oficiales vendorizadas — `gsap-scrolltrigger` para scroll, `gsap-core`/`gsap-timeline` para el resto — en vez de improvisar la API de memoria |
| 7 | **Puerta de calidad** | Contra staging con la **URL real**, subdirectorio incluido. Nunca contra un HTML local. Cadena de cinco puertas: `qa-run.mjs` (contrato publicado → validadores → round-trip → editor real → la página contra su diseño) más la skill `puerta-calidad-wordpress` |
| 8 | **Producción** | `wp search-replace --dry-run --skip-columns=guid` primero. Nunca editar URLs a mano. Reimportar la configuración del tema: el search-replace no la trae |

Detalle completo de cada fase, con las fuentes: `traspaso-2026-08-26/SETUP-RECOMENDADO.md` de este
plugin. El respaldo con nivel de confianza por afirmación está en
`traspaso-2026-08-26/investigacion/resultados-completos.md`.

## El aspecto va al tema hijo. El comportamiento va a un mu-plugin

**Regla vigente desde el 22/09/2026, fijada por el protocolo de colaboración A/B (diseñador/
desarrollador) del flujo — ver `COMO-TRABAJAMOS.md` en la raíz del plugin, que es el documento que
rige esto.** Reemplaza la regla del 4/09/2026 de abajo, que decía lo contrario para los CPT.

El reparto es por **quién es dueño de qué**, no por "menos plugins es mejor" a secas:

- **El aspecto** —el contrato de diseño, lo que se ve— va en el **tema hijo**. Es lo que entrega
  A (diseñador): la especificación congelada por Figma, convertida en bloques.
- **El comportamiento y el modelo de contenido** —tipos de contenido, **campos**, reglas de qué
  plantilla se aplica a qué, integraciones— van en un **mu-plugin** del propio proyecto. Es lo que
  entrega B (desarrollador). Un mu-plugin no es un plugin de terceros: es código del proyecto, tan
  versionado como el tema hijo, que WordPress carga siempre y que no aparece en la pantalla de
  Plugins para desactivarlo por accidente.

**Son dos despliegues, no uno.** `desplegar-tema.mjs` para el tema hijo y `desplegar-mu-plugins.mjs`
para la otra mitad, cada vez que se toca. Una carpeta versionada no es una carpeta cargada, y con el
mu-plugin no hay ni pantalla de plugins donde echarlo en falta.

Lo que se sigue prohibiendo, igual que antes: instalar un plugin de terceros para algo que es
código de un renglón (Code Snippets para una función, un plugin de CPT por interfaz para un tipo
de contenido). Eso sigue yendo a código, ahora en el mu-plugin en vez de en el tema hijo — separar
aspecto de comportamiento es precisamente lo que evita que el tema hijo termine cargado de lógica
que no es suya.

<details>
<summary>La regla anterior (4/09/2026 – 22/09/2026), por si hace falta el porqué de un proyecto
que aún la siga — click para expandir</summary>

**Regla del usuario, explícita (4/09/2026): no quiere plugins de WordPress en sus proyectos.** Lo
que sea del sitio —contrato de diseño, CPTs, campos— va en el **tema hijo**, no en un plugin
propio. Hasta esa fecha este flujo prescribía lo contrario (CPTs en un plugin, por portabilidad);
la portabilidad de tema **no es un objetivo de estos proyectos**.

</details>

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

### Y los CPT, en el mu-plugin — y solo si hacen falta

**Regla vigente desde el 22/09/2026:** los tipos de contenido se registran **por código, en el
mu-plugin del proyecto** (`register_post_type()`, `register_taxonomy()`). Es tarea de B
(desarrollador) — ver `COMO-TRABAJAMOS.md`. No hace falta ACF para esto, y es a propósito: el
código ya es la fuente portable, sin una capa intermedia (`acf-json/`) que mantener sincronizada.

**Un CPT se registra SOLO si de verdad hace falta.** No va en el esqueleto por defecto: un
proyecto de una landing o una home no necesita ninguno, y registrar uno "por si acaso" es lógica
de más que nadie usa. Sigue vigente el caso real que motivó esto: el proyecto de referencia tenía
un CPT registrado por código con **cero entradas** —una pieza que no sostenía nada—. Se retiró en
vez de migrarla. Antes de crear un CPT, comprueba que alguien lo va a usar.

**Y antes de eso, comprueba si la jerarquía de PÁGINAS ya lo da.** Medido el 22/09/2026 sobre un
caso real —una plantilla para «todos los contenidos internos» de un sitio, que hasta la propia
anotación de Figma pedía como CPT—: las tres cosas que la plantilla necesitaba salían gratis de las
páginas jerárquicas, y el CPT solo añadía un problema.

| Lo que necesita una plantilla de sección | Páginas jerárquicas | CPT |
|---|---|---|
| URL anidada `/seccion/<slug>/` | de fábrica | hay que fijar **una** base de reescritura, la misma para todas las secciones |
| Migas de pan | `get_post_ancestors()` | hay que construir la jerarquía aparte |
| Pestañas de la sección | hermanas en el menú o en el árbol | igual, pero sin árbol si no es jerárquico |

El CPT gana cuando hay **muchas entradas del mismo tipo con campos propios** (noticias, fichas,
eventos) o hace falta archivo, feed o taxonomías. Para un puñado de páginas de contenido editorial,
no. **El mu-plugin hace falta igual aunque no haya CPT**: los campos personalizados y las reglas de
qué plantilla se aplica a qué son modelo de contenido, y ese es su sitio.

Cuando toque:

1. `register_post_type()` / `register_taxonomy()` en el mu-plugin, colgado de `init`. Sin
   herramienta de terceros de por medio: es el mismo patrón para cualquier proyecto, sin depender
   de qué tenga instalado el WordPress de destino.
2. Los campos, con `register_post_meta( …, ['show_in_rest' => true, …] )` en el propio mu-plugin
   —para que aparezcan en el editor de bloques nativo sin plugin adicional— o con un metabox
   clásico si la edición lo pide. Una sola fuente para cada campo, en código.
3. **Si el proyecto de verdad necesita una interfaz de campos más rica que lo nativo** (repetidores,
   campos condicionales, una edición compleja), ACF sigue siendo una herramienta válida para ESO
   —los campos—, pero declarada en PHP con `acf_add_local_field_group()` dentro del propio
   mu-plugin, nunca creada desde su interfaz gráfica: así el campo vive en el mismo sitio que el
   CPT que lo usa, en código, sin `acf-json/` ni nada que solo exista en la base de datos. El CPT
   en sí nunca depende de ACF para registrarse.

**Consecuencia asumida** (del contrato en el tema, no de los CPT, que ahora viven en el
mu-plugin y no dependen del tema activo): cambiar de tema deja el sitio sin los tokens hasta que
se instale el tema hijo nuevo. Aceptado.

## Clases BEM propias: `wpf-bloque__elemento--modificador`

**Añadido el 22/09/2026.** Sirve para lo que el marcado de GB no da: un asidero estable.
GenerateBlocks identifica cada bloque con un hash —`gb-element-7042abea`— que no dice qué es y
que cambia si el bloque se regenera. Así que cuando hay que apuntar a un bloque desde fuera (un
snippet, una animación de GSAP, una prueba de Playwright) no hay a qué agarrarse, y lo que se
acaba haciendo es inventar una clase a mano para ese caso — es literalmente lo que pasó con el
`gb-year-item` del carrusel de la cronología (trampa 23). Esto lo convierte en convención.

Importa sobre todo por el reparto A/B de `COMO-TRABAJAMOS.md`: **A entrega los bloques y B pone
el comportamiento encima**, sobre marcado que no ha escrito él. Sin asidero estable, B no tiene
por dónde agarrar.

**La convención**, BEM de manual con prefijo `wpf-` (de wp-flujo):

| | Ejemplo |
|---|---|
| Bloque | `wpf-sumate-apoya` |
| Elemento | `wpf-sumate-apoya__panel` |
| Modificador | `wpf-sumate-apoya__panel--claro` |

El prefijo va en minúsculas y con guion, no como `WPflujo_`: un `_` suelto se confunde de un
vistazo con el `__` de BEM, y el resto del ecosistema ya va así — `gb-` y `gbp-`, que además usa
BEM en sus propias clases (`gb-accordion__toggle-icon`). Ser el tercero de la misma familia se lee
mejor que introducir una cuarta forma.

**La línea que no se cruza: estas clases NO llevan estilos.** Los `gbp-*` (Global Styles de GB
Pro) sí los llevan y van por `globalClasses`; los `wpf-*` son solo un asidero semántico y van por
`className`. Si un `wpf-` empezara a pintar, el valor dejaría de salir del diseño para salir de la
clase, que es justo lo que la regla de los Global Styles prohíbe. Corolario práctico: **no crees un
Global Style llamado `wpf-algo`**, porque entonces una clase que solo nombraba pasaría a pintar sin
que nadie lo pidiera.

**Van por `className`, nunca sueltas en el marcado.** Una clase presente en el HTML pero ausente de
los atributos, el editor la adopta como `className` propio al guardar: drift en el primer guardado
del cliente (ya está medido en `classList()` de `emit.mjs`). Comprobado el 22/09/2026 con
`qa-editor-check.mjs` sobre una sonda de diez casos —element, text, shape y media, con y sin
estilos, con `globalClasses`, con dos clases a la vez—: el editor las acepta todas y re-serializa
idéntico. El orden resultante es `[base] [globalClasses] [gb-tipo-id] [className]`.

**Cómo se usa.** Para lo que el diseñador SÍ nombró, la fábrica de `lib/bem.mjs`:

```js
const b = bem("Súmate y apoya");
b()                  // wpf-sumate-apoya
b("panel")           // wpf-sumate-apoya__panel
b("panel", "claro")  // wpf-sumate-apoya__panel wpf-sumate-apoya__panel--claro
```

La slugificación está hecha para lo que sale de verdad de Figma en este flujo: nombres en español
con acentos, espacios y separadores tipo `·`. Quita acentos, tira palabras vacías y se queda con
tres palabras — `«Panel · Súmate y apoya»` → `panel-sumate-apoya`, `«La ciudad y sus valores»` →
`ciudad-valores`.

**Y para las capas sin nombre**, que son la mayoría —en la Home del proyecto piloto, 187 de 290
bloques, casi dos tercios—, `configurarBem({ auto: true })` deriva una clase del namespace de
sección que el build ya declara con `resetUid("home/hero")` más el rol del bloque:
`wpf-hero__fila`, `wpf-hero__titulo`, `wpf-hero__icono-2`. También trata como anónimas las capas
con nombre de relleno de Figma (`Frame 12`, `Group 3`).

**Desactivado por defecto**, y a propósito: actualizar el plugin no puede cambiar el marcado de un
proyecto ya montado. Verificado — con `auto` apagado, los cuatro ficheros del proyecto piloto
generan byte a byte idéntico.

> **El límite del automatismo, dicho claro:** las clases derivadas sirven para LEER el marcado, no
> para apuntar desde CSS o JS. El número de `__icono-2` depende de cuántos hermanos del mismo rol
> vayan antes, así que insertar un bloque puede correrlo y romper justo lo único para lo que
> servía. Si hay que agarrarse a algo de forma estable, **la capa se nombra en Figma** y se usa
> `bem()`, que depende del nombre y no de la posición. El sistema convierte nombres en clases; no
> puede inventar una estabilidad que el diseño no tiene. Dicho de otro modo: esto le da a A una
> razón concreta para nombrar las capas que B va a tener que tocar.

## Las treinta trampas ya pagadas

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

19. **CORREGIDA el 22/09/2026 — `icon` en `text()` SÍ funciona; el diagnóstico original era
    incorrecto.** Decía «no uses `icon`, mete el SVG en `content`». El fallo real no era el
    atributo: era la FORMA del HTML que el emisor generaba con él. Medido con `qa-editor-check.mjs`
    sobre cinco variantes aisladas del mismo botón: el editor exige que, en cuanto hay `icon`, el
    bloque deje de ser «raíz con su clase base `gb-text` + contenido suelto» y pase a ser DOS
    `<span>` hermanos dentro de la raíz —uno `.gb-shape` con el SVG, otro `.gb-text` con el
    texto— con la raíz misma SIN la clase base (solo la id-class). Es justo lo que declara el
    `block.json` real del bloque: `icon` tiene `"source":"html","selector":".gb-shape"` y
    `content` tiene `"selector":".gb-text"` — dos selectores distintos, ninguno puede ser el
    elemento raíz completo. El emisor antiguo ponía la clase base Y el content suelto (sin su
    span), y por eso fallaba siempre. Corregido en `emit.mjs`: `text()` ahora construye el HTML
    correcto en cuanto se le pasa `icon`, y ni `icon` ni `content` se serializan en el JSON —los
    deriva Gutenberg del cuerpo, igual que ya pasaba con `content` a secas. `iconLocation` sí va en
    el JSON cuando vale `"after"` (no tiene `source`, no se puede derivar del HTML).

    **Por qué compensa usarlo, en vez de seguir metiendo el SVG a mano en `content`:** `icon` es el
    atributo real del picker del bloque en el editor — con el SVG registrado en la **Icon
    Library** de GB Pro (`generateblocks_svg_icons`, ver la trampa 25 para su prima la Asset
    Library de formas), el icono queda seleccionable desde el panel visual sin tocar código. Un
    SVG metido a mano en `content` con una clase inventada (tipo `.mi-icono`) da el mismo
    resultado visual pero el editor no lo reconoce como icono — es solo texto.

20. **Los glifos Unicode de flecha (`↗ → ▶ ← ›`…) se pintan como EMOJI de color, no como texto.**
    Ninguna fuente tipográfica del proyecto suele traer esos puntos de código, así que el navegador
    cae a su fuente de emoji del sistema — sin avisar, y sin que ningún validador de bloques lo
    detecte, porque el HTML es válido. Se ve al mirar la página de verdad, no en el marcado. Ya
    estaba anotado para Figma («Jost no tiene ↗: los glifos van en Inter»); resulta que en el
    navegador el problema es el mismo pero la causa distinta (no es la familia tipográfica, es que
    NINGUNA familia de texto trae esos glifos). Regla: cualquier flecha o icono de un botón/CTA va
    en SVG inline con `fill="currentColor"` (hereda el color del texto), nunca como carácter.

21. **GB Pro oculta el icono de «cerrar» del menú móvil con un selector de especificidad CERO**
    (`:where(.gb-menu-toggle--toggled) .gb-menu-close-icon`). Verificado el 21/09/2026: al poner
    estilos propios en `.gb-menu-open-icon`/`.gb-menu-close-icon` de un `menuToggle()` (para
    convertir el hamburguesa de 3 líneas en el diseño real de 2 líneas dentro de un círculo), el
    icono de cerrar se quedaba visible A LA VEZ que el de abrir — la regla del plugin que lo oculta
    usa `:where()` precisamente para poder ser pisada por CSS de tema, y cualquier selector propio
    la pisa sin querer. Regla: si se tocan esos dos selectores, hay que declarar TAMBIÉN el
    conmutado completo en los estilos propios (`display:none` en el de cerrar por defecto,
    `&.gb-menu-toggle--toggled .gb-menu-close-icon { display:flex }` y su inverso para el de abrir)
    — no basta con estilar el aspecto, hay que asumir también la visibilidad.

22. **La paginación de `generateblocks-pro/carousel-pagination` no admite contenido propio dentro
    de cada viñeta, y su clase real no es la que parece.** Verificado el 21/09/2026 leyendo
    `carousel.php`/`carousel.js` del plugin: la viñeta la pinta Swiper en tiempo de ejecución con
    `bulletClass:"gb-carousel-dot"` (el marcado fuente solo trae un `<span
    class="gb-carousel-pagination-content">` vacío de plantilla) y la activa lleva
    `.gb-carousel-dot.is-active` — un selector como `.gb-carousel-pagination-item`, que suena
    razonable, sencillamente no existe y el estilo no se aplica nunca, sin error de ningún linter
    porque el fallo no está en el marcado. Y aunque se corrija la clase, **Swiper reescribe el
    contenido del contenedor en cada render**, así que no hay forma de meter un año, un número o
    cualquier otra cosa DENTRO del punto.

    **El patrón que sí funciona** (usado en Cronología de `WEB FUNDACION SC LA PALMA`, a
    petición explícita del usuario — «cuando los bloques de GenerateBlocks no lo puedan resolver,
    usa snippet de código y clases para apuntar»): deja que `carousel-pagination` siga poniendo los
    puntos (con la clase real, así seguir pulsándolos mueve el carrusel sin JS propio), y pinta lo
    que no cabe dentro del punto —años, números, lo que sea— como un snippet `wp:html` aparte, con
    su propia clase (`data-year-index`, `.is-active`…), sincronizado por un `<script>` de ~20
    líneas que:
      1. Lee la instancia del carrusel síncronamente por `elemento.gbCarousel` — propiedad que GB
         Pro asigna en el constructor, sin esperar a ningún evento de "listo" (confirmado en el
         bundle: `this.element.gbCarousel=this`).
      2. Se suscribe al evento público `gb-carousel:change`, que el carrusel dispara en cada cambio
         de diapositiva con `detail.activeIndex` — es la API pública documentada en el propio
         bundle (`dispatchEvent(new CustomEvent("gb-carousel:change",{detail:{activeIndex}}))`), no
         hay que adivinar nada ni engancharse a eventos internos de Swiper.
      3. Para navegar desde el elemento propio (p. ej. pulsar el año, no solo el punto):
         `elemento.gbCarousel.swiper.slideTo(indice)`.
    Dale al `carousel()` un `uniqueId` fijo y legible (no el hex aleatorio de `uid()`) para que el
    snippet lo encuentre por `[data-carousel-id="…"]` sin depender de un id que cambia en cada
    build. `validate-blocks.mjs` avisa (no da error) de que ese id «no tiene el formato hex de 8
    típico de GB» — es un aviso cosmético, esperado, no una señal de que algo esté mal.

23. **Empujar los Global Colors de un contrato nuevo a un WordPress con GeneratePress ya
    configurado dejó ~40 ajustes del tema apuntando a colores que dejaron de existir, y una parte
    de ellos no vive en ningún ajuste.** Verificado el 21/09/2026: `generate_settings` traía
    decenas de campos (`h1_color`, `link_color`, `form_button_background_color`…) escritos como
    `var(--contrast-2)`, `var(--accent)`, etc. — la paleta POR DEFECTO de GeneratePress, que un
    proyecto anterior en ese mismo WordPress había dejado puesta. Al escribir los 6 Global Colors
    del contrato con `wp-push-tokens.mjs`, esos nombres se quedaron sin definir: la página cargaba
    igual, sin ningún error, y el navegador simplemente no aplicaba esos colores.

    Hay DOS capas, no una:
      1. **Los ajustes de la base de datos** (`generate_settings`): se remapean por PAPEL, no por
         nombre — `base-3`→fondo, `contrast`/`contrast-2`→texto, `contrast-3`/`accent-2`→hover,
         `accent`→acento. Un script de `wp eval` que recorra `generate_settings` y haga `strtr()`
         con ese mapa lo resuelve en un minuto.
      2. **Los defaults CABLEADOS del propio tema**, que ninguna fila de la base de datos toca:
         `wp-content/themes/generatepress/inc/defaults.php` fija `text_color`, `form_text_color`,
         `search_modal_text_color`… a `var(--contrast)` como VALOR POR DEFECTO del ajuste, no como
         algo que se pueda sobrescribir por opción. Si el proyecto no define ese ajuste explícita-
         mente, GP sigue emitiendo `var(--contrast)` sin más. La única solución es declarar esos
         nombres como ALIAS de los tokens del contrato en el `style.css` del tema hijo
         (`:root { --contrast: var(--color-paper); --accent: var(--color-gold); … }`) — no son
         tokens nuevos, son el vocabulario que GP espera.

    Y una tercera cosa que agrava las dos anteriores: con `css_print_method: file` (el valor por
    defecto de GP), el CSS dinámico se cachea a fichero y **no se regenera solo** al cambiar
    `generate_settings` — hay que borrar a mano las opciones `generate_dynamic_css_output` /
    `generate_dynamic_css_cached_version` y el fichero cacheado, o pasar `css_print_method` a
    `inline` (se imprime en cada carga, siempre fresco, y se acaba esta clase de caché obsoleta de
    raíz). Lo cazó `qa-contrato-publicado.mjs`, que es exactamente para lo que existe: ninguna otra
    capa de QA mira si lo que el marcado referencia existe de verdad en el navegador.

    **Cuándo aplica:** cualquier WordPress que NO nace vacío para el proyecto — un sitio de Local
    reciclado, un cliente que ya tenía GeneratePress con su propia paleta. En un `nuevo-proyecto.js`
    de cero esto no pasa, porque no hay paleta previa que dejar colgada.

24. **Cuando el mismo contenido existe en el `.dc.html` de Claude Design Y en el Figma que se
    trasladó a partir de él, y el cliente ha seguido ajustando en Figma, manda FIGMA.** Fijado por
    el usuario el 21/09/2026 en `WEB FUNDACION SC LA PALMA`, con estas palabras: «creo en Claude
    Design, traspasamos a Figma, hago los ajustes e implementas desde el Figma los contenidos,
    colores, etc. El HTML es de apoyo». Es la misma familia que la trampa 17 (web real > Figma
    cuando ambos existen), con el orden invertido: aquí el `.dc.html` es el borrador y Figma el
    contrato final, porque es donde sigue habiendo trabajo humano después de la exportación.

    Verificado de forma cara en ese mismo proyecto: la primera pasada de una Home completa se
    escribió leyendo el `.dc.html`, y salió con copy desfasado (un antetítulo del hero mucho más
    corto que el real, dos palabras cambiadas en un párrafo), fondos de sección equivocados en dos
    bloques, todos los textos del pie en un color que ya no era el vigente, y sin los 3 iconos de
    redes sociales que el HTML nunca tuvo pero Figma sí. Ninguna de esas siete cosas la ve un
    linter de bloques: el marcado era válido, solo que decía otra cosa que la que el cliente había
    dejado escrita en Figma.

    **Regla:** el `.dc.html` sigue siendo la única fuente para lo que Figma no sabe expresar —
    `clamp()`, `flex-wrap`, breakpoints, comportamiento de nav/menú— porque Figma no tiene esos
    conceptos. Para todo lo demás —textos, qué color va dónde, qué elementos existen— se lee el
    fichero de Figma con `use_figma`, resolviendo el nombre de la variable enlazada de cada nodo
    (`figma.variables.getVariableByIdAsync`), no el HEX. Si Figma y el HTML discrepan en algo que
    ninguno de los dos «posee» en exclusiva, se pregunta antes de decidir por cuenta propia.

    **Lo que Figma NO puede dar, ni con REST**, y hay que sacar de otro sitio: assets binarios que
    no son un relleno de imagen del lienzo — un vídeo, por ejemplo. La API de Figma
    (`/v1/files/:key/images`) solo devuelve rellenos de imagen; un `videoHash` de un nodo no tiene
    endpoint de descarga. Para eso manda la **anotación de Dev Mode** del nodo (texto libre que el
    diseñador deja anclado), que en el caso verificado especificaba el fichero exacto, sus
    atributos de reproducción y que el fotograma visible en el lienzo es el póster del vídeo en un
    segundo concreto — dato que solo estaba ahí, en ningún otro sitio.

25. **Un `.svg` metido como bloque `media` (`<img src="…​.svg">`) congela su color y esconde
    desviaciones del contrato.** Un `<img>` no hereda `currentColor`: lo que el fichero lleve
    escrito dentro es lo que se ve, y no hay CSS que lo cambie. Peor: el HEX queda **fuera del
    marcado**, así que ningún linter lo mira — el bloque es válido, y el fichero es opaco para
    ellos. Descubierto por el usuario el 22/09/2026 en `WEB FUNDACION SC LA PALMA`, donde
    `logo-nav.svg` y `slogan-h1.svg` llevaban `fill="#FFFFFF"` — blanco puro, que **no es uno de
    los 6 colores del contrato** (el correcto es `--color-paper`, `#F5F0E4`). Llevaban semanas
    servidos así, con los dos linters en verde y la comprobación de contrato publicado también en
    verde, porque ninguna de las tres cosas abre el `.svg`. Se suman tres costes menores: obliga a
    permitir la subida de SVG (`safe-svg` + `--user=1` en `wp media import`), que es superficie de
    riesgo evitable; gasta una petición HTTP por icono; y con `loading="lazy"` cae de lleno en la
    trampa 14.

    **Regla: un SVG va en bloque `shape`, inline, con sus colores pasados a `currentColor`** para
    que hereden el token del contenedor. El bloque lo admite de fábrica: su `block.json` declara
    `"html": { "source": "html", "selector": ".gb-shape" }`, o sea que el SVG vive en el marcado y
    Gutenberg lo deriva de ahí (es la misma razón por la que `shape()` no lo escribe en el JSON del
    comentario).

    **La excepción es el peso**, y es un juicio, no un número sagrado: un SVG decorativo grande
    infla el `post_content` de cada página que lo use. En ese proyecto, `circulos-fondo.svg` pesa
    **199 KB** y se queda como `media`; los iconos (617 B – 1,7 KB) y las piezas de marca (logo
    44 KB, slogan 19 KB) van inline. Como orden de magnitud: por debajo de ~50 KB, inline sin
    pensarlo; por encima, mira cuánto pesa ya la página y decide. Un decorativo que además no
    necesita recolorearse es el candidato natural a quedarse como `media`.

    **Y antes de inyectar, catalóguialo: el SVG se registra primero en la Asset Library de GB Pro**
    (Dashboard → GenerateBlocks → Asset Library), en un grupo propio del proyecto. Así el cliente
    puede reutilizarlo desde el selector del bloque Shape sin pegar código, y las piezas de marca
    quedan en un sitio y no dispersas por las páginas. Cómo funciona por dentro, verificado leyendo
    el plugin: la librería guarda dos opciones de WordPress, `generateblocks_svg_shapes` y
    `generateblocks_svg_icons`, cada una un array de grupos con la forma
    `{ group, group_id, shapes: [ { id, name, shape } ] }`; el filtro
    `generateblocks_pro_add_custom_svg_shapes` las mete en `generateblocks_get_svg_shapes()` de GB
    core, que el editor recibe como `svgShapes`. **Es un catálogo del editor, no una referencia
    dinámica**: al elegir una forma, su SVG se copia inline en el bloque. Se escriben por REST o,
    desde un script, con `wp option update generateblocks_svg_shapes --format=json`. Los
    `generateblocks_svg_icons` alimentan el selector del atributo `icon` de `text()` — ver la
    trampa 19, corregida el 22/09/2026: sí se usa, con la forma de HTML correcta.

26. **El nombre accesible de un SVG va en el CONTENEDOR, nunca dentro del `<svg>`.** Al aplicar la
    trampa 25 salta la siguiente: un SVG inline que necesita anunciarse —porque va suelto, sin un
    enlace o un texto al lado que ya lo nombre— no puede llevar el nombre dentro. Medido el
    22/09/2026 con `qa-editor-check.mjs` y una sonda de cuatro variantes sobre el mismo SVG:

    | | Dónde va el nombre | Editor |
    |---|---|---|
    | A | `aria-hidden="true"` en el `<svg>` | ✔ valida |
    | B | `role="img"` + `aria-label` en el `<svg>` | ✖ **Attempt Recovery** |
    | C | `role="img"` + `aria-label` en el `.gb-shape`, por `htmlAttributes` | ✔ valida |
    | D | un `<title>` dentro del `<svg>` | ✖ **Attempt Recovery** |

    O sea que las dos formas canónicas de nombrar un SVG en HTML —el par `role`/`aria-label` y el
    `<title>` hijo— son justo las que rompen el bloque. No lo ve ningún linter estático: el marcado
    es HTML válido. **El SVG sale siempre `aria-hidden="true"` y el nombre se pone en los
    `htmlAttributes` del bloque `shape`**, que es marcado del propio bloque y sí lo admite.

    Con una trampa dentro de la trampa: **`shape()` de `emit.mjs` no emitía `htmlAttributes`**,
    aunque el `block.json` del bloque los declara igual que en `element` o `media`. Los descartaba
    en silencio, así que la variante C «validaba» por la peor de las razones — los atributos no
    llegaban al marcado y el bloque quedaba idéntico a la variante A, sin nombre accesible. Se vio
    porque el `role="img"` no aparecía en la página servida. Corregido en el emisor el 22/09/2026;
    con una copia anterior, compruébalo antes de fiarte del resultado de la sonda.

27. **Una etiqueta dinámica vacía no deja el hueco: se lleva el BLOQUE ENTERO.** GenerateBlocks las
    trata como REQUERIDAS por defecto (`class-register-dynamic-tag.php`: «If this tag is required
    for the block to render and there is no replacement, bail» → devuelve `''`). Tiene dos caras y
    las dos importan:

    · **A favor**, es el mecanismo de condicional que el marcado no tiene. Un campo opcional
      —«si no se rellena, no lo imprimas»— se resuelve poniendo su etiqueta en el bloque y ya está,
      sin PHP y sin `query`. Truco que lo hace utilizable de verdad: mete los ADORNOS del campo
      (un filete, una comilla) en un `::before` del MISMO bloque, no en un hermano. Con dos bloques
      hermanos, el adorno se queda huérfano en mitad de la página cuando el campo está vacío.

    · **En contra**, un valor legítimamente vacío TUMBA el bloque. El caso real es
      `{{featured_image key:alt}}`: una foto decorativa sin texto alternativo es correcta, y sin
      embargo la imagen entera desaparecía. Se apaga por etiqueta con `|required:false`. Repasa una
      por una las etiquetas cuyo valor pueda estar vacío sin que eso sea un error.

28. **`{{post_excerpt}}` FABRICA un extracto si el campo está vacío.** Pasa por `get_the_excerpt()`,
    que recorta el cuerpo a 55 palabras cuando no hay extracto propio. En una plantilla donde la
    entradilla va justo encima del cuerpo, eso imprime dos veces las mismas frases y no da ningún
    error. Si lo que quieres es el campo en crudo, regístrate una etiqueta propia con
    `get_post_field( 'post_excerpt', $id )` — y de paso recuperas la trampa 27 a tu favor: vacío es
    vacío, y el bloque no se pinta.

29. **La imagen destacada sale DOS veces en una plantilla que ya la coloca.** GeneratePress la pinta
    por su cuenta en `generate_after_header` (`generate_featured_page_header()`), y eso vive FUERA
    de la plantilla: un Content Template sustituye la parte de plantilla del tema, no los ganchos de
    alrededor. No hay filtro que valga —imprime directo con `the_post_thumbnail()`—, así que hay que
    quitar la acción, y en `template_redirect`, que es donde los condicionales ya funcionan:
    `remove_action( 'generate_after_header', 'generate_featured_page_header', 10 )`. El filtro
    `generate_single_featured_image_output` de GP Premium NO sirve: solo gobierna la ruta de
    entradas singulares, no la de páginas. Comprobado el 22/09/2026.

30. **El compilador de CSS del emisor solo sabe anidar hacia DENTRO.** `buildCanonicalCss` entiende
    `&:hover`, `:hover`, `@media …` y descendientes (`.gb-shape svg`), y todo lo demás lo concatena
    como descendiente. Una regla que dependa de un ANCESTRO —«este bloque cambia de color en las
    páginas que no son la portada»— no se puede expresar ahí: saldría
    `.gb-element-x body:not(.home)`, que no casa con nada y no avisa. La salida que funciona sin
    duplicar el bloque es una **variable con respaldo**: el bloque declara
    `var(--lo-que-sea, <valor por defecto>)` y el tema hijo redefine `--lo-que-sea` en el `body` de
    las páginas que toca. El valor por defecto deja el resto del sitio intacto.

## Plantillas de contenido: un Elemento por tipo de página

**Montado y verificado el 22/09/2026.** Cuando todas las páginas de una sección comparten maqueta y
solo cambian los datos, no se maqueta una por una: se hace **un Elemento «Content Template»** de
GeneratePress y los datos entran por etiquetas dinámicas.

Cómo se crea, porque no hay interfaz que se pueda automatizar:

```
wp post create plantilla.html --post_type=gp_elements --post_status=publish --post_title="…"
```

y después, por `wp eval-file`, sus metas:

| Meta | Valor |
|---|---|
| `_generate_element_type` | `block` |
| `_generate_block_type` | `content-template` |
| `_generate_element_display_conditions` | `[ [ 'rule' => 'post:page', 'object' => '0' ] ]` |

El tipo `content-template` engancha en `generate_before_do_template_part` y devuelve `false` en
`generate_do_template_part`: el tema deja de pintar su título y su contenido, y **todo** sale del
Elemento. Él mismo envuelve la salida en `<article class="… dynamic-content-template">`, así que la
raíz del marcado es un `div` a secas, sin `<article>` propio.

De dónde sale cada dato:

| Dato | Cómo |
|---|---|
| Título | `{{post_title}}` |
| Imagen destacada | `{{featured_image key:url\|size:full}}` en `htmlAttributes.src` de un `media` |
| Campo propio | `{{post_meta key:mi_campo}}` |
| Extracto | etiqueta propia, no `{{post_excerpt}}` — trampa 28 |
| **Contenido de la entrada** | `<!-- wp:generatepress/dynamic-content {"contentType":"post-content"} /-->` |

Esa última fila es la única excepción legítima a «solo bloques genéricos V2»: **GenerateBlocks no
tiene etiqueta dinámica para `post_content`** (tiene título, extracto, fecha, imagen destacada y
metas, y ahí se acaba), y `core/post-content` necesita un contexto de plantilla de bloques que un
Elemento de GeneratePress no da. Sale envuelto en `<div class="dynamic-entry-content">`, que es a
lo que apunta el `styles` del `element` que lo contiene para dar tipografía a sus párrafos.

Dos cosas que la plantilla NO debe pedirle al redactor página por página: la caja a ancho completo
y la barra lateral. Se olvidan. Van al mu-plugin, con `body_class` (añadiendo `full-width-content`)
y el filtro `generate_sidebar_layout`, condicionados a las páginas que usan la plantilla.

Y las condiciones de visibilidad del Elemento admiten listas de objetos, no propiedades. «Todas las
páginas MENOS la portada y menos los avisos legales» no es una lista: es una propiedad de cada
página. Se declara la condición ancha en el Elemento y se afina con el filtro
`generate_element_display`, leyendo una meta de la página. Así nadie tiene que editar la condición
cada vez que se crea una página nueva.

### Marcado propio dentro de un bloque: etiquetas dinámicas, no shortcodes

Para las piezas que hay que calcular en PHP (migas de pan, un submenú, una lista) la vía buena es
**registrar una etiqueta dinámica propia**, no un shortcode:

```php
add_action( 'init', function () {                   // prioridad 20: GB registra las suyas en 10
    new GenerateBlocks_Register_Dynamic_Tag( [
        'title' => 'Migas de pan', 'tag' => 'mis_migas', 'type' => 'post',
        'supports' => [], 'return' => fn(): string => mis_migas_html(),
    ] );
}, 20 );
```

Gana al shortcode en tres cosas medibles: el estilo se queda ENTERO dentro del `styles` del bloque
—donde lo ven los dos linters y el contrato—, mientras la función solo emite marcado semántico con
clases `wpf-…`; hereda el condicional gratis de la trampa 27; y aparece en el desplegable de
etiquetas del editor, así que el cliente la reutiliza sin tocar código. La función va al **tema
hijo** (es aspecto), y los campos y las reglas de la plantilla al **mu-plugin** (es modelo de
contenido) — el mismo reparto de siempre.

Tras tocar el mu-plugin: `node herramientas/desplegar-mu-plugins.mjs --sitio "<…>"`. Es el hermano
de `desplegar-tema.mjs` y existe por la misma razón (trampa 12): una carpeta `wp/mu-plugins/`
versionada no es una carpeta cargada, y aquí no hay ni pantalla de plugins donde echarla en falta.

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
