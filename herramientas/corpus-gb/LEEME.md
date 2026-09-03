# Corpus de calibración — exports reales de GenerateBlocks

**25 patrones exportados de GenerateBlocks Pro V2, 742 bloques.** No los ha escrito este flujo:
los generó GenerateBlocks y los exportó WordPress.

De ahí su valor, y es un valor que ninguna otra cosa da: **si una regla salta sobre esto, la regla
está mal.** GB produjo este marcado y GB lo acepta. No hay que discutir si la regla «tiene
sentido»: se mide.

Es el banco de `../calibrar-validadores.mjs`. Toda regla nueva de `audit-gb.js` o de
`conversion/scripts/validate-blocks.mjs` pasa por aquí antes de entrar.

## Procedencia

Exportados como `wp_block` en JSON desde un WordPress con GB Pro V2 y guardados aquí solo con su
campo `content`. Origen: `C:\TRABAJOS\figma-gb-pipeline`, que era un proyecto; el corpus es
material de **herramienta** —calibra los validadores del plugin—, así que su sitio es este.

## Qué NO es

No es una batería de casos correctos que haya que reproducir, ni un conjunto de patrones para
copiar en proyectos. Es una **muestra de marcado válido en la naturaleza**, con toda su variedad
y sus rarezas, que es justo lo que hace falta para saber si una regla distingue algo.
