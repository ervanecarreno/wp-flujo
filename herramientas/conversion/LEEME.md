# Conversión Figma → GenerateBlocks

Cierra la laguna que este flujo tenía reconocida: *"El plugin no cubre la traducción
Figma → GenerateBlocks. Empieza cuando el marcado ya existe."*

**Promovido el 2/09/2026 desde `C:\TRABAJOS\figma-gb-pipeline`.** Ese repo es un **proyecto**,
con su propio remoto en GitHub y el handoff del design system de Metrópolis dentro. Estas piezas
son **herramienta**, no proyecto, así que su sitio es aquí: un proyecto de cliente invoca el
plugin, nunca otro proyecto.

Node ≥ 18, **sin dependencias** salvo donde se indica.

---

## Qué hay

### `lib/` — el núcleo

| Fichero | Qué hace |
|---|---|
| `canonical.mjs` | Serialización canónica de atributos de bloque: los escapes unicode de `serialize_block_attributes()`, CSS alfabetizado y minificado, orden de claves, utilidades (`rgba`, `pxToRem`) |
| `emit.mjs` | Emisores canónicos de GB V2: `element`, `text`, `media`, `shape`, `linkButton`. `CLASS_MODE` configurable |
| `convert-frame.mjs` | **La pieza que faltaba**: convierte un frame de Figma en bloques |
| `figma-client.mjs` | Cliente REST de Figma: nodos, variables locales, rellenos de imagen, PNG del frame |
| `tokens.mjs` · `infer-tokens.mjs` | Resolución de variables de Figma a tokens, e inferencia cuando no hay variables |
| `gbp-global-styles.mjs` | Global Styles de GB Pro (CPT `gblocks_styles`) |
| `validate.mjs` | Reglas del linter estático |
| `blockdiff.mjs` | Diferencia entre dos marcados de bloques, para el round-trip |
| `fidelity-check.mjs` | Comprobación de fidelidad de color y tipografía |
| `analyze-sections.mjs` | Trocea una página en secciones |

### `scripts/` — la línea de comandos

| Script | Fase | Qué hace |
|---|---|---|
| `extract.mjs` | 1 | Extrae un frame de Figma |
| `map-tokens.mjs` | 2 | Construye el mapa de tokens |
| `wp-push-tokens.mjs` | 2 | Empuja los tokens a GeneratePress y GB Pro |
| `wp-discover-abilities.mjs` | 2 | Descubre qué admite el WordPress de destino |
| `assemble.mjs` | 4 | Patrón validado + manifest de slots + contenido → página. `--reid` remapea `uniqueId` |
| `validate-blocks.mjs` | 4 | Linter estático (ver abajo) |
| `wp-roundtrip.mjs` | 7 | Guarda en WP, reexporta y compara: caza lo que el editor reescribe |
| `qa-fidelity-check.mjs` | 7 | Fidelidad de color y tipografía contra el diseño |
| `qa-editor-check.mjs` | 7 | Abre el bloque en el editor y comprueba que no se rompe |
| `qa-visual-diff.mjs` | 7 | Diff visual. **Requiere `playwright`, `pixelmatch` y `pngjs`** |
| `qa-run.mjs` | 7 | Lanza la batería de QA |

Uso, desde la raíz del plugin:

```bash
node herramientas/conversion/scripts/validate-blocks.mjs pagina.html
node herramientas/conversion/scripts/assemble.mjs patron.html manifest.json contenido.json --reid
```

---

## Los dos validadores: por qué siguen siendo dos

Este plugin tiene ahora **dos** linters de marcado GB, y **no se ha elegido uno a ciegas**.
Enfrentados al mismo fichero real (`patterns/hero-home/pattern.html`) el 2/09/2026:

| | Errores | Avisos |
|---|---|---|
| `herramientas/audit-gb.js` | **0** | 23 |
| `herramientas/conversion/scripts/validate-blocks.mjs` | **0** | 1 |

Coinciden en lo que importa —0 errores— y difieren en la sensibilidad. Ninguno domina al otro:

- **`audit-gb.js` caza cosas que el otro no**: por ejemplo `shape` sin atributo `html`.
- **`audit-gb.js` tiene una clase de falso positivo**: 5 de sus 23 avisos son
  `dynamic-tag · posible etiqueta con una sola llave`, disparados por **declaraciones CSS**
  (`{display:inline-flex;margin-bottom:3rem}`), no por etiquetas dinámicas.
- `validate-blocks.mjs` está calibrado contra 18 patrones exportados; `audit-gb.js`, contra
  **732 bloques** de 25 exports reales de GenerateBlocks. Ese corpus es el que manda.

**Reparto mientras tanto:**

- `validate-blocks.mjs` es el **pre-check del pipeline**: se ejecuta dentro de la conversión,
  antes de emitir.
- `audit-gb.js` es la **puerta**, la del método §8. Nada entra en WordPress sin pasarla.

**Tarea abierta:** unificarlos. El método no es opinar, es correr los dos contra el corpus de
732 bloques, quedarse con la unión de reglas verdaderas y tirar la heurística de `dynamic-tag`
que confunde CSS con etiquetas. Hasta que eso se haga, se ejecutan los dos.

---

## Lo que NO se ha traído

De `figma-gb-pipeline` queda fuera todo lo que es proyecto y no herramienta:

- `METROPOLIS Design System-handoff/` — material de un proyecto
- `patterns/`, `pages/`, `tokens/`, `ai-requests/` — datos de ese proyecto
- `app/`, `bridge-plugin/`, `wp-cli-bridge/` — su interfaz y sus puentes propios
- `config.json` — su configuración

Cada proyecto de cliente crea los suyos en su propia carpeta.
