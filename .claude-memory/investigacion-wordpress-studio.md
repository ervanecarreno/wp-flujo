---
name: investigacion-wordpress-studio
description: "Comparativa Local WP vs WordPress Studio para wp-flujo — pausada, retomar antes de tocar el entorno local"
metadata: 
  node_type: memory
  type: project
  modified: 2026-09-07T12:53:10.681Z
  originSessionId: df9e952d-84b2-49bf-9dbe-ffde836763ff
---

Javier pidió una investigación profunda sobre si sustituir **Local WP** (el entorno local actual de
[[plugin-wp-generateblocks]]) por **WordPress Studio** (developer.wordpress.com/es/docs/herramientas-para-desarrolladores/studio/),
porque cree que se conecta mejor con Claude. Se hizo la comparativa el 7/09/2026; queda **pausada,
sin decisión tomada ni cambios aplicados** — se retoma otro día.

**Hallazgo principal:** Studio trae un **servidor MCP nativo** (`studio mcp`) — Claude puede crear/
parar sitios, ejecutar wp-cli, hacer capturas y leer ficheros del sitio sin pasar por shell. Eso
sustituiría buena parte de la skill `wp-cli-en-local` (que hoy envuelve `wp.cmd`/`php.cmd` de Local a
mano). También crea sitios en segundos (vs. 2-5 min de Local) y tiene enlaces de demo compartibles
con cliente, algo que Local no tiene nativo.

**El motivo para NO cambiar directamente:** Studio usa **SQLite por defecto**, no MySQL/MariaDB como
Local (y como producción real). Eso es exactamente el tipo de brecha que ya costó una lección en este
proyecto — ver [[leccion-rutas-wordpress-subdirectorio]] ("marcado ≠ entorno"): validar contra un
entorno que no es el real no detecta el problema real. GenerateBlocks Pro V2 serializa Global Styles
en meta compleja (`gb_style_data`); no está verificado si sobrevive intacto bajo la capa de traducción
SQL→SQLite. Studio permite MySQL propio si ya hay `wp-config.php` con esas credenciales, pero ahí se
pierde la ventaja de "cero configuración".

**Conclusión de la comparativa, sin implementar todavía:**
1. No tocar la Fase 7 (puerta de calidad) ni el entorno de referencia final — ahí la fidelidad MySQL
   importa más que la velocidad.
2. Pilotar el MCP de Studio solo en fases donde iterar rápido pesa más que la fidelidad: Fase 0
   (bootstrap), Fase 4 (generación/depuración de marcado), Fase 6 (instalar-gsap.js).
3. Antes de fiarse de Studio para cualquier cosa que toque GenerateBlocks Pro: verificar en un
   proyecto de prueba (no de cliente) que el CPT `gblocks_styles` sobrevive intacto bajo SQLite.
4. Si el piloto va bien, migración mecánica pero no trivial: `desplegar-tema.mjs` asume la ruta de
   Local (`<Local Sites>/<sitio>/app/public`); con Studio cambia a la carpeta que se elija al crear
   el sitio. `wp-cli-en-local` pasaría a documentar `studio wp` en vez de los wrappers `.cmd`.

**How to apply:** antes de retomar esto, releer esta memoria completa (no solo el resumen) y
comprobar que la información sigue vigente — Studio está en desarrollo muy activo (CLI de enero
2026, phpMyAdmin de abril 2026), puede haber cambiado. No montar el piloto en ningún proyecto de
cliente real, solo en uno de prueba.
