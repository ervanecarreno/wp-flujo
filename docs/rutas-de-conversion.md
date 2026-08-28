# Rutas de conversión de un diseño a GenerateBlocks Pro V2

> Comparación medida el 28/08/2026 contra un WordPress real (Local WP · GeneratePress ·
> GenerateBlocks Pro 2.7.0), sobre el mismo diseño: la home del Ayuntamiento de Los Llanos de
> Aridane, fichero de Figma `Wu3a4o4pBd313MbV7hYSZo`.
>
> **Criterio único: FIDELIDAD de la conversión.**

---

## La conclusión, primero

**El cuello de botella no es la herramienta de conversión. Es si la paleta del diseño existe como
variables con nombre que se puedan mapear a tokens de WordPress.** En este fichero de Figma no
existe: la API devuelve `colors: []`.

Por eso las tres rutas se comportan como se comportan, y por eso la que parece más pobre
técnicamente —aplanar a HEX— es hoy la que da fidelidad exacta.

## Las rutas

| | Qué es | Estado |
|---|---|---|
| **1 · Handoff** | Un zip con el diseño ya convertido (Claude Design) | **funciona** |
| **2 · MCP de Figma** | Leer el nodo de Figma directamente desde Claude Code | **no disponible**: no hay ningún MCP de Figma conectado ni en el registro |
| **3 · `figma-gb-pipeline`** | Toolkit propio: extrae de Figma, mapea tokens, emite bloques | **funciona, con el mapa de tokens sin rellenar** |

## Fidelidad del color, medida en el navegador

Contando elementos pintados de verdad con el naranja de marca `#EE743B`:

| Ruta | Naranja de marca | Fondo de tarjeta | Veredicto |
|---|---|---|---|
| **1 · Handoff** | **47 elementos** | blanco, correcto | **fidelidad exacta** |
| **3a · Pipeline, frame del rediseño** | 41 elementos | `#e6e6f0` — de la paleta del **tema** | parcialmente desviada |
| **3b · Pipeline, frame con tokens** | **0 elementos** | todo de la paleta del tema | **totalmente desviada** |

La ruta 3b es la que mejor está construida y la que peor se ve. No es una contradicción:

```
--accent     #444457   (deberia ser #EE743B)
--base       #e6e6f0   (deberia ser blanco)
--accent-4   SIN DEFINIR  -> esa declaracion se descarta entera
```

Los tokens resuelven a lo que el tema tenga puesto. Y `tokens/map.json` del pipeline solo tiene dos
colores inferidos (`#ffffff` y `#000000`): **la paleta de Aridane nunca se mapeó**, porque las
variables de Figma vinieron vacías y no había de dónde sacarlas.

## Cómo escribe cada ruta el color

| Ruta | `var()` usados | HEX literales | Recolorear la marca |
|---|---|---|---|
| 1 · Handoff | 0 | 300 (58 de marca) | 58 sitios que tocar |
| 3a · Pipeline rediseño | 88 (1 token distinto) | 154 (56 de marca) | 56 sitios |
| 3b · Pipeline con tokens | **336 (22 tokens)** | **0** | **1 token** |

## Canonicidad del marcado

Las tres pasan el validador **después de recalibrarlo** (ver §8 del método). Antes de recalibrarlo,
el pipeline daba 278 errores falsos y el handoff 0 — y la razón es incómoda:

**El validador y el handoff compartían la misma suposición equivocada.** Los dos escriben `styles`
en kebab-case; GenerateBlocks lo escribe en **camelCase**. Medido sobre 732 bloques de 25 exports
reales de GB: 1423 claves camelCase frente a 75 kebab.

| | `styles` | ¿canónico? |
|---|---|---|
| GenerateBlocks (referencia) | camelCase | — |
| **Pipeline** | camelCase | **sí** |
| **Handoff** | kebab-case | **no** |

Consecuencia práctica: el marcado del handoff renderiza perfecto —GB usa el atributo `css` tal cual
y nunca mira `styles` en el servidor— pero **si alguien abre uno de esos bloques en el editor y lo
toca**, GB regenera el `css` desde `styles`, y esas claves no son las que espera.

Es decir: el handoff es fiel **de cara al visitante** y frágil **de cara al que edite después**.

## Qué hace falta para que la ruta 3 gane

Nada del pipeline: está bien construido. Falta el paso 2 de su propio SOP, **mapear los tokens**:

1. Fijar la paleta del diseño como Global Colors de GeneratePress y Global Styles de GB Pro
   (el pipeline trae `scripts/wp-push-tokens.mjs` y `tokens/map.json` para eso).
2. Reconvertir. Entonces `var(--accent)` resuelve a `#EE743B` y se tienen las dos cosas: fidelidad
   exacta **y** un token para recolorear.

Mientras ese paso no esté hecho, la ruta 3 produce un marcado impecable con los colores del tema
equivocado — que es peor que aplanar a HEX, porque además parece correcto.

## Y la ruta 2

No se pudo probar: **no hay MCP de Figma** conectado en esta máquina, ni aparece ninguno en el
registro de conectores. Para tenerla habría que conectar uno, o usar el extractor propio del
pipeline con un token de Figma.

Nota: aunque estuviera, chocaría con el mismo muro. Un MCP de Figma leería las **Variables** del
fichero para mapear tokens, y este fichero no expone ninguna. La ruta 2 no arregla por sí sola el
problema de fondo.

## Recomendación operativa

- **Hoy, para entregar:** ruta 1 (handoff), pidiendo que los colores vayan como `var(--token)` en
  vez de aplanados. Es lo que convierte su punto flaco en un empate.
- **Para que el cliente pueda mantener la web:** ruta 3, pero **haciendo primero el mapeo de
  tokens**. Sin ese paso, no.
- **Y en cualquiera de las dos:** que el generador escriba `styles` en **camelCase**. Es la
  diferencia entre un marcado que sobrevive al editor y uno que no.
