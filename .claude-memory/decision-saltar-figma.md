---
name: decision-saltar-figma
description: Por qué el flujo de Javier diseña directo en HTML en vez de extraer código de Figma
metadata: 
  node_type: memory
  type: feedback
  originSessionId: ad32cce8-eb62-47ea-b405-8e27ce6dd01c
  modified: 2026-08-27T07:32:52.407Z
---

Para el stack de Javier (GeneratePress + GenerateBlocks Pro V2, clientes ayuntamientos/pymes),
no usar Figma MCP ni REST API como fuente de datos para generar marcado. Diseñar directo en HTML
(Claude Design) y reservar Figma, si aparece, solo como capa de comunicación visual con el
cliente (captura/PDF sirve igual).

**Why:** verificado con fuentes oficiales (agosto 2026): el límite de uso del Figma MCP/REST se
ata al plan del ARCHIVO propietario, no al del que llama — un Figma de cliente en plan gratuito
deja ~6 peticiones al mes sobre ese archivo aunque el freelance pague Professional. La Variables
REST API (los tokens de diseño) exige Enterprise sin excepción, plan fuera de alcance para estos
clientes. Y aunque se extrajeran limpio, GenerateBlocks V2 no admite `var(--color)` de forma
fiable en el marcado pegado a mano, así que hay que aplanar a literales de todos modos — Figma no
resuelve el problema real. Ninguno de los fallos del [[proyecto-aridane-home]] era un fallo de
diseño; los cinco eran de traducción marcado→entorno, y ahí Figma no aporta nada.

**How to apply:** si el cliente insiste o ya trae un Figma armado por un tercero, usarlo solo como
referencia visual — nunca como fuente del marcado final. Sigue pasando cada bloque por el
validador antes de pegarlo en producción.

Ver [[flujo-wordpress-generateblocks]].
