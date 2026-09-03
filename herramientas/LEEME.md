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

## `tokens-a-css.js` — el CSS del contrato es una derivada

```
node herramientas/tokens-a-css.js design/x.tokens.json -o design/x.tokens.css
node herramientas/tokens-a-css.js design/x.tokens.json --verificar design/x.tokens.css
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
