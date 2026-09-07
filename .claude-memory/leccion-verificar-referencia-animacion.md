---
name: leccion-verificar-referencia-animacion
description: "cuando una referencia de animación da una URL, medirla con herramientas/referencia/medir-referencia.mjs — no asumir el patrón GSAP habitual del flujo"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: df9e952d-84b2-49bf-9dbe-ffde836763ff
  modified: 2026-09-07T12:16:19.247Z
---

Cuando el usuario (o una anotación de Figma) da una URL como referencia de una animación, entrar a
esa URL de verdad y medirla — no basta con mirar una captura de pantalla, ni con asumir el patrón
más habitual de este flujo (GSAP + ScrollTrigger, fundido/deslizamiento).

**Actualizado 7/09/2026:** esto ya no hace falta hacerlo a mano con `javascript_tool`. Existe
`node herramientas/referencia/medir-referencia.mjs <url>` en el plugin `wp-flujo` — en un comando
da la paleta, la escala tipográfica, los contenedores por sección, y sobre todo qué elementos
tienen `opacity`/`transform`/`filter` puestos EN LÍNEA (el estado inicial que dejan los motores
tipo Framer antes de disparar el JS) y qué es `position:sticky`/`fixed`. Úsalo primero; solo si
hace falta algo más fino (comportamiento exacto durante el scroll) recurrir a `javascript_tool` a
mano.

**Why:** en el proyecto Hedvig, la primera versión de la animación de la sección "Benefits" se
escribió a partir de leer la anotación de Figma ("mira cómo anima `hedvig.framer.website`") sin
entrar a esa web. Salió con `gsap.from()` (fundido + deslizamiento), el mismo patrón ya usado en
ACELIA — plausible, pero equivocado. El usuario corrigió explícitamente: *"la animación real la
debes buscar en la Anotación, entrar en la web real"*. Al entrar de verdad y medir con JS mientras
se hacía scroll, la animación real resultó ser apilamiento por **CSS puro**
(`position:sticky;top:0`, tarjetas sin hueco entre ellas) — cero líneas de GSAP, un mecanismo
completamente distinto al que se había asumido. Ver [[proyecto-hedvig-landing]] y la trampa 17 de
la skill `flujo-wordpress-generateblocks`.

**How to apply:** en cualquier tarea de "replica esta animación/interacción de referencia", el
primer paso es abrir la URL con el navegador y comprobar el mecanismo real (¿cambia `transform`?
¿`opacity`? ¿es `position:sticky`/`fixed`? ¿hay JS de por medio o es puro CSS?) antes de escribir
una sola línea de implementación. No dar por sentado que el mecanismo coincide con el patrón que
ya se usó en un proyecto anterior, aunque la petición lo sugiera ("animación GSAP").
