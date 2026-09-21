---
name: piloto-design-tokens-gbpro28
description: PENDIENTE — montar piloto del sistema de Design Tokens de GB Pro 2.8 beta como puente Figma → WordPress; recordárselo a David al arrancar el proyecto
metadata: 
  node_type: memory
  type: project
  originSessionId: c06ab7c4-ba4c-4c5e-95c4-a3588c23c9b1
  modified: 2026-09-21T00:00:00.000Z
---

Estudiado el 17/09/2026 por inspección propia y **cotejado el 21/09/2026 contra la release
pública `wpgaurav/generateblocks-skills` v2026.09.18** (`skills/generateblocks-layouts/
references/design-systems-beta.md` + el kit de ejemplo real "Paper and Ink", probados por
ese autor el 18/09/2026 contra las mismas betas GB 2.5.0-beta.1 / Pro 2.8.0-beta.1 que
tenemos en `C:\TRABAJOS\wp-flujo\BETA\`). **Piloto pendiente, aún sin arrancar.**
Recordárselo a David la próxima vez que se abra este proyecto.

**Por qué importa:** GB Pro 2.8 define un artefacto JSON versionado, con importador y
exportador, que convierte el contrato de diseño en algo generable desde variables de Figma.
Es el puente que faltaba para [[decision-saltar-figma]] y encaja con el contrato de
[[flujo-wordpress-generateblocks]]. Nuestra herramienta actual `herramientas/conversion/
scripts/wp-push-tokens.mjs` **no toca este sistema**: escribe en los ajustes del TEMA
(`generate_settings.global_colors`, `generate_spacing_settings`), que son campos fijos del
chrome de GeneratePress. Design Tokens de GB Pro es una vía distinta y más amplia — variables
CSS libres, sin el límite de "solo los campos que GP expone" que ese script documenta como
límite conocido.

Formato confirmado contra el JSON real del kit (`ink.design-system.json`, 19 tokens /
24 `globalStyles`, no solo la guía en prosa):
- `kind: "generateblocks/design-system"`, `version: 1`. Claves de nivel superior: **solo**
  `kind`, `version`, `globalStyles`, `designTokens`. **Corrección sobre lo anotado el 17/09:
  no existe `categoryOrder` ni clases globales con campo `status`** en el artefacto real —
  eso no se confirmó en el JSON de ejemplo ni en la guía; probablemente fue una confusión con
  los campos internos de post-meta (`gb_style_category`, que sí existe pero es solo texto de
  organización, no una lista de "clases con estado").
- Los **valores** de `:root` viven en `globalStyles[0].styles` (`{"--kit-accent": "#943f28"}`)
  — confirmado.
- `designTokens[]`: `name`, `type` (`color`/`unit`/`text`), `label`, `category`, `scope[]` —
  confirmado byte a byte contra el JSON real. `display` y `id` existen como campos válidos del
  esquema pero no aparecen en ningún token del ejemplo real (el importador los admite pero
  no los exige). `id` se omite deliberadamente en ficheros portables — confirmado.
- **Novedad no anotada el 17/09**: `globalStyles[]` para selectores que NO son `:root` puede
  llevar un campo `targets: [".otro-selector"]` — permite que un mismo bloque de estilos
  (p. ej. `.kit-button`) también aplique a un selector ajeno (`.kit-form
  button[type="submit"]`) sin duplicar la definición. En post-meta esto vive como
  `gb_style_targets` + su CSS compilado aparte en `gb_style_targets_css`; en el artefacto
  portable es solo el array `targets`. Tiene comprobación de propiedad: no cualquier selector
  es asignable como si fuera una clase.
- **Novedad**: `--gb-container-width` (tipo `unit`) es un nombre reservado — si existe con
  valor usable, sustituye el control de ancho de contenedor del plugin free. El ajuste antiguo
  se conserva y vuelve si el token deja de existir.

Regalo colateral: un token con `scope: []` emite la variable CSS pero **no aparece en ningún
selector de color del bloque**. Convierte [[leccion-colores-generateblocks]] en una regla
imponible por datos en vez de por disciplina. El endpoint de auditoría es
`/generateblocks-pro/design-tokens/v1/usages?name=--nombre&refresh=true` — confirmado, con
letra pequeña: escaneo de 5.000 posts recientes por defecto y tope de 50 resultados candidatos;
no demuestra ausencia de uso en CSS externo de tema/plugin. Línea de
[[leccion-huerfanos-color-redmean]].

**Los límites, que deciden el esfuerzo del piloto:**
1. La compilación de CSS es de cliente — **confirmado y precisado**: el cuello de botella
   exacto es `gbp.stylesBuilder.getCss(selector, styles)`, asíncrono y solo disponible en el
   contexto JS del editor autenticado. El kit de ejemplo no rodea esto con REST manual: carga
   el script `dist/design-system-import.js` dentro del editor real y simplemente llama
   `await window.generateBlocksProDesignSystem.importMissing(artefacto)`. Para un piloto
   scriptado, la vía realista es un navegador headless (Playwright/Claude in Chrome) que abra
   el editor autenticado e inyecte esa llamada — no wp-cli, y no falta hacerlo a mano en la UI.
2. Existe también una vía de "escritura guardada" más low-level por si hiciera falta editar
   Global Styles fuera de `:root` con precisión: `GET`/`POST
   /generateblocks-pro/v1/styles/root` devuelve/exige `postId`, `styles`, `css`, `tokens`,
   `checksum`; la escritura lleva `gb_base_checksum` del último GET y el servidor devuelve
   `gb_style_checksum_conflict` si alguien más escribió entretanto (concurrencia optimista;
   no se fuerza el guardado, se relee y reconcilia). El origen conserva 3 snapshots previos
   de `:root` — no es backup del sitio. Para el piloto esto es secundario: `importMissing()`
   ya cubre el caso de uso de "traer el artefacto entero".
3. Solo tres tipos: `color`, `unit`, `text` — confirmado. Los `boolean` de Figma no tienen
   hueco y los `number` necesitan sufijo de unidad.
4. **No hay modos**: un solo `:root` plano — confirmado, la guía lo dice de forma indirecta
   ("Token at-rules can express OS color-scheme preferences [pero] no implementan un
   selector manual de tema"). Los modos claro/oscuro de Figma no mapean; la escapatoria sigue
   siendo que el validador de color acepta `light-dark()` y `color-mix()`.
5. Los nombres deben ser `--nombre`; slugificar `color/brand/primary` es donde se juega la
   estabilidad del round-trip.
6. Los alias de Figma sí viajan como `var(--otro)` (hay detección de ciclos) — confirmado.
7. **Novedad importante para el riesgo del piloto**: `importMissing()` es explícitamente
   "una integración específica de esta versión beta, no una API prometida como permanente".
   Y es de solo-inserción: reimportar sobre un destino ya rebrandeado no crea nada nuevo, no
   pisa lo existente, y solo informa cuántos estilos ya había — verificado empíricamente por
   ese autor (destino limpio: 19 tokens + 23 estilos importados; reimportación sobre destino
   rebrandeado: 0 nuevos, preserva el acento del destino). Bien para un primer piloto de
   "traer un sistema entero a un sitio limpio"; mal como mecanismo de actualización/sync
   continuo — para eso haría falta la vía de escritura guardada del punto 2, con su checksum.

**How to apply:** es beta — piloto en un Local WP de usar y tirar, nunca en producción de
cliente ([[puerta-calidad-wordpress]]). Primer paso barato y decisivo: instalar las dos betas
juntas (Pro 2.8 exige GB ≥ 1.3.0, pero vienen emparejadas), exportar el Design System de un
proyecto ya hecho y **diffear ese JSON real contra nuestro `contrato.json`**. Ese diff dice en
una tarde si el conversor Figma → artefacto es media hora de script o una semana peleando con
nombres y modos. Con el cotejo de hoy, el paso siguiente además concreto es: escribir el
conversor `contrato.json` (W3C/Tokens Studio, leído por `lib-contrato.mjs`) → artefacto
`kind: "generateblocks/design-system"` (mapeo directo: cada token con `$type: color` → tipo
`color`; `$type` de dimensión con sufijo de unidad → tipo `unit`; el resto → `text`; alias
`{ruta}` de Tokens Studio → `var(--nombre)`, que es exactamente el mismo mecanismo que ya
resuelve `resolverAlias` en `lib-contrato.mjs`), y probar la importación en el Local de usar y
tirar con un navegador automatizado en vez de con la UI a mano.
