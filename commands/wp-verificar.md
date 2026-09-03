---
description: Corre la cadena de comprobación del proyecto — contrato, validadores, round-trip y contrato publicado
argument-hint: [url de una página publicada]
---

Verifica el proyecto de esta carpeta. URL indicada por el usuario, si la hay: $ARGUMENTS

Si existe `verificar.mjs` en la raíz del proyecto, usa ese —lo generó `nuevo-proyecto.js` y sabe
dónde está todo:

```
node verificar.mjs [--url <url>]
```

Si **no** existe (proyecto anterior al generador), corre la cadena a mano, en este orden, y luego
ofrece crear el `verificar.mjs` que falta:

1. **Contrato sincronizado** — `herramientas/tokens-a-css.js <x.tokens.json> --verificar <x.tokens.css>`
2. **Los dos validadores** sobre cada `build/*.html` — `herramientas/conversion/scripts/validate-blocks.mjs`
   y `herramientas/audit-gb.js`. **Los dos, siempre**: ninguno domina al otro.
3. **Round-trip** — `herramientas/conversion/scripts/wp-roundtrip.mjs`, si hay credenciales.
   No es un tercer validador: le pregunta a WordPress qué hace al guardar, en vez de suponerlo.
4. **Contrato publicado** — `herramientas/conversion/scripts/qa-contrato-publicado.mjs <url> --tokens <x.tokens.css>`

Todas las rutas cuelgan de `${CLAUDE_PLUGIN_ROOT}`.

El paso 4 es el que más se olvida y el único que caza **«declarar no es publicar»**: que el
marcado diga `var(--bg-page)` o `font-family: Fraunces` no significa que el navegador lo reciba.
Este flujo cometió ese fallo dos veces en dos semanas sin que ninguna otra capa lo viera, así que
**no lo omitas por parecer redundante**. Necesita la URL real y servida, con subdirectorio si lo
hay; si no la tienes, pídesela al usuario en vez de saltarte el paso.

Cuando algo falle, di **qué** falló y **qué lo arregla**, no solo que falló. Y si todo pasa, dilo
sin adornos.

Para la entrega o el paso a producción, esto no basta: invoca además la skill
`puerta-calidad-wordpress`, que cubre enlaces rotos, peso de imagen, accesibilidad y rendimiento.
