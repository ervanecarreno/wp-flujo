# Auditoría de la variante GenerateBlocks — 26/08/2026

Validación mecánica de `home-1b-generateblocks.html` (178 bloques GB + 1 `core/search` = los
179 del LEEME) contra el checklist de `docs/metodo-generateblocks-v2.md` §8, más una pasada
de coherencia entre marcado, CSS externo, JS del carrusel y servidor real.

**Resultado:** el marcado ya era canónico. Lo que estaba roto era el entorno alrededor.

---

## 1. Checklist del método §8 — 0 errores

| Regla | Estado |
|---|---|
| `css` coincide con `styles` (minificado, alfabético) | ✅ 178/178 |
| `className` sin la id-class | ✅ 178/178 |
| Cuerpo con `gb-<tipo>-<id>` + `gb-<tipo>` | ✅ 178/178 |
| Escapado `" & < > --` | ✅ sin ningún carácter crudo |
| `src`/`alt`/`href` dentro de `htmlAttributes` | ✅ ninguno en primer nivel |
| `htmlAttributes` objeto plano, nunca array | ✅ (causa #1 de "Attempt Recovery") |
| `content` duplicado en atributo y cuerpo | ✅ 70/70 bloques `text` |
| `element` con `tagName:"a"` contiene un `text` | ✅ 33/33, ninguno con texto plano |
| `uniqueId` únicos | ✅ 178 ids, 0 duplicados |
| Sin tipografía declarada | ✅ ningún `font-family` |
| Estructura de apertura/cierre | ✅ sin bloques huérfanos ni sin cerrar |

Etiquetas dinámicas: `{{post_permalink}}` `{{post_title}}` `{{post_date dateFormat:j F, Y}}`
`{{post_excerpt length:28}}` `{{featured_image size:large}}` — todas con sintaxis `{{tag opcion:valor}}`
correcta. Queries coherentes con el patrón destacado+lista: `posts_per_page:1, offset:0` y
`posts_per_page:3, offset:1`.

**Conclusión:** los avisos de "Attempt Recovery" que anticipaba el LEEME no vienen del generador.
Si aparecen, serán diferencias de serialización de tu versión concreta de GenerateBlocks, y
recuperar el bloque es inocuo.

---

## 2. Fallo real y bloqueante: todas las rutas de imagen daban 404

El WordPress de aridane.org **está instalado en un subdirectorio** (`/city/`, con `/ciudad/`
redirigiendo por 301). Los enlaces del marcado sí lo respetaban (`/city/contacto/`,
`/city/noticias/`…), pero **las imágenes no**:

```
/wp-content/uploads/2023/06/municipio.jpg         → 404
/city/wp-content/uploads/2023/06/municipio.jpg    → 200
```

El archivo mezclaba **tres formas de URL** a la vez: relativa sin prefijo (la mayoría),
absoluta con `www…/city/` (`lapalmasmartisland`) y absoluta con `aridane.org/ciudad/`
(`turismo_aridane_44-1`). Comprobado contra el servidor: **11 de 13 imágenes daban 404**.

Corregido en `home-1b-generateblocks-v2.html`: todas absolutas. Esto además cumple la regla
de la skill *"URLs siempre absolutas en `htmlAttributes`, nunca relativas"*.

### Verificación posterior contra el servidor

| Imagen | Antes | Después |
|---|---|---|
| `2023/06/municipio.jpg` (hero) | 404 | **200** |
| `2023/06/playas.jpg` | 404 | **200** |
| `2023/06/fondo_empresas-1-scaled.jpg` | 404 | **200** |
| `2023/07/archivo_municipal-1.jpg` | 404 | **200** |
| `2023/07/cemfac_portada-3.jpg` | 404 | **200** |
| `2023/09/lapalmasmartisland-1.jpg` | 200 | 200 |
| `2026/06/banner-pgo.jpeg` | 404 | **200** |
| `2020/12/turismo_aridane_44-1.jpg` | 200 | 200 |
| las 5 pendientes de subir | 404 | 404 *(ver §3)* |

---

## 3. Las 5 imágenes que siguen pendientes

Están en `../../assets/` pero **no existen en el servidor**. Apuntan a
`…/city/wp-content/uploads/2026/08/` — la carpeta que WordPress usará si las subes **este mes**.
Si las subes en otro mes, busca y reemplaza `2026/08` por el año/mes que toque.

| Archivo | Peso | ⚠️ |
|---|---|---|
| `banner-cortonaos.png` | 1,0 MB | |
| `banner-plan-edil.jpeg` | 76 KB | |
| `banner-infraestructuras-viales.png` | 621 KB | *(ver abajo)* |
| `promocion-deportiva.jpg` | **2,8 MB** | optimizar antes de subir |
| `servicios-sociales.jpg` | **3,8 MB** | optimizar antes de subir |

**Corregido de paso:** el marcado pedía `consulta-reconstruccion-infraestructuras-viales.png`
pero el asset entregado se llama `banner-infraestructuras-viales.png`. Nunca habría cargado.

Los 6,6 MB entre esas dos fotos son un problema serio de LCP en móvil y, en un sitio del sector
público, cuentan para las obligaciones del RD 1112/2018. Recomendación: convertir a WebP
(~200 KB cada una) antes de subirlas.

---

## 4. Desincronización de breakpoint (768 vs 781)

El README fija *"breakpoint único: 781px"* y `slider-animado.js` usa `MOBILE = 781` para decidir
cuántas tarjetas se ven. Pero el CSS ponía las tarjetas a ancho completo en `max-width:768px`.

Entre **769 y 781 px** el JS creía estar en móvil (1 tarjeta) mientras el CSS aún mostraba 2:
el número de puntos y el salto del scroll no cuadraban con lo que se veía. Corregido a 781px.

*Nota:* el CSS tiene además un escalón en 1024px (tablet) que el README no documenta. Lo he
dejado como está —es una decisión de diseño válida—, pero conviene reflejarlo en el README.

---

## 5. Accesibilidad — dos correcciones

`.ar-hero-search .wp-block-search__input:focus{ outline:none }` eliminaba el indicador de foco
del buscador principal sin sustituirlo: incumplimiento de **WCAG 2.4.7 (Focus Visible)**, exigible
por EN 301 549 / RD 1112/2018 en un ayuntamiento. Añadido un anillo naranja sobre el contenedor
con `:focus-within`, que además queda mejor que un outline sobre el input desnudo.

Las flechas y los puntos del carrusel tampoco tenían estilo de foco. Añadido `:focus-visible`.

El resto del carrusel está bien resuelto: `aria-label` en flechas y puntos, pausa con hover, con
foco de teclado, fuera de viewport y con `prefers-reduced-motion`.

---

## 6. Falsas alarmas descartadas

- **`.ar-slider`, `.ar-slider__nav`, `.ar-slider__dots`, `.is-active`** aparecen en el CSS pero no
  en el marcado. No es un error: las crea `slider-animado.js` en tiempo de ejecución.
- **`core/search` en un archivo de GenerateBlocks** es deliberado y correcto según el método §7
  (bloque de core que aporta funcionalidad de servidor, estilado desde el CSS externo).
- **Colores literales en vez de variables CSS** es intencionado: `--` cerraría el comentario HTML.

---

## 7. Qué queda abierto (no tocado)

- **Tipografía**: sigue sin declararse, la pone el tema. Correcto según el diseño.
- **`assets/banner-infraestructuras-viales.png`** ya no queda sin usar tras la corrección de nombre.
- **El buscador** es el nativo de WordPress; sustituir por el de trámites si existe.
- **Optimización de imágenes** (§3): pendiente de decisión.
