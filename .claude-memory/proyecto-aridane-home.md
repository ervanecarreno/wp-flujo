---
name: proyecto-aridane-home
description: "Rediseño de la home de aridane.org — dónde está, en qué punto quedó y por dónde se retoma"
metadata: 
  node_type: memory
  type: project
  originSessionId: ad32cce8-eb62-47ea-b405-8e27ce6dd01c
  modified: 2026-08-26T15:05:28.700Z
---

Rediseño de la portada de **aridane.org** (Ayuntamiento de Los Llanos de Aridane, La Palma) con
WordPress + GeneratePress + GenerateBlocks Pro V2. 179 bloques, 8 secciones.

**Ubicación:** `C:\TRABAJOS\CLOUDE CODE\prueba web generateblock\Rediseño Home Aridane.org\design_handoff_home_aridane\`
Empaquetado el 26/08/2026 en `aridane-home-1b_2026-08-26.zip` (18,1 MB) porque Javier iba a
seguir en otra máquina.

**DESCARTADO el 27/08/2026.** Javier confirmó que Aridane era una prueba y que el proyecto que
importa es el flujo/setup, no esta home. No retomar el diseño ni las 5 imágenes a WebP. Lo único
que sigue vivo de aquí son los scripts de `herramientas/` (validador Node sin dependencias), que
la fase 4 de [[flujo-wordpress-generateblocks]] necesita, y `AUDITORIA.md` con el checklist de
11 reglas. Todo lo demás es historial.

**A 27/08/2026 ese zip NO está en la máquina actual** y la ruta de arriba es de la máquina
anterior (aquí la base es `C:\TRABAJOS\CLOUDE WP\`). Hay que transferir el zip antes de poder
retomar nada de Aridane.

**Al retomar, leer `ESTADO.md` del propio proyecto — no este archivo ni el README.** Esa nota es
la fuente de verdad del estado y ya recoge el contexto que no está en el código.

Lo esencial: la auditoría de la variante GenerateBlocks está hecha (informe en
`wordpress/generateblocks/AUDITORIA.md`) y los archivos corregidos son los `-v2`. El siguiente
paso decidido y **sin hacer** es optimizar 5 imágenes a WebP antes de subirlas —dos pesan 3,8 MB
y 2,8 MB y van above the fold.

**Trampa con fecha:** el marcado v2 apunta esas 5 imágenes a `/uploads/2026/08/`, la carpeta que
WordPress usará solo si se suben en agosto de 2026. Pasado ese mes hay que cambiar `2026/08` o
regenerar con la constante `PEND` de `herramientas/fix-gb.js`.

Hay tres scripts de validación reutilizables en `herramientas/` (Node, sin dependencias).
Sirven para cualquier proyecto GenerateBlocks, no solo este.

Ver [[leccion-rutas-wordpress-subdirectorio]] y [[perfil-javier-wordpress]].
