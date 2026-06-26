# MycoJMO site redesign — design spec

**Date:** 2026-06-25
**Status:** Approved (direction locked via lavish review; "ship as shown")
**Mockup:** `.lavish/redesign.html` (high-fidelity preview rendered in the proposed CSS)

## Goal

Upgrade the site from the stock Bear Blog theme to a **bold, modern, distinctly-branded** look that gives Justin's photo a home and makes his proof (stats, pillars) scannable. Same content, much more presence. Whole-site scope: homepage, blog index, blog post layout, header, footer.

## Current state

- Stock Bear Blog theme: single centered text column, Atkinson font, generic `#2337ff` blue accent, no imagery, no hierarchy.
- Homepage (`src/pages/index.astro`) is hand-authored HTML opening on a dense wall of résumé text.
- Brand identity already exists but is unused: the `mycojmo` logo (`public/mycojmo.jpg`) — a watercolor mycorrhizal network with a deep-teal wordmark on cream paper — plus fungal imagery in `public/`.
- Styling is a single global stylesheet `src/styles/global.css`. No component-scoped CSS, no framework.

## Target — the design direction (locked decisions)

1. **Adopt the brand palette** sampled from the logo. Retire Bear-Blog blue.
2. **Bolder / more distinctive** treatment (chosen over "polished & safe").
3. **Space Grotesk** geometric sans for display/headings, at heavy weights + large scale. Body stays **Atkinson**.
4. Hero on a **tinted panel** with a faint mycelium-vein background motif, oversized headline, and an ochre highlight swash under the last name.
5. Photo in an **organic blob crop** with a thin ochre outline echoing the shape.
6. **Stat band = 3 stats** (30+ engineers · 40% AWS cut · $10B+ secured). SOC 2 stat removed.
7. No decorative "pea"/leaf accent dots.

### Design tokens (replace the `:root` block in `global.css`)

| Token | Value | Role |
|---|---|---|
| `--paper` | `#F4F1E8` | warm cream background |
| `--paper-2` | `#FBF9F3` | card / raised surface |
| `--paper-edge` | `#E7E2D2` | hairline borders |
| `--teal` | `#15534D` | primary (wordmark color), links, buttons |
| `--teal-deep` | `#0E3A36` | heading ink, stat band + footer bg |
| `--teal-soft` | `#2E7B72` | lighter accent / link hover |
| `--gold` | `#C8922E` | ochre accent (CTA highlight, swash, outline) |
| `--gold-soft` | `#E4C77A` | softer ochre (highlight fill) |
| `--moss` | `#7C8A4E` | olive (card top-rule gradient, vein motif) |
| `--clay` | `#9A5B3B` | earthy brown (em text) |
| `--ink` | `#26261F` | warm near-black body text |
| `--ink-soft` | `#5A5E52` | muted secondary text |

- Keep existing `--gray*`/`--black` RGB triples that other components reference, OR migrate references. Audit `src/components/*` and `src/layouts/BlogPost.astro` for `var(--accent)`, `rgb(var(--black))`, etc. and remap to the new tokens. **Do not** leave `--accent: #2337ff` in use anywhere.
- Typography vars: `--display: "Space Grotesk", system-ui, sans-serif;` `--body: "Atkinson", system-ui, sans-serif;`

### Fonts — self-host Space Grotesk (do NOT use the Google CDN in production)

The site runs on Cloudflare Workers and self-hosts Atkinson from `public/fonts/`. Match that:
- Add `public/fonts/space-grotesk-{500,600,700}.woff2` (download from the Space Grotesk release / google-webfonts-helper).
- Add matching `@font-face` blocks in `global.css` with `font-display: swap`, mirroring the Atkinson declarations.
- The mockup's `<link rel="stylesheet" ...fonts.googleapis...>` is mockup-only and must not appear in the real `BaseHead.astro`.

## Per-surface changes

### Homepage — `src/pages/index.astro`
Restructure the hand-authored copy into sections (all content preserved, re-grouped):
- **Hero band** (`.hero-band` → `.hero` grid): eyebrow pill, oversized `h1` name with ochre swash on "Moore", role line, lede, two CTAs (`Let's talk →` primary / `Download CV` ghost), credential links (LinkedIn / GitHub / CKA). Right column: blob-cropped photo + "Stanford, CA" badge.
  - **Constraint:** the `h1` name must stay on a **single line** at all widths — `white-space:nowrap` + a `clamp()` size that scales down (mockup uses `clamp(25px,4.7vw,52px)`) so it never wraps or overflows.
  - **Constraint:** the hero mycelium-vein motif must be **masked off the text column** (only show on the photo side, faded) so lines never run through the copy.
- **Stat band** (`.stats`, deep-teal): 3 stats.
- **What I've led**: 3 pillar cards (Team leadership & crisis · Infra & cost · Systems at scale) — bullets from current copy.
- **What I bring**: feature rows with a `.tag`, heading, paragraph, and a `.quote` war-story callout. Map the current "Pattern recognition / Thriving / Building teams / Full-stack" prose into 2–4 rows.
- **How I work** + **guarantee callout** (teal, with 100% first-week-value seal).
- **Let's talk**: two contact cards (work@ / play@).
- **Why the name**: mycorrhizae image + "better, together" story.
- Keep the existing "About the Parent Stuff" (pitd.io) and the consulting-vs-fulltime note — fold into footer area or a small closing strip. Footer links include `pitd.io ↗`.

### Blog index — `src/pages/blog/index.astro`
Replace the inline `<style>` with a branded **card grid**: `.post` cards (paper surface, hover lift), `.thumb` hero image, ochre uppercase date, Space Grotesk title. Keep the `getCollection('blog')` + sort logic and `<Image>` usage.

### Blog post — `src/layouts/BlogPost.astro`
Re-skin to the palette: hero image, centered title block in Space Grotesk, ochre date, teal links, paper background. Keep structure (`heroImage`, `FormattedDate`, `<slot/>`, prose width).

### Header — `src/components/Header.astro`
Sticky translucent cream bar with blurred backdrop, logo mark (`mycojmo.jpg`, round) + wordmark, nav links with active pill (teal tint), social icons. Keep `HeaderLink` active-state mechanism.

### Footer — `src/components/Footer.astro`
Deep-teal footer, wordmark, copyright, centered link row (Blog / About / LinkedIn / GitHub / pitd.io). Keep dynamic year.

### Global — `src/styles/global.css`
Token overhaul + new component classes (hero, stats, cards, feature, callout, contact, story, blog cards). Keep base element styles (Atkinson `@font-face`, base typography, `.sr-only`, responsive breakpoints) and add Space Grotesk to headings via `--display`.

## Photo handling

- Source dropped at `public/84A24338-1873-4374-B3CE-8B45260DB2E3.jpeg` (4.7 MB, 3840×5760).
- Optimized variants already generated: `public/justin.jpg` (327 KB, 1040×1560) and `public/justin.webp` (101 KB).
- Render with a `<picture>` (WebP + JPEG fallback) or Astro `<Image>`; blob crop via CSS `border-radius` + `object-fit: cover; object-position: 50% 20%`.
- **Delete the 4.7 MB original** `public/84A24338-...jpeg` before deploy so it doesn't ship (note: `public/.assetsignore` may already exclude some assets — verify).

## Implementation approach

Pure presentation change — **no content removed**, no routing/content-schema changes. Order:
1. `global.css` tokens + fonts + component classes (foundation).
2. Self-host Space Grotesk woff2 + `@font-face`.
3. Header + Footer (shared chrome).
4. Homepage restructure.
5. Blog index + BlogPost re-skin.
6. Swap photo in, delete original.

## Risks & mitigations

- **Token migration breakage:** other components reference `--accent`/`--gray`. Mitigation: grep all `src/` for old vars; remap before deleting them. `npm run check` (tsc) will catch type issues but not visual ones — preview with `npm run preview` (real Worker).
- **Font loading:** must self-host; CDN won't fit the Workers/offline model. FOUT mitigated by `font-display: swap`.
- **Mobile:** mockup has 860px breakpoint collapsing grids to one column; verify hero, stat band, cards, contact, story all stack cleanly. Keep the existing 720px base-font breakpoint.
- **Blog hero images:** existing posts use `heroImage` frontmatter; card grid assumes images exist (they do: blog1/blog2 + fungi). Verify all three posts render.

## Verification

- `npm run check` (astro build + tsc + wrangler dry-run) must pass.
- `npm run preview` for a visual pass on homepage, /blog, a post, mobile width.
- Confirm no `#2337ff` / `--accent` references remain; confirm Google Fonts link absent from `BaseHead`.

## Out of scope

- Copy rewrites (content stays as-is, only regrouped).
- New pages, RSS changes, content-schema changes.
- The duotone photo option (chosen treatment is the plain blob crop).
