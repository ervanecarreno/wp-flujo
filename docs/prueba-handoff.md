# Prueba de importación de un handoff de diseño

> Evidencia de las cifras que citan la skill `importar-handoff-diseno` y la fase 4 de
> `SETUP-RECOMENDADO.md`. Se guarda aquí para que el plugin no dependa de una carpeta de pruebas
> que puede borrarse.

**Fecha:** 28/08/2026.
**Material:** handoff de Claude Design de una home de ayuntamiento (26 ficheros, 19 MB), con tres
variantes: prototipo HTML, Gutenberg nativo y GenerateBlocks.
**Entorno:** Local WP · PHP 8.2.29 · WP-CLI 2.12.0 · GeneratePress · GenerateBlocks Pro 2.7.0.
**Método:** páginas creadas de verdad, medidas contra el WordPress real, y borradas al terminar.

---

## 1. Las dos variantes, medidas sobre el mismo diseño

| | Gutenberg nativo | GenerateBlocks |
|---|---|---|
| Marcado | 29,1 KB | 98,3 KB |
| Bloques | 126 | 179 |
| CSS asociado | 24,6 KB | 3,9 KB + el que genera GB |
| Tokens en el CSS | 12 | 0 |
| `var(--)` en el CSS | 51 | 0 |
| **HEX de marca en el marcado** | **0** | **124** |
| URLs de imagen absolutas | 9 | 2 |
| Clases `wp-image-{ID}` | **0** | **0** |

La variante GenerateBlocks aplana los colores a HEX literales porque el handoff viajaba con una
**versión antigua** del método (la que desaconsejaba `var()`). Con el método corregido eso no
tendría por qué pasar: `var()` sobrevive intacto, verificado.

## 2. El marcado sobrevive al guardado

Importado con `wp post create <fichero>` como administrador:

| | Gutenberg nativo | GenerateBlocks |
|---|---|---|
| Bytes del fichero → guardados | 29.889 → **29.889** | 100.775 → **100.775** |
| Bloques que reconoce `parse_blocks()` | 126 | 179 |
| Bloques **sin atributos** | **0** | **0** |
| `<svg>` conservados | 16 de 16 | 13 de 13 |
| ¿WordPress reescribió el escapado? | no | no |

**Byte a byte idéntico.** Con esto queda cerrado el cabo suelto que arrastraba el asunto del
escapado: con el escapado canónico del core, WordPress no reescribe nada al guardar.

## 3. Trampa: `wp_insert_post()` destruye el escapado

El mismo fichero, insertado con `wp_insert_post()` pasándole el contenido tal cual:

| Vía de importación | Escapes unicode |
|---|---|
| `wp post create <fichero>` | 384 **con** barra — correcto |
| `wp_insert_post( $contenido )` | 384 **sin** barra — destruido |

543 barras invertidas eliminadas. `wp_insert_post()` espera el contenido **escapado con barras** y
aplica `wp_unslash()` por dentro, así que la secuencia que representaba `<svg` queda como el texto
literal `u003csvg`.

**Y es completamente silencioso:** el JSON sigue siendo válido, así que no hay bloques sin
atributos, no hay aviso, no hay error.

> **Regla:** importar siempre con `wp post create <fichero>`. Si hace falta `wp_insert_post()` en
> PHP propio, `wp_slash()` antes.

## 4. Trampa: el SVG en línea y `kses`

Forzando el escenario real (`wp_set_current_user(0)` + `kses_init_filters()`):

| Quién pega | Bytes | `<svg>` | Bloques |
|---|---|---|---|
| Sin `unfiltered_html` | 24.114 (**−5.775**) | **0 de 16** | 126 (intactos) |
| Administrador | 29.889 | 16 de 16 | 126 |

**Los bloques sobreviven; solo desaparecen los iconos.** La página queda entera y sin iconos, sin
ninguna alerta ni marca de bloque inválido.

`wp post create` **no aplica `kses`** (WP-CLI no monta esos filtros), así que importar por línea de
comandos evita el problema del todo.

En la variante GenerateBlocks el efecto es distinto: sus SVG viven **dentro del JSON** del bloque,
escapados, así que `kses` no los ve. Se pierden los 13 del cuerpo pero sobreviven los 13 del
atributo `html` — el bloque queda descuadrado (cuerpo ≠ atributo), que es justo lo que detecta
`herramientas/audit-gb.js`.

## 5. Fidelidad visual: exacta

Estilos calculados en el navegador contra la especificación de tokens del handoff:

| Especificado | Medido |
|---|---|
| `--ar-accent: #EE743B` | `#EE743B` |
| `--ar-deep: #001D32` | `rgb(0, 29, 50)` |
| tarjeta radio 12, padding 26 | `12px` / `26px` |
| `inset 0 0 0 1px #D4D4D4, 0 2px 2px rgba(0,0,0,.05)` | `rgb(212,212,212) 0 0 0 1px inset, rgba(0,0,0,0.05) 0 2px 2px` |
| secciones 80px | `80px` |
| icono 24px naranja | `24px`, `rgb(238,116,59)` |
| H1 `letter-spacing: -.035em` | `-2.197px` sobre `62.78px` |

**Móvil (375px):** rejilla 2×3 correcta — 6 tarjetas, 2 columnas, alturas iguales por fila
(168/168, 147/147, 188/188), **sin scroll horizontal** (359 px de contenido en 375).

## 6. La diferencia que solo se ve pegando

| | Gutenberg nativo | GenerateBlocks |
|---|---|---|
| Al pegar solo los bloques | **sin estilos**: tokens vacíos, tarjetas sin fondo ni radio ni sombra | **ya estilada** |
| Pasos | 2 (CSS en el tema **y** bloques) | 1 |
| El CSS | 24,6 KB que instalar, y el tema puede pisarlo | lo genera GB solo (31 KB) al primer visitado |

GenerateBlocks escribe su CSS por post en `wp-content/uploads/generateblocks/style-{ID}.css` **la
primera vez que la página se ve en el frontend**. Antes de eso el fichero no existe: no es un
fallo, es generación perezosa.

## 7. Lo que no se pudo probar

- El CSS del tema pisando el del handoff por especificidad. Depende del tema del proyecto real.
- Los shortcodes del sitio de origen (salen como texto literal si no existen en el destino).
- El clic literal en el CSS Editor de GB Pro 2.6 desde la interfaz.
