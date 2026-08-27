---
name: generar-bloques-generateblocks
description: Genera marcado de bloques de GenerateBlocks Pro V2 canónico y validado. Úsala al escribir, pegar o corregir bloques de GenerateBlocks, comentarios `wp:generateblocks/...`, patrones de Gutenberg para GB, o cuando el editor de WordPress diga que un bloque "contiene contenido inesperado o no válido".
version: 0.1.0
---

# Generar bloques de GenerateBlocks Pro V2

El método de referencia completo está en `docs/metodo-generateblocks-v2.md` de este plugin: los
cinco bloques que hacen todo, la anatomía de cada uno, el escapado del JSON, estados y media
queries, contenido dinámico y estrategia de `uniqueId`. **Léelo antes de generar marcado nuevo.**

Lo que sigue es lo que no se puede saltar.

## Reglas duras

**El color nunca se elige en el panel del bloque.** GenerateBlocks resuelve siempre el valor a HEX
literal dentro del atributo `styles`, incluso si viene de theme.json o de los Global Colors de
GeneratePress. Confirmado por su soporte oficial. En su lugar: clases utilitarias
(`.text-accent`, `.bg-accent`) definidas una vez en el CSS del tema hijo, aplicadas por el campo
"CSS classes" de GB.

**Las imágenes se suben antes de generar el marcado**, con `wp media import ruta.jpg --porcelain`,
y se usa el ID que devuelve. Un `wp-image-{ID}` que no existe en el destino no da error: WordPress
simplemente no genera los tamaños responsive. Usa `herramientas/wp-cli/wp.cmd` (ver la skill
`wp-cli-en-local`), que carga `gd` y `exif` — sin ellas la degradación es silenciosa.

**Los breakpoints que cruzan varios bloques van al CSS externo**, no intentados con `styles`. Y con
una sola fuente de verdad: GeneratePress usa 768 px y GenerateBlocks 767 px por defecto.

## Checklist antes de entregar

Son las 10 casillas del §8 de `docs/metodo-generateblocks-v2.md`:

1. Cada `css` coincide exactamente con su `styles` (minificado, alfabético)
2. Ningún `className` contiene la id-class
3. Todos los HTML del cuerpo llevan `gb-<tipo>-<id>` + `gb-<tipo>`
4. Las cuatro sustituciones de escapado aplicadas (`--`, `<`, `>`, `&`); comillas SIN escapar
5. `src`/`alt`/`href` dentro de `htmlAttributes`, no en el primer nivel
6. `content` duplicado en atributo y cuerpo para todos los `text`
7. Todo `element` con `tagName: "a"` contiene un `text`, nunca texto plano
8. Los `uniqueId` son únicos y deterministas
9. Los breakpoints que cruzan bloques están en el CSS externo
10. Ninguna tipografía declarada si el tema ya la define

Si el editor dice *"contiene contenido inesperado o no válido"*, casi siempre es la 1 o la 4.

## Validar es parte del trabajo, no un extra

No entregues marcado sin pasarlo por el validador. Desde la raíz del plugin:

```
node herramientas/audit-gb.js <ruta-al-html-de-bloques>
node herramientas/audit-cross.js <carpeta-del-proyecto>
```

`audit-gb.js` reconstruye el `css` de cada bloque desde su atributo `styles` y los compara carácter
a carácter, más todas las reglas de arriba. **Solo importan los ERRORES**; los avisos incluyen
falsos positivos conocidos, documentados en `herramientas/LEEME.md`.

`audit-cross.js` cruza el marcado con el CSS, el JS y los assets: id-classes estiladas que no
existen, clases sin CSS, imágenes referenciadas que no se entregaron.

## Y aun así el marcado puede estar roto

Este validador comprueba **contenido, no entorno**. Está medido: da 0 errores sobre el fichero que
tenía 11 imágenes en 404 en producción. Después de validar, la fase 7 del flujo
(`puerta-calidad-wordpress`) sigue siendo obligatoria — comprueba cada URL contra el servidor real.

## RESUELTO: `var()` sí sobrevive, con el escapado correcto

Probado el 27/08/2026 de extremo a extremo contra un WordPress real (GenerateBlocks Pro 2.7.0):
un bloque con `background-color:var(--color-x)` en `styles`/`css`, guardado por el mismo camino
que usa el editor al pulsar "Actualizar" (API REST), llega **intacto** hasta el CSS que
GenerateBlocks genera de verdad en el frontend — sin aplanar a HEX. El escapado nunca fue el
obstáculo real.

**Lo que sí era el obstáculo, y no se sabía:** escapar las comillas (el quinto escape que este
documento y `docs/metodo-generateblocks-v2.md` daban por bueno) rompe el guardado real. WordPress
sanea el contenido al guardar con `kses`, que solo reconoce un comentario de bloque como Gutenberg
legítimo si el JSON de dentro tiene **comillas literales** — si no, borra silenciosamente todo el
interior del comentario y el bloque se guarda vacío. Con los **cuatro** escapes correctos
(`\u002d\u002d`, `\u003c`, `\u003e`, `\u0026`) y comillas literales, sobrevive perfecto. El checklist de
arriba y `docs/metodo-generateblocks-v2.md` §3 ya reflejan esto — si ves código o memoria que
siga escapando comillas, está desactualizado.

**Nota:** el color se sigue aplicando por clase CSS, nunca por el panel visual del bloque — eso
no cambia (ver la lección de memoria `leccion-colores-generateblocks`). Lo que cambia es que ya
no hay que evitar `var()` en `styles`/`css` por miedo al escapado.

**Sin probar todavía:** el experimento usó la API REST directamente, no un clic real en el
editor visual de GB Pro. Diferencia menor (misma capa de saneado), pero es el único cabo suelto.
