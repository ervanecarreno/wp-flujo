---
name: rutina-generateblocks-skills
description: Rutina en la nube que revisa wpgaurav/generateblocks-skills los días 1 y 16 y abre un PR en wp-flujo con lo nuevo
metadata:
  type: project
---

Desde el 15/10/2026, la rutina `trig_012d9KzuwwwaiqyTDsSic84y` (claude.ai/code/routines) se ejecuta
los días 1 y 16 a las 08:00 UTC. Compara el upstream con el commit apuntado en
`BETA/generateblocks-skills/ORIGEN.md` y, si hay novedades, abre un PR contra master. Nunca hace push a master.

**Why:** David pidió revisar e implementar las novedades cada 15 días. El cron no admite «cada 15 días» exactos.
**How to apply:** si un PR llega con cambios en `emit.mjs` o en los validadores, revisarlo antes de
fusionar. La rutina depende de que ORIGEN.md esté al día en GitHub. Lo pendiente de medir (`iconOnly`) está en ESTADO.md.
