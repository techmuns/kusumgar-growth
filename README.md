# Kusumgar Growth Engine

An AI sales-employee dashboard for **Kusumgar** (technical-textile / defence-fabric
manufacturer). It turns two growth motions into one visual cockpit:

1. **Exhibitions** — track global trade shows, sort exhibitors into customers vs. competitors.
2. **Outbound** — research a product, build a target list, find the buyer, send the email.

We build it in **5 phases**. This repo currently ships **Phase 1**: the foundation shell
plus a fully-working **Exhibitions** tab (Overview charts + filterable List with a
persistent relevance triage). The other four tabs are intentional placeholders.

## Architecture

- **Pure static site** served from `public/`. No build step, no framework.
- Plain HTML + one ES-module (`public/js/app.js`) + committed JSON in `public/data/`.
- The UI **always** just reads committed JSON via `fetch("data/xxx.json")`. Later phases
  add GitHub Actions that scrape data and commit fresh JSON — the UI never changes.
- [Tailwind](https://tailwindcss.com) via CDN, Google Fonts (Inter + Plus Jakarta Sans).
- **All charts are hand-built inline SVG.** No chart library.

```
public/
├── index.html          # the shell (header, tabs)
├── js/app.js           # all logic (ES module)
└── data/
    ├── exhibitions.json # 44 seed shows
    └── meta.json        # { updated_at, exhibitions_total }
```

## Run locally

Any static server works — there is nothing to build:

```bash
cd public
python3 -m http.server 8080
# open http://localhost:8080
```

## Deploy — Cloudflare Pages (one-time setup, then fully automated)

Deployment is **automatic on every push to GitHub**. Configure this **once** and it
stays automated forever — no manual deploy step is ever needed again:

1. In the **Cloudflare dashboard → Workers & Pages → Create → Pages**, choose
   **Connect to Git** and select the `techmuns/kusumgar-growth` repository.
2. Set the build configuration:
   - **Framework preset:** `None`
   - **Build command:** *(leave empty)*
   - **Build output directory:** `public`
3. Save. Cloudflare now redeploys automatically on every push to the production branch.

That's the whole setup. From then on, every commit — including the JSON that future
GitHub Actions will scrape and commit — ships to the live site with zero manual steps.

## Roadmap

- **Phase 1 (this build)** — Foundation shell + Exhibitions tab. ✅
- **Phase 2** — Products tab + a GitHub Action that scrapes kusumgar.com into a product catalog.
- **Phase 3** — Leads (target companies + buyers).
- **Phase 4** — Competitors intelligence.
- **Phase 5** — Outreach (cold-email machine).
