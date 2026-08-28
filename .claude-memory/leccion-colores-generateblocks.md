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

**Hallazgo colateral, corregido dos veces.** El escapado del JSON del comentario de bloque lo
hace WordPress en `serialize_block_attributes()` (`wp-includes/blocks.php`), y son **seis**
sustituciones: `\\`, `--`, `<`, `>`, `&` y `\"`. La última es la que importa: se aplica
**solo a la comilla ya escapada**, la que está dentro de un valor (atributos de un SVG en
línea). Las comillas **estructurales** del JSON se dejan literales.

Escaparlas *todas* es lo que rompe el guardado: el JSON deja de ser válido y `parse_blocks()`
devuelve los atributos vacíos, sin ningún error. **No es `kses`** — así lo decía la versión
anterior de esta memoria y era un mecanismo equivocado. La corrección intermedia (quitar la
sustitución de la comilla del todo) es segura pero no canónica: produce JSON válido que
WordPress acepta, aunque lo reescribe al reguardar desde el editor.

`herramientas/audit-gb.js` solo comprueba los cuatro caracteres crudos (`&`, `<`, `>`, `--`),
así que nunca dio un falso error. La verificación adversarial de la investigación original
(nota 63 de `resultados-completos.md`) **ya lo señalaba bien** y se pasó por alto.

El nuevo CSS Editor de GB Pro 2.6 **sigue sin probar empíricamente** — el experimento hecho usó la
API REST directamente, no un clic real en ese editor. Diferencia menor (misma capa de saneado),
pero queda como el único cabo suelto real de este asunto.

**How to apply:** en la fase de generación de marcado de [[flujo-wordpress-generateblocks]], el
color se sigue aplicando siempre por clase CSS, nunca por el panel visual del bloque — eso no ha
cambiado. Lo que cambia es que ya no hay que evitar `var()` en `styles`/`css` por miedo al
escapado: aplicar las seis sustituciones del core (ver `docs/metodo-generateblocks-v2.md` §3),
dejando literales las comillas estructurales del JSON.
