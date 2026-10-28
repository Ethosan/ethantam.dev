<img src="assets/apple-touch-icon.png" width="88" alt="ethantam.dev logo: an amber tulip bulb with a down arrow, on black">

# ethantam.dev

Personal site of Ethan Tam: who I am, what I'm doing now, and the projects I've built, with a live ticker of the prices I check too often and a dithered tulip painting. Plain HTML, CSS and JavaScript: no build step, no dependencies.

![HTML5](https://img.shields.io/badge/HTML5-E34F26?logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?logo=javascript&logoColor=black)
![Cloudflare Workers](https://img.shields.io/badge/Cloudflare_Workers-F38020?logo=cloudflare&logoColor=white)
![PWA](https://img.shields.io/badge/PWA-5A0FC8?logo=pwa&logoColor=white)

<p align="center">
  <img src="docs/screenshots/desktop-dark.png" width="72%" alt="Desktop, dark mode: the ticker across the top, name and introduction with the section nav pinned on the left, and the dithered tulip painting on the right">
  <img src="docs/screenshots/phone.png" width="22%" alt="Phone, dark mode: the ticker, introduction, local times and links, with sticky section titles">
</p>
<p align="center">
  <img src="docs/screenshots/desktop-light.png" width="72%" alt="Desktop, light mode: the same page with the painting re-rendered in the light theme's colours">
</p>
<p align="center"><sub>Dark mode on desktop and phone, and light mode. Live prices.</sub></p>

## At a glance

| | |
| --- | --- |
| **Live** | https://ethantam.dev |
| **Hosting** | Cloudflare Worker `ethantam-dev` with static assets; every push to `main` deploys through GitLab CI (`.gitlab-ci.yml`) |
| **Data** | Only the CV downloads and QR scans (below). The ticker streams from the Worker's `/api/live` (Yahoo for stocks, Binance for crypto). Visits are counted by Cloudflare Web Analytics, which sets no cookies: a manual-snippet site in the eatentam@gmail.com Cloudflare account (the hosting account is a different one), token in the beacon at the end of each page. |
| **Who got the CV** | `/stats`, behind a password (any user name; the password is the Worker secret `STATS_KEY`, changed with `npx wrangler secret put STATS_KEY`). It counts downloads of the PDF and scans of each QR code, and lists the latest 200 with the time, the place and network Cloudflare puts the connection in, the device, and for a download the page or site that linked to it. Kept in the `Stats` Durable Object's SQLite for a year; no IP address and no cookie; a repeat by the same person within 30 minutes counts once (matched by a daily-salted hash, blanked after a day); crawlers and link previews are listed faded and left out of the totals. |
| **Run locally** | `npm install && npm run dev` |
| **Source** | [gitlab.com/eatentam/ethantam.dev](https://gitlab.com/eatentam/ethantam.dev) (on GitLab since 17 Oct 2026). Read-only mirror: [github.com/Ethosan/ethantam.dev](https://github.com/Ethosan/ethantam.dev), which GitLab updates on every push |

Settings: none on the site. The CI deploy needs a `CLOUDFLARE_API_TOKEN` CI/CD variable (masked and protected).

## Features

- **Ticker:** streaming prices for a watchlist of crypto, the US 10-year yield, the dollar in yen, US stocks and DBS, updated as they move. The yield shows in percent with its move in basis points, DBS in Singapore dollars. Symbols that don't trade on New York hours (`ELSEWHERE` in `worker/index.js`: the yield, the yen and DBS) carry a ticker label of their own, get no PRE/AH tag, and don't decide when the market is open. One Durable Object holds an upstream socket to Yahoo's streamer (stocks) and one to Binance's market-data stream (crypto, USDT pairs, a tick a second), and pushes every change to each visitor over a WebSocket (`/api/live`), at most four times a second. Every visitor sees the same numbers. A price flashes green or red as it moves, and the dot by the label is lit while the stream is up. Outside 9:30-16:00 New York, stocks show the pre-market or after-hours price, tagged `PRE` or `AH`, with the change against the previous close. Crypto change is over the last 24 hours. If the socket can't connect, the page polls `/api/quotes` every 5s, and without the Worker at all it falls back to CoinGecko for crypto only. A hidden tab lets go of the socket after a minute and catches up the moment it's back. With nobody watching, the Durable Object closes its upstreams and sleeps.
- **Painting:** Ambrosius Bosschaert the Elder, *Vase of Flowers in a Window* (c.1618, Mauritshuis, public domain), dithered in the browser on a canvas, painted whole and then faded in from soft to sharp by CSS (one animation, smooth while the page is still loading; a theme change just repaints). Hover or tap to see the original.
- **Layout:** on desktop the name and section nav stay pinned on the left while the rest scrolls on the right, and the nav marks the section you're reading (the layout follows Brittany Chiang's site). Phones and tablets get one column with sticky section titles; phones also get a tab bar (Now, About, Projects, Contact) a thumb away, with 44px targets. Hover effects only apply where there's a mouse (`(hover: hover) and (pointer: fine)`), since on a phone a tap leaves a fake hover stuck.
- **Why I watch it:** tap a price on the ticker for a card with why it is on the list and its path today (a stock's session in New York with the regular hours shaded, or a coin's last 24 hours), the live price as the last point and a dashed line at the price the change is measured from. The reasons live in `WATCH` at the top of the ticker code in `main.js`. The strip holds still while you hover, tab through it or read a card, and every item is a real button for keyboards and screen readers.
- **Project cards:** each project with why it exists, what it grew into, and two screenshots: 780×1440 captures saved as WebP in `assets/`. Live data for Equarian Markets and Oracular; demo data for 20bucks, The List and Trade Journal; test data for Tally. Under each title, whether the app is up right now (and how fast it answered) and when its last commit landed, from `/api/projects`.
- **Terminal:** press `~` anywhere (or the `~` button) and type `help`. `why nvda` gives a ticker's reason, `cv` prints the CV, `open resume` opens `/resume`.
- **Themes:** dark and light mode with a toggle button. Respects `prefers-color-scheme` by default, persists the choice in `localStorage`. The dithered painting re-renders in theme colours, and the phone's status bar (`theme-color`) follows the toggle, not just the system setting.
- **Self-hosted fonts:** Geist, Geist Mono and Instrument Serif served as woff2 from `assets/fonts/` (latin subset only, about 80 KB in all). No Google Fonts dependency.
- **View transitions:** a smooth cross-fade when moving between sections through the nav (the View Transitions API, where supported).
- **Now:** a section with a snapshot of what Ethan is focused on at the moment.
- **Copy email:** one-click copy next to the email address, with the Clipboard API and an `execCommand` fallback.
- **Show QR code** (Contact section and `/resume`): puts `assets/qr.svg` (`HTTPS://ETHANTAM.DEV/Q`, counted as a scan of the phone code, then on to the home page) full screen (`share.js`, a `<dialog>`), black on white whatever the theme, keeps the screen awake while it's up, and closes with Close, Esc or the back gesture (it pushes its own `#qr` history entry). `/#qr` opens it on arrival, which is the installed app's "Show my QR code" shortcut (`manifest.json`), and `qr` in the terminal does the same. Both work offline once the site has been visited.
- **PWA:** installable (`manifest.json`) with offline support through a service worker (`sw.js`); the site works without a connection once cached.
- **Resume (`/resume`, also `/cv`):** Ethan's CV on one A4 page, shown as a sheet of paper next to a Download PDF button and a Print button. The sheet is true size where it fits and scales down whole below that, phones included. Printing it, or printing the home page (Ctrl+P, or `cv` in the terminal), gives the same single page and nothing else. The CV's only copy is the `<article id="cv">` in `resume.html`; the Worker copies it into the home page on every request. `ethan-tam-cv.pdf` is that sheet rendered by headless Chrome, and `og-resume.png` is the link preview for `/resume` (`scripts/og-resume.html`, which copies the CV in): after any change to the CV run `npm run cv-pdf`, which rewrites both and fails if the CV runs onto a second page. On phones it's the same A4 page scaled to fit, so what you see is what prints; touch screens get a hint to pinch to zoom (double-tap zoom is off on mobile-friendly pages in Chrome for Android). Pages without the CV (privacy, terms, 404) print as themselves. All sizes inside the sheet are in em, so it scales as one piece. The CV's header carries a QR code, `HTTPS://ETHANTAM.DEV/P`, which the Worker counts as a scan of the printed code and sends on to the home page; capitals keep it in QR's compact alphanumeric mode, version 2 (25x25). Its link (for a click in the PDF) is plain ethantam.dev, so clicks don't count as scans. `assets/qr.svg` is the phone code (`/Q`) on its own, black on white with a quiet zone. "Save as PDF" names the file "Ethan Tam CV".
- **Last updated:** stamped by the Worker from the live deploy's date. Never a date typed by hand, and right whichever pipeline did the deploy. `/api/version` has the deploy and the newest commit on `main` as of that moment (looked up on GitLab).
- **Search and AI:** both pages carry schema.org JSON-LD. The home page has a `@graph` with the WebSite, a ProfilePage, the Person (name variants, Cambridge from 2027, Advisory Singapore, awards, certifications, languages, LinkedIn and GitLab as `sameAs`) and each project as a CreativeWork credited to him. `/resume` is a ProfilePage with the same Person. `/llms.txt` sums him up for AI assistants. All of it is taken from the CV: when the CV changes, update the Person in both pages and `llms.txt` with it. In Google Search Console, verify `ethantam.dev` as a domain property (it can add the DNS record through Cloudflare) and submit `https://ethantam.dev/sitemap.xml`. Every deploy also pings IndexNow (`scripts/indexnow.mjs`, with the key file `0ff3763f1b67b2fc1b93eddcebcdc767.txt` at the root) so Bing re-crawls the sitemap's pages; Google doesn't take IndexNow.
- **Privacy and terms:** `/privacy` and `/terms`, linked from the footer; the same text as `PRIVACY.md` and `TERMS.md`.

## Architecture

```
Browser ──▶ Cloudflare Worker ethantam-dev
              ├─ GET /api/live    (WebSocket) ─┐
              ├─ GET /api/quotes  (snapshot)  ─┴─▶ Durable Object Ticker ──▶ Yahoo streamer   (stocks, socket)
              │                                                           ├─▶ Binance stream   (crypto, socket)
              │                                                           └─▶ Yahoo chart API  (previous closes; fills gaps while a socket is down)
              ├─ GET /api/spark   ──▶ Yahoo chart   (a stock's session or a coin's 24 hours, edge-cached 60s)
              ├─ GET /api/projects ─▶ each app + GitLab commits       (edge-cached 2 min)
              ├─ GET /            ──▶ index.html, with "Last updated" stamped from the deploy and the CV copied in from resume.html
              └─ everything else  ──▶ static assets   (404.html for unknown paths)
```

The Durable Object keeps the last good prices in its storage, so a cold start with Yahoo down still has something to show.

| Path | Purpose |
| --- | --- |
| `index.html`, `styles.css`, `main.js` | The page, its styles and its script |
| `resume.html`, `resume.js` | The resume page, its Print button and theme toggle; the CV's only copy |
| `share.js`, `assets/qr.svg` | The QR code full screen (both pages), and the QR code itself |
| `ethan-tam-cv.pdf`, `og-resume.png`, `scripts/cv-pdf.mjs`, `scripts/og-resume.html` | The CV as a PDF and as the `/resume` link preview, and what renders them from `resume.html` (`npm run cv-pdf`) |
| `worker/index.js` | `GET /api/live` and `GET /api/quotes` through the `Ticker` Durable Object, `/api/spark`, `/api/projects`, on `/` the deploy stamp and the CV, the counted PDF and QR paths (`/ethan-tam-cv.pdf`, `/P`, `/Q`) and `/stats` through the `Stats` Durable Object; everything else is a static file |
| `privacy.html`, `terms.html` | The privacy policy and terms as pages (`PRIVACY.md` and `TERMS.md` are the same text for the repo; keep them in step) |
| `wrangler.jsonc` | Worker config: the `TICKER` and `STATS` Durable Object bindings and their migrations, the paths the Worker sees first, the `VERSION` metadata binding; serves `404.html` for unknown paths |
| `.assetsignore` | Keeps the README, docs, scripts, config and Worker source from being served |
| `_headers`, `_redirects` | Security headers (CSP, HSTS, COOP, CORP, Permissions-Policy) and cache-control rules; `/cv` redirects to `/resume` |
| `manifest.json`, `sw.js` | PWA manifest; service worker (network-first for HTML, CSS and JS, cache-first for images and fonts) |
| `noscript.css` | Shows the plain painting when JavaScript is off |
| `fonts.css`, `assets/fonts/` | Self-hosted `@font-face` declarations and the woff2 files |
| `assets/` | Project screenshots, the painting, icons and the social preview image |
| `docs/screenshots/` | The screenshots above (not served) |

## Getting started

```sh
npm install
npm run dev
```

That serves the static files and the `/api/quotes` endpoint together. A plain static server works too, but the stock prices will show "—" and only crypto loads.

### Deploy

Every push to `main` runs the `deploy` job in `.gitlab-ci.yml`, which runs `wrangler deploy --tag <short commit>` with the `CLOUDFLARE_API_TOKEN` variable. To deploy by hand: `npm run deploy`.

## Legal

See the [privacy policy](PRIVACY.md) and [terms](TERMS.md). The **code** is released under the [MIT License](LICENSE); the **content** — the CV and its PDF, the writing, and the images — belongs to Ethan Tam and isn't licensed for reuse (see the terms; the dithered painting itself is public domain). The **fonts** (Geist, Geist Mono, Instrument Serif) are not Ethan's and come under the [SIL Open Font License](assets/fonts/OFL.txt), which travels with them. `/.well-known/security.txt` says where to report a security problem.
