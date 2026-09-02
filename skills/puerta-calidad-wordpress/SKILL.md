---
name: puerta-calidad-wordpress
description: Puerta de calidad antes de entregar o subir a producción un WordPress: contrato de diseño publicado (tokens y tipografía que resuelven de verdad), enlaces e imágenes rotas, peso de imagen, accesibilidad WCAG, CLS/LCP y salud de WordPress. Úsala cuando se vaya a entregar, revisar o publicar un sitio, cuando se hable de accesibilidad, Lighthouse, imágenes pesadas o enlaces rotos, y siempre antes de dar por bueno un despliegue.
version: 0.2.0
---

# Puerta de calidad antes de producción

Es la fase 7 del flujo y **no es opcional**. Existe porque el validador de marcado no la cubre:
está medido que da 0 errores sobre el fichero que tenía 11 de 13 imágenes en 404 en producción.
Una capa valida el **contenido**, esta valida el **entorno**. Las dos hacen falta.

## Regla que decide si sirve de algo

Ejecútalo **contra el sitio desplegado en staging, con la URL real, incluido el subdirectorio si lo
hay**. Nunca contra un HTML local suelto: es precisamente el subdirectorio lo que rompió Aridane, y
en local no se ve.

## Los seis pasos

**0. ¿Llegó el contrato de diseño al navegador?**

```
node herramientas/conversion/scripts/qa-contrato-publicado.mjs <url-real> [--tokens x.tokens.css]
```

Comprueba, sobre la página **servida**, que cada `var(--token)` del marcado tiene una definición
real y que cada familia tipográfica declarada tiene un `@font-face` que la cargue.

Existe porque este flujo cometió el mismo fallo dos veces en dos semanas: 14 Global Colors
empujados y verificados que el navegador no veía (WP los publica como `--wp--preset--color--X`),
y dos fuentes declaradas 47 veces entre las dos que se servían **sin un solo `@font-face`** — todo
salía en Georgia. **Declarar no es publicar**, y ninguna de las dos cosas da error en ningún sitio:
el navegador coge otra cosa y calla.

Ningún otro paso de esta puerta lo ve: los pasos 1 y 2 miran URLs, el 3 accesibilidad, el 4
rendimiento y el 5 la salud de WordPress. Ninguno mira si lo que el marcado *referencia* existe.

Es Node sin dependencias y tarda un segundo. Distingue el token usado **sin respaldo** —que rompe
y hace fallar la puerta— del que lleva `var(--x, valor)`, que degrada y solo se informa.

**1 y 2. Rotas y peso de imagen — un solo comando, sin descargar nada**

```
node herramientas/puerta-calidad.js <url-real-con-subdirectorio>
```

Cubre los dos primeros pasos: extrae del HTML todas las imágenes (incluido `srcset` y fondos CSS),
recursos y enlaces, y comprueba cada URL **contra el servidor real**. Separa lo roto en tu propio
sitio —que bloquea la entrega— de lo roto hacia fuera, y lista las imágenes que pasan del
presupuesto. Node sin dependencias: no descarga nada. Opciones: `--max-kb=200`, `--json`.

Es lo que habría detectado los 11×404 de Aridane, porque resuelve las rutas como el navegador y no
como el marcado. **Si solo haces un paso de los cinco, haz este.**

Medido contra un sitio real: 350 URLs comprobadas en una pasada.

*Límite que hay que conocer:* comprueba **una página** y todo lo que esa página referencia. Para
recorrer el sitio entero hace falta un rastreador, y entonces sí:

```
npx linkinator <url-staging> --recurse --concurrency 20
```

Para **convertir** las imágenes que salgan pesadas: `sharp-cli` o `avif-cli`. **No `squoosh-cli`**,
sin mantenimiento activo desde que Google disolvió el equipo. Presupuesto: **menos de 200 KB** por
imagen above-the-fold.

**3. Accesibilidad**

```
npx pa11y-ci <url>
npx @axe-core/cli <url>
```

Contra **WCAG 2.1 AA**, que es lo exigible hoy por el RD 1112/2018 — **obligatorio para webs de
ayuntamiento, no opcional**. Comprueba la fecha actual: EN 301 549 v4.1.1 (WCAG 2.2 AA) se esperaba
en el DOUE hacia octubre de 2026.

**4. Rendimiento**

```
npx lhci autorun
```

Umbrales: CLS `maxNumericValue: 0.1` y LCP ≤ 2,5 s.

**5. Salud de WordPress**

```
wp doctor check --all --path="<ruta del sitio>"
```

Cubre autoload options, cron, actualizaciones de plugin/tema. **Ya está instalado en esta máquina**,
fijado a la versión `2.3.0` porque la última rama exige WP-CLI ^3.0 y aquí hay 2.12.0. Si hay que
reinstalarlo en otra máquina: `wp package install wp-cli/doctor-command:2.3.0` (sin fijar versión,
falla). Usa el envoltorio de la skill `wp-cli-en-local`, y ejecútalo desde PowerShell —
`cmd //c "..."` puede partir un `--path` con espacios.

## Tras el despliegue

Migrar con `wp search-replace "<url-local>" "<url-produccion>" --dry-run --skip-columns=guid`,
revisar el informe, y solo entonces repetir sin `--dry-run`. Nunca editar URLs a mano: WordPress las
guarda absolutas por diseño intencional.

Y **repetir estos seis pasos contra la URL de producción real** una vez desplegado. Que pasara en
staging no garantiza producción: cambia el dominio, y a veces el subdirectorio.
