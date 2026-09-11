---
name: proyecto-hedvig-landing
description: HEDVIG y ACELIA están cerrados y archivados en _archivo; el sitio figma-staging de Local WP todavía conserva el WordPress de Hedvig
metadata: 
  node_type: memory
  type: project
  originSessionId: df9e952d-84b2-49bf-9dbe-ffde836763ff
  modified: 2026-09-11T00:00:00.000Z
---

**Cerrados los dos, el 11/09/2026.** Javier pidió limpiar los proyectos de prueba. Las carpetas se
**movieron a `C:\TRABAJOS\_archivo\`** con su convención de nombre, no se borraron:

- `_archivo\WEB ACELIA (prueba cerrada 11-09-2026)` — 15 commits, 56 MB
- `_archivo\WEB HEDVIG (prueba cerrada 11-09-2026)` — 3 commits, 11 MB

Ninguna tiene remoto git: esas carpetas son **el único sitio donde existe su historial**. Por eso se
archivaron en vez de borrarse, decisión que tomó Javier cuando se le planteó. No proponer borrarlas
otra vez sin que él lo pida.

En la misma limpieza **sí se borraron del todo**, con su permiso: `Bomberos comparativas web` (que no
era un proyecto, solo un PDF de anotaciones) y `prueba-claude-design` (cuyo propio `HALLAZGOS.md`
decía que se borrara al terminar; sus conclusiones ya viven en `docs/prueba-handoff.md` del plugin).

**Lo que queda vivo y no se tocó:** el sitio **`figma-staging` de Local WP (puerto MySQL 10011)**
todavía tiene dentro el WordPress de Hedvig — la página "Hedvig – home" (post 49781), los Elementos
de header/footer, el menú y los medios. Archivar la carpeta no toca el WordPress. Si algún día se
quiere el sitio limpio de verdad, hay que vaciarlo por wp-cli como ya se hizo con ACELIA el
7/09/2026 (página, Elementos, menú, 17 medios y el tema `generatepress-acelia`).

**Why:** que una conversación futura no intente seguir trabajando en estos proyectos como si
estuvieran activos, ni vuelva a preguntar si se borran.

**How to apply:** si Javier menciona "el proyecto de WordPress" o "figma-staging" sin más contexto,
ya **no** se puede asumir Hedvig — preguntar. Las lecciones técnicas que dejaron los dos siguen
vivas dentro del plugin y se cargan solas: las trampas 13-16 de la skill
`flujo-wordpress-generateblocks` (secciones a sangre completa en GeneratePress, `sizes="auto"` de
WP 6.7+, Elementos que necesitan `_generate_element_type`, `overflow-x:hidden` en `html` no en
`body`), más [[leccion-verificar-referencia-animacion]] y [[leccion-rutas-wordpress-subdirectorio]].
Varias herramientas de `herramientas/` citan estos proyectos en sus comentarios como la evidencia de
por qué existe cada regla: esas citas son historia, no rutas — no hay que "arreglarlas".
