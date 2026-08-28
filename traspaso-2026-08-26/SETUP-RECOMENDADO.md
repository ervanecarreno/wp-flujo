# Setup WordPress + GenerateBlocks — flujo definitivo (última revisión 27/08/2026)

Ajuste del flujo de 7 pasos de Javier, basado en la investigación completa (7 temas,
investigados y verificados adversarialmente — detalle con fuentes en `investigacion/resultados-completos.md`),
en las lecciones del proyecto Aridane, y en un experimento propio contra un WordPress real
(27/08/2026 por la tarde) que corrige una de las conclusiones de la investigación original — ver
Fase 1 y Fase 4. Prioriza, en este orden: **velocidad → menos pasos → fiabilidad del prototipo**.

**Este flujo ya no es solo un documento.** Está empaquetado como plugin de Claude Code
(`wp-generateblocks`, en la raíz de este mismo repo) con 4 skills que se activan solas y las
herramientas de validación ya construidas y probadas. Este documento sigue siendo la referencia
de criterio; `ESTADO.md` en la raíz lleva el estado de implementación al día.

## Los tres cambios de fondo respecto a la propuesta original

1. **El WordPress vacío se monta primero, no después del diseño.** El fallo de Aridane (rutas
   rotas por el subdirectorio `/city/`) fue posible precisamente porque el diseño se cerró sin
   conocer los hechos del entorno real. Montar el shell de Local WP es ~10 min y no bloquea nada.
2. **Los tokens de color van en CSS real con clases utilitarias, no en el panel de color de cada
   bloque.** GenerateBlocks resuelve SIEMPRE el color elegido en su selector a HEX literal —
   confirmado por su propio soporte, incluso si el valor viene de theme.json — así que nunca hay
   forma de que "cambiar un color" sea una edición si el color se elige bloque a bloque.
3. **Hay una puerta de calidad automatizada antes de producción, que es justo lo que faltó.** El
   marcado de Aridane era perfecto y aun así el sitio estaba roto. Validar el marcado y validar
   el entorno son dos capas distintas y las dos hacen falta.

---

## Flujo (8 fases)

### Fase 0 — Bootstrap del entorno (NUEVA, ~10 min, antes del diseño)

Crear el sitio vacío en Local WP con GeneratePress + GenerateBlocks Pro V2 + ACF (free) +
plugins específicos del proyecto. Anotar de inmediato los hechos que el diseño va a necesitar:
¿hay subdirectorio?, ¿qué breakpoint usa GP (768px por defecto) vs el que se vaya a usar en
GB (767px por defecto, configurable con el filtro `generateblocks_media_query`)?, ¿carpeta de
uploads?

Dentro de ese mismo sitio, dejar montado el esqueleto de portabilidad (ver Fase 2) — es más barato
hacerlo vacío que reordenarlo después.

### Fase 1 — Diseño (ajustada: sin Figma como fuente de datos)

Diseñar directamente en HTML (Claude Design / prototipo navegable), no partir de un archivo Figma
para extraer código, sea con MCP o con token de acceso personal — el límite se ata al plan del
ARCHIVO del cliente, no a quien llama: un Figma en plan gratuito deja ~6 peticiones al mes sobre
ese archivo aunque pagues Professional o uses tu propio token; la Variables REST API exige
Enterprise sin excepción da igual el método de acceso.

**Corrección del 27/08/2026 (tarde) — lo que sigue abajo estaba equivocado y ya no aplica:** este
documento afirmaba que "GenerateBlocks no admite `var(--color)` de forma fiable en el marcado
pegado a mano", y por eso recomendaba aplanar todo a literales incluso si se extrajera limpio de
Figma. **Es falso, verificado contra un WordPress real** (ver Fase 4): `var(--color-x)` sobrevive
intacto con el escapado correcto — el problema real nunca fue `var()`, sino un quinto escape de
comillas que ni este documento ni la investigación original sabían que rompía el guardado. Sigue
sin ser buena idea extraer marcado de Figma (por el límite de peticiones de arriba), pero YA NO es
por un problema técnico de `var()` — si algún día se extrae limpio, las variables sí sobrevivirían.

**Si el cliente insiste en Figma o ya lo tiene armado por un tercero**, úsalo solo como referencia
visual (capturas, comentarios) — nunca como fuente del marcado final. Sigue pasando cada bloque
generado por el validador antes de pegarlo.

En esta fase se fija también el **sistema de color como tokens reales**: variables CSS (o los
Global Colors nativos de GeneratePress: `--accent`, `--contrast`, etc.) en una hoja de estilos de
verdad — nunca elegidos en el panel de color de cada bloque GB (ver Fase 4, sigue aplicando aunque
`var()` funcione: el problema del panel es que resuelve a HEX literal, no el escapado).

### Fase 2 — Esqueleto de portabilidad (dentro del WP de la Fase 0, antes de generar marcado)

- `git init` dentro de `wp-content/` (Local WP no tiene integración git nativa — usar su terminal
  integrado, "Open Site Shell")
- Tema hijo de GeneratePress, versionado
- Un plugin propio (o mu-plugin) que registre los Custom Post Types **por código**, nunca en
  `functions.php` del tema ni con un plugin de UI (ambos no sobreviven a un cambio de tema o no
  son versionables)
- Carpeta `acf-json/` en el tema hijo — activar ACF Local JSON desde ya. **Es gratis, no requiere
  PRO**, y sincroniza sola en cuanto detecta un archivo más reciente que la base de datos
- Carpeta `/patterns/` en el tema hijo para las secciones reutilizables (y candidatamente la home
  entera, vía `Template Types: front-page` en la cabecera del patrón) — es la vía oficialmente
  recomendada por WordPress frente a los Synced Patterns, que viven solo en base de datos y no
  viajan con el código
- `.gitignore`: fuera core, `uploads/`, plugins de terceros (documentar versiones en un README en
  vez de comitear binarios)
- **La configuración del tema y la tipografía no están en código: están en la base de datos.** Es
  la laguna que el resto de esta fase no cubre. Verificado contra un WordPress real: viven en tres
  opciones de WordPress (`generate_settings`, `generate_spacing_settings` y
  `generate_package_font_library`), así que no viajan con el repo. Sin exportarlas, el destino
  recibe la maqueta correcta con la tipografía y los espaciados de fábrica. Expórtalas en cuanto
  el tema esté configurado, y **cada vez que lo toques**:

  ```
  node herramientas/config-tema.js exportar --path="<sitio>"
  ```

  Deja un JSON legible por opción en `config-tema/` (más un `MANIFIESTO.json`), listo para
  comitear. Solo lleva esas tres; si encuentra otras opciones `generate_*` en la base de datos te
  las lista para que decidas tú si hacen falta (`--incluir=`), no lo asume. En el destino, la
  reimportación pide `--confirmar` y guarda copia de lo anterior antes de sobrescribir.

### Fase 3 — Repo GitHub (igual que la propuesta original, con el alcance correcto)

Push del esqueleto de la Fase 2. A partir de aquí, push/pull diario tiene sentido porque lo que
se versiona es realmente código, no un volcado de base de datos.

### Fase 4 — Generación de marcado (con el validador como parte del proceso, no al final)

1. **Subir las imágenes primero**, vía `wp media import ruta/img.jpg --porcelain`, capturando el
   ID real devuelto. Generar el marcado usando ESE id — nunca uno inventado en el prototipo. Es
   el mecanismo exacto que causa la degradación silenciosa de `srcset` cuando el id no existe en
   el destino (no da error: simplemente no genera tamaños responsive).
2. Generar los bloques de GenerateBlocks con la skill del checklist de 10 reglas (`generar-bloques-generateblocks`
   del plugin; el §8 de `docs/metodo-generateblocks-v2.md` tiene el detalle de cada una).
   **El escapado del JSON del comentario de bloque son 4 sustituciones, no 5**: `--`, `<`, `>`, `&`
   → sus `\uXXXX`. **Las comillas se dejan literales** — escaparlas rompe el guardado real (ver
   nota de la Fase 1 y el detalle completo en `docs/metodo-generateblocks-v2.md` §3).
3. Colores: nunca elegidos en el panel de color del bloque — sigue resolviendo siempre a HEX
   literal, tenga o no Global Styles activados (ver Fase 6). Por defecto, clases utilitarias
   (`.text-accent`, `.bg-accent`...) en el CSS del tema hijo. Alternativa ya verificada: escribir
   `var(--accent)` directamente en `styles`/`css` al generar el bloque (nunca por el panel) —
   sobrevive intacto con el escapado de 4 sustituciones de arriba.
4. Pasar el **validador Node** — ya construido, integrado en el plugin
   (`herramientas/audit-gb.js`, reconstruye el `css` de cada bloque desde `styles` y compara
   carácter a carácter). Pendiente de ampliar con dos reglas que esta investigación señala: (a)
   fallar si aparece un HEX de marca literal fuera de una lista de excepciones conocida, y (b)
   contra un WordPress real (vía wp-cli), comprobar que cada `wp-image-{ID}` referenciado
   corresponde a un adjunto que existe de verdad.

### Fase 5 — Plantillas intermedias, noticias, CPT (igual que la propuesta original)

Con la diferencia de que los CPT ya están registrados por código desde la Fase 2, y las
plantillas/secciones se guardan como archivos PHP en `/patterns`, no como contenido pegado que
solo vive en la base de datos.

**Los query loops se montan aquí, y la animación va después (Fase 6). No al revés.** Animar una
sección con un número fijo de tarjetas y convertirla luego en query loop rompe la animación: los
selectores dejan de encajar y las tarjetas que llegan del bucle nunca se registran en
ScrollTrigger. Es el mismo fallo descrito en la Fase 6, pero causado por el orden de trabajo.

### Fase 6 — Animación (confirmado: después de la Fase 5, tu instinto original era correcto)

- GSAP es **100% gratuito desde abril de 2025**, incluido ScrollTrigger — ya no hay fricción de
  licencia
- Encolar vía `wp_enqueue_script` en el tema hijo (portable, viaja con el repo), no vía WPCode
  (vive en la base de datos, no viaja entre entornos)
- GenerateBlocks Pro **no tiene animación nativa por scroll/keyframes** (confirmado dos veces por
  su propio soporte) — su panel de Effects sirve solo para hover/focus. Para cualquier animación
  de scroll, GSAP es obligatorio
- **El punto que de verdad importa:** inicializar en `DOMContentLoaded`, después del HTML
  renderizado en servidor (incluidos los query loops) — pero eso no basta si el contenido cambia
  de cantidad después (paginación, filtros AJAX). Hay que re-consultar el DOM y llamar a
  `ScrollTrigger.refresh()` cada vez, nunca asumir un número fijo de tarjetas. Es exactamente la
  misma clase de fragilidad que el desfase de breakpoint de Aridane
- Accesibilidad: `prefers-reduced-motion` no es opcional — el criterio WCAG 2.2.2 (nivel A) ya es
  exigible hoy por el RD 1112/2018. Animar solo `transform`/`opacity`, nunca propiedades de layout

### Fase 7 — Puerta de calidad (NUEVA — lo que faltó en Aridane)

Contra el sitio **ya desplegado en staging, con la URL real incluyendo el subdirectorio si lo
hay** — nunca contra un HTML local suelto:

1. **`node herramientas/puerta-calidad.js <url-staging>`** (del plugin, sin dependencias) —
   sustituye a `npx linkinator`: extrae del HTML real imágenes, `srcset`, fondos CSS y enlaces, y
   comprueba cada URL contra el servidor. Separa lo roto en el propio sitio de lo roto hacia
   fuera. Habría detectado las 11 imágenes 404 de Aridane, porque resuelve rutas como el
   navegador real, no como el marcado. Probado contra un sitio real: 350 URLs en una pasada
2. Peso/formato de imagen (el propio script anterior ya lo reporta, con presupuesto de 200 KB por
   imagen above-the-fold). Para **convertir** las que salgan pesadas: **sharp-cli o avif-cli** (no
   squoosh-cli, sin mantenimiento activo)
3. `pa11y-ci` + `@axe-core/cli` contra WCAG 2.1 AA — obligatorio por RD 1112/2018 para
   ayuntamientos, no opcional
4. `lhci autorun` (Lighthouse CI) con umbral de CLS (`maxNumericValue: 0.1`) y LCP ≤2.5s
5. `wp doctor check --all --path="<sitio>"` (vía `herramientas/wp-cli/wp.cmd` del plugin) — salud
   general de WordPress. **Ojo al instalarlo**: `wp package install wp-cli/doctor-command` a secas
   falla si la versión de WP-CLI es 2.x (la rama por defecto exige ^3.0); fijar la versión
   compatible, p. ej. `wp-cli/doctor-command:2.3.0` para WP-CLI 2.12

Ninguna de estas herramientas sustituye al validador Node del marcado — son capas
complementarias: una valida el CONTENIDO, la otra el ENTORNO.

### Fase 8 — Producción

Migrar con `wp search-replace "http://local.test" "https://dominio.com/subdirectorio" --dry-run
--skip-columns=guid`, revisar el informe, y solo entonces repetir sin `--dry-run`. Nunca editar
URLs relativas a mano — WordPress guarda URLs absolutas por diseño intencional (el contenido es
"migratorio", se sindica fuera del sitio). Tras el despliegue, re-ejecutar la Fase 7 completa
contra la URL de producción real.

**Antes de dar la migración por buena, importar la configuración del tema.** El `search-replace`
arregla las URLs, pero la configuración de GeneratePress y la tipografía no llegan solas: son las
tres opciones de base de datos de la Fase 2.

```
node herramientas/config-tema.js importar --path="<sitio destino>"             (solo informa)
node herramientas/config-tema.js importar --path="<sitio destino>" --confirmar  (escribe)
```

Sin `--confirmar` no escribe nada: lista opción por opción si es idéntica, si cambia o si hay que
crearla. Con `--confirmar` guarda copia de los valores anteriores en `config-tema/copias-previas/`
y te da el comando exacto para volver atrás. Después, mirar el sitio en el navegador: tipografía,
colores y espaciados. Es lo único de esta fase que ningún validador puede confirmar por ti.

---

## Piezas descartadas y por qué

- **GenerateCloud** ($99/año): solo tiene sentido gestionando muchos sitios de cliente con
  librería de patrones compartida. Para un proyecto puntual, exportar/importar XML es gratis y
  suficiente.
- **Global Styles de GenerateBlocks Pro** como mecanismo de sincronización entre entornos: es un
  custom post type sin API REST ni WP-CLI oficial — no hay forma fiable de versionarlo en git hoy.
  Tratarlo como paso de checklist manual antes de cada entrega, no como algo automático. Esto
  **no cambia** con el hallazgo de abajo: el problema de Global Styles nunca fue el escapado de
  `--`, es que no hay API para exportarlo/versionarlo — sigue sin poder viajar por git.
- **El problema de `--` en el comentario HTML, resuelto (27/08/2026).** Este documento y la
  investigación original daban por buena una quinta sustitución de escapado (comillas → `"`)
  que resulta ser la que rompe el guardado real: WordPress guarda el bloque vacío sin dar error.
  Con las cuatro sustituciones correctas (`--`, `<`, `>`, `&`) y comillas literales, `var(--color)`
  sobrevive intacto hasta el CSS real del frontend — probado contra un WordPress real, no solo
  contra el editor. Detalle completo, con la metodología, en `docs/metodo-generateblocks-v2.md`
  §3 y en `ESTADO.md`. **Sigue sin probar**: un clic real en el CSS Editor de GB Pro 2.6 desde la
  UI (el experimento usó la API REST directamente, el mismo camino que usa el editor al guardar,
  pero no un clic literal en ese editor concreto).
- **theme.json en GeneratePress** (tema clásico): su efecto real en frontend es ambiguo incluso en
  la documentación oficial — verificarlo contra el sitio real antes de construir nada encima, no
  darlo por hecho.

## Vigencias a revisar (esto cambia con el tiempo)

- **EN 301 549 v4.1.1** (WCAG 2.2 AA) se espera en el Diario Oficial de la UE hacia octubre de
  2026 — hoy (27/08/2026) sigue vigente WCAG 2.1 AA. Revisar esta fecha antes de cerrar cualquier
  auditoría de accesibilidad a partir de esa fecha.
- **WPackagist** fue adquirida por WP Engine en marzo de 2026 — si se usa Composer para plugins de
  terceros, tenerlo en cuenta dado el litigio Automattic/WP Engine en curso.
- El litigio **ACF vs Secure Custom Fields** sigue abierto (medida cautelar, no sentencia firme,
  juicio previsto finales de 2026/principios de 2027) — revisar el estado antes de fijar ACF como
  dependencia a largo plazo.
