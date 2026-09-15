---
name: leccion-huerfanos-color-redmean
description: "Nueva herramienta resolver-huerfanos-color.mjs: resuelve HEX fuera del contrato contra los tokens base por distancia redmean, sin hacerlo a mano color a color"
metadata:
  node_type: memory
  type: feedback
  originSessionId: fscl-15-09-2026
  modified: 2026-09-16T00:00:00.000Z
---

Un handoff casi siempre trae HEX que el contrato congelado no tiene (lo dice
`importar-handoff-diseno`: «124 HEX repartidos por 179 bloques», visto en real). Hasta el
15/09/2026, resolver cada uno contra el contrato —qué dos tokens mezclar, en qué proporción, qué
tan parecido queda— era trabajo manual: se hizo así en el proyecto Fundación Santa Cruz de La
Palma para 15 huérfanos (`design/mapa-colores.md` de ese proyecto) y costó una sesión entera, con
una fórmula de distancia perceptual ("euclídea ponderada Rec. 709") que el propio documento nunca
llegó a nombrar.

**Esa fórmula es redmean** (compuphase.com/cmetric.htm, la que usa `convert -fuzz` de ImageMagick):
verificado reproduciendo sus Δ exactos a partir del HEX y los tokens (`#45403A` → `muted 40% /
ink` da 1,51, que redondea al Δ=2 que el documento tenía escrito a mano; `#8A6220` → `gold 65% /
ink` da 24, idéntico).

**Ahora hay una herramienta**: `herramientas/resolver-huerfanos-color.mjs`, en el plugin. Prueba
cada token del contrato solo y cada `color-mix(in srgb, tokenA P%, tokenB)` entre todos los pares,
por pasos de porcentaje configurables, y devuelve el mejor ajuste con su Δ, en una tabla lista para
pegar en el mapa de color del proyecto. `--umbral` separa lo que entra limpio (derivado válido) de
lo que no (avisar antes de aceptar una mezcla forzada). Documentada en `importar-handoff-diseno`
v0.2.0 y en `herramientas/LEEME.md`.

**Why:** era el paso más mecánico y más lento de convertir un handoff con paleta amplia a un
contrato de pocos tokens, y no existía ninguna herramienta para él — solo la advertencia de que
pasaría.

**How to apply:** en la fase 1/importación de cualquier proyecto nuevo, en cuanto se detecten HEX
del handoff fuera del contrato, correr esta herramienta antes de ponerse a medir contraste a mano.
No sustituye el criterio (¿hace falta de verdad el matiz?) ni el contraste WCAG, que sigue siendo
manual.

Ver [[plugin-wp-generateblocks]].
