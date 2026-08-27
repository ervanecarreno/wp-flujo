---
name: perfil-javier-wordpress
description: Javier hace webs WordPress para clientes con un stack fijo; sus prioridades y su entorno de trabajo
metadata: 
  node_type: memory
  type: user
  originSessionId: ad32cce8-eb62-47ea-b405-8e27ce6dd01c
  modified: 2026-08-27T09:20:00.000Z
---

Javier (javier@metropoliscom.com, Metrópolis Comunicación) desarrolla webs WordPress para
clientes —ayuntamientos y pymes, ámbito Canarias/La Palma— con un **stack fijo**:
GeneratePress + GenerateBlocks Pro V2 + ACF + Local WP para staging.

Sus prioridades, en este orden explícito: **1) velocidad · 2) menos pasos · 3) fiabilidad del
prototipo** (que lo aprobado en diseño sea exactamente lo que sale en producción).

Escribe en español; los entregables van en español (es-ES / es-Canarias).

**Entorno real a 27/08/2026** — verificado en la máquina actual, no asumido. Windows 11 Pro,
carpeta base `C:\TRABAJOS\CLOUDE WP\` (la máquina anterior usaba `C:\TRABAJOS\CLOUDE CODE\`,
ruta que aquí NO existe):
- Instalado: `node` (v24.18), `npm` (11.16), `git`, `gh`, Local WP
- **NO** instalado: `php` en PATH, `wp-cli`, `composer`, `cwebp`/`magick`/`ffmpeg`
- Sin ningún sitio de Local WP **para el flujo de clientes** todavía (el único que existe,
  `figma-staging`, pertenece a otro proyecto — ver abajo)

Es decir: parte del flujo que da por hecho todavía no existe en su máquina. Verificar antes
de recomendar comandos que asuman `wp` o `composer`.

**Ojo, no confundir proyectos:** bajo `C:\TRABAJOS` hay un `figma-gb-pipeline` (repo git con
extracciones de Figma, plugin `figma-pipeline-bridge`, sitio Local `figma-staging`) que es **otro
proyecto sin relación con este flujo** — Javier lo confirmó explícitamente el 27/08/2026. No es
una contradicción con [[decision-saltar-figma]], que sigue vigente tal cual para el trabajo de
clientes WordPress. No sacarlo a colación como incoherencia.

Ver [[flujo-wordpress-generateblocks]] y [[setup-wordpress-pendiente]].
