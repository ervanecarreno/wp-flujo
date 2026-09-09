---
name: plugin-wp-generateblocks
description: "El flujo de 8 fases ya está empaquetado como plugin de Claude Code en C:\\TRABAJOS\\wp-flujo, con 5 skills propias más 8 skills de GSAP vendorizadas"
metadata: 
  node_type: memory
  type: project
  modified: 2026-09-07T12:44:22.430Z
  originSessionId: df9e952d-84b2-49bf-9dbe-ffde836763ff
---

Desde el 27/08/2026 el flujo de [[flujo-wordpress-generateblocks]] **ya no es solo un documento**:
está empaquetado como plugin de Claude Code en el propio repo `C:\TRABAJOS\wp-flujo`
(el repo ES el plugin: `.claude-plugin/plugin.json` en la raíz, más `marketplace.json` con
`"source": "./"`). Se llama **`wp-generateblocks`**, y desde el 9/09/2026 vive publicado en
github.com/ervanecarreno/wp-flujo (privado), con releases etiquetadas por `claude plugin tag` en
formato `wp-generateblocks--v<version>`. Va por 0.13.1.

**Trampa del propio plugin, aprendida el 9/09/2026:** `/plugin install` hace una **copia** en
`~/.claude/plugins/cache/`, no un enlace vivo al repo. Editar `C:\TRABAJOS\wp-flujo` no cambia lo
que Claude carga: hace falta `claude plugin update wp-generateblocks@metropolis-wp` y reiniciar.
Sin eso, el plugin instalado estuvo congelado en 0.2.0 durante dos semanas mientras el repo iba por
0.13.0 — sin comandos ni skills de GSAP, y sin ningún aviso. `claude plugin list` dice la versión
real instalada.

Decisión de fondo: plugin y no skill suelta, porque lo que se perdió al cambiar de máquina no fue
el texto —la skill de cuenta se sincronizó sola— sino los **scripts**; y los hooks, exclusivos de
plugin, son lo único que puede hacer que validar no dependa de acordarse.

**Las 5 skills** (cada una con su propio disparador, sin solaparse):
`flujo-wordpress-generateblocks` (las 8 fases y el punto de decisión de conversión),
`importar-handoff-diseno` (marcado que ya existe: elige vía e importa),
`generar-bloques-generateblocks` (método, checklist de 10 casillas, validador obligatorio),
`wp-cli-en-local` (los envoltorios de wp-cli) y `puerta-calidad-wordpress` (fase 7).

**Añadido el 7/09/2026:** las 8 skills oficiales de GSAP (`gsap-core`, `gsap-timeline`,
`gsap-scrolltrigger`, `gsap-plugins`, `gsap-utils`, `gsap-performance`, `gsap-react`,
`gsap-frameworks`) están **vendorizadas** dentro de `skills/`, copiadas desde
`github.com/greensock/gsap-skills` (MIT) en vez de instalarlas aparte como marketplace, para que
viajen con el plugin a cualquier máquina. Complementan a `herramientas/animacion/instalar-gsap.js`:
la herramienta monta el andamiaje (biblioteca de clases), las skills enseñan la API cuando hace
falta escribir GSAP a mano.

**Decisión del 28/08/2026 pedida por Javier:** en todo proyecto nuevo hay que **preguntar el tipo de
conversión** entre GenerateBlocks Pro V2 (la habitual, por defecto) y Gutenberg nativo (la que se
conserva como alternativa). Está escrito como punto de decisión obligatorio en la skill del flujo,
en la fase 1 de `SETUP-RECOMENDADO.md` y en `importar-handoff-diseno`. Las cifras que lo justifican,
medidas contra un WordPress real, en `docs/prueba-handoff.md`.

**Principio de diseño que hay que mantener:** las skills **apuntan** a los documentos que ya viajan
en el repo (`traspaso-2026-08-26/SETUP-RECOMENDADO.md`, `docs/metodo-generateblocks-v2.md`) en vez
de copiar su contenido. Una sola fuente de verdad. Si se duplica, se desincroniza.

**Pendiente que es de Javier, no del repo:** desactivar la skill de cuenta **`web-para-wordpress`**.
Su descripción empuja a `theme.json` y ACF Blocks, contra las conclusiones de la investigación, y
compite con las skills del plugin. No se edita desde el repositorio: es una skill de la cuenta.

Estado de las etapas y lo que queda, siempre en `ESTADO.md` de la raíz del repo.
