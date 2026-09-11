---
name: directrices-interfaz-web
description: "Más de 100 reglas MUST/SHOULD/NEVER de interfaz web: teclado, foco, formularios, animación, maquetación, accesibilidad, rendimiento y tema oscuro. Úsala al revisar o auditar una interfaz ya montada, cuando se hable de accesibilidad, WCAG, foco, teclado, lectores de pantalla, CLS, contraste o estados vacíos, y antes de dar por buena una página de cliente. Complementa a la fase 7 del flujo: pa11y y Lighthouse cazan lo automatizable, esto cubre lo que ninguna herramienta ve."
version: 0.1.0
license: MIT
---

# Directrices de interfaz web

Reglas oficiales de **Vercel Labs** (`github.com/vercel-labs/web-interface-guidelines`, MIT),
vendorizadas para que viajen con el plugin. El texto de abajo es suyo, íntegro y sin tocar.

## Cómo se usa en este flujo

Estas reglas **no sustituyen a la fase 7**, la complementan. La diferencia importa:

| | Qué caza | Cuándo |
|---|---|---|
| `puerta-calidad-wordpress` (fase 7) | Lo **automatizable**: enlaces rotos, peso de imagen, violaciones de axe, CLS/LCP | Contra la URL real, antes de producción |
| Esta skill | Lo que **ninguna herramienta ve**: si el foco se pierde al cerrar un modal, si el destino táctil es de 18 px, si el formulario bloquea el pegado | Al revisar el marcado y al repasar la página a mano |

Un sitio puede sacar cero errores en axe y seguir siendo inutilizable con teclado. Esto es la otra
mitad.

## Peso legal, no opinión

Para los proyectos de ayuntamiento **la accesibilidad es obligación legal** (RD 1112/2018,
WCAG 2.1 AA vía EN 301 549). Buena parte de las reglas marcadas `MUST` aquí son precisamente lo
que un auditor mira y lo que axe no puede comprobar solo: nombres accesibles, orden de foco,
alternativas de teclado a gestos, jerarquía de encabezados.

## Lo que NO aplica a este flujo

Hay tres bloques escritos para aplicaciones React/Next que en una web de WordPress no tocan.
No los apliques por inercia ni los cites como deuda técnica:

- **Hydration** entero — no hay hidratación en una página servida por PHP.
- De **Performance**: «Track and minimize re-renders (React DevTools/React Scan)» y lo de
  inputs controlados/no controlados.
- De **Content Handling**: `truncate`, `line-clamp-*`, `min-w-0` son clases de Tailwind. La regla
  de fondo sí vale (el texto largo no debe romper la caja); escríbela como CSS propio en el
  contrato de diseño, no metas Tailwind.

Y dos que chocan con reglas de este flujo, donde **manda este flujo**:

- «Prefer CSS > Web Animations API > JS libraries» — aquí la fase 6 usa GSAP a propósito, por la
  lección de animación sobre contenido dinámico. La regla que sí vale y se respeta es la de
  animar solo `transform` y `opacity`.
- «Meet contrast—prefer APCA over WCAG 2» — para cliente público **manda WCAG 2.1 AA**, que es lo
  que exige la ley y lo que mide pa11y. APCA como criterio adicional, nunca como sustituto.

---

Concise rules for building accessible, fast, delightful UIs. Use MUST/SHOULD/NEVER to guide decisions.

## Interactions

### Keyboard

- MUST: Full keyboard support per [WAI-ARIA APG](https://www.w3.org/WAI/ARIA/apg/patterns/)
- MUST: Visible, unobscured focus rings (`:focus-visible`; group with `:focus-within`); sticky/fixed elements never cover focus
- MUST: Manage focus (trap, move, return) per APG patterns
- NEVER: `outline: none` without visible focus replacement

### Targets & Input

- MUST: Hit target ≥24px (mobile ≥44px); if visual <24px, expand hit area
- MUST: Mobile `<input>` font-size ≥16px to prevent iOS zoom
- NEVER: Disable browser zoom (`user-scalable=no`, `maximum-scale=1`)
- MUST: `touch-action: manipulation` to prevent double-tap zoom
- SHOULD: Set `-webkit-tap-highlight-color` to match design

### Forms

- MUST: Hydration-safe inputs (no lost focus/value)
- NEVER: Block paste in `<input>`/`<textarea>`
- MUST: Loading buttons show spinner and keep original label
- MUST: Enter submits focused input; in `<textarea>`, ⌘/Ctrl+Enter submits
- MUST: Keep submit enabled until request starts; then disable with spinner
- MUST: Accept free text, validate after—don't block typing
- MUST: Allow incomplete form submission to surface validation
- MUST: Errors inline next to fields; on submit, focus first error
- MUST: `autocomplete` + meaningful `name`; correct `type` and `inputmode`
- SHOULD: Disable spellcheck for emails/codes/usernames
- SHOULD: Placeholders end with `…` and show example pattern
- MUST: Warn on unsaved changes before navigation
- MUST: Compatible with password managers & 2FA; allow pasting codes
- MUST: Trim values to handle text expansion trailing spaces
- MUST: No dead zones on checkboxes/radios; label+control share one hit target

### State & Navigation

- MUST: URL reflects state (deep-link filters/tabs/pagination/expanded panels)
- MUST: Back/Forward restores scroll position
- MUST: Links use `<a>`/`<Link>` for navigation (support Cmd/Ctrl/middle-click)
- NEVER: Use `<div onClick>` for navigation

### Feedback

- SHOULD: Optimistic UI; reconcile on response; on failure rollback or offer Undo
- MUST: Confirm destructive actions or provide Undo window
- MUST: Use polite `aria-live` for toasts/inline validation
- SHOULD: Ellipsis (`…`) for options opening follow-ups ("Rename…") and loading states ("Loading…")

### Touch & Drag

- MUST: Generous targets, clear affordances; avoid finicky interactions
- MUST: Delay first tooltip; subsequent peers instant
- MUST: `overscroll-behavior: contain` in modals/drawers
- MUST: During drag, disable text selection and set `inert` on dragged elements
- MUST: Drag/swipe/pinch/path gestures have a tap/click and keyboard alternative unless essential
- MUST: If it looks clickable, it must be clickable

### Autofocus

- SHOULD: Autofocus on desktop with single primary input; rarely on mobile

## Animation

- MUST: Honor `prefers-reduced-motion` (provide reduced variant or disable)
- SHOULD: Prefer CSS > Web Animations API > JS libraries
- MUST: Animate compositor-friendly props (`transform`, `opacity`) only
- NEVER: Animate layout props (`top`, `left`, `width`, `height`)
- NEVER: `transition: all`—list properties explicitly
- SHOULD: Animate only to clarify cause/effect or add deliberate delight
- SHOULD: Choose easing to match the change (size/distance/trigger)
- MUST: Animations interruptible and input-driven; autoplay only for muted, non-essential loops
- MUST: Autoplay motion >5s alongside other content has pause, stop, or hide controls
- MUST: Correct `transform-origin` (motion starts where it "physically" should)
- MUST: SVG transforms on `<g>` wrapper with `transform-box: fill-box`

## Layout

- SHOULD: Optical alignment; adjust ±1px when perception beats geometry
- MUST: Deliberate alignment to grid/baseline/edges—no accidental placement
- SHOULD: Balance icon/text lockups (weight/size/spacing/color)
- MUST: Verify mobile, laptop, ultra-wide (simulate ultra-wide at 50% zoom)
- MUST: Respect safe areas (`env(safe-area-inset-*)`)
- MUST: Avoid unwanted scrollbars; fix overflows
- SHOULD: Flex/grid over JS measurement for layout

## Content & Accessibility

- SHOULD: Inline help first; tooltips last resort
- MUST: Skeletons mirror final content to avoid layout shift
- MUST: `<title>` matches current context
- MUST: No dead ends; always offer next step/recovery
- MUST: Design empty/sparse/dense/error states
- SHOULD: Curly quotes (“ ”); avoid widows/orphans (`text-wrap: balance`)
- MUST: `font-variant-numeric: tabular-nums` for number comparisons
- MUST: Redundant status cues (not color-only); icons have text labels
- MUST: Accessible names exist even when visuals omit labels
- MUST: Use `…` character (not `...`)
- MUST: `scroll-margin-top` on headings; "Skip to content" link; hierarchical `<h1>`–`<h6>`
- MUST: Resilient to user-generated content (short/avg/very long)
- MUST: Locale-aware dates/times/numbers (`Intl.DateTimeFormat`, `Intl.NumberFormat`)
- SHOULD: `translate="no"` on brand names, code tokens, & identifiers to prevent garbled auto-translation
- MUST: Accurate `aria-label`; decorative elements `aria-hidden`
- MUST: Icon-only buttons have descriptive `aria-label`
- MUST: Prefer native semantics (`button`, `a`, `label`, `table`) before ARIA
- MUST: Media has captions/transcripts/descriptions as applicable; controls are keyboard-operable; decorative media hidden from assistive tech
- MUST: Non-breaking spaces: `10&nbsp;MB`, `⌘&nbsp;K`, brand names

## Content Handling

- MUST: Text containers handle long content (`truncate`, `line-clamp-*`, `break-words`)
- MUST: Flex children need `min-w-0` to allow truncation
- MUST: Handle empty states—no broken UI for empty strings/arrays

## Performance

- SHOULD: Test iOS Low Power Mode and macOS Safari
- MUST: Measure reliably (disable extensions that skew runtime)
- MUST: Track and minimize re-renders (React DevTools/React Scan)
- MUST: Profile with CPU/network throttling
- MUST: Batch layout reads/writes; avoid reflows/repaints
- MUST: Mutations (`POST`/`PATCH`/`DELETE`) target <500ms
- SHOULD: Prefer uncontrolled inputs; controlled inputs cheap per keystroke
- MUST: Virtualize large lists (>50 items)
- MUST: Preload above-fold images; lazy-load the rest
- MUST: Prevent CLS (explicit image dimensions)
- SHOULD: `<link rel="preconnect">` for CDN domains
- SHOULD: Critical fonts: `<link rel="preload" as="font">` with `font-display: swap`
- SHOULD: `<video autoplay muted loop playsinline>` over animated GIF; provide still/reduced-motion alternative
- SHOULD: Short non-essential loops include a Safari H.264 MP4 `<picture>` source, `prefers-reduced-motion` media condition, and still fallback

## Dark Mode & Theming

- MUST: `color-scheme: dark` on `<html>` for dark themes
- SHOULD: `<meta name="theme-color">` matches page background
- MUST: Native `<select>`: explicit `background-color` and `color` (Windows fix)

## Hydration

- MUST: Inputs with `value` need `onChange` (or use `defaultValue`)
- SHOULD: Guard date/time rendering against hydration mismatch

## Design

- SHOULD: Layered shadows (ambient + direct)
- SHOULD: Crisp edges via semi-transparent borders + shadows
- SHOULD: Nested radii: child ≤ parent; concentric
- SHOULD: Hue consistency: tint borders/shadows/text toward bg hue
- MUST: Accessible charts (color-blind-friendly palettes)
- MUST: Meet contrast—prefer [APCA](https://apcacontrast.com/) over WCAG 2
- MUST: Increase contrast on `:hover`/`:active`/`:focus`
- SHOULD: Match browser UI to bg
- SHOULD: Avoid dark color gradient banding (use background images when needed)

---

## Licencia

MIT © 2025 Vercel Labs. Texto completo en `skills/LICENCIA-DIRECTRICES-VERCEL.txt`.
