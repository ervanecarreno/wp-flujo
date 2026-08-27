---
name: puerta-calidad-wordpress
description: "Las 5 herramientas CLI gratuitas que validan el ENTORNO antes de producción, no solo el marcado"
metadata: 
  node_type: memory
  type: reference
  originSessionId: ad32cce8-eb62-47ea-b405-8e27ce6dd01c
  modified: 2026-08-27T07:33:25.931Z
---

Antes de subir a producción cualquier proyecto WordPress de Javier, ejecutar contra el sitio en
staging **con la URL real, subdirectorio incluido si lo hay** (nunca contra un HTML local suelto):

1. `npx linkinator <url> --recurse --concurrency 20` — enlaces e imágenes rotas. Es lo único que
   habría detectado los 11×404 del [[proyecto-aridane-home]], porque resuelve rutas como el
   navegador real, no como el marcado
2. Peso/formato de imagen: convertir con `sharp-cli` o `avif-cli` (NO `squoosh-cli`, sin
   mantenimiento activo desde que Google disolvió el equipo). Presupuesto orientativo: <200 KB
   por imagen above-the-fold
3. `pa11y-ci` + `@axe-core/cli` — WCAG 2.1 AA, obligatorio por RD 1112/2018 para cualquier web de
   ayuntamiento, no opcional
4. `lhci autorun` (Lighthouse CI) — umbral de CLS (`maxNumericValue: 0.1`) y LCP ≤2.5s
5. `wp-cli doctor` — salud general de WordPress (autoload options, integridad de plugins)

Todas gratuitas, de código abierto, sin plan de pago necesario, ejecutables en Windows sin
infraestructura de CI dedicada.

Esta capa es complementaria al validador Node de marcado (el que compara `css` reconstruido desde
`styles`, ver [[leccion-rutas-wordpress-subdirectorio]]) — una valida el CONTENIDO, la otra el
ENTORNO. Ninguna sustituye a la otra; las dos hacían falta en Aridane y ninguna existía.

Es la Fase 7 de [[flujo-wordpress-generateblocks]].
