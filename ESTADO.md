# ESTADO — flujo WordPress + GenerateBlocks

> **Fuente de verdad del estado del proyecto.** Al retomar, lee esto primero: ni el README ni la
> memoria de Claude Code lo sustituyen. Actualízalo al cerrar cada sesión de trabajo.

**Última actualización:** 27/08/2026

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
| 3 | Recuperar o reescribir el validador Node (`herramientas/`) | pendiente — no está en esta máquina; en tránsito desde la máquina anterior |
| 4 | Esqueleto del plugin en git | pendiente |
| 5 | Skills: una enrutadora + una referencia por fase | pendiente |
| 6 | Puerta de calidad como script + comando | pendiente |
| 7 | Hooks (incluido el de commit de memoria al cerrar) | pendiente |

### Bloqueos abiertos

- **`wp-cli` no está en PATH** y tampoco `php`. Local WP los trae en su *site shell*. Sin
  confirmarlo empíricamente, tres de las ocho fases son especulación.
- **El validador Node no está aquí.** Solo vive en `aridane-home-1b_2026-08-26.zip` en la máquina
  anterior. Si no aparece, la etapa 3 pasa de "recuperar" a "reescribir".

### Descartado (no volver a perseguirlo)

- **Proyecto Aridane**: era una prueba. Lo único reutilizable son los scripts de `herramientas/`
  y el checklist de 11 reglas de `AUDITORIA.md`.
- **`figma-gb-pipeline`** (en `C:\TRABAJOS`): otro proyecto, sin relación con este flujo.
- **Figma como fuente del marcado**: descartado con fundamento; ver la memoria
  `decision-saltar-figma`.

## Cómo retomar en una máquina nueva

La ruta de trabajo **tiene que ser exactamente `C:\TRABAJOS\wp-flujo`**. La carpeta de memoria de
Claude Code se nombra a partir de la ruta, así que una ruta distinta deja la memoria huérfana —
fue exactamente lo que pasó el 27/08/2026.

1. `git clone <repo> C:\TRABAJOS\wp-flujo`
2. Enlazar la memoria (junction, no necesita permisos de administrador):

   ```powershell
   $m = "$env:USERPROFILE\.claude\projects\C--TRABAJOS-wp-flujo"
   New-Item -ItemType Directory -Force -Path $m | Out-Null
   New-Item -ItemType Junction -Path "$m\memory" -Target "C:\TRABAJOS\wp-flujo\.claude-memory"
   ```
3. Abrir Claude Code en `C:\TRABAJOS\wp-flujo` y decir *"lee ESTADO.md y la memoria"*.

Al terminar de trabajar: `git add -A && git commit && git push`. Eso lleva proyecto **y** memoria.
