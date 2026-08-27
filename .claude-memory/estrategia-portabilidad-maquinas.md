---
name: estrategia-portabilidad-maquinas
description: Cómo viaja el trabajo entre las máquinas de Javier — memoria versionada en el repo por junction, ruta canónica fija, y el chat deliberadamente no viaja
metadata: 
  node_type: memory
  type: project
  modified: 2026-08-27T09:45:00.000Z
---

Javier cambia de ordenador continuamente y perdía contexto en cada salto. Estrategia fijada el
27/08/2026, ya montada y verificada:

**Ruta canónica: `C:\TRABAJOS\wp-flujo`, idéntica en todas las máquinas.** No es cosmético: la
carpeta de memoria de Claude Code se nombra a partir de la ruta de trabajo
(`C:\TRABAJOS\wp-flujo` → `C--TRABAJOS-wp-flujo`, minúsculas y todo, verificado contra casos
reales). Una ruta distinta deja la memoria huérfana aunque se copie bien — fue exactamente el
fallo del salto anterior (`CLOUDE CODE` → `CLOUDE WP`).

**La memoria vive dentro del repo.** Carpeta real `C:\TRABAJOS\wp-flujo\.claude-memory\`, y en
`~/.claude/projects/C--TRABAJOS-wp-flujo/memory` hay un **junction** que apunta ahí. Verificado:
los junctions de directorio en Windows **no requieren admin** (`New-Item -ItemType Junction`), y
la escritura a través del enlace aterriza en la carpeta real. Así cada `push` lleva la memoria y
cada `clone` la trae, con historial de cómo evolucionó el criterio.

**El chat NO viaja, por decisión.** Una transcripción son ~1,5 MB por sesión, reanudarla entre
máquinas no tiene garantía, y cuando se intentó no se usó: lo que reconstruyó el contexto fueron
14 KB de memoria más un documento. `sesion-cruda/` está en `.gitignore`. Lo que sobrevive es la
memoria y **`ESTADO.md`** en la raíz del repo, que es la fuente de verdad del estado y se
actualiza al cerrar cada sesión (el patrón que ya funcionó en el proyecto Aridane).

**Antipatrón descartado:** sincronizar `.claude` entera con OneDrive/Dropbox. Ahí viven
`.credentials.json`, `daemon.lock`, `sessions/` y caches; dos máquinas escribiendo a la vez
corrompen estado. Solo la subcarpeta de memoria, y por git.

**Sin remoto, por decisión explícita (27/08/2026).** La cuenta de GitHub que hay en la máquina
(`ervanecarreno`) pertenece al proyecto **figma-gb-pipeline**, que es otro proyecto sin relación.
El usuario eligió dejar `wp-flujo` **solo en local, sin copia**, asumiendo el riesgo. **No volver a
proponer GitHub ni ningún remoto salvo que él lo pida.** Consecuencia asumida: la memoria y el
proyecto viajan juntos por git entre carpetas y máquinas, pero no hay copia fuera de este disco.

**Los dos proyectos de `C:\TRABAJOS` están separados y no se mezclan:** `wp-flujo` (este) y
`figma-gb-pipeline` (pipeline de Figma a GB, con su propio git y remoto, e incluye dentro
`METROPOLIS Design System-handoff`). Cada uno con su silo de memoria. **Nunca abrir Claude Code en
`C:\TRABAJOS` raíz**: crea un tercer silo que contamina ambos, ya pasó una vez.

**Ya automatizado (27/08/2026).** Hay un hook `Stop` en `.claude/settings.json` de este repo que
ejecuta `herramientas/commit-memoria.sh`: commitea `.claude-memory` **solo si cambió**, commitea
solo esa ruta (no arrastra otros cambios indexados), y sale en silencio si no es un repo, no hay
carpeta de memoria o no hay nada que commitear. Cuando commitea, avisa con un `systemMessage`: no
hace nada a escondidas. Probado en los dos casos, con memoria limpia y con memoria cambiada.

Nota: el evento correcto es **`Stop`** — `SessionEnd` existe en el esquema pero no lo usa ningún
plugin real, así que no se eligió a ciegas. `Stop` salta al final de cada turno, y como el script
solo actúa si hay cambios, en la práctica commitea justo cuando la memoria se ha escrito.

Ver [[plugin-wp-generateblocks]] y [[flujo-wordpress-generateblocks]].
