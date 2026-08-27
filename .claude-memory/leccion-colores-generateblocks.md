---
name: leccion-colores-generateblocks
description: GenerateBlocks siempre resuelve el color elegido en el panel a HEX literal — nunca usar el selector de color para la marca. var(--color) sí sobrevive si el escapado es el correcto (verificado)
metadata: 
  node_type: memory
  type: feedback
  originSessionId: ad32cce8-eb62-47ea-b405-8e27ce6dd01c
  modified: 2026-08-27T15:10:00.000Z
---

En GenerateBlocks (free y Pro), nunca fijar el color de marca eligiéndolo en el panel de color de
cada bloque. En su lugar: definir clases CSS utilitarias (`.text-accent`, `.bg-accent`...) una vez
en el CSS complementario del tema hijo, usando variables reales (`var(--accent)` o los Global
Colors nativos de GeneratePress), y aplicarlas a los bloques vía el campo "CSS classes" de GB.

**Why:** confirmado por el propio soporte oficial de GenerateBlocks — el selector de color del
bloque SIEMPRE resuelve el valor elegido a HEX literal dentro del atributo `styles` del bloque,
incluso si ese color viene de theme.json o de los Global Colors de GeneratePress. No hay forma de
que quede como referencia viva. Es la causa raíz de que en el [[proyecto-aridane-home]] el color
de marca (`#EE743B`) apareciera como literal repetido 100+ veces en 100 KB de marcado: no fue un
descuido del generador, es cómo funciona GenerateBlocks siempre. "Cambiar un color" solo puede ser
una edición si el color nunca se fijó bloque a bloque — de ahí que las clases utilitarias sigan
siendo la vía recomendada por defecto, incluso ahora que se sabe que `var()` sobrevive (ver abajo):
la elección del color en el PANEL sigue rompiendo la referencia; el problema nunca fue el escapado.

**RESUELTO el 27/08/2026 — `var(--color)` sí sobrevive, con el escapado correcto.** Probado de
extremo a extremo contra un WordPress real (figma-staging, GenerateBlocks Pro 2.7.0): un bloque
con `background-color:var(--color-x)` en `styles`/`css`, guardado vía la API REST (el mismo camino
que usa el editor al pulsar "Actualizar"), sobrevive **intacto** hasta el CSS que GenerateBlocks
genera de verdad en el frontend (`wp-content/uploads/generateblocks/style-{ID}.css`) — sin
aplanar a HEX. Esto abre una vía real (sin usar el panel de color) para que `var()` funcione: un
CSS Editor de GB Pro, o cualquier mecanismo que escriba directamente en el atributo `styles`/`css`
en vez de por el panel de color bloque a bloque.

**Hallazgo colateral, más importante que el original:** el documento del método
(`docs/metodo-generateblocks-v2.md` §3) documentaba **cinco** escapes del JSON del comentario de
bloque, incluyendo `"` → `\u0022`. **Es incorrecto y rompe el guardado real.** WordPress sanea
el contenido al guardar (vía REST/editor) con `kses`, que solo reconoce un comentario de bloque
como Gutenberg legítimo si el JSON de dentro tiene **comillas literales** — si no, borra
silenciosamente todo el interior del comentario y `parse_blocks()` devuelve atributos vacíos. Con
solo **cuatro** escapes (`\u002d\u002d`, `\u003c`, `\u003e`, `\u0026`) y comillas literales, el
bloque sobrevive perfecto. `herramientas/audit-gb.js` nunca exigió el quinto escape, así que el
validador siempre fue correcto — el error estaba solo en la documentación, ya corregida, y en la
investigación original (con addendum en `resultados-completos.md`).

El nuevo CSS Editor de GB Pro 2.6 **sigue sin probar empíricamente** — el experimento hecho usó la
API REST directamente, no un clic real en ese editor. Diferencia menor (misma capa de saneado),
pero queda como el único cabo suelto real de este asunto.

**How to apply:** en la fase de generación de marcado de [[flujo-wordpress-generateblocks]], el
color se sigue aplicando siempre por clase CSS, nunca por el panel visual del bloque — eso no ha
cambiado. Lo que cambia es que ya no hay que evitar `var()` en `styles`/`css` por miedo al
escapado: usar los cuatro escapes correctos (ver `docs/metodo-generateblocks-v2.md` §3) y dejar
las comillas literales.
