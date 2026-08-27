# ESTADO — flujo WordPress + GenerateBlocks

> **Fuente de verdad del estado del proyecto.** Al retomar, lee esto primero: ni el README ni la
> memoria de Claude Code lo sustituyen. Actualízalo al cerrar cada sesión de trabajo.

**Última actualización:** 27/08/2026 (herramientas integradas)

## Qué es este repo

El flujo de trabajo definitivo para webs WordPress de cliente (GeneratePress + GenerateBlocks
Pro V2 + ACF), y las herramientas que lo hacen ejecutable. **No** es un proyecto de cliente
concreto.

## Dónde está cada cosa

| Ruta | Qué es |
|---|---|
| `traspaso-2026-08-26/SETUP-RECOMENDADO.md` | El flujo de 8 fases, sintetizado y accionable. **Empieza aquí.** |
| `traspaso-2026-08-26/investigacion/resultados-completos.md` | El respaldo: 7 temas, cada afirmación con fuente y verificación adversarial (130 KB) |
| `.claude-memory/` | Memoria persistente de Claude Code, versionada con el repo (ver más abajo) |
| `herramientas/` | Validadores Node sin dependencias: `audit-gb.js` (checklist §8), `audit-cross.js` (marcado vs CSS/JS/assets), `fix-gb.js` (generador, ojo a su constante `PEND`) |
| `docs/metodo-generateblocks-v2.md` | El método de referencia para generar bloques GB V2, con el checklist del §8 |
| `docs/AUDITORIA-aridane.md` | Caso de estudio: la auditoría que descubrió los fallos de entorno |
| `verificacion/roundtrip-escapado-wp.js` | Prueba que `var(--color)` sobrevive al escapado de WP |
| `config-heredada/` | Config de Claude Code de la máquina anterior, como referencia (sin secretos, verificado) |

## Estado actual

La **investigación está cerrada**: los 7 temas tienen investigación y verificación adversarial.
Lo que queda no es investigar, es convertir el documento en herramienta.

Decidido el 27/08/2026: se empaqueta como **plugin de Claude Code que contiene skills**, no como
una skill suelta. Motivo: lo que se perdió al cambiar de máquina no fue el texto (la skill de
cuenta se sincronizó sola) sino los *scripts*; y los hooks —capacidad exclusiva de plugin— son lo
único que puede hacer que validar no dependa de acordarse.

### Etapas

| # | Etapa | Estado |
|---|---|---|
| 1 | Reescribir la descripción de la skill `web-para-wordpress` | pendiente — su descripción actual empuja a `theme.json` y ACF Blocks, contra las conclusiones de la investigación |
| 2 | Verificar `wp-cli` y `php` en el site shell de Local WP | pendiente — bloquea las fases 4, 7 y 8 del flujo |
| 3 | Recuperar el validador Node (`herramientas/`) | **HECHA** (27/08/2026) — recuperado, integrado y probado |
| 4 | Esqueleto del plugin en git | pendiente |
| 5 | Skills: una enrutadora + una referencia por fase | pendiente |
| 6 | Puerta de calidad como script + comando | pendiente |
| 7 | Hooks (incluido el de commit de memoria al cerrar) | pendiente |

### Bloqueos abiertos

- **`wp-cli` no está en PATH** y tampoco `php`. Local WP los trae en su *site shell*. Sin
  confirmarlo empíricamente, tres de las ocho fases son especulación.

### Hallazgos del 27/08/2026 (al integrar las herramientas)

- **El escapado de WordPress NO es el obstáculo para `var(--color)`.**
  `verificacion/roundtrip-escapado-wp.js` demuestra round-trip sin pérdida: el `--` se serializa
  como `--` y vuelve intacto. Queda por probar si el **editor** de GB lo reescribe al
  guardar y si el frontend lo pinta. Experimento de 10 min con premio grande: si sobrevive,
  las clases utilitarias de la fase 4 pasan a ser opcionales.
- **El validador da 0 errores sobre el fichero que estaba roto en producción.** Ejecutado contra
  el HTML v1 de Aridane (el de las 11 imágenes en 404): 0 errores / 42 avisos. No es un fallo del
  validador — es la demostración de que valida CONTENIDO, no ENTORNO, y de por qué la fase 7 tiene
  que existir. Define exactamente qué deben añadir las dos reglas nuevas.
- **Precisión pendiente:** el §8 de `docs/metodo-generateblocks-v2.md` lista **10** casillas, no 11
  como dice la memoria. Resolver el recuento al codificar el validador del plugin.

### Descartado (no volver a perseguirlo)

- **Proyecto Aridane**: era una prueba. Lo único reutilizable son los scripts de `herramientas/`
  y el checklist de 11 reglas de `AUDITORIA.md`.
- **`figma-gb-pipeline`** (en `C:\TRABAJOS`): otro proyecto, sin relación con este flujo.
- **Figma como fuente del marcado**: descartado con fundamento; ver la memoria
  `decision-saltar-figma`.

## Separación de proyectos

En `C:\TRABAJOS` conviven **dos proyectos sin relación**, y no deben mezclarse:

| Carpeta | Proyecto | Git |
|---|---|---|
| `wp-flujo` | **este**: flujo WordPress + GenerateBlocks | git local, **sin remoto por decisión del usuario** |
| `figma-gb-pipeline` | otro: pipeline Figma → GeneratePress/GB. Contiene `METROPOLIS Design System-handoff` | git propio con remoto en GitHub |

**Nunca abrir Claude Code en `C:\TRABAJOS`**, solo en la carpeta del proyecto. Cada carpeta tiene
su silo de memoria nombrado por su ruta; abrir en la raíz crea un tercer silo que contamina los
dos. Ocurrió entre el 21 y el 26/08/2026 y se limpió el 27/08/2026.

`_archivo/` guarda lo que no es de ningún proyecto.

## Cómo retomar en una máquina nueva

La ruta de trabajo **tiene que ser exactamente `C:\TRABAJOS\wp-flujo`**. La carpeta de memoria de
Claude Code se nombra a partir de la ruta, así que una ruta distinta deja la memoria huérfana —
fue exactamente lo que pasó el 27/08/2026.

1. Copia la carpeta `wp-flujo` **completa** (incluido su `.git`) a `C:\TRABAJOS\wp-flujo` en la
   máquina nueva. No hay remoto git —decisión del 27/08/2026—, así que el traslado es una copia
   de carpeta, no un `clone`. El historial y la memoria viajan dentro.
2. Enlazar la memoria (junction, no necesita permisos de administrador):

   ```powershell
   $m = "$env:USERPROFILE\.claude\projects\C--TRABAJOS-wp-flujo"
   New-Item -ItemType Directory -Force -Path $m | Out-Null
   New-Item -ItemType Junction -Path "$m\memory" -Target "C:\TRABAJOS\wp-flujo\.claude-memory"
   ```
3. Abrir Claude Code en `C:\TRABAJOS\wp-flujo` y decir *"lee ESTADO.md y la memoria"*.

Al terminar de trabajar: `git add -A && git commit && git push`. Eso lleva proyecto **y** memoria.
