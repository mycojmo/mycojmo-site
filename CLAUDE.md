# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Personal/consulting site for MycoJMO LLC (mycojmo.com) — Justin Pewitt Moore. Built on Astro, derived from the Bear Blog theme, and deployed to **Cloudflare Workers** via the `@astrojs/cloudflare` adapter. Content is the product: most edits are to page copy (`src/pages/index.astro`) and blog posts.

## Commands

- `npm run dev` — local Astro dev server
- `npm run build` — production build to `dist/` (emits a Cloudflare `_worker.js`)
- `npm run preview` — build then serve with `wrangler dev` (runs the real Worker locally; use this to test Cloudflare-specific behavior, not `dev`)
- `npm run check` — full pre-deploy gate: `astro build && tsc && wrangler deploy --dry-run`. Run this before deploying.
- `npm run cf-typegen` — regenerate `worker-configuration.d.ts` after changing Cloudflare bindings in `wrangler.json`
- `npm run deploy` — `wrangler deploy` to Cloudflare

There is no test suite and no linter; `npm run check` (tsc under Astro's strict config + a deploy dry-run) is the verification step.

## Architecture

- **Routing** is file-based in `src/pages/`. `blog/[...slug].astro` renders individual posts; `blog/index.astro` is the post list; `rss.xml.js` generates the feed.
- **Content** lives in `src/content/blog/` as `.md`/`.mdx`, loaded via the `glob` loader in `src/content.config.ts`. Frontmatter is schema-validated with Zod: `title` and `description` are required, `pubDate` required (coerced to Date), `updatedDate` and `heroImage` optional. A post that violates this schema fails the build.
- **Layout** for posts is `src/layouts/BlogPost.astro`; shared chrome is in `src/components/` (`BaseHead`, `Header`, `Footer`, `HeaderLink`, `FormattedDate`).
- **Global constants** (`SITE_TITLE`, `SITE_DESCRIPTION`) are in `src/consts.ts` and imported where needed. The canonical site URL (`https://mycojmo.com`) is set in `astro.config.mjs` and feeds canonical links, sitemap, and RSS.
- **Styling** is a single global stylesheet at `src/styles/global.css` (no component-scoped CSS framework). Static assets and fonts are served from `public/`.

## Notable details

- The home page (`src/pages/index.astro`) is hand-authored HTML copy, not driven by a content collection — edit it directly.
- `astro.config.mjs` enables `platformProxy` so Cloudflare bindings are available in `astro dev`.
- `worker-configuration.d.ts` is generated (do not hand-edit); regenerate with `npm run cf-typegen`.
