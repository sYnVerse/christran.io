# christran.io

Personal website and blog for [Chris Tran](https://christran.io) — portfolio, writing, and interactive explorers — built with **Astro** and deployed on **Cloudflare Workers**.

Live site: [https://christran.io](https://christran.io)

## Stack

| Layer | Choice |
| --- | --- |
| Framework | [Astro](https://astro.build) 7.x |
| Content | MDX collections (`src/content/`) |
| Images | Astro `<Image />` + [sharp](https://sharp.pixelplumbing.com/) |
| Math (blog) | remark-math + rehype-katex |
| Hosting | [Cloudflare Workers](https://workers.cloudflare.com/) + Wrangler |
| Optional local tooling | `tools/blog-generator` (not deployed with the site) |

## Requirements

- **Node.js ≥ 22.22.0** and npm ≥ 9.6.5 (see `engines` in `package.json`)
- A Cloudflare account if you want to deploy your own fork

## Quick start

```bash
git clone https://github.com/sYnVerse/christran.io.git
cd christran.io
npm install
npm run dev
```

Open the URL printed by Astro (typically `http://localhost:4321`).

### Build & preview

```bash
npm run build          # output in ./dist
npm run preview        # build + wrangler dev
npm run check          # build + tsc + wrangler deploy --dry-run
```

### Deploy

```bash
npm run deploy         # astro build && wrangler deploy
```

Production deploys for christran.io are usually triggered from the Cloudflare dashboard when `main` changes. Optional conditional build/deploy commands (skip when only docs/tools change):

```bash
# Build
git diff --quiet HEAD^ HEAD src public astro.config.mjs package.json package-lock.json || npm run build

# Deploy
git diff --quiet HEAD^ HEAD src public astro.config.mjs package.json package-lock.json || npx wrangler deploy
```

Set `CF_BUILD=1` (or `CF_PAGES`) in the Cloudflare build environment so `astro.config.mjs` enables the `@astrojs/cloudflare` adapter.

## Environment variables & secrets

The **published Worker for this marketing site** does not require application secrets in `wrangler.json`. Auth for other apps in the ecosystem lives on [auth.christran.io](https://auth.christran.io) (sYnID), not in this repo’s runtime config.

| Name | Where | Purpose |
| --- | --- | --- |
| Cloudflare account / API credentials | Cloudflare dashboard / Wrangler login | Deploy only — never commit |
| `GEMINI_API_KEY` | Local `tools/blog-generator/.env` only | Optional local AI drafting |
| `RESEND_API_KEY` | Local `tools/blog-generator/.env` only | Optional local email of draft ideas |
| `USER_EMAIL` / `SENDER_EMAIL` | Local `.env` only | Optional local notification addresses |
| `PEXELS_API_KEY` / `UNSPLASH_ACCESS_KEY` | Local `.env` only | Optional stock image search |
| `DASHBOARD_URL` / `PORT` / `BLOG_CONTENT_PATH` | Local `.env` only | Optional blog-generator settings |
| `.dev.vars` | Local Wrangler (gitignored) | Local Workers secrets if you add bindings later |

Copy `tools/blog-generator/.env.example` → `.env` for the local tool. **Do not commit `.env` or `.dev.vars`.**

## Project structure

```
├── public/                 # Static assets, _headers, _redirects, .well-known
├── src/
│   ├── assets/             # Optimized images
│   ├── components/         # UI (search, terminal, interactive widgets)
│   ├── content/            # Blog + portfolio MDX collections
│   ├── layouts/
│   ├── pages/              # Routes + JSON/RSS endpoints
│   ├── scripts/
│   └── styles/
├── tools/
│   └── blog-generator/     # Optional local Express dashboard (not part of Workers deploy)
├── graphify-out/           # Knowledge graph data used by /explore
├── astro.config.mjs
├── wrangler.json
└── package.json
```

### Notable public routes

- `/` — home  
- `/blog`, `/portfolio`, `/explore`  
- `/rss.xml`, `/search-index.json`, `/graph-data.json`  
- `/auth` — redirects to the separate OpenAuth host  

## Local blog generator (optional)

`tools/blog-generator` is a **local-only** helper for idea generation, drafting, and publishing posts from your machine. It is **not** deployed by `wrangler.json`. Prefer binding it to localhost and never exposing it on the public internet.

```bash
cd tools/blog-generator
cp .env.example .env   # fill secret names listed above — never commit this file
npm install
npm run test-apis
npm start              # http://localhost:5000
```

## Scripts

| Command | Action |
| --- | --- |
| `npm run dev` | Astro dev server |
| `npm run build` | Production build → `./dist` |
| `npm run preview` | Build + Wrangler local preview |
| `npm run check` | Build + TypeScript + Wrangler dry-run |
| `npm run deploy` | Build + Wrangler deploy |
| `npm run cf-typegen` | Regenerate Cloudflare types |

## License

Copyright © 2025–2026 Chris Tran.

This repository uses a **dual license**:

| Material | Paths | License |
| --- | --- | --- |
| **Code** (site, components, configs, tooling, and other software) | Everything **except** the content paths below | [GNU Affero General Public License v3.0 or later](./LICENSE) (`AGPL-3.0-or-later`) |
| **Written content & media** (posts, articles, portfolio write-ups, and their images) | `src/content/**`, `src/assets/img/blog/**`, `src/assets/img/projects/**` | [Creative Commons Attribution-ShareAlike 4.0 International](./LICENSE-CONTENT) (CC BY-SA 4.0) |

**Content © Chris Tran, licensed [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).**  
Attribution: credit Chris Tran / [christran.io](https://christran.io) and link to the license.

Full legal texts: [`LICENSE`](./LICENSE) (AGPL-3.0) and [`LICENSE-CONTENT`](./LICENSE-CONTENT) (CC BY-SA 4.0).

---

Built by [sYnVerse](https://github.com/sYnVerse) · [christran.io](https://christran.io)
