# ethantam.dev

Personal site of Ethan Tam. Plain HTML, CSS and JS: no build step, no dependencies.

- **Ticker:** live BTC/ETH/SOL from the CoinGecko public API, plus a few stats
- **Painting:** Ambrosius Bosschaert the Elder, *Vase of Flowers in a Window* (c.1618, Mauritshuis, public domain), dithered in the browser on a canvas. Hover or tap to see the original.
- **Terminal:** press `~` anywhere (or the `~` button) and type `help`

## Run locally

```sh
npx serve .
```

Open it through a local server rather than `file://`, or the canvas can't read the image and the painting falls back to the plain version.

## Deploy

Netlify: import this repo, leave the build command empty, publish directory `.`. Then add `ethantam.dev` under Domain management.
