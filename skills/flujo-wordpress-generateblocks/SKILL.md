---
name: flujo-wordpress-generateblocks
description: Flujo de 8 fases para webs WordPress de cliente con GeneratePress + GenerateBlocks Pro V2 + ACF. Úsala en cuanto aparezca un proyecto WordPress de cliente (ayuntamiento, pyme), o si se menciona GeneratePress, GenerateBlocks, GB Pro, maquetar una home o una landing, patrones de bloques, o pasar un sitio a producción. Actívala sin esperar a que la pidan por su nombre.
version: 0.1.1
---

# Flujo WordPress + GenerateBlocks

Orden de prioridades del proyecto, y no es negociable: **velocidad → menos pasos → fiabilidad del
prototipo**. Cualquier propuesta que añada pasos tiene que justificarse contra esto.

El usuario se describe como **perfil no-desarrollador**: instrucciones paso a paso, el comando
exacto, explicado antes de ejecutarlo, sin jerga innecesaria. **Nunca inventes valores** —tokens,
breakpoints, IDs, rutas—: pregunta o compruébalo.

## Antes de nada: sitúa la fase

Pregunta o deduce en qué fase está el proyecto. No empieces a producir marcado si la fase 0 no se
ha hecho: es el error que costó caro en el proyecto Aridane.

## Las 8 fases

| # | Fase | Lo que no puede fallar |
|---|---|---|
| 0 | **Bootstrap del WordPress vacío** (~10 min) | Va **antes** del diseño. Anota subdirectorio, breakpoint real de GP (768) vs GB (767), y carpeta de uploads. Sin estos datos el diseño se cierra a ciegas |
| 1 | **Diseño directo en HTML** | No partir de Figma para extraer código. Fijar el color como variables CSS reales desde ya |
| 2 | **Esqueleto de portabilidad** | `git init` en `wp-content/`, tema hijo, CPTs por código en plugin propio, `acf-json/` activo (es gratis), carpeta `/patterns/`. Y **exportar la configuración del tema**: no está en código (ver trampa 6) |
| 3 | **Repo** | Solo lo de la fase 2. Nunca core, `uploads/` ni plugins de terceros |
| 4 | **Generación de marcado** | Imágenes **primero** con `wp media import --porcelain` para usar IDs reales. Color por clase CSS, jamás por el panel del bloque. Pasar el validador |
| 5 | **Plantillas, noticias, CPT** | Los CPT ya están por código desde la fase 2; las secciones van a `/patterns` como PHP, no pegadas en la base de datos |
| 6 | **Animación con GSAP** | Va **después** de la fase 5, query loops ya montados. Animar antes y convertir luego a query loop rompe la animación. GB Pro no tiene animación por scroll: su panel Effects es solo hover/focus |
| 7 | **Puerta de calidad** | Contra staging con la **URL real**, subdirectorio incluido. Nunca contra un HTML local |
| 8 | **Producción** | `wp search-replace --dry-run --skip-columns=guid` primero. Nunca editar URLs a mano. Reimportar la configuración del tema: el search-replace no la trae |

Detalle completo de cada fase, con las fuentes: `traspaso-2026-08-26/SETUP-RECOMENDADO.md` de este
plugin. El respaldo con nivel de confianza por afirmación está en
`traspaso-2026-08-26/investigacion/resultados-completos.md`.

## Las seis trampas ya pagadas

Todas verificadas en proyectos reales. No hay que volver a descubrirlas.

1. **Validar el marcado no detecta fallos del entorno.** Un fichero de bloques puede dar 0 errores
   sobre 179 bloques y tener 11 de 13 imágenes en 404 en producción, porque el WordPress vive en un
   subdirectorio. Comprobado: el validador da 0 errores sobre el fichero que estaba roto. De ahí
   que la fase 7 exista y sea obligatoria.
2. **GenerateBlocks resuelve a HEX literal el color elegido en su panel.** Confirmado por su propio
   soporte, incluso si el valor viene de theme.json. Si el color se elige bloque a bloque,
   "cambiar un color" deja de ser una edición. Siempre por clase CSS utilitaria.
3. **`wp media import` sin las extensiones `gd` y `exif` sube la imagen pero no genera los tamaños
   responsive, y no da ningún error.** Degradación silenciosa de `srcset`. Usa el envoltorio
   `herramientas/wp-cli/wp.cmd`, que ya las carga.
4. **La animación sobre query loops se rompe al cambiar el número de elementos.** Re-consultar el
   DOM y llamar a `ScrollTrigger.refresh()`; nunca una NodeList cacheada.
5. **Un desfase de breakpoint entre CSS y JS cuesta caro.** GP usa 768 y GB 767 por defecto: una
   sola fuente de verdad, anotada en la fase 0.
6. **La configuración del tema y la tipografía no viajan con el repo git: viven en la base de
   datos.** Verificado contra un WordPress real: en las opciones `generate_settings`,
   `generate_spacing_settings` y `generate_package_font_library`. El repo lleva el tema hijo, los
   CPT, `acf-json/` y `/patterns/`, así que el destino recibe la maqueta bien y la tipografía y los
   espaciados de fábrica. Hay script:

   ```
   node herramientas/config-tema.js exportar --path="<sitio>"                      (fase 2)
   node herramientas/config-tema.js importar --path="<sitio>"                      (informa, no escribe)
   node herramientas/config-tema.js importar --path="<sitio>" --confirmar          (fase 8, escribe)
   ```

   Exporta solo esas tres opciones; si encuentra otras `generate_*` las lista para que el usuario
   decida (`--incluir=`). **No las añadas por tu cuenta.** Al importar, sin `--confirmar` no
   escribe nada, y con `--confirmar` deja copia previa en `config-tema/copias-previas/`.

## Descartado con fundamento — no volver a proponerlo

- **Figma como fuente del marcado.** El límite del MCP/REST se ata al plan del archivo del
  cliente, no al tuyo; la API de Variables exige Enterprise. Y habría que aplanar a literales
  igualmente. Como referencia visual, sí; como fuente, no.
- **GenerateCloud** ($99/año): solo renta gestionando muchos sitios con patrones compartidos.
- **Global Styles de GB Pro como sincronización entre entornos**: sin API REST ni WP-CLI oficial.
  Paso manual de checklist, no automático.
- **theme.json en GeneratePress** (tema clásico): efecto real en frontend ambiguo hasta en la doc
  oficial. No construir nada encima sin verificarlo contra el sitio real.
- **WPCode para encolar scripts**: vive en la base de datos y no viaja entre entornos. Tema hijo.

## Vigencias con fecha de caducidad

- **WCAG 2.1 AA** es lo exigible hoy por el RD 1112/2018. EN 301 549 v4.1.1 (WCAG 2.2 AA) se
  esperaba en el DOUE hacia octubre de 2026: **comprobar la fecha actual** antes de cerrar una
  auditoría de accesibilidad.
- Litigio **ACF vs Secure Custom Fields** abierto (medida cautelar, no sentencia). Revisar antes de
  fijar ACF como dependencia a largo plazo.
- **WPackagist** pasó a WP Engine en marzo de 2026; relevante solo si se usa Composer.

## Skills hermanas

- `generar-bloques-generateblocks` — al producir marcado de bloques (fase 4)
- `wp-cli-en-local` — para cualquier comando `wp` (fases 4, 7, 8)
- `puerta-calidad-wordpress` — antes de entregar o subir a producción (fase 7)
