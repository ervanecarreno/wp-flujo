---
name: plugin-wp-generateblocks
description: El flujo de 8 fases ya está empaquetado como plugin de Claude Code en C:\TRABAJOS\wp-flujo, con 4 skills y las herramientas dentro
metadata: 
  node_type: memory
  type: project
  modified: 2026-08-27T10:40:00.000Z
---

Desde el 27/08/2026 el flujo de [[flujo-wordpress-generateblocks]] **ya no es solo un documento**:
está empaquetado como plugin de Claude Code en el propio repo `C:\TRABAJOS\wp-flujo`
(el repo ES el plugin: `.claude-plugin/plugin.json` en la raíz, más `marketplace.json` con
`"source": "./"`). Se llama **`wp-generateblocks`**, versión 0.1.0.

Decisión de fondo: plugin y no skill suelta, porque lo que se perdió al cambiar de máquina no fue
el texto —la skill de cuenta se sincronizó sola— sino los **scripts**; y los hooks, exclusivos de
plugin, son lo único que puede hacer que validar no dependa de acordarse.

**Las 4 skills** (cada una con su propio disparador, sin solaparse):
`flujo-wordpress-generateblocks` (las 8 fases), `generar-bloques-generateblocks` (método,
checklist de 10 casillas, validador obligatorio), `wp-cli-en-local` (los envoltorios de wp-cli) y
`puerta-calidad-wordpress` (fase 7).

**Principio de diseño que hay que mantener:** las skills **apuntan** a los documentos que ya viajan
en el repo (`traspaso-2026-08-26/SETUP-RECOMENDADO.md`, `docs/metodo-generateblocks-v2.md`) en vez
de copiar su contenido. Una sola fuente de verdad. Si se duplica, se desincroniza.

**Pendiente que es de Javier, no del repo:** desactivar la skill de cuenta **`web-para-wordpress`**.
Su descripción empuja a `theme.json` y ACF Blocks, contra las conclusiones de la investigación, y
compite con las skills del plugin. No se edita desde el repositorio: es una skill de la cuenta.

Estado de las etapas y lo que queda, siempre en `ESTADO.md` de la raíz del repo.
