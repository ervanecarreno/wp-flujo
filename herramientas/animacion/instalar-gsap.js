#!/usr/bin/env node
/**
 * instalar-gsap.js — instala la BIBLIOTECA de animación del flujo en un
 * proyecto ya montado.
 *
 * Historia corta, porque explica qué hace y qué no:
 *
 *   · Hasta el 4/09/2026 la fase 6 era solo una fila en la tabla de fases,
 *     sin nada detrás. Entonces este script empezó a dejar una PLANTILLA con
 *     ejemplos comentados.
 *   · El 7/09/2026, montando la landing de Hedvig contra una web de
 *     referencia real, se vio que la plantilla no bastaba: cada proyecto
 *     acababa reescribiendo los mismos cinco patrones (entrada por scroll,
 *     escalonado, palabra a palabra, texto ligado al scroll, apilado sticky)
 *     y volviendo a tropezar con los mismos problemas —parpadeo del estado
 *     inicial, página en blanco si el CDN falla—.
 *
 * Ahora instala una biblioteca QUE YA FUNCIONA. No escribes JavaScript:
 * pones una clase en el marcado y la sección anima. El JS solo se toca para
 * afinar tiempos, en un objeto CONFIG que está arriba del todo.
 *
 * Qué escribe, en el tema hijo (por defecto `wp/tema-hijo/`):
 *   1. `assets/animations.js` — la biblioteca, con las clases documentadas.
 *   2. Un bloque en `functions.php` que:
 *      · encola GSAP + ScrollTrigger desde cdnjs (versión fija);
 *      · encola la biblioteca;
 *      · imprime en el <head> el CSS del estado inicial y el interruptor
 *        con RED DE SEGURIDAD: si GSAP no carga o el JS peta, el contenido
 *        aparece solo a los 2,5 s en vez de quedarse invisible para siempre.
 *
 * Lo que sigue SIN hacer: decidir qué anima cada sección. Eso es poner la
 * clase en el marcado, y para eso hace falta una referencia real —
 * `medir-referencia.mjs` la saca de una URL— no una suposición.
 *
 * Uso:
 *   node herramientas/animacion/instalar-gsap.js [--tema-hijo wp/tema-hijo] [--forzar]
 *
 * Node, sin dependencias. No pisa nada que ya exista salvo con --forzar.
 *
 * OJO — escribe en la carpeta VERSIONADA del repo, no en el tema activo de
 * Local WP: no hay symlink entre ambos. Después hay que desplegar:
 *   node herramientas/desplegar-tema.mjs --sitio "<...>/app/public"
 * (trampa 12 de la skill: tres días con la fase 6 dada por hecha sin que el
 * sitio sirviera el script.)
 */
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const args = process.argv.slice(2);
const opt = (n, def) => { const i = args.indexOf(n); return i !== -1 ? args[i + 1] : def; };
const forzar = args.includes("--forzar");

const temaHijo = path.resolve(opt("--tema-hijo", path.join("wp", "tema-hijo")));
const functionsPhp = path.join(temaHijo, "functions.php");
const animationsJs = path.join(temaHijo, "assets", "animations.js");

if (!fs.existsSync(functionsPhp)) {
  console.error(`✖ No existe ${functionsPhp}.`);
  console.error(`  Uso: node herramientas/animacion/instalar-gsap.js [--tema-hijo wp/tema-hijo] [--forzar]`);
  console.error(`  Corre esto desde la raíz del proyecto (donde está la carpeta wp/), o pasa --tema-hijo.`);
  process.exit(2);
}

const MARCADOR = "/* === Animación (GSAP) — instalado por wp-flujo/herramientas/animacion/instalar-gsap.js === */";
/* Cierre EXPLÍCITO del bloque. El bloque lleva dos add_action(): "hasta el
 * primer `);`" cortaba en el primero y dejaba huérfano el segundo; "hasta el
 * final del fichero" se comía cualquier código del usuario que hubiera
 * DESPUÉS del bloque en una edición manual — pasó de verdad probando esto.
 * Con un marcador de cierre, el recorte es exacto sin importar cuántos
 * add_action() lleve el bloque por dentro. */
const FIN_MARCADOR = "/* === /Animación (GSAP) === */";

const actual = fs.readFileSync(functionsPhp, "utf8");
if (actual.includes(MARCADOR) && !forzar) {
  console.error(`✖ ${functionsPhp} ya tiene el bloque de animación. Usa --forzar para volver a escribirlo (no lo duplica: lo reemplaza).`);
  process.exit(1);
}

/* GSAP 3.15.0 desde cdnjs, comprobado en vivo el 4/09/2026 (gsap.min.js y
 * ScrollTrigger.min.js existen y responden 200 en esa versión). Pinnado a
 * una versión exacta: un CDN sin pin puede cambiar de golpe bajo el sitio. */
const GSAP_VERSION = "3.15.0";

/* El prefijo de las clases y el handle del script salen del "Text Domain" de
 * style.css — el slug canónico que ya pone nuevo-proyecto.js. Así dos temas
 * hijos activos en el mismo WordPress no chocan ni en handles ni en CSS. */
const styleCss = path.join(temaHijo, "style.css");
const textDomain = fs.existsSync(styleCss)
  ? (fs.readFileSync(styleCss, "utf8").match(/Text Domain:\s*([a-z0-9-]+)/i)?.[1] ?? null)
  : null;
const P = textDomain ?? "tema-hijo";

/* ── El CSS del estado inicial ──────────────────────────────────────────────
 * Va bajo `html.P-anim`, clase que pone el script del <head>. Sin JS, sin la
 * clase: el contenido se ve. Es la diferencia entre "no anima" y "no se ve". */
const CSS_INICIAL = [
  `.${P}-anim .${P}-reveal,`,
  `.${P}-anim .${P}-reveal-sm,`,
  `.${P}-anim .${P}-reveal-xs,`,
  `.${P}-anim .${P}-reveal-x,`,
  `.${P}-anim .${P}-reveal-x-izq,`,
  `.${P}-anim .${P}-words,`,
  `.${P}-anim .${P}-zoom{opacity:0}`,
  /* Apilado sticky: es CSS puro, no lleva JS. La clase va en el CONTENEDOR y
     sus hijos directos se convierten en tarjetas que se tapan entre sí. */
  `.${P}-stack>*{position:sticky;top:0}`,
  `.${P}-word{display:inline-block;will-change:transform,opacity}`,
  /* Con movimiento reducido no hay ni estado inicial oculto. */
  `@media (prefers-reduced-motion: reduce){`,
  `.${P}-anim .${P}-reveal,.${P}-anim .${P}-reveal-sm,.${P}-anim .${P}-reveal-xs,`,
  `.${P}-anim .${P}-reveal-x,.${P}-anim .${P}-reveal-x-izq,.${P}-anim .${P}-words,`,
  `.${P}-anim .${P}-zoom{opacity:1}}`,
].join("");

const bloquePhp = `
${MARCADOR}
/**
 * GSAP + ScrollTrigger desde cdnjs (versión fija, sin build propio) y la
 * biblioteca \`assets/animations.js\`, que es donde vive la animación. Va en
 * el footer (\`true\`): no bloquea el pintado inicial.
 *
 * GenerateBlocks Pro anima hover/focus por su cuenta (panel Effects, puro
 * CSS) — esto es SOLO para animación por scroll, que GB Pro no cubre.
 */
add_action(
	'wp_enqueue_scripts',
	static function (): void {
		wp_enqueue_script( 'gsap', 'https://cdnjs.cloudflare.com/ajax/libs/gsap/${GSAP_VERSION}/gsap.min.js', array(), '${GSAP_VERSION}', true );
		wp_enqueue_script( 'gsap-scrolltrigger', 'https://cdnjs.cloudflare.com/ajax/libs/gsap/${GSAP_VERSION}/ScrollTrigger.min.js', array( 'gsap' ), '${GSAP_VERSION}', true );

		$js = get_stylesheet_directory() . '/assets/animations.js';
		if ( file_exists( $js ) ) {
			wp_enqueue_script(
				'${P}-animations',
				get_stylesheet_directory_uri() . '/assets/animations.js',
				array( 'gsap', 'gsap-scrolltrigger' ),
				(string) filemtime( $js ),
				true
			);
		}
	}
);

/**
 * Estado inicial e interruptor, los dos en el <head>.
 *
 * El CSS oculta lo que va a animar ANTES del primer pintado: si no, se ve el
 * contenido y desaparece de golpe cuando arranca el JS.
 *
 * El script pone la clase que activa ese CSS y programa su retirada a los
 * 2,5 s. Si \`animations.js\` no llega a arrancar —CDN bloqueado, error de
 * JS, red lenta— el contenido aparece igual. Una animación que falla no
 * puede dejar la página en blanco: eso es un fallo peor que no animar.
 *
 * Van juntos y en línea a propósito: separarlos en un fichero encolado
 * reintroduce la ventana de parpadeo que este bloque existe para cerrar.
 */
add_action(
	'wp_head',
	static function (): void {
		echo '<style id="${P}-anim-css">${CSS_INICIAL}</style>' . "\\n";
		echo '<script>(function(d){var r=d.documentElement;r.classList.add("${P}-anim");'
			. 'setTimeout(function(){if(!r.classList.contains("${P}-anim-lista"))'
			. 'r.classList.remove("${P}-anim");},2500);})(document);</script>' . "\\n";
	},
	1
);
${FIN_MARCADOR}
`;

/* Si ya había un bloque (--forzar), se quita ENTERO —entre los dos
 * marcadores, inclusive— antes de volver a escribirlo. Nunca se duplica el
 * add_action, y nunca se toca lo que el usuario haya escrito antes o
 * después del bloque: la primera versión de este script recortaba "hasta el
 * final del fichero", y con código del usuario después del bloque (una
 * edición manual, por ejemplo) se lo comía entero — visto de verdad
 * probando esto contra un tema hijo sintético. */
const escapa = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const patronBloqueViejo = new RegExp(`\\n?${escapa(MARCADOR)}[\\s\\S]*?${escapa(FIN_MARCADOR)}\\n?`);
const sinBloqueViejo = actual.replace(patronBloqueViejo, "\n");
fs.writeFileSync(functionsPhp, sinBloqueViejo.replace(/\s*$/, "\n") + bloquePhp);
console.log(`✔ ${functionsPhp} — bloque de animación escrito (encolado + estado inicial + red de seguridad).`);

/* ── La biblioteca ─────────────────────────────────────────────────────────
 * `__P__` se sustituye por el slug del proyecto. El código generado NO usa
 * plantillas de cadena, para que este fichero no tenga que escaparlas. */
const BIBLIOTECA = `/**
 * Biblioteca de animación por scroll — GSAP + ScrollTrigger.
 *
 * Instalada por wp-flujo/herramientas/animacion/instalar-gsap.js. NO hace
 * falta escribir JavaScript para usarla: pon una clase en el marcado (en
 * build/*.mjs, con \`className:\`) y la sección anima. Todo lo ajustable está
 * en CONFIG, aquí arriba.
 *
 * CLASES DISPONIBLES
 *
 *   .__P__-reveal        entra desde abajo (32px) al asomar en pantalla
 *   .__P__-reveal-sm     igual, 24px
 *   .__P__-reveal-xs     igual, 12px  (textos pequeños, botones)
 *   .__P__-reveal-x      entra desde la DERECHA (128px)
 *   .__P__-reveal-x-izq  entra desde la IZQUIERDA (128px)
 *
 *   .__P__-stagger       en un CONTENEDOR: sus descendientes con clase
 *                        .__P__-reveal* entran en cascada, con un solo
 *                        disparador. Úsalo en rejillas y filas de tarjetas:
 *                        nueve testimonios sueltos son nueve ScrollTrigger.
 *
 *   .__P__-words         titular palabra a palabra, con desenfoque que se
 *                        disipa. Al cargar la página, no por scroll.
 *   .__P__-scroll-words  cada palabra pasa de apagada a legible LIGADA al
 *                        scroll (scrub). Para una frase larga de manifiesto.
 *   .__P__-zoom          la imagen entra desacercándose (scale 1.2 → 1).
 *
 *   .__P__-stack         en un CONTENEDOR: sus hijos directos se apilan
 *                        (position:sticky) y cada uno tapa al anterior al
 *                        hacer scroll. Es CSS PURO, esta biblioteca no lo
 *                        toca — el CSS lo pone functions.php. Necesita que
 *                        las tarjetas NO tengan hueco entre ellas y que
 *                        tengan fondo opaco.
 *
 * REGLAS, no las rompas al tocar esto
 *
 *  1. prefers-reduced-motion se respeta vía gsap.matchMedia(). El estado
 *     inicial oculto también se anula ahí (lo hace el CSS de functions.php).
 *  2. Anima transform y opacity. La única excepción es el desenfoque de
 *     .__P__-words: es al cargar y sobre unas pocas palabras, no en cada
 *     frame de scroll.
 *  3. Contenido de query loop (paginación, "cargar más", filtro AJAX): NO
 *     caches el NodeList. Tras cada actualización del DOM llama a
 *     window.__P__Animaciones.refrescar(). Este fallo ya se pagó: una
 *     animación con número fijo de tarjetas funcionaba en local y se rompía
 *     en producción en cuanto el loop devolvía otra cantidad.
 *  4. Si quitas una animación, quita también la clase del marcado. Dejar la
 *     clase sin animación deja el elemento invisible: lo oculta el CSS.
 */
(function () {
  "use strict";

  var CONFIG = {
    duracion: 0.7,          // segundos de cada entrada
    escalonado: 0.09,       // retardo entre hermanos dentro de .__P__-stagger
    inicio: "top 85%",      // cuándo dispara (sintaxis de ScrollTrigger)
    inicioSuelto: "top 88%",// igual, para elementos fuera de un grupo
    ease: "power2.out",
    desplazamiento: { reveal: 32, sm: 24, xs: 12, x: 128 },
    hero: {                 // lo que anima al cargar, sin scroll
      duracionPalabra: 0.7,
      escalonadoPalabra: 0.08,
      desenfoque: 3,        // px de blur inicial en .__P__-words
      desplazamientoPalabra: 5,
      zoom: 1.2,            // escala inicial de .__P__-zoom
      duracionZoom: 1.4,
      retardo: 0.25,        // espera antes de subtítulos/botones
    },
    scrollWords: {          // .__P__-scroll-words
      opacidadInicial: 0.1,
      escalonado: 0.4,
      inicio: "top 85%",
      fin: "bottom 40%",
    },
  };

  var P = "__P__";
  var raiz = document.documentElement;

  if (typeof gsap === "undefined" || typeof ScrollTrigger === "undefined") {
    /* Sin GSAP no se anima, pero el contenido TIENE que verse. */
    raiz.classList.remove(P + "-anim");
    return;
  }
  gsap.registerPlugin(ScrollTrigger);

  /** Envuelve cada palabra de los nodos de texto en un <span> propio. Solo
   *  toca nodos de texto: los <span> que ya venían en el marcado (p. ej. la
   *  segunda línea apagada de un titular de dos tonos) se quedan como están. */
  function partirEnPalabras(el) {
    var palabras = [];
    var nodos = [];
    (function recoge(n) {
      for (var i = 0; i < n.childNodes.length; i++) {
        var hijo = n.childNodes[i];
        if (hijo.nodeType === 3 && hijo.textContent.trim()) nodos.push(hijo);
        else if (hijo.nodeType === 1) recoge(hijo);
      }
    })(el);

    nodos.forEach(function (nodo) {
      var frag = document.createDocumentFragment();
      var trozos = nodo.textContent.split(/(\\s+)/);
      trozos.forEach(function (trozo) {
        if (!trozo.trim()) { frag.appendChild(document.createTextNode(trozo)); return; }
        var span = document.createElement("span");
        span.className = P + "-word";
        span.textContent = trozo;
        frag.appendChild(span);
        palabras.push(span);
      });
      nodo.parentNode.replaceChild(frag, nodo);
    });
    return palabras;
  }

  var CLASES = {};
  CLASES[P + "-reveal"] = { y: CONFIG.desplazamiento.reveal };
  CLASES[P + "-reveal-sm"] = { y: CONFIG.desplazamiento.sm };
  CLASES[P + "-reveal-xs"] = { y: CONFIG.desplazamiento.xs };
  CLASES[P + "-reveal-x"] = { x: CONFIG.desplazamiento.x };
  CLASES[P + "-reveal-x-izq"] = { x: -CONFIG.desplazamiento.x };
  var SELECTOR = Object.keys(CLASES).map(function (c) { return "." + c; }).join(",");

  function montar() {
    gsap.matchMedia().add(
      {
        normal: "(prefers-reduced-motion: no-preference)",
        reduced: "(prefers-reduced-motion: reduce)",
      },
      function (contexto) {
        var normal = contexto.conditions.normal;
        var dur = function (v) { return normal ? v : 0; };
        var px = function (v) { return normal ? v : 0; };

        /* Titular palabra a palabra, al cargar. */
        gsap.utils.toArray("." + P + "-words").forEach(function (el) {
          var palabras = partirEnPalabras(el);
          gsap.set(el, { opacity: 1 });
          gsap.from(palabras, {
            opacity: 0,
            y: px(CONFIG.hero.desplazamientoPalabra),
            filter: normal ? "blur(" + CONFIG.hero.desenfoque + "px)" : "none",
            duration: dur(CONFIG.hero.duracionPalabra),
            stagger: dur(CONFIG.hero.escalonadoPalabra),
            ease: CONFIG.ease,
            clearProps: "filter",
          });
        });

        /* Imagen que se desacerca, al cargar. */
        gsap.utils.toArray("." + P + "-zoom").forEach(function (el) {
          gsap.set(el, { opacity: 1 });
          gsap.from(el, {
            scale: normal ? CONFIG.hero.zoom : 1,
            opacity: 0,
            duration: dur(CONFIG.hero.duracionZoom),
            ease: CONFIG.ease,
          });
        });

        /* Frase larga ligada al scroll. */
        gsap.utils.toArray("." + P + "-scroll-words").forEach(function (el) {
          var palabras = partirEnPalabras(el);
          if (!normal) { gsap.set(palabras, { opacity: 1 }); return; }
          gsap.set(palabras, { opacity: CONFIG.scrollWords.opacidadInicial });
          gsap.to(palabras, {
            opacity: 1,
            ease: "none",
            stagger: CONFIG.scrollWords.escalonado,
            scrollTrigger: {
              trigger: el,
              start: CONFIG.scrollWords.inicio,
              end: CONFIG.scrollWords.fin,
              scrub: true,
            },
          });
        });

        /* Grupos: un solo disparador, hijos en cascada. */
        gsap.utils.toArray("." + P + "-stagger").forEach(function (grupo) {
          var hijos = gsap.utils.toArray(grupo.querySelectorAll(SELECTOR));
          if (!hijos.length) return;
          hijos.forEach(function (h) { h.setAttribute("data-" + P + "-anim", "grupo"); });
          gsap.from(hijos, {
            opacity: 0,
            y: px(CONFIG.desplazamiento.reveal),
            duration: dur(CONFIG.duracion),
            stagger: dur(CONFIG.escalonado),
            ease: CONFIG.ease,
            scrollTrigger: { trigger: grupo, start: CONFIG.inicio, once: true },
          });
        });

        /* Sueltos. */
        gsap.utils.toArray(SELECTOR).forEach(function (el) {
          if (el.getAttribute("data-" + P + "-anim")) return;
          var clase = Object.keys(CLASES).filter(function (c) { return el.classList.contains(c); })[0];
          var desde = CLASES[clase] || { y: CONFIG.desplazamiento.reveal };
          gsap.from(el, {
            opacity: 0,
            x: px(desde.x || 0),
            y: px(desde.y || 0),
            duration: dur(CONFIG.duracion),
            ease: CONFIG.ease,
            scrollTrigger: { trigger: el, start: CONFIG.inicioSuelto, once: true },
          });
        });

        raiz.classList.add(P + "-anim-lista");
      }
    );
  }

  montar();

  /* Para contenido que llega después (query loop paginado, filtro AJAX):
   *   window.__P__Animaciones.refrescar();
   * Vuelve a consultar el DOM y recalcula posiciones. Nunca guardes una
   * NodeList fuera de aquí. */
  window[P.replace(/-/g, "_") + "Animaciones"] = {
    refrescar: function () {
      montar();
      ScrollTrigger.refresh();
    },
  };
})();
`;

if (fs.existsSync(animationsJs) && !forzar) {
  console.log(`⏭ ${animationsJs} ya existe, no se toca (usa --forzar para reescribirlo).`);
} else {
  fs.mkdirSync(path.dirname(animationsJs), { recursive: true });
  fs.writeFileSync(animationsJs, BIBLIOTECA.replaceAll("__P__", P));
  console.log(`✔ ${animationsJs} — biblioteca escrita (prefijo de clases: "${P}-").`);
}

console.log(`
Ya puedes animar SIN escribir JavaScript: pon la clase en el marcado.

  className: "${P}-reveal"        entra desde abajo
  className: "${P}-reveal-x"      entra desde la derecha
  className: "${P}-stagger"       en un contenedor: sus tarjetas, en cascada
  className: "${P}-words"         titular palabra a palabra
  className: "${P}-scroll-words"  frase larga ligada al scroll
  className: "${P}-zoom"          imagen que se desacerca
  className: "${P}-stack"         en un contenedor: tarjetas que se apilan

Los tiempos se afinan en el objeto CONFIG de assets/animations.js.

Dos avisos que cuestan caro si se saltan:

  1. Esto está en el repo, no en el sitio. Despliega:
       node <plugin>/herramientas/desplegar-tema.mjs --sitio "<...>/app/public"

  2. No animes antes de tener los query loops montados (fase 5): animar y
     luego convertir a query loop rompe la animación.

Y antes de decidir QUÉ anima cada sección, si hay una web de referencia,
mídela en vez de suponerla:
  node <plugin>/herramientas/referencia/medir-referencia.mjs <url>`);
