# ESTADO — flujo WordPress + GenerateBlocks

> **Fuente de verdad del estado del proyecto.** Al retomar, lee esto primero: ni el README ni la
> memoria de Claude Code lo sustituyen. Actualízalo al cerrar cada sesión de trabajo.

**Última actualización:** 2/09/2026.

---

## Cerrado el 2/09/2026: la traducción Figma → GenerateBlocks, dentro del plugin

**La laguna que este documento reconocía —*"el plugin no cubre la traducción Figma →
GenerateBlocks, empieza cuando el marcado ya existe"*— queda cerrada.**

Promovido a `herramientas/conversion/` el toolkit que vivía en `C:\TRABAJOS\figma-gb-pipeline`:
11 módulos en `lib/` y 11 scripts. Node ≥18, sin dependencias salvo el diff visual.

**El motivo es de arquitectura, no de comodidad.** `figma-gb-pipeline` es un **proyecto**, con
remoto propio en GitHub y material de proyecto dentro. Un proyecto de cliente debe depender del
**plugin**, nunca de otro proyecto. Se detectó al plantear la web de la Fundación Santa Cruz de La
Palma: la ruta de conversión que se le iba a proponer la ataba a ese repo.

Solo se ha traído herramienta. Queda fuera todo lo que es material de proyecto —el handoff,
`patterns/`, `pages/`, `tokens/`, `app/`, `bridge-plugin/`—; cada cliente crea los suyos.

**Pieza clave que entra:** `lib/convert-frame.mjs`, que convierte un frame de Figma en bloques.
Con ella el flujo cubre por primera vez de Figma a WordPress sin salto manual.

**Los dos validadores conviven a propósito.** Enfrentados al mismo fichero real: los dos dan
**0 errores**; `audit-gb.js` da 23 avisos y `validate-blocks.mjs` 1. Ninguno domina — `audit-gb.js`
caza `shape` sin `html`, pero tiene un falso positivo (confunde declaraciones CSS con etiquetas
dinámicas: 5 de sus 23 avisos). Reparto: `validate-blocks.mjs` es el pre-check del pipeline,
`audit-gb.js` sigue siendo la puerta del método §8. Unificarlos queda como tarea abierta, con
método escrito.

Plugin a **0.5.0**.

---

## ⏭ LO SIGUIENTE (pendiente al retomar)

### 1. Decidir sobre las rutas de conversión (medido, falta decidir)

Comparadas las tres rutas contra un WordPress real. Informe: `docs/rutas-de-conversion.md`.

**El cuello de botella no es la herramienta: es que la paleta del diseño no existe como variables
en Figma** (la API devuelve `colors: []`). De ahí todo lo demás:

| Ruta | Fidelidad del color medida |
|---|---|
| 1 · Handoff (integrado ya en el plugin) | **exacta** — 47 elementos en `#EE743B` |
| 2 · MCP de Figma | **no disponible**: no hay MCP conectado ni en el registro |
| 3 · `figma-gb-pipeline` | tokens perfectos, **colores del tema equivocado** (0 elementos en naranja) |

**Lo que hay que decidir:** si se hace el mapeo de tokens que le falta al pipeline
(`scripts/wp-push-tokens.mjs` + `tokens/map.json`, que solo tiene `#ffffff` y `#000000`). Con ese
paso hecho, la ruta 3 da fidelidad exacta **y** un solo token para recolorear. Sin él, produce un
marcado impecable con la paleta equivocada, que es peor que aplanar a HEX porque parece correcto.

**Y una corrección que afecta al handoff:** escribe `styles` en kebab-case y GenerateBlocks lo
escribe en **camelCase**. Renderiza bien (GB usa `css` tal cual), pero si alguien abre uno de esos
bloques en el editor y lo toca, GB regenera el `css` desde `styles` y esas claves no son las que
espera. Hay que pedir camelCase a Claude Design.

Páginas de prueba levantadas en `figma-staging` (borrar cuando ya no hagan falta):
`/aridane-gb/` · `/aridane-nativa/` · `/ruta3-pipeline/` · `/ruta3b-pipeline-tokens/`

### 2. Probar `config-tema.js` de punta a punta

Sigue pendiente de ayer: necesita un WordPress con GeneratePress arrancado en Local. Lo escrito y
verificado hoy es la sintaxis, los argumentos, el puerto de MySQL y la detección del sitio parado.

```
node herramientas/config-tema.js exportar --path="<sitio>"
node herramientas/config-tema.js importar --path="<otro>" --confirmar
```

---

## Cerrado el 28/08/2026 (noche): los Global Styles, rescatados

**El flujo daba los Global Styles de GB Pro por no versionables. Era falso.** Comprobado
contra GenerateBlocks Pro 2.7.0: son el CPT `gblocks_styles`, **expuesto en la API REST**
(`rest_base: gblocks_styles`) y manejable por wp-cli.

| Dónde | Qué |
|---|---|
| `post_title` | el selector |
| `menu_order` | el orden de salida del CSS = la especificidad |
| `gb_style_css` | el CSS compilado de esa regla |
| `gb_style_data` | el objeto de estilos en camelCase, igual que `styles` de un bloque |

Herramienta nueva: **`herramientas/global-styles.js`**, exportar/importar **idempotente**
(compara la estructura del JSON, no la cadena; probado: 13 estilos, 0 cambios al reimportar).

**Y cambia cómo generar marcado.** Si un componente se repite, va como global style y el
bloque lleva `globalClasses` sin `styles` propios — que es lo que hace GB en sus exports, y
la razón de que la id-class no siempre esté. Deja el marcado **sin un solo HEX literal**.

Documentado en el método §7 bis, la fase 4 de `SETUP-RECOMENDADO.md`, la trampa 6 de la skill
del flujo y `herramientas/LEEME.md`. Plugin a **0.4.0**.

---

## Cerrado el 28/08/2026 (noche): el validador, recalibrado contra GB real

`herramientas/audit-gb.js` daba **714 errores sobre 732 bloques escritos por GenerateBlocks
mismo**. Eran suyos, no del marcado. Cuatro reglas equivocadas:

1. Comparaba `styles` con `css` sin convertir camelCase a kebab-case. GB escribe `styles` en
   camelCase (1423 claves frente a 75) y `css` en kebab (532 bloques, 0 en camel).
2. Exigía que `css` fuera una serialización exacta de `styles`. **GB no serializa: optimiza.**
   Colapsa longhands en shorthand, quita espacios de `rgba()` y `clamp()`. No es reconstruible.
   Ahora es aviso; con `--estricto` vuelve a ser error, para marcado propio.
3. Exigía la clase base `gb-<tipo>`: el 60% de los cuerpos reales no la lleva.
4. Exigía la id-class siempre: los bloques sin `styles` propios salen con `class=""`.

Además ahora lee **exports `wp_block` en JSON**, que es como GB exporta los patrones, y
recurre bien en las claves anidadas (`@media` dentro de un selector descendiente daba
`[object Object]`).

**Resultado: 0 errores sobre los 732 bloques de referencia.** Método §8 reescrito con las
cuatro reglas correctas y la tabla de claves anidadas.

---

## Cerrado el 28/08/2026 (tarde): el escapado, corregido del todo

**Corrección de la corrección de ayer, y esta vez leída del código del core.**

`serialize_block_attributes()` en `wp-includes/blocks.php` hace **seis** sustituciones:
`\\`, `--`, `<`, `>`, `&` y la comilla **ya escapada**. La distinción que lo decide todo: esa
última se aplica **solo a la comilla de dentro de un valor**; las **estructurales** del JSON se
dejan literales. Aplicarla a todas invalida el JSON y el bloque se guarda vacío.

Qué estaba mal y qué se ha hecho:

| | |
|---|---|
| La tabla de hasta el 27/08 | ambigua: leída al pie de la letra escapaba todas las comillas |
| La corrección del 27/08 | segura pero **no canónica** (4 sustituciones), y con el mecanismo equivocado: culpaba a `kses`, y en realidad es JSON inválido |
| Hoy | las seis del core, con la distinción explícita, y el historial escrito en `docs/metodo-generateblocks-v2.md` §3 |

**La verificación adversarial de la investigación original ya lo señalaba bien** (nota 63 de
`investigacion/resultados-completos.md`) y se pasó por alto al escribir la corrección del 27.

Además: `herramientas/audit-gb.js` **ya avisa** cuando el escapado no es el canónico
(`escapado-no-canonico`). No es error —el bloque funciona— pero al reguardar desde el editor
WordPress reescribe el marcado y el contenido cambia de bytes sin que nadie lo edite.

**Hallazgo nuevo de la prueba de pegado:** `wp_insert_post()` con el contenido tal cual **destruye
el escapado en silencio**. Espera el contenido escapado con barras y aplica `wp_unslash()`, así que
le quita la barra a todos los escapes unicode: 543 eliminadas en un fichero de 179 bloques, con el
JSON todavía válido y por tanto **sin un solo aviso**. La regla es importar con
`wp post create <fichero>`, que además no aplica `kses` y salva el SVG en línea. Escrito en la
fase 4 de `SETUP-RECOMENDADO.md` y en la skill de bloques.

Actualizado en: `docs/metodo-generateblocks-v2.md` §3, la skill `generar-bloques-generateblocks`
(checklist y explicación), fase 4 y erratas de `SETUP-RECOMENDADO.md`, los dos HTML publicados,
`audit-gb.js` y la memoria `leccion-colores-generateblocks`. Plugin a **0.1.3**.

---

### Cerrado hoy (28/08/2026)


- **La laguna de portabilidad de la configuración del tema, resuelta.** `herramientas/config-tema.js`
  exporta `generate_settings`, `generate_spacing_settings` y `generate_package_font_library` a JSON
  versionable y las reimporta en el destino. Exporta **solo esas tres**: lo demás que encuentra en
  la base de datos lo lista para que lo decida Javier, no lo asume. Importar exige `--confirmar` y
  deja copia previa.
- **`wp.cmd` ya resuelve el puerto de MySQL de Local** por la variable `WP_MYSQL_PORT`. Era el
  papelito suelto de ayer: Local da a cada sitio un puerto propio y sin eso wp-cli da "conexión
  denegada" aunque el sitio esté arrancado. `config-tema.js` lo saca solo de `sites.json`.
- **Hallazgo, con consecuencia real:** `wp core version` **lee un fichero, no la base de datos**,
  así que funciona igual con el sitio parado. La primera versión del script lo usaba como prueba de
  conexión, daba el sitio por bueno y luego reportaba las tres opciones como "no existen" — un
  falso negativo perfecto, del mismo tipo que los que este flujo existe para evitar. Ahora
  comprueba con `wp option get siteurl`. Documentado en `herramientas/wp-cli/LEEME.md`.
- **Las dos correcciones de orden, ya escritas en el flujo.** La del CPT por código en la fase 2 ya
  estaba; la de GSAP después de los query loops estaba implícita en la fase 6 y ahora es explícita
  también en la fase 5, donde se decide el orden de trabajo.
- Documentado en: fases 2, 5 y 8 de `SETUP-RECOMENDADO.md`, la skill
  `flujo-wordpress-generateblocks` (nueva trampa 6, y las fases 2/6/8 de su tabla),
  `herramientas/LEEME.md` (con la sección de `puerta-calidad.js`, que faltaba) y
  `herramientas/wp-cli/LEEME.md`. Plugin subido a **0.1.2** para que `/plugin` lo detecte.
- **La versión visual del flujo, al día.** `traspaso-2026-08-26/setup-recomendado.html` republicado
  con la configuración del tema en las fases 2 y 8, y el orden query loops → animación en la 5.
  Misma URL de siempre (no cambia el enlace):
  https://claude.ai/code/artifact/e0637e21-fdca-432a-b83e-133b1362bef4

### Sigue abierto, sin urgencia

- **`conversion/scripts/wp-push-tokens.mjs` no tiene el *fallback* que promete.** Su docstring
  describe una "estrategia dual" (abilities MCP, y si no, endpoint REST de opciones), pero solo la
  primera esta implementada. Medido el 2/09/2026 contra `figma-staging`: las abilities de
  GeneratePress no estaban registradas (2 abilities en total, 0 de GP) y el script murio con
  `HTTP 404 rest_ability_not_found`, sin alternativa. Hay que anadir la via wp-cli
  (`update_option('generate_settings', ...)`), que es la que funciono.
- **Dato nuevo para unificar los validadores.** En la misma prueba, un marcado con comillas dobles
  dentro del atributo `css` (pilas de fuente tipo `"Fraunces", Georgia, serif`) rompia el JSON del
  bloque: `validate-blocks.mjs` lo paro con 12 errores y **`audit-gb.js` dio 0 errores**. Sumado al
  caso inverso ya registrado (audit-gb caza `shape` sin `html`), queda confirmado que ninguno domina
  y que hay que pasar los dos hasta unificarlos.

- Las dos reglas de validador que la investigación recomienda y no están: fallar ante un HEX de
  marca literal, y comprobar contra un WordPress real que cada `wp-image-{ID}` existe.
- **Unificar los dos validadores.** Desde la promoción del 2/09 conviven `audit-gb.js` y
  `conversion/scripts/validate-blocks.mjs`. Método para resolverlo, no opinar: correr los dos
  contra el corpus de 732 bloques y quedarse con la unión de reglas verdaderas. Detalle y
  medición en `herramientas/conversion/LEEME.md`.
- El clic literal en el CSS Editor de GB Pro 2.6 desde la UI (el experimento usó la API REST, el
  mismo camino que usa el editor al guardar, pero no ese botón concreto).

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
| `herramientas/global-styles.js` | Fases 2, 4 y 8: exporta e importa los Global Styles de GB (CPT `gblocks_styles`). Idempotente |
| `docs/rutas-de-conversion.md` | Las 3 rutas de conversión comparadas y medidas: handoff, MCP de Figma y figma-gb-pipeline |
| `docs/prueba-handoff.md` | Evidencia medida de la importación de un handoff: escapado, kses, fidelidad visual y las dos trampas |
| `docs/recorrido-proyecto-ejemplo.html` | Ejemplo trabajado: un proyecto ficticio de principio a fin, para ver cómo se interactúa con el plugin. Publicado en https://claude.ai/code/artifact/a607bb4e-69c8-40ef-87d9-282674329393 |
| `verificacion/roundtrip-escapado-wp.js` | Prueba que `var(--color)` sobrevive al escapado de WP |
| `skills/` | Las 5 skills del plugin (ver README) |
| `.claude-plugin/` | Manifiestos del plugin y del marketplace |
| `.claude/settings.json` | Hook `Stop`: versiona la memoria automáticamente |
| `herramientas/commit-memoria.sh` | El script del hook. Defensivo: calla si no hay cambios o no es un repo |
| `herramientas/wp-cli/` | `wp.cmd` y `php.cmd`: usan el PHP y wp-cli que trae Local, sin instalar nada. Ver su LEEME |
| `herramientas/puerta-calidad.js` | Fase 7: comprueba URLs rotas y peso de imagen contra el servidor real |
| `herramientas/config-tema.js` | Fases 2 y 8: exporta e importa la configuración del tema y la tipografía, que viven en la base de datos y no viajan con el repo |
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
| 5 | Skills del plugin | **HECHA** — 5 skills: flujo, importación de handoff (28/08), generación de bloques, wp-cli en Local y puerta de calidad. Sin duplicar los docs: apuntan a ellos |
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
