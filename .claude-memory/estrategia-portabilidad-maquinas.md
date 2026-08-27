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

**Pendiente de automatizar:** un hook al cerrar sesión que haga `git add .claude-memory &&
git commit`, para que no dependa de acordarse. Es el primer caso de uso real de hooks y refuerza
empaquetar el flujo como plugin. Ver [[flujo-wordpress-generateblocks]].
