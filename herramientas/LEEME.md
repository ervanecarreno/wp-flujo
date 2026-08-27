# Herramientas de validación (Node, sin dependencias)

Tres scripts que validan el marcado de GenerateBlocks contra el checklist de
`../docs/metodo-generateblocks-v2.md` §8. Requieren solo Node (probado en v24).
No instalan nada ni tocan la red salvo donde se indica.

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
