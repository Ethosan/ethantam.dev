# ethantam.dev

Personal site of Ethan Tam. Plain HTML, CSS and JS: no build step, no dependencies.

- **Ticker:** live BTC/ETH/SOL from the CoinGecko public API, plus a few stats
- **Painting:** Ambrosius Bosschaert the Elder, *Vase of Flowers in a Window* (c.1618, Mauritshuis, public domain), dithered in the browser on a canvas. Hover or tap to see the original.
- **Terminal:** press `~` anywhere (or the `~` button) and type `help`

## Run locally

```sh
npx wrangler dev
```

That serves the static files and the `/api/quotes` endpoint together. (A plain static server works too, but the stock prices will show "—" and only crypto loads.)

## Deploy

Hosted as a Cloudflare Worker (`ethantam-dev`) with static assets, connected to this repo through Workers Builds: every push to `main` deploys.

- `wrangler.jsonc`: Worker config; serves `404.html` for unknown paths
- `worker/index.js`: handles `GET /api/quotes` (Yahoo, cached 60s at the edge); everything else is a static file
- `.assetsignore`: keeps the README, config and worker source from being served
- `_headers`: security and cache headers
