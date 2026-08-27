# Traspaso a otro ordenador — actualizado 27/08/2026

Este paquete no es el proyecto Aridane en sí (ese es `aridane-home-1b_2026-08-26.zip`, entregado
aparte). Es el **contexto de trabajo**: memoria de la conversación con Claude Code + el resultado
completo de la investigación del nuevo flujo WordPress. Sirve para retomar sin explicar nada de
nuevo.

## Léelo en este orden

1. **`SETUP-RECOMENDADO.md`** — el flujo definitivo de 8 fases, ya sintetizado y accionable. Esto
   es lo que importa para trabajar.
2. **`investigacion/resultados-completos.md`** (130 KB) — el respaldo: los 7 temas, cada
   afirmación con nivel de confianza y fuente, más una verificación adversarial de cada uno.
   Consultar solo si hace falta el detalle o la fuente exacta de algo.
3. **`memory/`** — snapshot de la memoria persistente de Claude Code a fecha 27/08/2026.
4. **`sesion-cruda/`** — transcripción bruta y completa de esta conversación (6,6 MB), por si
   quieres intentar reanudarla literalmente en la máquina nueva en vez de solo recuperar el
   contexto vía memoria. **Sin garantía de que funcione** — instrucciones y el porqué dentro de
   su propio LEEME.md. La vía de `memory/` de abajo es la que sabemos que funciona.

## Cómo usarlo en la máquina nueva

1. Copia el contenido de `memory/` a la carpeta de memoria de Claude Code en la máquina nueva:
   normalmente `%USERPROFILE%\.claude\projects\<hash-del-proyecto>\memory\`. Si esa carpeta ya
   tiene contenido propio, añade los archivos en vez de sobrescribir — no hay colisión de nombres
   esperada.
2. Abre Claude Code y dile algo como *"sigamos con el proyecto WordPress, mira la memoria"*. Con
   la memoria copiada, debería recuperar el contexto sin que se lo repitas.
3. Si prefieres leerlo tú mismo primero, empieza por `SETUP-RECOMENDADO.md`.

## Estado de la investigación

**Completa.** Los 7 temas (Global Styles de GenerateBlocks, theme.json como fuente de tokens,
Figma MCP vs REST, qué versionar en git, portabilidad de contenido Gutenberg, dónde encaja la
animación, la puerta de validación de entorno) tienen investigación **y** verificación
adversarial — un segundo agente que intentó específicamente refutar cada hallazgo antes de darlo
por bueno.

## Aviso

`investigacion/workflow-setup-wp.js` es el script que generó todo esto — solo hace falta si en
algún momento quieres relanzar una investigación similar sobre otro tema. No hace falta para usar
el resultado.
