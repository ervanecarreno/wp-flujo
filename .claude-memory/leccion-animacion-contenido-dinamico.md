---
name: leccion-animacion-contenido-dinamico
description: "La animación con GSAP sobre query loops debe re-consultar el DOM y refrescar ScrollTrigger, nunca asumir un número fijo de elementos"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: ad32cce8-eb62-47ea-b405-8e27ce6dd01c
  modified: 2026-08-27T07:33:15.895Z
---

Al animar contenido que viene de un query loop de WordPress (noticias, CPTs, cualquier listado
dinámico) con GSAP/ScrollTrigger: inicializar en `DOMContentLoaded` después del HTML renderizado
en servidor, pero además re-consultar el DOM (`querySelectorAll`, nunca una NodeList cacheada) y
llamar a `ScrollTrigger.refresh()` cada vez que el contenido cambie de cantidad (paginación,
filtros AJAX, "cargar más").

**Why:** un demo que asume un número fijo de tarjetas funciona en local y se rompe en producción
en cuanto el query loop devuelve un número distinto — es la misma clase de fragilidad que el
desfase de breakpoint CSS/JS de 13px que costó caro en el [[proyecto-aridane-home]] (fuente única
de verdad que nadie sincronizó). GenerateBlocks Pro no tiene animación nativa por scroll
(confirmado dos veces por su soporte oficial): su panel Effects es solo hover/focus vía CSS, así
que cualquier animación de entrada por scroll pasa obligatoriamente por GSAP.

**How to apply:** en la fase 6 de [[flujo-wordpress-generateblocks]], cualquier animación sobre
un query loop lleva el patrón re-query + refresh, nunca un `querySelectorAll` ejecutado una sola
vez al cargar. Enqueue de GSAP vía tema hijo (portable, viaja con el repo), no WPCode (vive en la
BD). Accesibilidad: `prefers-reduced-motion`, animar solo `transform`/`opacity`.
