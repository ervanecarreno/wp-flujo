# wp-generateblocks

Plugin de Claude Code que empaqueta el flujo de trabajo de 8 fases para webs WordPress de cliente
con **GeneratePress + GenerateBlocks Pro V2 + ACF**, junto con las herramientas que lo hacen
ejecutable.

No es un proyecto de cliente. Es la maquinaria que se usa **en** los proyectos de cliente.

Para el estado del trabajo y qué toca hacer ahora, lee **[ESTADO.md](ESTADO.md)**.

## Qué trae

| Carpeta | Contenido |
|---|---|
| `skills/` | Las 5 skills: el flujo de 8 fases, importación de handoff, generación de bloques, wp-cli en Local y la puerta de calidad |
| `herramientas/` | Validadores Node sin dependencias (`audit-gb.js`, `audit-cross.js`, `fix-gb.js`) |
| `herramientas/conversion/` | **Figma → GenerateBlocks**: conversión de frames, emisores canónicos, ensamblador y QA. Cierra la laguna que el flujo tenía reconocida. Ver su [LEEME](herramientas/conversion/LEEME.md) |
| `herramientas/wp-cli/` | `wp.cmd` y `php.cmd`: usan el PHP y wp-cli que ya trae Local WP, sin instalar nada |
| `herramientas/animacion/` | Fase 6 (GSAP): `instalar-gsap.js` instala una biblioteca de clases de animación ya lista (no una plantilla), solo cuando el proyecto lo necesita |
| `herramientas/desplegar-tema.mjs` | Copia `wp/tema-hijo/` al tema real del sitio en Local — corre esto tras tocar cualquier fichero del tema hijo |
| `herramientas/referencia/` | `medir-referencia.mjs`: audita una web de referencia (paleta, tipografía, contenedores, animación) con medidas reales, no a ojo |
| `docs/` | El método de referencia de GB Pro V2 y la auditoría del caso de estudio |
| `verificacion/` | Pruebas empíricas puntuales, como el round-trip del escapado de WordPress |
| `traspaso-2026-08-26/` | El flujo sintetizado y los 130 KB de investigación con fuentes |

## Las 5 skills

- **`flujo-wordpress-generateblocks`** — se activa al aparecer un proyecto WordPress de cliente.
  Las 8 fases, las siete trampas ya pagadas, el punto de decisión de conversión y lo descartado con fundamento.
- **`importar-handoff-diseno`** — cuando el marcado **ya existe** (un handoff de Claude Design u
  otro origen). Pregunta el tipo de conversión —GenerateBlocks Pro V2 o Gutenberg nativo— y avisa de
  las dos trampas silenciosas de la importación.
- **`generar-bloques-generateblocks`** — al escribir o corregir marcado de bloques. Incluye el
  checklist de 10 casillas y obliga a pasar el validador.
- **`wp-cli-en-local`** — antes de proponer cualquier comando `wp` o `php`.
- **`puerta-calidad-wordpress`** — antes de entregar o publicar.

## Usarlo en un proyecto de cliente

Las skills tienen que estar disponibles **fuera** de esta carpeta, porque los proyectos de cliente
viven en otro sitio. Para eso se instala como plugin.

La instalación de plugins se hace desde el menú `/plugin` de Claude Code en un terminal
interactivo: primero se añade este repositorio como *marketplace* (la ruta
`C:\TRABAJOS\wp-flujo`, que ya contiene `.claude-plugin/marketplace.json`) y después se instala
el plugin `wp-generateblocks`.

Alternativa sin plugin, para probarlo antes: copiar las cinco carpetas de `skills/` a
`%USERPROFILE%\.claude\skills\`. **Sin verificar todavía** en esta máquina — esa carpeta no existe
aún, así que habría que crearla y comprobar que las skills se cargan.

## Importante al instalarlo

Existe una skill antigua en la cuenta llamada **`web-para-wordpress`** cuya descripción empuja a
usar `theme.json` y ACF Blocks, en contra de lo que concluyó la investigación. **Hay que
desactivarla** al instalar este plugin, o habrá dos criterios en competencia. Se desactiva desde la
gestión de skills de la cuenta, no desde este repositorio.

## Requisitos

- **Node** (probado en v24) para los validadores. Sin dependencias: no hay `npm install`.
- **Local WP** para PHP y wp-cli. No hace falta instalar PHP ni wp-cli en el sistema.
