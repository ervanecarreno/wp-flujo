---
name: figma-mcp-anotaciones
description: El MCP de Figma sí conecta (OAuth por sesión) y las anotaciones de Dev Mode son un canal de instrucciones por sección que Claude puede leer
metadata: 
  node_type: memory
  type: project
  originSessionId: df9e952d-84b2-49bf-9dbe-ffde836763ff
  modified: 2026-09-07T08:07:42.093Z
---

El MCP `plugin:figma:figma` conecta y funciona — verificado el 7/09/2026, contradice el estado
"no disponible" registrado el 28/08 en `docs/rutas-de-conversion.md` de [[plugin-wp-generateblocks]].
La autorización es **OAuth por sesión de Claude Code** (vía `mcp__plugin_figma_figma__authenticate`,
enlace que se abre en el navegador), no un token permanente: hay que rehacerla en sesiones nuevas si
no queda cacheada. Un error típico al reintentar es "Invalid state parameter" — pasa por reutilizar
un enlace viejo; hay que generar uno nuevo con `authenticate` y usar ese, no repetir el anterior.

**Las anotaciones de Dev Mode de Figma (`node.annotations`, leídas con `use_figma`) son un canal
real para que el cliente/diseñador deje instrucciones ancladas a una sección concreta** — no al
fichero entero. Pueden estar en un nodo hijo, no en el frame raíz que da la URL, así que hay que
recorrer con `findAll` buscando `annotations.length > 0`, no asumir que están en el nodo del
`node-id` de la URL.

**Why:** el usuario lo usó primero como prueba (fichero "Prueba de animaciones" en Figma,
`hyAMxyeACYAZF32olj6sZU`) para ver si Claude podía leer una nota suya, y confirmó que sí — ahora lo
considera una forma válida de comunicarse con Claude sobre secciones específicas de un diseño en
Figma, especialmente para la referencia de animación que pide la fase 6 (GSAP) del flujo.

**How to apply:** documentado ya como capacidad del flujo en la skill
`flujo-wordpress-generateblocks` (sección "Anotaciones de Figma: canal de instrucciones por
sección", desde la versión 0.8.0). Si el usuario menciona que ha dejado una nota/anotación en
Figma, o pregunta "qué pone" en una sección, comprobar ahí antes de asumir que hay que leer texto
visible del diseño o pedir que lo copie a mano. No confundir con "Figma como fuente del marcado"
(descartado en la misma skill): leer una anotación es una lectura puntual y barata, no extracción
de árbol de nodos para generar bloques.
