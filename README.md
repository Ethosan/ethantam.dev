# ethantam.dev

Personal site of Ethan Tam. Plain HTML, CSS and JS: no build step, no dependencies.

- **Ticker:** live prices for a watchlist of stocks and crypto, fetched from Yahoo by the Worker (`/api/quotes`, edge-cached 60s, falls back to the last good result). If that endpoint isn't there, the page falls back to CoinGecko for crypto only.
- **Painting:** Ambrosius Bosschaert the Elder, *Vase of Flowers in a Window* (c.1618, Mauritshuis, public domain), dithered in the browser on a canvas. Hover or tap to see the original.
- **Terminal:** press `~` anywhere (or the `~` button) and type `help`

## Run locally

```sh
npm install
npm run dev
```

That serves the static files and the `/api/quotes` endpoint together. (A plain static server works too, but the stock prices will show "—" and only crypto loads.)

## Deploy

Hosted as a Cloudflare Worker (`ethantam-dev`) with static assets, connected to this repo through Workers Builds: every push to `main` deploys.

- `wrangler.jsonc`: Worker config; serves `404.html` for unknown paths
- `worker/index.js`: handles `GET /api/quotes` (Yahoo, cached 60s at the edge); everything else is a static file
- `.assetsignore`: keeps the README, config and worker source from being served
- `_headers`: security headers (including a CSP) and asset caching
- `noscript.css`: shows the plain painting when JavaScript is off
