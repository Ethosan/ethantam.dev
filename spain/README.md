# spain.ethantam.dev — the Camino page as its own Cloudflare Pages project

This folder is a standalone site: `index.html` + `camino.css` + `camino.js` + the shared
`styles.css`/`fonts.css` and font files copied in, so a Pages project with **build output
directory = `spain/`** (no build command) serves it at its root. The main Worker site
does not serve it (`spain` is in `.assetsignore`).

## Deploy

Every push to the default branch runs the `pages` job in `.gitlab-ci.yml`:

```
npx wrangler pages deploy spain --project-name spain-ethantam-dev
```

which creates the project on first run and publishes it at:

```
https://spain-ethantam-dev.pages.dev
```

The `CLOUDFLARE_API_TOKEN` CI variable needs **Cloudflare Pages: Edit** in addition to the
"Edit Cloudflare Workers" template (dashboard.cloudflare.com/profile/api-tokens, or edit
the existing token's permissions). Retry the pipeline once the permission is added.

## Point spain.ethantam.dev at it

Preferred: in the Pages project → Custom domains → add `spain.ethantam.dev`
(Cloudflare creates the DNS record itself, proxied).

Fallback: DNS → add a CNAME record `spain` → `spain-ethantam-dev.pages.dev`, proxied
(orange cloud). Same-account `pages.dev` targets are allowed as CNAME targets.

Then the page is live at **https://spain.ethantam.dev/** and every merge also gets a
preview URL under `https://<commit>.spain-ethantam-dev.pages.dev`.

## Local preview

```
npx wrangler pages dev spain
```

## Notes

- CSP is in `_headers` (Pages serves it): no inline style/script — the only inline script
  is the theme bootstrap whose sha256 is allow-listed; the Cloudflare Web Analytics beacon
  is allow-listed by domain.
- `index.html` uses relative paths only, so it works identically on `pages.dev`, the
  custom domain, and local preview. The canonical is rewritten by `camino.js` for
  `spain.ethantam.dev` and `*.pages.dev`.
- Fonts are the site's own Geist / Geist Mono / Instrument Serif italic (SIL OFL, see
  `fonts/OFL.txt`); no external requests beyond the analytics beacon.
