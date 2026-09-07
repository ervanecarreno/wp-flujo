---
name: leccion-verificar-referencia-animacion
description: "cuando una referencia de animación da una URL, hay que entrar y medir con JS mientras se scrollea — no asumir el patrón GSAP habitual del flujo"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: df9e952d-84b2-49bf-9dbe-ffde836763ff
  modified: 2026-09-07T09:27:33.276Z
---

Cuando el usuario (o una anotación de Figma) da una URL como referencia de una animación, entrar a
esa URL de verdad y medir el comportamiento con scroll real + `getComputedStyle` (vía
`javascript_tool`, cambiando `window.scrollTo` y leyendo `transform`/`opacity`/`position` de los
nodos relevantes) — no basta con mirar una captura de pantalla, ni con asumir el patrón más
habitual de este flujo (GSAP + ScrollTrigger, fundido/deslizamiento).

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
