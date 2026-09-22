# wp-generateblocks

Plugin de Claude Code que empaqueta el flujo de trabajo de 8 fases para webs WordPress de cliente
con **GeneratePress + GenerateBlocks Pro V2**, junto con las herramientas que lo hacen ejecutable.

No es un proyecto de cliente. Es la maquinaria que se usa **en** los proyectos de cliente.

Para el estado del trabajo y qué toca hacer ahora, lee **[ESTADO.md](ESTADO.md)**.

Para el procedimiento — quién decide qué, qué se comparte, el circuito de cada tarea — lee
**[COMO-TRABAJAMOS.md](COMO-TRABAJAMOS.md)**. Es el documento que rige, no una skill más: si algo
en las skills discrepa con él, gana él.

## Qué trae

| Carpeta | Contenido |
|---|---|
| `skills/` | Las 7 skills propias del flujo, más las 8 skills oficiales de GSAP vendorizadas (ver abajo) |
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

## Dos skills de diseño añadidas en 0.14.0

| Skill | Qué resuelve |
|---|---|
| `directrices-interfaz-web` | Las directrices oficiales de **Vercel Labs** (MIT), vendorizadas: más de 100 reglas MUST/SHOULD/NEVER de teclado, foco, formularios, animación, maquetación, accesibilidad y rendimiento. **Complementa a la fase 7, no la sustituye:** pa11y y Lighthouse cazan lo automatizable, esto cubre lo que ninguna herramienta ve (foco perdido al cerrar un modal, destinos táctiles de 18 px, formularios que bloquean el pegado). La cabecera de la skill marca qué bloques son de React/Next y no aplican aquí. |
| `sembrar-contrato-de-diseno` | Arranca `design/<sistema>.tokens.json` partiendo de un DESIGN.md del catálogo de `voltagent/awesome-design-md` (~74 sistemas) en vez de inventar la escala a ojo. Lleva la tabla de conversión al contrato y la regla de siempre: **del DESIGN.md se copian valores, los nombres del contrato no cambian.** El catálogo no se vendoriza: se consulta en el momento. |

## Las 8 skills de GSAP (vendorizadas)

Copia local de las skills oficiales de GreenSock (`github.com/greensock/gsap-skills`, MIT — licencia
en `skills/LICENCIA-GSAP-SKILLS.txt`), metidas dentro del plugin para que viajen con él en cualquier
máquina donde se instale, sin depender de un marketplace externo añadido a mano.

- **`gsap-core`** — API base: `gsap.to/from/fromTo`, easing, stagger, `gsap.matchMedia()` (responsive
  y `prefers-reduced-motion`).
- **`gsap-timeline`** — secuenciar varios pasos con `gsap.timeline()`.
- **`gsap-scrolltrigger`** — animación ligada al scroll. La que más se usa en Fase 6.
- **`gsap-plugins`** — Flip, Draggable, SplitText, MorphSVG y el resto (todos gratis tras la compra
  de Webflow, sin Club GSAP).
- **`gsap-utils`** — helpers (`clamp`, `mapRange`, etc.).
- **`gsap-performance`** — buenas prácticas de rendimiento.
- **`gsap-react`** / **`gsap-frameworks`** — solo aplican si un proyecto de cliente usa React/Vue/
  Svelte, algo fuera de lo habitual en este flujo (tema hijo PHP + JS vanilla), pero se dejan por si
  hace falta.

Estas skills enseñan **cómo escribir GSAP correcto** (API, timelines, ScrollTrigger). No sustituyen a
`herramientas/animacion/instalar-gsap.js`, que resuelve otra cosa: deja instalada la biblioteca de
clases del proyecto (`-reveal`, `-stagger`, etc.) y el enqueue en WordPress. Se usan juntas: el
tooling monta el andamiaje, las skills guían cómo se escribe la animación dentro de él.

## Usarlo en un proyecto de cliente

Las skills tienen que estar disponibles **fuera** de esta carpeta, porque los proyectos de cliente
viven en otro sitio. Para eso se instala como plugin.

La instalación de plugins se hace desde el menú `/plugin` de Claude Code en un terminal
interactivo: primero se añade este repositorio como *marketplace* (la ruta
`C:\TRABAJOS\wp-flujo`, que ya contiene `.claude-plugin/marketplace.json`) y después se instala
el plugin `wp-generateblocks`.

Alternativa sin plugin, para probarlo antes: copiar todas las carpetas de `skills/` a
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
