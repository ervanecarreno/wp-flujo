---
name: flujo-wordpress-generateblocks
description: Flujo definitivo de 8 fases para proyectos WordPress+GenerateBlocks de Javier — usar en todo proyecto nuevo
metadata: 
  node_type: memory
  type: project
  originSessionId: ad32cce8-eb62-47ea-b405-8e27ce6dd01c
  modified: 2026-08-27T07:32:42.793Z
---

Flujo de trabajo estándar de Javier para webs con GeneratePress + GenerateBlocks Pro V2 + ACF,
fijado el 27/08/2026 tras una investigación de 7 temas (investigados y verificados
adversarialmente con fuentes) sobre las lecciones del [[proyecto-aridane-home]]. Documento
completo en `C:\TRABAJOS\CLOUDE CODE\traspaso-2026-08-26\SETUP-RECOMENDADO.md` — este resumen es
para tener el criterio a mano; consultar el documento para el detalle de cada fase.

**Prioridad explícita de Javier, en este orden: velocidad → menos pasos → fiabilidad del
prototipo.** Cualquier ajuste al flujo debe respetar ese orden.

## Las 8 fases (vs. la propuesta original de 7 de Javier)

0. **Bootstrap del WordPress vacío ANTES del diseño** (~10 min) — para conocer subdirectorio,
   breakpoints reales de GP/GB, carpeta de uploads, antes de que el diseño se cierre a ciegas
1. **Diseño directo en HTML** (Claude Design), no partir de Figma para extraer código — ver
   [[decision-saltar-figma]]. Fijar el sistema de color como variables CSS reales desde ya
2. **Esqueleto de portabilidad** dentro de ese WP vacío: git init en wp-content/, tema hijo, CPTs
   por código en plugin propio, `acf-json/` activo desde el día uno (gratis, no es PRO), carpeta
   `/patterns/` para secciones y home completa
3. Repo GitHub — con el alcance correcto (solo lo de la fase 2, nunca core/uploads/terceros)
4. Generación de marcado: imágenes subidas PRIMERO vía `wp media import --porcelain` para usar
   IDs reales; colores vía clases CSS utilitarias, nunca elegidos en el panel de color de GB
   (GB siempre resuelve a HEX literal, ver [[leccion-colores-generateblocks]]); pasa el validador
   Node ampliado
5. Plantillas intermedias, noticias, CPT — igual que la propuesta original de Javier
6. Animación con GSAP — CONFIRMADO que va después de la fase 5, el orden que Javier ya proponía
   era correcto. Ver [[leccion-animacion-contenido-dinamico]]
7. **Puerta de calidad automatizada** (NUEVA) contra el sitio en staging con la URL real: 
   linkinator (enlaces/imágenes rotas) → peso/formato de imagen → pa11y-ci+axe (WCAG 2.1 AA,
   obligatorio por RD 1112/2018) → Lighthouse CI (CLS/LCP) → wp-cli doctor
8. Producción vía `wp search-replace --dry-run --skip-columns=guid`, nunca editando URLs a mano
   (WordPress las guarda absolutas por diseño intencional)

## Piezas descartadas conscientemente

- GenerateCloud ($99/año): solo rentable gestionando muchos sitios de cliente con patrones
  compartidos
- Global Styles de GB Pro como mecanismo de sync entre entornos: sin API REST/WP-CLI oficial,
  tratarlo como paso manual de checklist, no como algo automático
- theme.json en GeneratePress (tema clásico): efecto real en frontend ambiguo incluso en la doc
  oficial — no construir nada encima sin verificarlo contra el sitio real primero

## Vigencias a revisar con el tiempo

- EN 301 549 v4.1.1 (WCAG 2.2 AA) se espera en el Diario Oficial de la UE hacia octubre de 2026 —
  hasta entonces sigue vigente WCAG 2.1 AA
- WPackagist fue adquirida por WP Engine en marzo de 2026 (relevante si se usa Composer, dado el
  litigio Automattic/WP Engine en curso)
- El litigio ACF vs Secure Custom Fields sigue abierto (medida cautelar, no sentencia firme)
