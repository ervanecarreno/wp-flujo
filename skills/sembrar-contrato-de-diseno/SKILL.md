---
name: sembrar-contrato-de-diseno
description: "Arranca el contrato de diseño de un proyecto partiendo de un DESIGN.md de referencia (catálogo de getdesign.md / voltagent-awesome-design-md) en vez de inventar la escala a ojo. Úsala en la fase 1, cuando haya que fijar colores, tipografías, tamaños o espaciados de un proyecto nuevo, cuando el cliente no traiga manual de marca, o si se menciona DESIGN.md, sistema de diseño de referencia o «que se parezca a» una marca conocida."
version: 0.1.0
---

# Sembrar el contrato de diseño desde un DESIGN.md

La fase −1 del flujo pide congelar `design/<sistema>.tokens.json` antes de maquetar nada. El
problema real no es el formato: es que **rellenar catorce valores a ojo produce escalas malas**
—saltos tipográficos arbitrarios, seis grises que nadie distingue, un espaciado que no es una
progresión—. Un DESIGN.md de referencia resuelve eso en un paso.

## El catálogo

`github.com/voltagent/awesome-design-md` (MIT) tiene ~74 sistemas analizados y publicados en
formato DESIGN.md: paleta con nombres, escala tipográfica completa con `fontSize`/`fontWeight`/
`lineHeight`/`letterSpacing`, radios y espaciado. Se consultan en `getdesign.md` o por API:

```
gh api repos/voltagent/awesome-design-md/contents/design-md --jq '.[].name'
gh api repos/voltagent/awesome-design-md/contents/design-md/<marca>/DESIGN.md --jq '.content' | base64 -d
```

**No se vendorizan en el plugin a propósito**: son 74 ficheros que cambian solos y que solo hacen
falta una vez por proyecto. Se traen en el momento y se tiran.

## La regla que no se negocia

> **Del DESIGN.md se copian VALORES. Los NOMBRES son los del contrato y no cambian.**

Es la misma regla de siempre —*los nombres se congelan, los valores no*—, y aquí es donde más se
rompe: el DESIGN.md trae sus propios nombres (`ink`, `canvas`, `hairline`, `primary-press`) y es
tentador adoptarlos. No se hace. Si se adoptan, el marcado, el `wp-push-tokens.mjs` y el
`verificar.mjs` dejan de encontrar los tokens que esperan, y eso no lo avisa nadie.

### La tabla de conversión

| Lo que trae el DESIGN.md | Dónde va en el contrato |
|---|---|
| `canvas`, `background`, `bg-default` | `light.bg.page` |
| `canvas-soft`, `surface`, `muted-bg` | `light.bg.surface` |
| el fondo oscuro de la marca | `light.bg.inverse` |
| `ink`, `foreground`, `text-primary` | `light.text.primary` |
| `ink-secondary` | `light.text.secondary` |
| `ink-mute`, `text-muted` | `light.text.muted` |
| `primary`, el color de marca | `light.accent.default` **y** `light.text.accent` |
| `primary-deep` / `primary-press` | `light.accent.hover` |
| `hairline`, `border-subtle` | `light.border.subtle` |
| `display-xxl` / `display-xl` | `core.font-size.display-xl` |
| el siguiente escalón de display | `core.font-size.display-md` |
| `body` / `text-md` | `core.font-size.body` |
| `caption` / `label` / `text-xs` | `core.font-size.label` |
| la familia de titulares | `core.font-family.display` |
| la familia de texto | `core.font-family.text` |

Lo que sobre del DESIGN.md **se descarta**. El contrato tiene un token por papel, no por color: si
la referencia trae once grises, elige tres y tira ocho. Añadir tokens nuevos al contrato es una
decisión aparte, y se pregunta antes.

## Cuatro avisos

1. **Son interpretaciones, no las marcas.** El catálogo las renombra a propósito («Stripi» por
   Stripe) y reconstruye los valores observando la web, no desde el sistema real. Sirven como
   escala bien construida, no como identidad de nadie.
2. **No clones la identidad de una marca para un cliente.** Copiar la paleta y la tipografía de
   Stripe para un ayuntamiento es un problema legal y de criterio, no un atajo. Se toma la
   *estructura* —la progresión tipográfica, la relación entre fondo y texto— y los valores se
   mueven al color del cliente.
3. **Las tipografías de marca casi nunca se pueden usar.** Sohne, Geist o SF Pro son de pago o
   propietarias. Sustituye por la equivalente libre y ajusta: al cambiar de familia cambian el
   `lineHeight` y el `letterSpacing` óptimos, no se heredan.
4. **Contraste antes de congelar.** Para cliente público el par `light.text.primary` sobre
   `light.bg.page` y el `light.accent.default` sobre su fondo tienen que pasar **WCAG 2.1 AA**.
   Varias referencias del catálogo no lo pasan: son webs de producto, no sitios sujetos al
   RD 1112/2018. Comprueba antes, no en la fase 7.

## Después de rellenar

Regenera el CSS y sigue el flujo normal — declarar no es publicar:

```
node "<plugin>/herramientas/tokens-a-css.mjs" design/<sistema>.tokens.json -o design/<sistema>.tokens.css
```

Y recuerda rellenar `<PREFIJO>_FUENTES` con **solo los pesos que se usan de verdad**: una escala
copiada suele traer seis, y cada peso que no se usa es tiempo de carga regalado.
