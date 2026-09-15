---
name: importar-handoff-diseno
version: 0.2.0
description: Importa a WordPress un handoff de diseño ya convertido a bloques (de Claude Design u otro origen), eligiendo entre GenerateBlocks Pro V2 y Gutenberg nativo. Úsala cuando llegue un zip o carpeta de handoff, cuando se mencione "el diseño ya está convertido", "tengo el marcado hecho", "handoff", "Claude Design", o cuando haya que pegar/importar una home o landing ya maquetada. Actívala sin esperar a que la pidan por su nombre.
---

# Importar un handoff de diseño a WordPress

Esta skill cubre el caso en que **el marcado ya existe**: alguien —Claude Design, un pipeline propio,
otro desarrollador— ha convertido el diseño a bloques y hay que meterlo en WordPress sin perder
fidelidad. No genera marcado: lo importa, lo valida y avisa de lo que se degrada en silencio.

Encaja entre la **fase 1** y la **fase 4** del flujo de 8 fases
([[flujo-wordpress-generateblocks]]). Las fases 0, 2, 5, 6, 7 y 8 no cambian.

## LO PRIMERO: preguntar qué tipo de conversión

**No lo decidas tú.** En cuanto se vea que el diseño hay que convertirlo a WordPress, pregunta:

> ¿Qué tipo de conversión prefieres para esta página?
>
> **A · GenerateBlocks Pro V2** (la habitual) — llega estilada de una vez, sin instalar CSS.
> **B · Gutenberg nativo** — un solo CSS con tokens: cambiar un color cambia toda la página.

Y anota la respuesta donde se guarde el estado del proyecto, porque condiciona la fase 2 (si hace
falta hueco para el CSS en el tema hijo) y la fase 4.

### La tabla para decidir, con datos medidos

Comparación real sobre la misma home (28/08/2026, medida contra un WordPress con GeneratePress y
GenerateBlocks Pro 2.7.0 — detalle en `docs/prueba-handoff.md`):

| | **A · GenerateBlocks Pro V2** | **B · Gutenberg nativo** |
|---|---|---|
| Al pegar solo los bloques | **ya estilada** | **sin estilos** hasta instalar su CSS |
| Pasos para verla puesta | 1 (los bloques) | 2 (CSS en el tema **y** bloques) |
| Tamaño del marcado | 98 KB · 179 bloques | 29 KB · 126 bloques |
| Dónde viven los estilos | dentro de cada bloque | un CSS de 24 KB con 12 tokens |
| Recolorear la marca | 124 HEX repartidos por 179 bloques | 1 token |
| Riesgo de que el tema lo pise | bajo | real (el CSS compite por especificidad) |
| Dependencia | requiere GB Pro activo | ninguna |

**Cómo orientar la recomendación:**

- **Web que el cliente va a mantener, reteñir o rehacer por temporadas** → B, nativo. El token gana.
- **Prototipo que hay que enseñar ya, o sitio que ya usa GB Pro y necesita su control de layout** → A.
- **Si eligen A, pide que los colores vayan como `var(--token)` en `styles`/`css`, no aplanados a
  HEX.** Es lo que convierte el punto flaco de A en un empate: verificado que `var()` sobrevive
  intacto hasta el CSS del frontend.

**Por defecto, A**, que es la vía habitual del proyecto. Pero si el encargo dice que el cliente va a
mantener la web, di lo de B antes de que elijan.

## Colores que llegan fuera del contrato: no a ojo, con la herramienta

El handoff casi siempre trae HEX que el contrato congelado no tiene — es justo el caso de los
«124 HEX repartidos por 179 bloques» de la tabla de arriba. La tentación es resolverlos a ojo,
color a color, con una calculadora de contraste al lado: así se hizo en Fundación Santa Cruz de La
Palma para 15 huérfanos (`design/mapa-colores.md`, 15/09/2026) y costó una sesión entera.

```
node herramientas/resolver-huerfanos-color.mjs <contrato.tokens.json> "#E0B36A:198" "#8A6220:18" …
node herramientas/resolver-huerfanos-color.mjs <contrato.tokens.json> --huerfanos huerfanos.json -o informe.md
```

Para cada huérfano prueba el token solo y cada `color-mix(in srgb, tokenA P%, tokenB)` entre los
tokens base, y se queda con el más parecido por distancia **redmean** — verificado contra esa misma
tabla: reproduce sus Δ (por ejemplo `#8A6220` → `gold 65% / ink`, Δ 24) sin que nadie tuviera que
volver a medir a mano.

Lo que decide el propio Δ, no la herramienta:

- **Δ bajo (por defecto ≤30):** es un derivado — `color-mix` de dos tokens, nunca un token nuevo.
  Declaralo donde viva el mapa de color del proyecto.
- **Δ alto:** antes de aceptar un derivado que se nota, pregunta si el color de origen está mal
  medido (un desliz del diseño) en vez de dar por buena una mezcla forzada.
- **Lo que la herramienta NO mide es contraste.** Un derivado con Δ bajo puede seguir fallando WCAG
  AA sobre su fondo real — compruébalo aparte, con las reglas de contraste que traiga el contrato.

## Importar: siempre con `wp post create`

```
herramientas\wp-cli\wp.cmd post create <fichero.html> --post_type=page --post_status=draft ^
  --post_title="<titulo>" --user=<admin> --porcelain --path="<sitio>"
```

Devuelve el ID. Créalo **en borrador** y publícalo cuando esté revisado.

### Dos trampas silenciosas, las dos verificadas

**1. Nunca `wp_insert_post()` con el contenido tal cual.** Esa función espera el contenido escapado
con barras y aplica `wp_unslash()` por dentro, así que **le quita la barra a todos los escapes
unicode** del comentario de bloque: `<svg` se queda como el texto literal `u003csvg`. Medido:
543 barras eliminadas en un fichero de 179 bloques. **Y el JSON sigue siendo válido**, así que no
hay bloques sin atributos, ni aviso, ni error. Si hace falta PHP propio: `wp_slash()` antes.

**2. El SVG en línea desaparece si lo pega alguien sin `unfiltered_html`** (o sea, no
administrador). Medido: se van los 16 SVG de una home y **los 126 bloques quedan intactos** — la
página se ve completa y sin iconos, sin ninguna alerta. Por eso `--user=<admin>` en el comando de
arriba.

Ventaja de importar por línea de comandos: **`wp post create` no aplica `kses`**, así que evita el
problema del todo. Es más seguro que pegar en el editor de código.

## Comprobar que ha entrado entero

Tres comprobaciones, en este orden. Las dos primeras son de fichero; la tercera necesita el
WordPress real y es la que de verdad decide.

```
1) node herramientas/audit-gb.js <fichero.html>          (solo para la opcion A)
2) comparar bytes: los del fichero y los guardados tienen que coincidir
3) parse_blocks() contra el WordPress real
```

Para la tercera, mira si hay **bloques sin atributos**: un bloque de GenerateBlocks siempre lleva
al menos `uniqueId`, así que si vuelve vacío es que el escapado rompió el comentario. Cuenta también
las aperturas y cierres de `<svg>`, y comprueba que WordPress no reescribió el escapado.

## Lo que el handoff no trae, y hay que hacer igual

Esto sale en todos los handoff mirados hasta ahora, así que dilo antes de que se descubra en
producción:

- **Las imágenes vienen como URLs absolutas del sitio de origen y sin `wp-image-{ID}`.** Sin ID de
  adjunto **no hay `srcset`**: la imagen se sirve a tamaño completo en móvil y no da ningún error.
  Hay que subirlas con `wp media import <fichero> --porcelain` y sustituir cada referencia por el ID
  real. Es la fase 4 del flujo, y no la salta el handoff.
- **El peso de las imágenes no está mirado.** En el caso real, 6 de 7 pasaban de 200 KB, una de
  3,9 MB. Lo detecta la fase 7.
- **La tipografía suele quedar deliberadamente abierta** ("la aporta el tema"). Es correcto como
  decisión de diseño, pero significa que la fase 2 sigue siendo obligatoria: configurar el tema **y
  exportar esa configuración** con `herramientas/config-tema.js`, porque vive en la base de datos.
- **Los shortcodes del sitio de origen salen como texto literal** si no existen en el destino. No es
  un fallo: hay que registrarlos o sustituir esa sección.
- **El método que viaja dentro del handoff puede estar desactualizado.** Si trae una copia de
  `metodo-generateblocks-v2.md`, compárala con la de este plugin: una versión antigua es lo que hace
  que un generador aplane los colores a HEX en vez de usar `var()`.

## Si eligieron B (Gutenberg nativo)

El checklist de bloques de [[generar-bloques-generateblocks]] **no aplica** al marcado de la página
—no hay bloques de GB que validar— pero sí todo lo demás de esta skill.

Dos cosas propias de esta vía:

- **El CSS va al `style.css` del tema hijo** (o un parcial importado desde ahí), no a "CSS
  adicional" del personalizador: eso vive en la base de datos y no viaja con el repo.
- **Instala el CSS antes de pegar los bloques.** Si no, lo que se ve es el esqueleto sin estilos y
  parece que la importación ha fallado cuando no ha fallado.

Para una página de prueba puntual sirve incrustar el CSS en un bloque `core/html` al principio de la
propia página (sobrevive si lo pega un administrador), pero **eso no es la entrega**: en el proyecto
real va al tema hijo.

## Skills hermanas

- [[flujo-wordpress-generateblocks]] — las 8 fases donde encaja esto
- [[generar-bloques-generateblocks]] — cuando hay que **generar** marcado de GB, no importarlo
- [[wp-cli-en-local]] — para que los comandos `wp` funcionen en esta máquina
- [[puerta-calidad-wordpress]] — antes de entregar: imágenes rotas, peso, accesibilidad
