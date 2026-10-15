---
title: Template authoring — full sites with GenerateBlocks
description: Building entire sites - headers, footers, archive and single templates - with GeneratePress + GP Premium Elements (vendor-recommended), GB Pro Site Header/Navigation, or FSE block themes. Display rules, hooks, inherit-query archives.
---

# Template Authoring — Full Sites

How to go from "sections in a page" to "the whole site": headers, footers,
archive loops, single-post templates, 404s, hooks.

## 1. Pick the architecture first

| Architecture | When | Templates live in |
|---|---|---|
| **GeneratePress + GP Premium Elements** (vendor-recommended; gauravtiwari.org runs this) | GP theme sites. The default choice | Appearance → Elements (Block Elements) |
| **GB Pro Site Header / Navigation blocks** | Header built in blocks instead of theme; combines with either architecture | Page content or an Element |
| **FSE block theme + GB** | The site already uses a block theme (Twenty Twenty-Five etc.) | Site Editor templates / template parts |

Context (July 2026, unchanged): GeneratePress explicitly is **not** adopting core block
themes — their position is that GB + GP Elements exceeds FSE in CSS coverage,
dynamic content, and conditional logic, with their own next-gen full-site
system in development. GB works fine inside FSE templates (one of the few
block plugins that does), but GP + Elements is the vendor path.
(Source: generatepress.com "GeneratePress and the future of Full Site Editing".)

## 2. GP Premium Block Elements (the workhorse)

Appearance → Elements → Add New → **Block**. Ten element types:

| Element type | Purpose |
|---|---|
| **Hook** | Inject block content at any GP hook (e.g. `generate_after_header`, `generate_before_footer`) with priority control. The universal tool |
| **Site Header** | Replace the theme header |
| **Page Hero** | Hero/title area on targeted pages — classic use: dynamic `{{post_title}}` + `{{featured_image}}` hero on all posts |
| **Content Template** | Replace the content template for single posts/pages |
| **Loop Template** | Replace archive loops — pairs with the GB Query block |
| **Post Meta Template / Post Navigation / Archive Navigation / Sidebar / Site Footer** | The corresponding theme areas |

Everything inside an Element is normal block markup — author it with this
skill's rules, paste into the Element's editor. Two GB-specific advantages:
GB compiles its CSS correctly inside Elements (most third-party block plugins
don't), and dynamic tags resolve against the displayed page's context.

### Display Rules (on every Element)

- **Location** (required): entire site, post types, taxonomy archives,
  specific posts/pages, author archives, 404, search...
- **Exclude**: subtract from location.
- **Users**: roles / logged-in state.

This is the template-level conditional system — prefer it over Pro block
conditions when the unit is a whole section/template. Programmatic override:
`generate_element_display` filter.

### Archive template recipe (Loop Template element)

1. Element type: Block → Loop Template.
2. Inside: a GB `query` block with **`"inheritQuery":true,"query":{}`** —
   the loop takes the real archive query (category, tag, search, paged) from
   whatever archive it renders on.
3. `looper` = grid wrapper; `loop-item` = card template with dynamic tags
   (`{{post_title link:post}}`, `{{featured_image size:medium_large}}`,
   `{{post_excerpt length:25}}`, `{{post_date}}`, `{{term_list tax:category}}`).
4. Add `query-no-results` (search empty state) and `query-page-numbers`.
5. Display Rules: Location = the archives it should style
   (e.g. All Archives, or Post Category Archives).

### Single-post template recipe (Content Template or Page Hero + Hook)

- Page Hero element: `{{post_title}}` h1, meta row
  (`{{post_date}}`, `{{author_meta key:display_name}}`,
  `{{term_list tax:category|sep:, }}`), optional `{{featured_image}}` background.
- Hook element at `generate_after_content`: related posts — Pro query with
  `"post__not_in":["current"]` + tax_query `"terms":["current"]`
  (see `query-block.md` §3), or prev/next navigation with Pro
  `source:next-post` tags (see `dynamic-tags.md` §6).
- Display Rules: Location = Posts → All Posts.

### Site footer recipe

Site Footer element → GB section with columns; Pro tags
`{{site_title}}`, `{{current_year}}`, `{{site_logo_url}}` make it dynamic:
`© {{current_year}} {{site_title}}`.

## 3. GB Pro Site Header + Navigation

For block-built headers independent of the theme header (`pro-interactive.md`
§4 has the hierarchy):

```
site-header → [logo media/element] + navigation → menu-toggle + menu-container → classic-menu
```

- `classic-menu` renders a WP menu (Appearance → Menus) — content updates
  without touching markup.
- Sticky behavior, off-canvas mobile menu, and mega menu panels (overlays
  anchored to menu items) are configured in the editor UI.
- Place it in a GP Site Header element (replacing the theme header) or an FSE
  header template part.

## 4. FSE block themes + GB

If the site runs a block theme:

- GB blocks work in Site Editor templates and template parts; the markup
  rules in this skill apply unchanged.
- Archives: same `inheritQuery:true` pattern inside the archive template.
- theme.json provides palette/typography presets — GB styles can reference
  them as CSS variables (`var(--wp--preset--color--primary)` — escape `--`
  in JSON). See `global-styles.md` for the bridge.
- Know the limitation: theme templates are files/CPT content the user edits
  in the Site Editor — deliver template markup as `.html` files they paste
  into the template, exactly like page sections.

## 5. Hooks crash course (GP)

Common GP hooks for Hook elements: `generate_before_header`,
`generate_after_header` (announcement bars), `generate_before_content`,
`generate_after_content` (related posts, CTAs), `generate_before_footer`,
`generate_after_footer`, `wp_footer`. Full map: GP "Hooks Visual Guide".
A Hook element + Display Rules + GB section = inject anything anywhere
without touching templates.

## 6. Patterns vs Elements vs Pages — where content lives

| Unit | Lives in | Use for |
|---|---|---|
| Page sections | Page/post content | One-off page designs |
| Reusable sections | Patterns (`wp_block` CPT / pattern library) | Repeating sections users insert |
| Site furniture (header/footer/heroes) | GP Elements (or FSE template parts) | Rendered automatically by location |
| Archive/single layouts | Loop Template / Content Template elements (or FSE templates) | Post-type-wide layouts |
| Modals/popups/mega menus | GB Pro Overlays (`gblocks_overlay` CPT) | Triggered surfaces |
| Forms | GB Pro Forms (`gblocks_form` CPT) + form-render | Reusable forms |

## 7. Hand-authoring workflow for templates

1. Author the template markup as an `.html` file (this skill's rules).
2. Tell the user where to paste it: which Element type + which Display Rules,
   or which FSE template.
3. Anything configured outside block markup (display rules, menu assignment,
   overlay triggers, form actions, sticky settings) — list it as explicit
   manual steps in chat. Block markup can't carry those settings.
4. For archive loops, default to `inheritQuery:true` — only hardcode a query
   when the section genuinely is a fixed list, independent of page context.
