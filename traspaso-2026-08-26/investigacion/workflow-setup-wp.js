export const meta = {
  name: 'setup-wp-generateblocks',
  description: 'Investiga y verifica las piezas del setup WordPress+GenerateBlocks antes de rediseñar el flujo',
  phases: [
    { title: 'Investigar', detail: '7 temas en paralelo, cada uno con búsqueda web real' },
    { title: 'Verificar', detail: 'fact-check adversarial de las afirmaciones concretas' },
  ],
}

const CONTEXTO = `
PROYECTO DE REFERENCIA (recién terminado, 26/08/2026): rediseño de la home de aridane.org
(ayuntamiento español) con WordPress + GeneratePress + GenerateBlocks Pro V2.
179 bloques, 8 secciones, entregado como marcado de bloques pegable + CSS complementario.

LECCIONES DURAS de ese proyecto. El nuevo setup DEBE prevenir cada una:

1. El marcado de bloques era PERFECTO (0 errores sobre 179 bloques contra un checklist de
   validación de 11 reglas) pero 11 de 13 imágenes daban 404 en producción: el WordPress vive
   en un subdirectorio (aridane.org/city/) y las rutas de imagen eran relativas sin ese prefijo.
   MORALEJA: validar el MARCADO no detecta fallos del ENTORNO.

2. Dos imágenes pesaban 3,8 MB y 2,8 MB, above the fold, en un sitio del sector público español
   con obligaciones legales de accesibilidad (RD 1112/2018 / EN 301 549).

3. El CSS cambiaba a móvil en 768px y el JS del carrusel en 781px: 13px de desincronización
   silenciosa. No existía fuente única de verdad para los breakpoints.

4. En GenerateBlocks V2 los estilos viven dentro del JSON del comentario de bloque HTML, y la
   secuencia '--' cierra el comentario HTML antes de tiempo. Consecuencia: NO se pueden usar
   variables CSS (var(--color)) dentro de los bloques. Hubo que escribir los colores como
   literales (#EE743B) repetidos más de 100 veces en un archivo de 100 KB. Cambiar un color
   del diseño = buscar y reemplazar a ciegas.

5. Lo más valioso que se produjo NO fue el diseño: fue un validador en Node sin dependencias
   que reconstruye el 'css' de cada bloque desde su atributo 'styles' y los compara carácter a
   carácter. Eso es lo único que dio confianza real antes de pegar en producción.

EL USUARIO trabaja con Claude Code en Windows, hace webs para clientes (ayuntamientos, pymes)
con stack fijo: GeneratePress + GenerateBlocks Pro V2 + ACF. Prioriza, en este orden:
VELOCIDAD, MENOS PASOS, y sobre todo FIABILIDAD DEL PROTOTIPO (que lo que se ve en el diseño
sea exactamente lo que sale en producción, sin sorpresas).
`

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['resumen', 'hallazgos', 'recomendacion', 'incertidumbres'],
  properties: {
    resumen: { type: 'string', description: 'Qué has averiguado, 3-5 frases' },
    hallazgos: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['afirmacion', 'confianza', 'fuente'],
        properties: {
          afirmacion: { type: 'string', description: 'Un hecho concreto y verificable' },
          confianza: { type: 'string', enum: ['alta', 'media', 'baja'] },
          fuente: { type: 'string', description: 'URL o documentación concreta; "sin fuente" si viene de memoria' },
        },
      },
    },
    recomendacion: { type: 'string', description: 'Qué debería hacer el usuario, concreto y accionable' },
    incertidumbres: { type: 'array', items: { type: 'string' } },
  },
}

const VERDICT = {
  type: 'object',
  additionalProperties: false,
  required: ['afirmaciones_falsas', 'afirmaciones_dudosas', 'confirmado', 'nota'],
  properties: {
    afirmaciones_falsas: { type: 'array', items: { type: 'string' } },
    afirmaciones_dudosas: { type: 'array', items: { type: 'string' } },
    confirmado: { type: 'array', items: { type: 'string' } },
    nota: { type: 'string' },
  },
}

const TEMAS = [
  {
    key: 'gb-global-styles',
    prompt: `Investiga a fondo GenerateBlocks (free 2.x) y GenerateBlocks Pro V2:

(a) Que es exactamente la funcionalidad "Global Styles"? Es un JSON? Donde se guarda (post type,
    opcion, archivo)? Se puede exportar/importar? Se puede versionar en git?
(b) Como funcionan los "Global Style" blocks/clases: se aplican por clase CSS y permiten cambiar
    un estilo en un sitio y que se propague a todos los bloques que lo usan?
(c) Las variables CSS de theme.json (var(--wp--preset--color--x)) se pueden usar DENTRO de un
    Global Style de GenerateBlocks? Esto es CRITICO: en el marcado de bloques directo NO se puede
    porque los dos guiones rompen el comentario HTML, pero un Global Style vive fuera del
    comentario de bloque. Resuelve eso el problema de los colores literales repetidos?
(d) Que son los "Patterns" de GenerateBlocks Pro y como se almacenan/exportan? Y las "Pattern
    Libraries" locales?
(e) Hay CLI, API REST o archivos en disco para sincronizar todo eso entre entornos?

Busca en la documentacion oficial de GenerateBlocks (docs.generateblocks.com, generateblocks.com),
changelogs, y foros. Distingue claramente lo verificado de lo supuesto.`,
  },
  {
    key: 'theme-json-tokens',
    prompt: `Investiga como montar una FUENTE UNICA DE VERDAD de design tokens en WordPress con
GeneratePress + GenerateBlocks, dado que el marcado de bloques GB no admite var() con dos guiones:

(a) theme.json en un tema hijo de GeneratePress: que controla realmente, como se relaciona con el
    sistema de colores propio de GeneratePress (que tiene sus "Global Colors"), y si chocan.
(b) Se puede generar theme.json desde tokens de Figma (Design Tokens / Style Dictionary /
    Tokens Studio)? Hay herramientas hechas?
(c) El problema de los breakpoints: theme.json NO define breakpoints. Como se consigue que CSS,
    JS y los bloques usen el mismo breakpoint sin repetirlo a mano? Que usa GenerateBlocks V2
    como breakpoints por defecto y son configurables?
(d) Estrategia concreta para que cambiar un color de marca sea UNA edicion y no un search&replace
    en 100 KB de marcado.

Busca documentacion oficial de WordPress (developer.wordpress.org theme.json reference),
GeneratePress y GenerateBlocks.`,
  },
  {
    key: 'figma-handoff',
    prompt: `Investiga el estado REAL hoy (2026) de llevar un diseno de Figma a codigo con un agente:

(a) El Figma Dev Mode MCP Server oficial: existe, esta en GA o beta, que requiere (plan de pago,
    app de escritorio, endpoint local)? Que devuelve exactamente (codigo, variables, imagenes)?
(b) La alternativa: Figma REST API con un personal access token. Que endpoints sirven para esto
    (/files, /nodes, /images, /variables)? Las Variables/design tokens requieren plan Enterprise?
(c) Comparativa honesta para un freelance/estudio pequeno: MCP vs token REST. Coste, fiabilidad,
    friccion de setup, y que pasa si el cliente entrega el Figma en un plan gratuito.
(d) Merece la pena, o es mas fiable que el diseno nazca ya en HTML (tipo Claude Design) y saltarse
    Figma? Argumenta con datos, no con opinion.

Busca la documentacion oficial de Figma (developers.figma.com, help.figma.com) y anuncios recientes.`,
  },
  {
    key: 'wp-git',
    prompt: `Investiga como versionar un proyecto WordPress en git de forma util y sin dolor:

(a) Que se versiona y que NO: core, wp-content/uploads, plugins de terceros, tema hijo, mu-plugins,
    composer.json. Cual es el consenso actual y por que.
(b) Local WP (by WP Engine) en concreto: donde vive el sitio en disco en Windows, que carpeta tiene
    sentido convertir en repo, si hay integracion de git, y sus gotchas.
(c) El problema real: la BASE DE DATOS no se versiona bien, y en WordPress el CONTENIDO (paginas,
    bloques, opciones de ACF, Global Styles) vive en la BD. Como se resuelve? Investiga
    aproximaciones: WP-CLI export/import, plugins de migracion (WP Migrate DB Pro, Duplicator,
    All-in-One WP Migration), versionar patterns como archivos PHP, ACF Local JSON.
(d) ACF Local JSON en concreto: como hace que los grupos de campos vivan en archivos versionables
    y se sincronicen solos. Funciona en ACF FREE o requiere Pro?
(e) Registro de Custom Post Types: por codigo en el tema hijo vs plugin de UI. Que es mas portable.

Busca documentacion oficial (localwp.com, advancedcustomfields.com, developer.wordpress.org,
make.wordpress.org) y practicas establecidas.`,
  },
  {
    key: 'contenido-portable',
    prompt: `Investiga como mover CONTENIDO Gutenberg entre entornos (local -> staging -> produccion)
sin que se rompa. Este es el punto que mas fallo en el proyecto de referencia:

(a) El problema de las URLs: rutas relativas vs absolutas en el marcado de bloques, subdirectorios
    de instalacion, y que pasa al migrar. Cual es la practica correcta?
(b) wp-cli search-replace: como se usa para reescribir dominios, por que --dry-run importa, y el
    problema de los datos serializados en PHP.
(c) Los IDs de adjuntos (attachment IDs) en los bloques de imagen: por que el marcado con un id que
    no existe en el destino rompe los tamanos responsive, y como se evita.
(d) Block Patterns registrados como ARCHIVOS PHP en el tema hijo, en lugar de contenido en la BD:
    es la via fiable para versionar secciones? Como se registran? Sirve para una home entera?
(e) La API de "Synced Patterns" (antes Reusable Blocks) y si ayuda o estorba.
(f) Existe alguna forma de que las imagenes de un diseno se suban a la Biblioteca de medios y se
    referencien correctamente de forma automatizada (wp-cli media import)?

Busca en developer.wordpress.org, wp-cli.org y documentacion de bloques.`,
  },
  {
    key: 'animacion',
    prompt: `Investiga donde encaja la animacion en un pipeline de WordPress con bloques, y como hacerlo
sin romper nada:

(a) GSAP en WordPress: como encolar correctamente (wp_enqueue_script, dependencias, defer), desde
    tema hijo vs plugin de snippets tipo WPCode. Cual es mas portable entre entornos.
(b) GenerateBlocks Pro V2 trae animaciones/efectos propios (scroll effects, transitions)? Si si,
    cuando usar los suyos y cuando GSAP? Busca en su documentacion.
(c) prefers-reduced-motion y accesibilidad: obligaciones concretas en sitios del sector publico
    (EN 301 549, WCAG 2.2 criterios 2.3.3 y 2.2.2).
(d) EL PUNTO CLAVE: la animacion debe anadirse ANTES o DESPUES de montar las plantillas de CPT y
    los query loops? Argumenta. Considera que el contenido dinamico se renderiza en servidor y que
    una animacion que dependa de elementos del DOM que aun no existen (o que cambian de cantidad)
    es fragil. Que patron lo hace robusto?
(e) Impacto en rendimiento y en Core Web Vitals (CLS sobre todo).`,
  },
  {
    key: 'validacion-entorno',
    prompt: `El proyecto de referencia demostro que validar el MARCADO no basta: el marcado estaba
perfecto y aun asi 11 de 13 imagenes daban 404 en produccion. Investiga y disena la capa de
validacion de ENTORNO que faltaba:

(a) Que comprobaciones automatizables detectan que una pagina de WordPress esta rota antes de
    publicarla? Enumera las de maximo valor: enlaces rotos, imagenes 404, peso de imagenes,
    contraste, foco visible, jerarquia de encabezados, CLS.
(b) Herramientas concretas que se pueden ejecutar desde linea de comandos en Windows y meterse en
    un flujo con un agente: Lighthouse CI, pa11y, axe-core CLI, linkinator/broken-link-checker,
    wp-cli doctor. Para cada una: que detecta, cuanto cuesta montarla, si necesita el sitio
    levantado.
(c) Obligaciones legales espanolas para webs de ayuntamientos: RD 1112/2018, EN 301 549, nivel WCAG
    exigido, y si hay auditoria obligatoria. Se preciso, esto es normativa real.
(d) Presupuestos de rendimiento razonables para una home de ayuntamiento: peso de imagen maximo,
    LCP objetivo, formato (WebP/AVIF), y como automatizar la conversion desde linea de comandos.
(e) Disena una "puerta de calidad" concreta: que se ejecuta, en que orden, y que debe bloquear la
    subida a produccion.`,
  },
]

phase('Investigar')

const resultados = await pipeline(
  TEMAS,
  (t) => agent(
    `${CONTEXTO}\n\n===== TU TAREA =====\n${t.prompt}\n\n` +
    `IMPORTANTE: usa busqueda web de verdad (ToolSearch para cargar WebSearch/WebFetch y usalas). ` +
    `No respondas de memoria: los productos cambian y la fecha es agosto de 2026. ` +
    `Marca confianza 'baja' en cualquier afirmacion que no hayas podido confirmar con una fuente. ` +
    `Prefiero un "no lo he podido verificar" honesto a una afirmacion inventada.`,
    { label: `investiga:${t.key}`, phase: 'Investigar', schema: SCHEMA }
  ),
  (res, t) => {
    if (!res) return null
    return agent(
      `Eres un verificador esceptico. Otro agente ha investigado el tema "${t.key}" para un setup de ` +
      `WordPress + GenerateBlocks. Tu trabajo es REFUTAR, no confirmar.\n\n` +
      `Sus hallazgos:\n${JSON.stringify(res, null, 2)}\n\n` +
      `Comprueba con busqueda web (ToolSearch -> WebSearch/WebFetch) las afirmaciones CONCRETAS: ` +
      `nombres de funcionalidades, versiones, si algo requiere plan de pago, rutas de archivo, ` +
      `nombres de comandos CLI, y articulos de normativa legal.\n` +
      `Senala especialmente: funcionalidades que NO existen o se llaman de otra forma, cosas que ` +
      `requieren una licencia que no se ha mencionado, y consejos que se contradicen con la ` +
      `documentacion oficial. Si algo es correcto, dilo en 'confirmado'. Se breve y concreto.`,
      { label: `verifica:${t.key}`, phase: 'Verificar', schema: VERDICT }
    ).then(v => ({ tema: t.key, investigacion: res, verificacion: v }))
  }
)

return resultados.filter(Boolean)
