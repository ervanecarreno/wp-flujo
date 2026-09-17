---
name: piloto-design-tokens-gbpro28
description: PENDIENTE — montar piloto del sistema de Design Tokens de GB Pro 2.8 beta como puente Figma → WordPress; recordárselo a David al arrancar el proyecto
metadata: 
  node_type: memory
  type: project
  originSessionId: c06ab7c4-ba4c-4c5e-95c4-a3588c23c9b1
  modified: 2026-09-17T15:01:41.410Z
---

Estudiado el 17/09/2026: los zips de GenerateBlocks 2.5.0-beta.1 y GenerateBlocks Pro
2.8.0-beta.1 están en `C:\TRABAJOS\wp-flujo\BETA\`. **Piloto pendiente, aún sin arrancar.**
Recordárselo a David la próxima vez que se abra este proyecto.

**Por qué importa:** GB Pro 2.8 define un artefacto JSON versionado, con importador y
exportador, que convierte el contrato de diseño en algo generable desde variables de Figma.
Es el puente que faltaba para [[decision-saltar-figma]] y encaja con el contrato de
[[flujo-wordpress-generateblocks]].

Formato (`kind: "generateblocks/design-system"`, `version: 1`):
- Los **valores** viven en `globalStyles[":root"].styles` (`{"--color-marca": "#0a5"}`).
- `designTokens[]` es solo el registro de metadatos: `name`, `type`, `label`, `category`,
  `scope[]`, `display?`. El importador exige que cada token tenga su valor en `:root`.
- También viaja `categoryOrder` y las clases globales (`selector`, `styles`, `category`, `status`).

Dos vías de entrada: el **panel Diseño → importar fichero** (límite 25 MB), y la **API pública
de navegador** `window.generateBlocksProDesignSystem.importMissing(artefacto)`, que es no
destructiva (`conflictMode: "skip"`). Se habilita con
`generateblocks_pro_enqueue_design_system_import()`, que a propósito **no está enganchada a
ningún hook**: es un punto de extensión pensado para plugins consumidores como el nuestro
([[plugin-wp-generateblocks]]).

Regalo colateral: un token con `scope: []` emite la variable CSS pero **no aparece en ningún
selector de color del bloque**. Convierte [[leccion-colores-generateblocks]] en una regla
imponible por datos en vez de por disciplina. Y el endpoint REST `/usages` dice dónde se usa
cada token — auditoría gratis, en la línea de [[leccion-huerfanos-color-redmean]].

**Los límites, que deciden el esfuerzo del piloto:**
1. La compilación de CSS es de cliente. `Styles_Root::save()` es público en PHP pero exige el
   CSS ya compilado, así que **no hay camino limpio por wp-cli** — la importación pasa por
   navegador sí o sí.
2. Solo tres tipos: `color`, `unit`, `text`. Los `boolean` de Figma no tienen hueco y los
   `number` necesitan sufijo de unidad.
3. **No hay modos**: un solo `:root` plano. Los modos claro/oscuro de Figma no mapean; la
   escapatoria es que el validador de color acepta `light-dark()` y `color-mix()`.
4. Los nombres deben ser `--nombre`; slugificar `color/brand/primary` es donde se juega la
   estabilidad del round-trip.
5. Los alias de Figma sí viajan como `var(--otro)` (hay detección de ciclos).

**How to apply:** es beta — piloto en un Local WP de usar y tirar, nunca en producción de
cliente ([[puerta-calidad-wordpress]]). Primer paso barato y decisivo: instalar las dos betas
juntas (Pro 2.8 exige GB ≥ 1.3.0, pero vienen emparejadas), exportar el Design System de un
proyecto ya hecho y **diffear ese JSON real contra nuestro `contrato.json`**. Ese diff dice en
una tarde si el conversor Figma → artefacto es media hora de script o una semana peleando con
nombres y modos.
