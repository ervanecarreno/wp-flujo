# Cómo trabajamos los dos

**Este es el documento que rige el procedimiento.** Las skills del flujo (empezando por
`flujo-wordpress-generateblocks`) lo asumen y lo citan; si una skill y este documento discrepan,
gana este documento y se corrige la skill.

Fijado el 22/09/2026. Aplica a cualquier proyecto de cliente que use este plugin, no a uno en
concreto — lo que sea específico de un proyecto (quién es A, quién es B, el dominio del servidor)
va en el `CLAUDE.md` de ese proyecto, no aquí.

A diseña, B desarrolla. Ninguno entra en el ordenador del otro: nos encontramos en el repositorio
y en una URL.

## Arranque rápido

Para no releer todo el documento cada vez que se empieza una tarea:

- [ ] **¿Sois dos personas de verdad hoy, o uno solo haciendo los dos puestos?** Determina si toca
  rama (ver «El circuito de cada tarea», paso 1) — dos personas, rama siempre; una sola, rama
  opcional. El resto del circuito no cambia.
- [ ] **¿Toca a A o a B?** Aspecto (Figma, bloques) → A. Comportamiento (CPT, snippets, animación,
  despliegue) → B. Si dudas, es de B: todo lo que no sea "cómo se ve" lo es.
- [ ] **¿Vas a tocar algo por interfaz** (Personalizador, cookies, un ajuste de plugin)? Anótalo en
  `ESTADO.md` del proyecto antes de tocarlo, no después.
- [ ] **Antes de dar algo por terminado: la puerta de calidad.** Sin excepción, sea cual sea el
  tamaño del cambio — ver «Lo que se valida y por qué», más abajo.

## Quién es quién

Cada uno es dueño de una parcela. Dueño significa que decide y que nadie más la toca.

**A — Diseñador.** El aspecto y el sistema.
- Figma manda: sistema de marca, especificación de diseño (colores, tipos, espacios).
- Claude Design, solo para explorar bocetos; nunca la versión final.
- Handoff: Figma MCP → este plugin → bloques (GenerateBlocks Pro V2 o Gutenberg nativo, según el
  proyecto).
- Revisión visual del resultado ya en el servidor.
- **Entrega:** la especificación congelada y los bloques generados (en una rama, si sois dos).

**B — Desarrollador.** El comportamiento.
- Tipos de contenido, a código en un **mu-plugin**.
- Snippets y funciones, en el tema hijo.
- Animación con GSAP, sobre lo que entrega A.
- Formularios, cookies e integraciones de plugins.
- Rendimiento: medir, corregir, volver a medir.
- Despliegue: wp-cli remoto, staging y producción.
- **Entrega:** código listo para revisar (en una rama, si sois dos).

**La entrega de A no es «el diseño está aprobado en Figma».** Es un artefacto: la especificación
congelada y los bloques generados. Figma sigue mandando sobre los valores —colores, tipos,
espacios—, pero la entrega se revisa en el servidor, no abriendo Figma.

## Flujo de diseño a bloques

```
Figma  ──MCP──▶  este plugin (herramientas/conversion/)  ──▶  bloques
```

GenerateBlocks Pro V2 o Gutenberg nativo, según decida el proyecto (ver el punto de decisión de
conversión en `flujo-wordpress-generateblocks`). Si algo no cuadra entre el diseño y el bloque, se
arregla en la especificación de Figma, no parcheando el bloque a mano — un bloque tocado a mano se
pierde en la siguiente generación (ver «Lo que no hacemos» abajo).

## Lo que compartimos

Tres sitios, y solo tres. Nada de carpetas compartidas ni de ordenadores en la nube.

1. **El código** — el repositorio de GitHub del proyecto. Tema hijo, mu-plugin, bloques, y el
   criterio del proyecto en su `CLAUDE.md` y `ESTADO.md`.
2. **El contenido** — un único WordPress en el servidor del cliente, desde el día uno, cerrado al
   público y sin indexar. Una sola base de datos para los dos — elimina la sincronización de
   `wp_options` entre entornos. No hay migración de staging a producción: el día del lanzamiento
   se apunta el dominio y ya está.
3. **El diseño** — Figma. Es la fuente de verdad: vive en la nube y está siempre al día, sin
   copias. Claude Design es solo apoyo para explorar ideas antes de que entren en Figma; lo que
   hay en Figma manda.

## El circuito de cada tarea

Siempre el mismo, lo empiece quien lo empiece.

1. **Rama nueva, si hay dos personas** (A·B). Una por tarea, cuando A y B son dos personas
   distintas que pueden chocar en los mismos ficheros — que es el riesgo real que evita una rama.
   **Si un solo operador hace los dos puestos con Claude, la rama es opcional**: no hay con quién
   chocar, y forzarla ahí es ceremonia sin función. Lo que NUNCA es opcional, con una persona o con
   dos, es el paso 5. Ver «Validado contra el proyecto piloto» para el porqué de esta distinción.
2. **Diseño cerrado y bloques generados** (A). La especificación se congela en Figma. De ahí sale
   por MCP hacia este plugin, que la convierte en bloques. Si algo no cuadra, se arregla en la
   especificación, no en el bloque.
3. **Comportamiento encima** (B). Funcionalidad y animación sobre lo que A ha entregado, sin
   cambiar su aspecto.
4. **Revisión y despliegue** (A·B). Al abrir la revisión, el cambio aparece en la URL del
   servidor. Los dos lo miran ahí, en el navegador. Nadie instala nada del otro.
5. **Puerta de calidad y merge** (A·B). Si no pasa, no entra. Esa es la única definición de
   «terminado» — ver la skill `puerta-calidad-wordpress`. Este paso es igual de obligatorio si hubo
   rama o si se trabajó directo: la puerta no depende de git, depende del sitio real.

## Las cuatro reglas

Con esto se evitan casi todos los choques.

1. **El código sube, el contenido baja.** El código va del repositorio al servidor. El contenido y
   los ajustes viven en el servidor y no vuelven nunca al repositorio.
2. **La especificación manda.** Los ajustes visuales del tema se configuran *desde* la
   especificación de diseño, no en paralelo. Si hay dos fuentes de verdad, gana la especificación.
3. **Lo que se toca por interfaz, por turnos.** Tipografía del tema, cookies, opciones de
   plugins: lo toca uno cada vez y lo anota en `ESTADO.md` del proyecto. Es lo único que no queda
   registrado solo.
4. **Un solo canal.** Las decisiones se escriben donde está el trabajo — issues del repo o Slack,
   nunca WhatsApp. Lo que se decide en un chat y no se anota, no ha pasado.

## Lo que no hacemos

Cada una de estas cosas nos ha costado, o nos costaría, un día de trabajo.

- Editar a mano un bloque generado. Se pierde en la siguiente generación; el arreglo va a la
  especificación o al generador.
- Registrar tipos de contenido desde un plugin de interfaz (ACF y similares) o snippets desde un
  plugin de snippets (Code Snippets y similares). Todo a código: CPT al mu-plugin, snippets al
  tema hijo — ver «El aspecto va al tema hijo. El comportamiento va a un mu-plugin» en
  `flujo-wordpress-generateblocks`.
- Mover la base de datos de un sitio a otro con plugins de migración.
- Montar una máquina virtual compartida. El repositorio ya hace ese trabajo.
- Meter otra librería de animación en paralelo a GSAP, que es la que ya usa el flujo (fase 6).

## Dónde trabaja cada uno

- **B: siempre en CLI local.** SSH, wp-cli, git, Playwright necesitan el entorno de B — no hay
  forma de hacer despliegue o QA real sin terminal local.
- **A: CLI local solo para generar bloques**; Proyectos (la web de claude.ai) para brief y
  contenidos — no necesita terminal para lo suyo salvo el paso de Figma → bloques.
- **«Código» en la web** (claude.ai/code) sirve para tareas sueltas que no toquen el servidor: no
  trae las claves SSH de nadie salvo que se configuren a mano ahí. No es el sitio para desplegar.

Las dos cuentas de Claude van en el mismo equipo de Claude Code: así las skills de este plugin se
despliegan a los dos y no las mantiene cada uno por su cuenta. Lo que no se comparte entre cuentas
son las conversaciones, y por eso el criterio de cada proyecto vive escrito en su repositorio
(`CLAUDE.md`, `ESTADO.md`), no en el historial de chat.

## Validado contra el proyecto piloto (22/09/2026)

`WEB FUNDACION SC LA PALMA` es la prueba de valor de este documento: mide si el protocolo funciona
contra un proyecto real, no contra la teoría. Evaluado con la evidencia de git, no de memoria —
`git log --all` en los dos repos, `web-fundacion-sc-la-palma` y este mismo plugin.

**Validado, con coste real evitado al seguirlo:**

- **La especificación manda.** La primera pasada de la Home de ese proyecto se escribió leyendo el
  `.dc.html` de Claude Design en vez de Figma, y salió mal en siete cosas —copy, colores del pie,
  fondo de dos secciones, el póster del vídeo del hero. Se corrigió releyendo Figma. El coste de
  saltarse esta regla se pagó una vez, de verdad, antes de fijarla.
- **La puerta de calidad, sin excepción.** `qa-editor-check.mjs` —la única capa que abre el editor
  real de WordPress— cazó dos regresiones que ni los linters estáticos ni la vista veían: un
  atributo `icon` que invalidaba el bloque, y una regresión real de una beta de GenerateBlocks Pro.
  `qa-contrato-publicado.mjs` cazó 39 ajustes de GeneratePress apuntando a una paleta de color que
  ya no existía. Ninguna de las dos cosas se ve mirando el marcado ni la pantalla.
- **El piloto como canario antes de adoptar una versión nueva.** Se probaron los betas de GB en un
  clon aislado, salió una regresión real, se arregló en este mismo plugin —beneficia a cualquier
  proyecto, no solo a ese piloto— y se decidió no subirlos todavía. Es exactamente el resultado que
  la regla busca.

**Nunca se siguió, y no costó nada no seguirla:**

- **Rama por tarea.** Cero ramas, en los dos repos, en todo el historial del proyecto: 15 commits
  directos a `master` en el proyecto de cliente, 5 en este plugin. Ninguno se deshizo, ninguno
  chocó con otro. La razón, vista con la evidencia delante: el proyecto lo llevó un solo operador
  haciendo los dos puestos con Claude, no dos personas distintas. Una rama protege contra que dos
  personas choquen en los mismos ficheros — un riesgo que, con un solo operador, no existe. Por
  eso la regla pasó de obligatoria a condicional al tamaño real del equipo (ver el circuito, paso
  1): impone la ceremonia solo cuando la ceremonia tiene función.

**Sin ejercitar todavía, no descartado:**

- **Un único WordPress en el servidor del cliente desde el día uno.** Ese proyecto sigue en Local
  (`figma-staging.local`); no hay servidor real de cliente en juego aún, así que esta regla no se
  ha puesto a prueba de verdad.
- **CPT en el mu-plugin, no en ACF.** Ese proyecto no tiene ningún tipo de contenido propio
  todavía.

La lectura general: las reglas sobre **de dónde sale la verdad** —Figma, la puerta de calidad, el
piloto como canario— protegen contra que dos fuentes discrepen, que es el riesgo real de un equipo
A/B, y las tres se ganaron su sitio con un fallo real evitado. La ceremonia de coordinación —la
rama— solo vale cuando hay a quién coordinar con. Ese es el criterio para revisar cualquier regla
nueva que se proponga aquí: qué riesgo concreto evita, y si ese riesgo existe en el proyecto que la
va a seguir.

---

A diseña · B desarrolla
Nos vemos en el repositorio y en la URL
Si no ha pasado la puerta de calidad, no está terminado
