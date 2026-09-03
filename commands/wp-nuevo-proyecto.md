---
description: Levanta el esqueleto de un proyecto web de cliente con el flujo Figma → GenerateBlocks ya montado
argument-hint: "<Nombre del proyecto>" [sistema de diseño] [sitio de Local WP]
---

El usuario quiere empezar un proyecto web nuevo con este flujo. Argumentos que ha dado: $ARGUMENTS

Levántalo con el generador del plugin. **No montes la estructura a mano** y no copies ficheros de
otro proyecto: el generador existe justamente porque hacerlo a mano se olvidaba piezas.

```
node "${CLAUDE_PLUGIN_ROOT}/herramientas/nuevo-proyecto.js" "<Nombre>" \
  --sistema <sistema-de-diseño> --slug <slug-del-plugin> \
  --sitio <carpeta-en-local-wp> --puerto <WP_MYSQL_PORT>
```

Antes de ejecutarlo necesitas cuatro datos. Deduce del nombre los que puedas y **pregunta solo
por los que no puedas deducir**, en una sola tanda:

- **sistema** — el sistema de diseño. Si el usuario ya tiene uno (Pergamino, por ejemplo), ese.
- **slug** — identificador del plugin del proyecto en WordPress. Minúsculas y guiones.
- **sitio** — la carpeta del sitio en Local WP. Si no existe todavía, dilo: la fase 0 es crear el
  entorno **antes** de diseñar, no después.
- **puerto** — el `WP_MYSQL_PORT` de ese sitio. Se saca de Local, o probando `wp core version`.

Después:

1. Enseña qué ha generado y lee al usuario los pasos que imprime el generador.
2. Ofrece hacer `git init` y el primer commit.
3. Recuérdale que `.env.local` va **con comillas** en los valores: las contraseñas de aplicación
   llevan espacios y sin comillas se truncan.

El método completo está en la skill `flujo-wordpress-generateblocks`. Invócala si vais a seguir
con las fases; este comando solo monta el punto de partida.
