---
name: leccion-colores-generateblocks
description: GenerateBlocks siempre resuelve el color elegido en el panel a HEX literal — nunca usar el selector de color para la marca
metadata: 
  node_type: memory
  type: feedback
  originSessionId: ad32cce8-eb62-47ea-b405-8e27ce6dd01c
  modified: 2026-08-27T07:33:01.410Z
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
una edición si el color nunca se fijó bloque a bloque.

El nuevo CSS Editor de GB Pro 2.6 (estable desde junio 2026) no tiene confirmación de que resuelva
esto — probarlo empíricamente (crear un Global Style con `var()`, guardar, inspeccionar el HTML
resultante) antes de apoyarse en él.

**Hallazgo del 27/08/2026 (parcial, no cierra el asunto):** el script `verificacion/roundtrip-escapado-wp.js`
demuestra que `var(--color-primary)` **sobrevive intacto** al escapado de atributos de bloque de
WordPress — el `--` se serializa como `\u002d\u002d`, no queda ningún `--` crudo que rompa el
comentario, y parsea de vuelta sin pérdida. Es decir: **el escapado NO es el obstáculo**, contra lo
que se asumía. Lo que sigue SIN probar es si el editor de GB reescribe el `var()` al abrir y guardar
el bloque, y si el frontend lo pinta. Ese es el experimento pendiente y de premio gordo: si `var()`
sobrevive también al editor, cambiar un color pasa a ser una edición y las clases utilitarias se
vuelven opcionales. Hasta comprobarlo, seguir con las clases.

**How to apply:** en la fase de generación de marcado de [[flujo-wordpress-generateblocks]], el
color se aplica siempre por clase CSS, nunca por el panel visual del bloque.
