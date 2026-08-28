# Herramientas de validación (Node, sin dependencias)

Cinco scripts. Tres validan el marcado de GenerateBlocks contra el checklist de
`../docs/metodo-generateblocks-v2.md` §8; `puerta-calidad.js` valida el sitio ya desplegado
(fase 7) y `config-tema.js` lleva la configuración del tema de un sitio a otro (fases 2 y 8).
Requieren solo Node (probado en v24). No instalan nada ni tocan la red salvo donde se indica.

## `audit-gb.js` — checklist del método §8

```bash
node herramientas/audit-gb.js wordpress/generateblocks/home-1b-generateblocks-v2.html
```

Comprueba bloque a bloque:

- `css` reconstruido desde `styles` (mismo `buildCss` del método) y comparado carácter a carácter
- `className` sin la id-class · cuerpo con `gb-<tipo>-<id>` + `gb-<tipo>` · `tagName` coherente
- Escapado: ningún `"` `&` `<` `>` `--` crudo dentro del JSON del comentario
- `htmlAttributes` objeto plano, nunca array (causa #1 de "Attempt Recovery")
- `src`/`alt`/`href` dentro de `htmlAttributes`, no en primer nivel
- `content` duplicado en atributo y cuerpo · SVG duplicado en `html` y cuerpo
- `element` con `tagName:"a"` conteniendo un `text`, nunca texto plano
- `uniqueId` únicos · apertura/cierre emparejados · sintaxis de etiquetas dinámicas

**Interpretar la salida:** solo importan los **ERRORES**. Los avisos incluyen falsos
positivos conocidos: cuenta como "texto suelto" el contenido de los bloques `text` hijos,
y marca `{{post_date dateFormat:j F, Y}}` como sintaxis dudosa por el espacio del formato
(es correcta). Al 26/08/2026 el archivo v2 daba **0 errores / 42 avisos, todos falsos**.

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
