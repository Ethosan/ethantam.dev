# ethantam.dev

Personal site of Ethan Tam. Plain HTML, CSS and JS: no build step, no dependencies.

- **Ticker:** live prices for a watchlist of stocks and crypto, fetched from Yahoo by the Worker (`/api/quotes`, edge-cached 60s, falls back to the last good result). If that endpoint isn't there, the page falls back to CoinGecko for crypto only.
- **Painting:** Ambrosius Bosschaert the Elder, *Vase of Flowers in a Window* (c.1618, Mauritshuis, public domain), dithered in the browser on a canvas. Hover or tap to see the original.
- **Layout:** on desktop the name and section nav stay pinned on the left while the rest scrolls on the right, and the nav marks the section you're reading (the layout follows Brittany Chiang's site). Phones and tablets get one column with sticky section titles.
- **Project screenshots:** 780×1440 captures saved as WebP in `assets/`. Live for Equarian Markets; demo data for 20bucks, The List and Trade Journal; test data for Tally.
- **Terminal:** press `~` anywhere (or the `~` button) and type `help`
- **Themes:** dark and light mode with a toggle button. Respects `prefers-color-scheme` by default, persists choice in `localStorage`. The dithered painting re-renders in theme colors.
- **Self-hosted fonts:** Geist, Geist Mono, and Instrument Serif served as woff2 from `assets/fonts/` (latin subset only, ~80 KB total). No Google Fonts dependency.
- **View transitions:** smooth cross-fade when navigating between sections via the nav (uses the View Transitions API where supported).
- **"Now" page:** a snapshot of what Ethan is currently focused on, at `/now.html`.
- **Copy email:** one-click copy button next to the email address, with clipboard API and execCommand fallback.
- **PWA:** installable as a standalone app (`manifest.json`) with offline support via a service worker (`sw.js`). The site works without a network connection once cached.
- **Print styles:** clean black-on-white output when printing; hides the ticker, terminal, and decorative elements.

## Run locally

```sh
npm install
npm run dev
```

That serves the static files and the `/api/quotes` endpoint together. (A plain static server works too, but the stock prices will show "—" and only crypto loads.)

## Deploy

Hosted as a Cloudflare Worker (`ethantam-dev`) with static assets. Deploys are manual: `npm run deploy` (runs `wrangler deploy`).

- `wrangler.jsonc`: Worker config; serves `404.html` for unknown paths
- `worker/index.js`: handles `GET /api/quotes` (Yahoo, cached 60s at the edge); everything else is a static file
- `.assetsignore`: keeps the README, config and worker source from being served
- `_headers`: security headers (CSP, HSTS, COOP, CORP, Permissions-Policy) and cache-control rules
- `manifest.json`: PWA manifest for installability
- `sw.js`: service worker for offline support (network-first for HTML, CSS and JS, cache-first for images and fonts)
- `noscript.css`: shows the plain painting when JavaScript is off
- `fonts.css`: self-hosted @font-face declarations (latin subset woff2)
- `assets/fonts/`: Geist, Geist Mono, Instrument Serif woff2 files
- `now.html`: "Now" page — current focus snapshot
