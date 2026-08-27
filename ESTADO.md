# ESTADO — flujo WordPress + GenerateBlocks

> **Fuente de verdad del estado del proyecto.** Al retomar, lee esto primero: ni el README ni la
> memoria de Claude Code lo sustituyen. Actualízalo al cerrar cada sesión de trabajo.

**Última actualización:** 27/08/2026, final de jornada.

---

## ⏭ LO SIGUIENTE (pendiente al retomar — 28/08/2026)

**Cerrar la laguna de portabilidad de la configuración del tema.** Es lo único que quedó a medias.

Javier planteó un supuesto real al final de la sesión: un diseño ya aprobado en Figma (una home
más un CPT fijo de "servicios") que hay que trasladar a WordPress en Local WP, ajustar secciones,
noticias del blog y **configuración del tema y tipografía**, confirmar fiabilidad del diseño,
animar con GSAP y añadir query loops. El flujo cubre todo eso… **menos un hueco verificado**:

La configuración del tema y la tipografía **viven en la base de datos, no en código**, así que
**no viajan con el repo git**. Comprobado contra un WordPress real (figma-staging):

```
generate_settings              ← toda la configuración del tema
generate_spacing_settings      ← espaciados
generate_package_font_library  ← la tipografía
```

La fase 2 versiona el tema hijo, los CPT, `acf-json/` y `/patterns/`, pero no esto. Al migrar a
producción no van solas.

**La tarea:** un script en `herramientas/` (Node sin dependencias, como los demás) que exporte
esas opciones a un JSON versionado en el repo y las reimporte en el destino. Base del comando:

```
wp option get generate_settings --format=json --path="<sitio>"
wp option update generate_settings --format=json --path="<sitio>" < fichero.json
```

Al terminarlo: documentarlo en la fase 2 de `SETUP-RECOMENDADO.md` y en la skill
`flujo-wordpress-generateblocks`, y **subir el `version` de `.claude-plugin/plugin.json`** para
que `/plugin` detecte la actualización (ver Bloqueos abiertos).

### También conversado y sin cerrar

- **Correcciones de orden al supuesto de Javier**, ya explicadas pero no escritas en el flujo: el
  CPT de servicios debe registrarse por código en la fase 2 (no al final, o se construye la
  sección dos veces), y **GSAP va después de los query loops** — animar una sección con un número
  fijo de tarjetas y convertirla luego en query loop rompe la animación. Valorar si merece una
  nota explícita en `SETUP-RECOMENDADO.md`.
- **El plugin no cubre la traducción Figma → GenerateBlocks.** Empieza cuando el marcado ya
  existe. Javier tiene un pipeline propio para ese paso en `C:\TRABAJOS\figma-gb-pipeline`
  (proyecto distinto, no mezclar), pero conviene decidir si se documenta el enlace entre ambos.

---

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
| `skills/` | Las 4 skills del plugin (ver README) |
| `.claude-plugin/` | Manifiestos del plugin y del marketplace |
| `.claude/settings.json` | Hook `Stop`: versiona la memoria automáticamente |
| `herramientas/commit-memoria.sh` | El script del hook. Defensivo: calla si no hay cambios o no es un repo |
| `herramientas/wp-cli/` | `wp.cmd` y `php.cmd`: usan el PHP y wp-cli que trae Local, sin instalar nada. Ver su LEEME |
| `herramientas/puerta-calidad.js` | Fase 7: comprueba URLs rotas y peso de imagen contra el servidor real |
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
| 1 | Retirar la skill de cuenta `web-para-wordpress` | **pendiente y es tuya**: no se edita desde el repo. Su descripción empuja a `theme.json` y ACF Blocks, contra la investigación, y ahora compite con las skills del plugin. Desactívala en la gestión de skills de la cuenta |
| 2 | Verificar `wp-cli` y `php` de Local WP | **HECHA** (27/08/2026) — PHP 8.2.29 y WP-CLI 2.12.0, con envoltorios propios en `herramientas/wp-cli/` |
| 3 | Recuperar el validador Node (`herramientas/`) | **HECHA** (27/08/2026) — recuperado, integrado y probado |
| 4 | Esqueleto del plugin | **HECHA** (27/08/2026) — `.claude-plugin/plugin.json` y `marketplace.json`, con la estructura verificada contra plugins reales |
| 5 | Skills del plugin | **HECHA** (27/08/2026) — 4 skills: flujo, generación de bloques, wp-cli en Local y puerta de calidad. Sin duplicar los docs: apuntan a ellos |
| 6 | Puerta de calidad como script ejecutable | **HECHA** (27/08/2026) — `herramientas/puerta-calidad.js`, sin dependencias. Cubre los pasos 1 y 2 de los 5 |
| 7 | Hooks | **HECHA** (27/08/2026) — hook `Stop` en `.claude/settings.json` que commitea `.claude-memory` solo si cambió. Requiere reiniciar Claude Code una vez para que se cargue |
| — | `wp doctor` instalado | **HECHA** (27/08/2026) — fijado a la versión `2.3.0`, compatible con WP-CLI 2.12.0 |
| — | Experimento `var(--color)` en GenerateBlocks | **HECHA** (27/08/2026) — resuelto de extremo a extremo, con un bug de documentación encontrado y corregido de propina. Ver Hallazgos abajo |

### Bloqueos abiertos

Ninguno bloqueante. Condición operativa a recordar: los comandos de wp-cli que tocan la base de
datos exigen que el sitio esté **arrancado** en Local (*Start site*).

`wp doctor` **ya instalado** (27/08/2026). La rama `dev-main` exige WP-CLI ^3.0 y tenemos 2.12.0:
hubo que fijar la versión compatible con `wp package install wp-cli/doctor-command:2.3.0`, no la
última. Verificado: `wp doctor list` responde con las 16 comprobaciones disponibles.

Detectado al probarlo: pasar por `cmd //c "..."` desde Git Bash puede partir un `--path` con
espacios en argumentos sueltos (pasó de verdad con la ruta de "Local Sites"). Usar siempre
PowerShell para comandos de wp-cli contra un sitio real.

**El plugin instalado no se actualiza solo con `/plugin → Update`.** Detectado el 27/08/2026: el
menú compara por número de versión de `.claude-plugin/plugin.json`, no por contenido ni por SHA de
git. Con la versión sin cambiar, `Update` respondía *"already at the latest version"* aunque el
contenido real hubiera cambiado (pasó con el commit del bug de escapado). **Subir el `version` de
`plugin.json` en cada cambio real** a `skills/` o `herramientas/` para que `/plugin` lo detecte, y
recordar que además pide reiniciar Claude Code para aplicarlo.

### Hallazgos del 27/08/2026 (al integrar las herramientas)

- **`var(--color)` sí sobrevive de extremo a extremo — experimento RESUELTO.** Probado contra un
  WordPress real (figma-staging, sandbox puntual, ver más abajo): un bloque con
  `background-color:var(--color-x)` guardado vía REST (el mismo camino que el editor al pulsar
  "Actualizar") llega intacto hasta el CSS que GenerateBlocks genera de verdad en el frontend
  (`wp-content/uploads/generateblocks/style-{ID}.css`), sin aplanar a HEX. El color se sigue
  aplicando por clase CSS en el flujo por defecto (no cambia), pero ya no hay que evitar `var()`
  por miedo al escapado.
- **Bug encontrado y corregido: el quinto escape de comillas rompe el guardado real.**
  `docs/metodo-generateblocks-v2.md` §3 documentaba 5 escapes JSON, incluyendo `"` → `\u0022`.
  Con ese escape, el `kses` de WordPress no reconoce el comentario como bloque de Gutenberg
  legítimo y lo guarda VACÍO — `parse_blocks()` devuelve atributos vacíos, sin error visible.
  Con los **cuatro** escapes correctos (`\u002d\u002d`, `\u003c`, `\u003e`, `\u0026`) y comillas
  literales, el bloque sobrevive perfecto. `herramientas/audit-gb.js` nunca exigió el quinto
  escape, así que el validador siempre fue correcto — el error estaba solo en la documentación
  (ya corregida en `docs/metodo-generateblocks-v2.md` §3 y §8, en la skill
  `generar-bloques-generateblocks`, en la memoria `leccion-colores-generateblocks`, y con un
  addendum fechado en `traspaso-2026-08-26/investigacion/resultados-completos.md`).
- **Metodología del experimento**, por si hay que repetirlo: sitio `figma-staging` (de
  figma-gb-pipeline, usado como sandbox puntual con permiso explícito del usuario — un post de
  prueba creado y borrado, sin tocar ficheros ni git de ese proyecto). Conectar wp-cli exige el
  puerto MySQL específico del sitio (`\AppData\Roaming\Local\sites.json`, campo
  `services.mysql.ports.MYSQL`; en este caso 10011) vía
  `php -c php.ini -d mysqli.default_port=<puerto> wp-cli.phar ...` — el `php.ini` del plugin no
  lo sabe porque cada sitio usa un puerto distinto. Para simular el guardado del editor sin tocar
  credenciales: `wp eval-file` con `wp_set_current_user(1)` + `WP_REST_Request` +
  `rest_do_request()` en el propio proceso de wp-cli, contra el mismo endpoint que usa Gutenberg.
  El diagnóstico decisivo fue `parse_blocks($post->post_content)`: atributos vacíos = el JSON no
  decodificó, sea cual sea el motivo.
- **El validador da 0 errores sobre el fichero que estaba roto en producción.** Ejecutado contra
  el HTML v1 de Aridane (el de las 11 imágenes en 404): 0 errores / 42 avisos. No es un fallo del
  validador — es la demostración de que valida CONTENIDO, no ENTORNO, y de por qué la fase 7 tiene
  que existir. Define exactamente qué deben añadir las dos reglas nuevas.

### Descartado (no volver a perseguirlo)

- **Proyecto Aridane**: era una prueba. Lo único reutilizable son los scripts de `herramientas/`
  y el checklist de 10 reglas de `AUDITORIA.md`.
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

Al terminar de trabajar: `git add -A && git commit`. Sin remoto, no hay `push` — eso lleva proyecto
**y** memoria dentro del propio commit, listo para copiar la carpeta a otra máquina.
