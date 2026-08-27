# Herramientas y configuración — 27/08/2026

Este paquete NO incluye memoria, investigación ni el diseño de Aridane (ya los tienes en la
máquina nueva). Es solo código y configuración reutilizable que no viajó por ninguna otra vía.

## Contenido

```
aridane-herramientas/
  herramientas/                        <- carpeta completa del proyecto Aridane
    audit-gb.js                        <- valida 179 bloques GB contra el checklist de 11 reglas
    audit-cross.js                     <- coherencia marcado <-> CSS externo <-> JS <-> assets
    fix-gb.js                          <- genera la v2 corregida (ojo: constante PEND = "2026/08")
    LEEME.md                           <- cómo usar los tres scripts
  wordpress-generateblocks/
    AUDITORIA.md                       <- informe de la auditoría de Aridane, con el checklist aplicado
  docs/
    metodo-generateblocks-v2.md        <- el método fuente: las 5 primitivas de GB, escapado JSON,
                                           anatomía de bloque, y el checklist de validación §8

verificacion-escapado-wp/
  roundtrip.js                         <- prueba empírica de si var(--color) sobrevive al escapado
                                           de WordPress (serialize_block_attributes). Ejecutar con
                                           `node roundtrip.js` — no requiere dependencias.
                                           Es la "prueba mínima" que la investigación del flujo
                                           recomendaba hacer antes de confiar en variables CSS
                                           dentro de un bloque GenerateBlocks.

claude-config/
  proyecto-dotclaude/
    mcp-servers.json                   <- MCP configurado en el proyecto (solo markitdown, sin claves)
    settings.local.json                <- permisos locales acumulados (allowlist de comandos)
  usuario-dotclaude/
    settings.json                      <- ajuste global de usuario (solo skipWorkflowUsageWarning)
```

## Cómo colocarlo en la máquina nueva

- `aridane-herramientas/herramientas/` → pégala dentro de tu copia del proyecto Aridane, en
  `...\design_handoff_home_aridane\herramientas\` (o donde prefieras si vas a reutilizar los
  scripts para un proyecto nuevo — son genéricos para cualquier marcado de GenerateBlocks, no
  dependen del contenido de Aridane).
- `claude-config/proyecto-dotclaude/*` → dentro de la carpeta `.claude\` de tu directorio de
  trabajo en la máquina nueva.
- `claude-config/usuario-dotclaude/settings.json` → `%USERPROFILE%\.claude\settings.json` (fusiona
  a mano si ya existe uno con otro contenido; el de aquí es mínimo).
- `verificacion-escapado-wp/roundtrip.js` → donde te resulte cómodo, es un script suelto de una
  sola pieza.

---

## Qué SÍ está en el zip

1. ✅ `herramientas/` completa (los 3 scripts de validación + su LEEME.md)
2. ✅ `AUDITORIA.md` y el documento que define el checklist de 11 reglas (`metodo-generateblocks-v2.md`, §8)
3. ✅ Configuración de Claude Code no sincronizada que SÍ existe: `.claude/mcp-servers.json` y
   `.claude/settings.local.json` del proyecto, y `%USERPROFILE%\.claude\settings.json` del usuario
4. ✅ `roundtrip.js` — el verificador del escapado `--` de WordPress, encontrado en el scratchpad
   de la sesión (no estaba guardado en ningún proyecto; era parte del trabajo de investigación
   pero es una herramienta reutilizable, no contenido de diseño)

## Qué NO está — no existe en esta máquina, no es que se me olvidara

1. ❌ **`%USERPROFILE%\.claude\skills\`** — no existe esa carpeta en esta máquina
2. ❌ **`%USERPROFILE%\.claude\commands\`** — no existe esa carpeta en esta máquina
3. ❌ **`%USERPROFILE%\.claude\agents\`** — no existe esa carpeta en esta máquina
4. ❌ **Ningún `CLAUDE.md`** — no hay ninguno en todo `C:\TRABAJOS\CLOUDE CODE`, ni en el proyecto
   Aridane, ni en ningún subdirectorio
5. ❌ **`.claude/skills/`, `.claude/commands/`, `.claude/agents/`, `.claude/hooks/` del proyecto**
   — la carpeta `.claude\` de `C:\TRABAJOS\CLOUDE CODE` solo contiene los dos archivos incluidos
   arriba (`mcp-servers.json` y `settings.local.json`); esos cuatro subdirectorios no existen

Las skills que usamos en esta sesión (`web-para-wordpress`, etc.) no viven en ninguna de estas
rutas — las gestiona la propia app desde su caché interna de plugins, no son configuración tuya
que se pueda copiar como archivo. Si las necesitas en la máquina nueva, se activan solas al
invocarlas por nombre; no hay nada que trasladar.
