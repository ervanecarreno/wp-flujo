# Herramientas de validación (Node, sin dependencias)

Seis scripts. Tres validan el marcado de GenerateBlocks contra el checklist de
`../docs/metodo-generateblocks-v2.md` §8; `puerta-calidad.js` valida el sitio ya desplegado
(fase 7); `config-tema.js` lleva la configuración del tema de un sitio a otro y `global-styles.js` hace
lo mismo con los Global Styles de GenerateBlocks (fases 2, 4 y 8).
Requieren solo Node (probado en v24). No instalan nada ni tocan la red salvo donde se indica.

## `audit-gb.js` — checklist del método §8

```bash
node herramientas/audit-gb.js wordpress/generateblocks/home-1b-generateblocks-v2.html
```

Comprueba bloque a bloque:

- `css` reconstruido desde `styles` convirtiendo camelCase a kebab-case, como hace GB
- `className` sin la id-class · id-class en el cuerpo **si el bloque tiene CSS propio** · `tagName` coherente
- Escapado: ningún `&` `<` `>` `--` crudo dentro del JSON, y aviso si no es el canónico del core
- `htmlAttributes` objeto plano, nunca array (causa #1 de "Attempt Recovery")
- `src`/`alt`/`href` dentro de `htmlAttributes`, no en primer nivel
- `content` duplicado en atributo y cuerpo · SVG duplicado en `html` y cuerpo
- `element` con `tagName:"a"` conteniendo un `text`, nunca texto plano
- `uniqueId` únicos · apertura/cierre emparejados · sintaxis de etiquetas dinámicas

**Recalibrado el 28/08/2026 contra 732 bloques de 25 exports reales de GenerateBlocks**, que ahora
pasa con **0 errores**. Antes daba 714: cuatro reglas eran falsas (comparaba camelCase con kebab,
exigía que `css` fuera serialización exacta de `styles` cuando GB lo *optimiza*, y pedía siempre la
clase base y la id-class). Detalle en `../docs/metodo-generateblocks-v2.md` §8.

**Interpretar la salida:** solo importan los **ERRORES**. Los avisos incluyen falsos positivos
conocidos: cuenta como "texto suelto" el contenido de los bloques `text` hijos, y marca
`{{post_date dateFormat:j F, Y}}` como sintaxis dudosa por el espacio del formato (es correcta).

Con `--estricto`, la comparación `css`/`styles` vuelve a ser error. Úsalo **solo** con marcado
generado por este flujo: con marcado exportado de WordPress da falsos positivos, porque GB optimiza
(colapsa longhands en shorthand, quita espacios de `rgba()` y `clamp()`).

Lee también **exports `wp_block` en JSON**, que es como GenerateBlocks exporta los patrones.

## `audit-cross.js` — coherencia entre marcado, CSS, JS y assets

```bash
node herramientas/audit-cross.js .        # desde design_handoff_home_aridane/
```

Cruza el marcado con `home-1b-gb-extra.css`, `slider-animado.js` y `assets/`: id-classes
que el CSS estila pero no existen, clases del marcado sin CSS, bloques no-GB, parámetros de
las queries, imágenes referenciadas vs. entregadas, y qué selectores busca el carrusel.

**Ojo:** marcará `.ar-slider`, `.ar-slider__nav`, `.ar-slider__dots` y `.is-active` como
huérfanas. **No lo son**: las crea `slider-animado.js` en tiempo de ejecución.

## `fix-gb.js` — generador de la v2

```bash
node herramientas/fix-gb.js wordpress/generateblocks
```

Regenera `home-1b-generateblocks-v2.html` y `home-1b-gb-extra-v2.css` desde los originales.
Hace reemplazo textual (no reserializa JSON), así `styles`, `css` y el cuerpo HTML se
actualizan a la vez y el marcado sigue siendo canónico.

**Si vuelves a ejecutarlo, revisa antes la constante `PEND` (`2026/08`)**: es la carpeta
`YYYY/MM` donde WordPress dejará las 5 imágenes pendientes. Si las subes en otro mes, cámbiala.

## `puerta-calidad.js` — el sitio ya desplegado (fase 7)

```bash
node herramientas/puerta-calidad.js https://ejemplo.org/subdirectorio/ --max-kb=200
```

Lo que el validador de marcado no puede ver, porque no es marcado: imágenes y enlaces que dan
404 contra el servidor real, y peso de imagen. Es la comprobación que habría detectado las 11 de
13 imágenes en 404 del proyecto Aridane, donde el marcado daba 0 errores sobre 179 bloques.

Distingue **roto en tu sitio** (bloquea la entrega, sale con código 1) de **roto hacia fuera**
(informativo: una web ajena caída no debe tumbar una entrega tuya). La URL tiene que ser la real
del sitio desplegado, **con el subdirectorio si lo hay**: contra un HTML local no sirve de nada,
porque el subdirectorio es justo lo que rompe.

## `config-tema.js` — la configuración del tema, de un sitio a otro

La configuración de GeneratePress y la tipografía **no están en código**: están en la base de
datos, en tres opciones de WordPress verificadas contra un WordPress real:

```
generate_settings               configuración del tema
generate_spacing_settings       espaciados
generate_package_font_library   tipografía
```

Por eso no viajan con el repo git. Sin esto, el destino recibe la maqueta correcta con la
tipografía y los espaciados de fábrica.

```bash
# Fase 2, en cuanto el tema esté configurado (y cada vez que lo toques)
node herramientas/config-tema.js exportar --path="C:\Users\David\Local Sites\web\app\public"

# Fase 8, en el destino. Sin --confirmar solo informa: no escribe nada
node herramientas/config-tema.js importar --path="<sitio destino>"
node herramientas/config-tema.js importar --path="<sitio destino>" --confirmar
```

Deja un JSON por opción en `config-tema/`, formateado para que el diff de git se pueda leer, más
un `MANIFIESTO.json` con de dónde salió y qué se dejó fuera.

**Solo exporta esas tres.** Si encuentra otras opciones `generate_*`, `generateblocks_*` o
`theme_mods_*` en la base de datos, **las lista y no las toca**: la decisión es tuya, se añaden con
`--incluir=nombre1,nombre2`. Dos que conviene mirar con cuidado si aparecen:

| Opción | Lo que arrastra |
|---|---|
| `theme_mods_*` | IDs de adjunto (logo, favicon): los IDs **no coinciden** entre sitios |
| `generate_package_*` (otras) | activación de módulos de GP Premium: el destino necesita licencia |

`generateblocks_dynamic_css_posts` **nunca** se exporta, ni pidiéndola: es el índice de CSS por
post de este sitio, se regenera solo y apunta a IDs locales.

Al importar con `--confirmar` guarda copia de los valores anteriores en
`config-tema/copias-previas/<fecha>/` y te imprime el comando exacto para volver atrás.

**El sitio tiene que estar ARRANCADO en Local:** esto lee y escribe en la base de datos. Si está
parado, lo dice y no hace nada. El puerto de MySQL del sitio lo saca solo del `sites.json` de
Local y se lo pasa a `wp.cmd` por `WP_MYSQL_PORT`.

Lo único que no puede comprobar por ti: que el sitio **se vea** bien después. Míralo en el
navegador — tipografía, colores y espaciados.

## `global-styles.js` — los Global Styles de GenerateBlocks, versionables

Un Global Style es una regla CSS con nombre. **Se puede versionar**, aunque este flujo dijera lo
contrario hasta el 28/08/2026: el CPT `gblocks_styles` está expuesto en la API REST y se maneja bien
por wp-cli.

```bash
node herramientas/global-styles.js exportar --path="<sitio>" [--fichero=global-styles.json]
node herramientas/global-styles.js importar --path="<sitio>"              # solo informa
node herramientas/global-styles.js importar --path="<sitio>" --confirmar  # escribe
```

Deja un JSON legible con un elemento por estilo: selector, orden, CSS compilado y el objeto de
estilos en camelCase. **El orden del array es la especificidad** — GenerateBlocks saca el CSS de
arriba abajo, así que reordenar el fichero cambia qué regla gana.

Es **idempotente**: reimportar sin cambios dice "sin cambios 13" y no toca nada. Compara la
estructura del JSON, no la cadena, porque al exportar se decodifica para que el diff se lea y al
importar se vuelve a codificar — los bytes no coinciden aunque el contenido sea idéntico.

**Para qué sirve de verdad:** define los componentes del diseño una vez como global styles y emite
los bloques con `globalClasses` en vez de estilos por bloque. El marcado se queda sin un solo HEX.
Detalle en `docs/metodo-generateblocks-v2.md` §7 bis.

**Ojo:** importar afecta a **todas** las páginas que usen esas clases. Exporta los actuales antes
para tener con qué volver atrás.

---

## `nuevo-proyecto.js` — el punto de partida de un proyecto de cliente

El método y las herramientas ya se reproducen solos: este plugin está instalado en Claude Code y
sus skills se cargan en cualquier carpeta. **Lo que no se reproducía era el esqueleto** —
`design/`, el contrato, el plugin del proyecto, la puerta de calidad—, que se montaba a mano cada
vez, y cada vez se olvidaba una pieza. Los dos fallos que costaron la semana del 2/09/2026 —los
tokens que no llegaban al navegador y las fuentes declaradas y no cargadas— eran los dos por eso.

Así que el arreglo no es una nota en un checklist: **viene de fábrica**. El plugin de WordPress
que genera encola el CSS del contrato **y** las fuentes, en frontend y en el editor, desde el
primer minuto.

```
node herramientas/nuevo-proyecto.js "WEB Ayuntamiento de Tazacorte" \
  --sistema pergamino --slug ayto-tazacorte --sitio ayto-tazacorte --puerto 10011
```

Genera 12 ficheros: `CLAUDE.md` con las reglas, `ESTADO.md` con la tabla de las 8 fases, el
contrato en JSON con los nombres congelados, su CSS generado, los dos documentos de diseño,
`tokens/map.json`, `wp/<slug>.php`, `.env.local.ejemplo`, `.gitignore` y **`verificar.mjs`**.

Se niega a escribir sobre una carpeta con contenido salvo con `--forzar`.

Atajo: **`/wp-nuevo-proyecto`**.

## `tokens-a-css.mjs` — el CSS del contrato es una derivada

```
node herramientas/tokens-a-css.mjs design/x.tokens.json -o design/x.tokens.css
node herramientas/tokens-a-css.mjs design/x.tokens.json --verificar design/x.tokens.css
```

El contrato vive en **un** fichero, el JSON en formato W3C / Tokens Studio. El CSS se genera.

Existe porque la cabecera del CSS del primer proyecto decía, literalmente, *«espejo exacto del
JSON: si cambias uno, cambia el otro»*. Eso es sincronizar a mano dos declaraciones de la misma
verdad, y nada avisa cuando divergen. **Ya habían divergido**: el JSON decía `Fraunces` y el CSS
`"Fraunces", Georgia, serif`. La pila de respaldo es parte del contrato y estaba solo en un lado.

`--verificar` no escribe: compara, dice **en qué línea** difieren y con qué valores, y sale con 1.
Es la puerta anti-deriva del contrato, y es el paso 1 de `verificar.mjs`.

Nombres: la ruta del token unida por guiones (`space.md` → `--space-md`). Dos escapes para lo que
no encaje: `$metadata.renombres` para renombrar el primer tramo (`font-family` → `font`), y
`"$css"` dentro de un token, que manda sobre todo lo demás. Avisa de colisiones de nombre y de
alias `{ruta}` que no resuelven.

## `resolver-huerfanos-color.mjs` — colores fuera del contrato, sin resolverlos a ojo

```
node herramientas/resolver-huerfanos-color.mjs design/x.tokens.json "#E0B36A:198" "#8A6220:18"
node herramientas/resolver-huerfanos-color.mjs design/x.tokens.json --huerfanos huerfanos.json -o informe.md
```

Un handoff casi siempre trae HEX que el contrato congelado no tiene (ver `importar-handoff-diseno`).
Resolver cada uno a mano —qué dos tokens mezclar, en qué proporción, qué tan parecido queda— es
mecánico y se hizo así en Fundación Santa Cruz de La Palma para 15 huérfanos: una sesión entera.

Para cada huérfano prueba cada token solo y cada `color-mix(in srgb, tokenA P%, tokenB)` entre los
tokens base del contrato, y se queda con el más parecido por distancia **redmean**
(compuphase.com/cmetric.htm, la misma que usa `convert -fuzz` de ImageMagick). Verificado contra la
tabla real de ese proyecto: reproduce sus Δ sin que nadie tuviera que volver a medir.

Con `--umbral` (por defecto 30) separa lo que entra limpio de lo que no: por debajo, es un
**derivado** (`color-mix` de dos tokens, nunca un token nuevo); por encima, avisa para que se
confirme a mano si de verdad hace falta ese matiz. **No mide contraste** — un derivado con Δ bajo
puede seguir fallando WCAG AA sobre su fondo real.

## `calibrar-validadores.mjs` — ¿esta regla distingue algo?

```
node herramientas/calibrar-validadores.mjs                    # solo el corpus
node herramientas/calibrar-validadores.mjs <carpeta-propia>   # compara los dos
```

Corre `audit-gb.js` y `conversion/scripts/validate-blocks.mjs` sobre `corpus-gb/` —25 exports
reales de GenerateBlocks, 742 bloques— y, si le das una carpeta, también sobre tu marcado.
Normaliza por bloque, porque los ficheros van de 8 a 156 y comparar totales crudos no dice nada.

El criterio no admite discusión: **GB produjo ese marcado y GB lo acepta. Si una regla salta ahí,
la regla está mal.** Y hay una segunda forma de estar mal, más sutil: saltar *igual* sobre los dos
conjuntos. Entonces la regla no distingue nada, y da lo mismo lo que diga.

Da veredicto por regla:

| | |
|---|---|
| `✔ no salta sobre marcado válido` | la regla sirve |
| `✖ FALSA` | es ERROR sobre marcado que GB acepta |
| `✖ NO DISTINGUE` | misma tasa en los dos conjuntos |
| `◦ solo describe exports de GB` | no valida lo nuestro |

Sale con 1 si alguna regla no supera el corte. **Una regla nueva no entra por parecer razonable:
pasa por aquí y demuestra que distingue.**

Con esto se cerró en el 2/09/2026 la unificación de los dos validadores, que llevaba abierta desde
agosto: 847 avisos sobre marcado válido bajaron a **0**, sin perder una sola detección real. El
detalle está en `conversion/LEEME.md`.

### Los tres niveles

Los dos validadores tienen ahora `error`, `aviso` y **`nota`**. La nota es lo que se conserva
porque a veces describe algo cierto, pero que no distingue marcado bueno de malo. No sale en el
informe por defecto; se ve con **`--todo`**. Quién baja a nota no es una opinión: lo decide la
calibración.

## `gb-regenerar-css.mjs` — importar por wp-cli deja el CSS caducado

**Trampa nueva, del 2/09/2026, y afecta a todo el flujo.**

GenerateBlocks no escribe los estilos en el marcado: los guarda en
`wp-content/uploads/generateblocks/style-<postID>.css` y lo rehace **al guardar desde el editor**.
`wp post create` y `wp post update` no lo disparan. La página queda servida con el CSS de la
versión anterior.

Y falla de la peor manera posible: **la página carga**, con su estructura y su contenido. Solo
que los bloques nuevos salen sin estilo, con la tipografía y los tamaños del tema. Medido en la
landing del proyecto de referencia: **95 bloques declaraban `css` y 25 no tenían regla servida**;
la cita del testimonio salía en Manrope de 18px en vez de Fraunces de 36.

No lo ve **ninguna** de las otras capas, y no por descuido:

| Capa | Por qué no lo ve |
|---|---|
| los dos validadores | el marcado es correcto |
| round-trip REST | WordPress devuelve lo mismo que se envió |
| editor real | el editor genera su CSS al vuelo, así que allí se ve bien |
| contrato publicado | los tokens resuelven; es la **regla que los usa** la que falta |

```
node herramientas/gb-regenerar-css.mjs --sitio "<app/public>" --puerto <N> \
  --post 49550 --url http://sitio.local/pagina/ --marcado build/pagina.html
```

Borra la hoja, obliga a GB a reescribirla, pide la página y **comprueba que cada bloque con `css`
tiene su regla servida**. `--post`/`--elemento` se pueden repetir; `--url` y `--marcado` se
enganchan al último que se haya escrito antes, así que manda el orden de la línea de comandos.

### Los Elementos de GeneratePress no tienen hoja propia

Header y footer viven como Elementos (`gp_elements`), pero GB **no** escribe un
`style-<IDdelElemento>.css`: funde el CSS del header + el del footer + el de la página en el
`style-<ID>.css` **de la página que se está viendo**. Pasarle el ID de un Elemento borraba un
fichero inexistente y decía que todo iba bien.

Desde el 4/09/2026 hay `--elemento`, que lee sus condiciones de visualización
(`_generate_element_display_conditions`) y resuelve solo en qué páginas se muestra:

```
node herramientas/gb-regenerar-css.mjs --sitio "<app/public>" --puerto <N> \
  --elemento 49650 --marcado build/header.html \
  --elemento 49651 --marcado build/footer.html \
  --post 49631 --url http://sitio.local/ --marcado build/home.html
```

Un `--post` que resulta ser un Elemento se detecta y se trata como `--elemento`, avisando.

Se resuelven las reglas que de verdad usan header y footer: `general:site`, `general:singular`,
`general:front_page` y `post:<tipo>` con o sin objeto. El vocabulario de GeneratePress es más
amplio (archivos, taxonomías, roles) y reimplementar `GeneratePress_Conditions::show_data()` aquí
sería frágil, así que **ante una regla que no entiende regenera todas las páginas y lo dice**:
regenerar de más no rompe nada, solo tarda. Tope de 60 páginas.

Y como un Elemento puede resolver a páginas donde al final no se pinta, antes de comprobar sus
reglas mira si **algún `uniqueId` del marcado aparece en el HTML servido**. Si no aparece ninguno,
salta la comprobación en vez de dar una falsa alarma.

**Segundo arreglo del mismo día:** el conteo de bloques exigía el prefijo `wp:generateblocks/`
—con barra— así que **los bloques Pro no se comprobaban**. Un header nativo entero (site-header,
navigation, menu-container, classic-menu…) podía quedarse sin CSS y la línea final seguía diciendo
«todos los bloques tienen su regla servida». Medido en ACELIA: decía 8 bloques donde hay 14.

**El detalle que cuesta encontrar:** `generateblocks_dynamic_css_time` parece un rompe-cachés
—es el `?ver=` del enlace— pero en el código de GB es un **limitador de frecuencia**:

```php
if ( 5 <= ( $current_time - $last_time ) ) { ...escribe el fichero... }
```

Ponerlo a «ahora» hace lo contrario de lo que uno espera: GB se niega a escribir durante cinco
segundos y la página sale **sin nada** de CSS. Hay que **atrasarlo**. GB lo pone al día él mismo
al escribir, y eso es lo que rompe la caché.

**Dónde va en el método:** al final de la fase 4, cada vez que se importe o actualice marcado por
wp-cli, y antes de la puerta de calidad.

## `animacion/instalar-gsap.js` — biblioteca de animación, no una plantilla

Hasta el 7/09/2026 este script dejaba una plantilla con dos ejemplos comentados: cada proyecto
volvía a escribir los mismos patrones (entrada por scroll, escalonado, palabra a palabra, texto
ligado al scroll, apilado sticky) y volvía a tropezar con los mismos dos fallos — parpadeo del
contenido antes de que arrancara GSAP, y página en blanco si el CDN no respondía.

Ahora instala una **biblioteca que ya funciona**. No se escribe JavaScript para animar una sección:
se pone una clase en el marcado (`className: "<slug>-reveal"`, etc.) y anima. El JS solo se toca
para afinar tiempos, en un objeto `CONFIG` al principio de `assets/animations.js`.

Clases, todas con el prefijo del proyecto (el "Text Domain" de `style.css`):

| Clase | Efecto |
|---|---|
| `-reveal` / `-reveal-sm` / `-reveal-xs` | Entra desde abajo (32 / 24 / 12px) |
| `-reveal-x` / `-reveal-x-izq` | Entra desde la derecha / la izquierda |
| `-stagger` (en un contenedor) | Sus hijos con clase `-reveal*` entran en cascada, un solo disparador |
| `-words` | Titular palabra a palabra con desenfoque, al cargar |
| `-scroll-words` | Cada palabra de apagada a legible, **ligada al scroll** (scrub) |
| `-zoom` | Imagen que se desacerca (scale → 1) |
| `-stack` (en un contenedor) | Sus hijos se apilan con `position:sticky` — **CSS puro, sin JS** |

El estado inicial (oculto) va en un `<style>` que `functions.php` imprime en el `<head>`, bajo
`html.<slug>-anim`. Un script mínimo, también en el `<head>`, pone esa clase y programa su
retirada a los 2,5s: si `animations.js` no llega a arrancar, el contenido aparece igual en vez de
quedarse invisible para siempre. Ver la trampa 17/18 en la skill: la primera vez que se escribió
esto a mano en un proyecto, no tenía esa red de seguridad.

Contenido de query loop (paginación, "cargar más", filtro AJAX): nunca captures el NodeList fuera
de la biblioteca. Tras actualizar el DOM, llama a `window.<slug>Animaciones.refrescar()`.

## `desplegar-tema.mjs` — copia el tema hijo al tema real de Local

Cierra la trampa 12: `wp/tema-hijo/` es la carpeta VERSIONADA del proyecto, no el tema activo del
sitio — no hay symlink con `Local Sites/<sitio>/app/public/wp-content/themes/<tema>/`. Sin este
paso, un cambio en `functions.php` o en `assets/` (a mano, o por `instalar-gsap.js`) se queda solo
en el repo. Pasó de verdad en ACELIA: tres días con la fase 6 marcada como hecha en `ESTADO.md`
sin que el sitio sirviera el script, porque `node verificar.mjs` no comprueba scripts encolados.

```
node herramientas/desplegar-tema.mjs --sitio "<Local Sites>/<sitio>/app/public"
```

Deduce solo el nombre de la carpeta del tema (`generatepress-<slug>`, del "Text Domain" de
`style.css` — la misma convención que fija `nuevo-proyecto.js`), copia todo el árbol y pasa `php -l`
sobre el `functions.php` YA COPIADO, no sobre la fuente: si la copia fallara a medias, es lo que el
sitio va a ejecutar de verdad lo que hay que comprobar.

**Corre esto cada vez que toques algo dentro de `wp/tema-hijo/`**, no solo tras `instalar-gsap.js`.

## `referencia/medir-referencia.mjs` — audita una web de referencia con medidas, no con la vista

Nace de la trampa 17/18, pagada dos veces seguidas en Hedvig el 7/09/2026: una landing construida
leyendo el fichero de Figma en vez de la web real que el cliente dio como referencia (el Figma
tenía copias de texto distintas y ni footer), y una animación adivinada por el patrón habitual del
flujo (GSAP) cuando la real era apilamiento por CSS puro. Las dos veces la comprobación que
destapó el error fue la misma: abrir la URL y teclear `getComputedStyle`/`getBoundingClientRect` a
mano, docenas de veces. Este script la hace en un solo comando.

```
node herramientas/referencia/medir-referencia.mjs <url> [--ancho 1440] [--salida datos.json]
```

Da, de la web real: paleta por área ocupada, escala tipográfica completa (tamaño, peso,
interlineado, tracking, color — no solo el tamaño), radios y paddings más usados, contenedor de
cada sección de primer nivel, y **qué elementos tienen `opacity`/`transform`/`filter` puestos EN
LÍNEA** — así es como los motores de animación tipo Framer marcan el estado inicial antes de
disparar el JS, con la página recién cargada y sin haber scrolleado un píxel. Si una sección no
aparece ahí, no anima con JS: es CSS, o no anima. También lista los elementos `position:sticky`/
`fixed` — varios con el mismo padre y sin hueco entre ellos es la huella del apilado de tarjetas
que salió en Hedvig; confírmalo con scroll real antes de darlo por hecho.

No decide qué construir: da los números. La fidelidad sigue siendo trabajo con criterio, pero
contra medidas, no contra la impresión de una captura de pantalla.

Usa `playwright-core` (ya en `package.json`, un `npm install` sin descargar Chromium: abre el
Chrome o Edge ya instalado, igual que `qa-editor-check.mjs` y `qa-visual-diff.mjs`).
