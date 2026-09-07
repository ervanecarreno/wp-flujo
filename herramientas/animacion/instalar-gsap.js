#!/usr/bin/env node
/**
 * instalar-gsap.js — añade animación GSAP a un proyecto YA montado.
 *
 * Fase 6 del flujo ("Animación con GSAP") existía hasta el 4/09/2026 solo
 * como una FILA en la tabla de fases —"va después de la fase 5"— sin ninguna
 * herramienta detrás: nada que encolara GSAP, ningún patrón de arranque
 * escrito, cero rastro en `nuevo-proyecto.js`. Cada vez había que montarlo
 * de cero, a mano, en el proyecto de turno.
 *
 * Este script hace lo que `nuevo-proyecto.js` hace con el esqueleto general,
 * pero solo para animación, y SOLO cuando el proyecto de verdad la necesita —
 * mismo criterio que ACF: no va por defecto, se añade cuando toca.
 *
 * Qué escribe, en el tema hijo del proyecto (por defecto `wp/tema-hijo/`):
 *   - un bloque en `functions.php` que encola GSAP + ScrollTrigger desde
 *     cdnjs y el `assets/animations.js` propio del proyecto;
 *   - `assets/animations.js`, con el patrón seguro ya escrito (ver el
 *     comentario dentro del propio fichero): respeta
 *     `prefers-reduced-motion`, re-consulta el DOM en contenido de query
 *     loop y llama `ScrollTrigger.refresh()`, anima solo transform/opacity.
 *
 * Lo que NO hace: escribir la animación en sí. Eso se decide sección a
 * sección — con la referencia que tengas (interacción real de Figma, una
 * URL a un sitio con el efecto que quieres, o solo la descripción) — y se
 * añade a mano dentro de `assets/animations.js`, dentro del patrón que
 * este script ya deja puesto.
 *
 * Uso:
 *   node herramientas/animacion/instalar-gsap.js [--tema-hijo wp/tema-hijo] [--forzar]
 *
 * Node, sin dependencias. No pisa nada que ya exista salvo con --forzar.
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

const actual = fs.readFileSync(functionsPhp, "utf8");
if (actual.includes(MARCADOR) && !forzar) {
  console.error(`✖ ${functionsPhp} ya tiene el bloque de animación. Usa --forzar para volver a escribirlo (no lo duplica: lo reemplaza).`);
  process.exit(1);
}

/* GSAP 3.15.0 desde cdnjs, comprobado en vivo el 4/09/2026 (gsap.min.js y
 * ScrollTrigger.min.js existen y responden 200 en esa versión). Pinnado a
 * una versión exacta: un CDN sin pin puede cambiar de golpe bajo el sitio. */
const GSAP_VERSION = "3.15.0";

/* El handle del script debe ser único por proyecto (dos temas hijos activos
 * a la vez en el mismo WP —compartido con otra prueba— no deben chocar). El
 * slug canónico del proyecto ya vive en el "Text Domain" de style.css, el
 * mismo que nuevo-proyecto.js pone al crear el tema — se lee de ahí en vez
 * de adivinar a partir del nombre de una carpeta. */
const styleCss = path.join(temaHijo, "style.css");
const textDomain = fs.existsSync(styleCss)
  ? (fs.readFileSync(styleCss, "utf8").match(/Text Domain:\s*([a-z0-9-]+)/i)?.[1] ?? null)
  : null;
const handleAsset = textDomain ?? "tema-hijo";

const bloquePhp = `
${MARCADOR}
/**
 * GSAP + ScrollTrigger desde cdnjs (versión fija, sin build propio) y el
 * \`assets/animations.js\` de este proyecto, que es donde vive la animación
 * de verdad. Va en el footer (\`true\`): no bloquea el pintado inicial.
 *
 * GenerateBlocks Pro anima hover/focus por su cuenta (panel Effects, puro
 * CSS) — esto es SOLO para animación por scroll, que GB Pro no cubre.
 * Confirmado dos veces por su soporte oficial.
 */
add_action(
	'wp_enqueue_scripts',
	static function (): void {
		wp_enqueue_script( 'gsap', 'https://cdnjs.cloudflare.com/ajax/libs/gsap/${GSAP_VERSION}/gsap.min.js', array(), '${GSAP_VERSION}', true );
		wp_enqueue_script( 'gsap-scrolltrigger', 'https://cdnjs.cloudflare.com/ajax/libs/gsap/${GSAP_VERSION}/ScrollTrigger.min.js', array( 'gsap' ), '${GSAP_VERSION}', true );

		$js = get_stylesheet_directory() . '/assets/animations.js';
		if ( file_exists( $js ) ) {
			wp_enqueue_script(
				'${handleAsset}-animations',
				get_stylesheet_directory_uri() . '/assets/animations.js',
				array( 'gsap', 'gsap-scrolltrigger' ),
				(string) filemtime( $js ),
				true
			);
		}
	}
);
`;

/* Si ya había un bloque (--forzar), se quita entero antes de volver a
 * escribirlo — nunca se duplica el add_action. */
const sinBloqueViejo = actual.replace(
  new RegExp(`\\n?${MARCADOR.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[\\s\\S]*?\\n\\);\\n`),
  ""
);
fs.writeFileSync(functionsPhp, sinBloqueViejo + bloquePhp);
console.log(`✔ ${functionsPhp} — bloque de animación escrito.`);

const PLANTILLA_ANIMATIONS_JS = `/**
 * Animación por scroll de este proyecto, con GSAP + ScrollTrigger.
 *
 * Instalado por wp-flujo/herramientas/animacion/instalar-gsap.js. El
 * patrón de abajo viene de un fallo real ya pagado en otro proyecto: una
 * animación que asumía un número fijo de tarjetas funcionaba en local y se
 * rompía en producción en cuanto un query loop de WordPress (noticias,
 * CPTs, cualquier listado dinámico) devolvía una cantidad distinta.
 *
 * Reglas de este fichero, no las rompas al añadir una animación:
 *
 *  1. Respeta prefers-reduced-motion. gsap.matchMedia() se encarga: el
 *     bloque "reduced" corre en vez del normal, nunca los dos.
 *  2. Anima SOLO transform y opacity. Cualquier otra propiedad fuerza
 *     layout/paint en cada frame — se nota, sobre todo en móvil.
 *  3. Si el selector puede venir de un query loop (paginación, "cargar
 *     más", un filtro AJAX), NUNCA caches el NodeList ni el conteo:
 *     vuelve a consultar el DOM cuando el contenido cambie, y llama
 *     ScrollTrigger.refresh() después. Ver el ejemplo comentado abajo.
 *  4. GenerateBlocks Pro ya anima hover/focus por su cuenta (panel
 *     Effects del bloque, puro CSS) — no lo dupliques aquí. Este fichero
 *     es solo para animación disparada por scroll.
 *
 * Cómo describir una animación antes de escribirla aquí: la referencia con
 * más fidelidad es la interacción real de Figma (Smart Animate entre dos
 * frames) si existe. Si no, una URL a un sitio con el efecto que quieres —
 * pídesela a quien te lo encargó, o dala tú— para revisar el timing/easing
 * real antes de escribir el gsap.to(...).
 */
document.addEventListener("DOMContentLoaded", () => {
  gsap.registerPlugin(ScrollTrigger);

  gsap.matchMedia().add(
    {
      normal: "(prefers-reduced-motion: no-preference)",
      reduced: "(prefers-reduced-motion: reduce)",
    },
    (contexto) => {
      const { normal } = contexto.conditions;

      // Ejemplo: una entrada simple por scroll. Sustituye el selector y
      // los valores por los de la sección real.
      //
      // gsap.from(".mi-seccion .gb-element", {
      //   opacity: 0,
      //   y: normal ? 24 : 0,
      //   duration: normal ? 0.6 : 0,
      //   ease: "power2.out",
      //   scrollTrigger: { trigger: ".mi-seccion", start: "top 80%" },
      // });

      // Ejemplo sobre contenido de un query loop (noticias, tarjetas...):
      // vuelve a consultar el DOM cada vez, no captures una NodeList fuera
      // de esta función ni asumas un número fijo de elementos.
      //
      // const tarjetas = document.querySelectorAll(".gb-query-loop-item");
      // gsap.from(tarjetas, {
      //   opacity: 0, y: normal ? 16 : 0, duration: normal ? 0.5 : 0,
      //   stagger: normal ? 0.08 : 0, ease: "power2.out",
      //   scrollTrigger: { trigger: ".gb-query", start: "top 85%" },
      // });
      //
      // Si ese listado pagina o filtra por AJAX, tras cada actualización:
      //   ScrollTrigger.refresh();
    }
  );
});
`;

if (fs.existsSync(animationsJs) && !forzar) {
  console.log(`⏭ ${animationsJs} ya existe, no se toca (usa --forzar para reescribirlo desde la plantilla).`);
} else {
  fs.mkdirSync(path.dirname(animationsJs), { recursive: true });
  fs.writeFileSync(animationsJs, PLANTILLA_ANIMATIONS_JS);
  console.log(`✔ ${animationsJs} — plantilla escrita.`);
}

console.log(`
Siguiente paso: para cada sección que anime, pide (o trae) una referencia —
la interacción real de Figma si existe, o la URL de un sitio con el efecto
que quieres— y escribe la animación dentro de assets/animations.js, en el
patrón que ya está puesto. No animes antes de tener los query loops
montados (fase 5): animar y luego convertir a query loop rompe la
animación.`);
