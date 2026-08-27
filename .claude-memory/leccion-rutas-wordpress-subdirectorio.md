---
name: leccion-rutas-wordpress-subdirectorio
description: Validar el marcado de bloques no detecta fallos del entorno; el caso de las rutas de imagen en subdirectorio
metadata: 
  node_type: memory
  type: feedback
  originSessionId: ad32cce8-eb62-47ea-b405-8e27ce6dd01c
  modified: 2026-08-26T15:05:18.977Z
---

En el proyecto Aridane (26/08/2026) el marcado de GenerateBlocks pasó un checklist de 10 reglas
con **0 errores sobre 179 bloques** y aun así **11 de 13 imágenes daban 404 en producción**: el
WordPress vive en un subdirectorio (`aridane.org/city/`) y las rutas de imagen eran relativas sin
ese prefijo. Los *enlaces* sí lo llevaban; las *imágenes* no.

**Why:** validar el MARCADO y validar el ENTORNO son dos cosas distintas. Un archivo de bloques
puede ser perfectamente canónico y aun así estar roto en el sitio de destino. Los fallos que
más duelen no son de sintaxis: son de contexto (URL base, subdirectorio, dominio, carpeta de
subida `YYYY/MM`, IDs de adjuntos que no existen en el destino).

**How to apply:** en cualquier entrega de WordPress, después de validar el marcado, **comprobar
cada URL con una petición real al servidor de destino** antes de dar nada por bueno. Basta un
bucle con `curl -o /dev/null -w "%{http_code}"`. Fue lo que convirtió una suposición en un
diagnóstico. Aplicar lo mismo a: rutas de imagen, enlaces internos, y peso de los archivos.

Corolario que Javier valoró: lo más útil que se produjo en ese proyecto no fue el diseño sino un
**validador en Node sin dependencias** que reconstruye el `css` de cada bloque desde su atributo
`styles` y los compara carácter a carácter. Escribir la herramienta de verificación es parte del
trabajo, no un extra.

Ver [[proyecto-aridane-home]] y [[setup-wordpress-pendiente]].
