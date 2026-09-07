---
name: proyecto-hedvig-landing
description: WEB HEDVIG es el proyecto activo en figma-staging; ACELIA se descartó y se limpió por completo de WordPress
metadata: 
  node_type: memory
  type: project
  originSessionId: df9e952d-84b2-49bf-9dbe-ffde836763ff
  modified: 2026-09-07T09:13:34.865Z
---

**`figma-staging` (Local WP, puerto MySQL 10011) está dedicado ahora a `C:\TRABAJOS\WEB HEDVIG`**,
una landing completa (8 secciones) montada el 7/09/2026 a partir del fichero de Figma
`hyAMxyeACYAZF32olj6sZU` ("Prueba de animaciones") — el mismo fichero de [[figma-mcp-anotaciones]].
Página portada: "Hedvig – home" (post 49781). Incluye la animación GSAP de la anotación (fase 6,
sección "Benefits", 3 tarjetas) y header/footer como Elementos de GeneratePress.

**ACELIA (`C:\TRABAJOS\WEB ACELIA`) está descartado.** El usuario lo llamó explícitamente "una
prueba" y pidió borrarlo. Se limpió por completo de `figma-staging` (página, Elementos, menú,
17 medios, tema `generatepress-acelia` — todo vía wp-cli) el 7/09/2026. La carpeta local **se
dejó intacta como archivo**, a petición explícita del usuario (eligió "solo limpiar WordPress"
frente a "borrar todo" cuando se le preguntó) — no tiene remoto git, así que sigue siendo el único
sitio donde queda su historial, pero no se usa para nada más.

**Why:** evita que una futura conversación intente seguir trabajando en ACELIA (páginas/Elementos
ya no existen en WordPress) o proponga volver a limpiar/borrar la carpeta local (ya se decidió
conservarla, no hace falta volver a preguntar).

**How to apply:** si el usuario menciona "el proyecto de WordPress" o "figma-staging" sin más
contexto, asumir que se refiere a Hedvig salvo que diga lo contrario. Las cuatro trampas técnicas
encontradas montando Hedvig (secciones a sangre completa en GeneratePress, `sizes="auto"` de WP
6.7+, Elementos que necesitan `_generate_element_type` además de `_generate_block_type`,
`overflow-x:hidden` en `html` no en `body`) están documentadas en la skill
`flujo-wordpress-generateblocks` (trampas 13-16) — no hace falta repetirlas aquí, se cargan solas.
