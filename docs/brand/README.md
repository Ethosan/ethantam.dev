# ethantam.dev brand guide

The look ethantam.dev already has, read from the live site at v1.0.1 (near-black · warm off-white · one amber · Geist, Geist Mono, Instrument Serif italic). Full guide: [DESIGN.html](DESIGN.html). Open it from a checkout: it loads the repo's own mark, images and fonts by relative path.

| What | Where |
|---|---|
| Mark | `assets/mark.svg` (the amber tulip) and `assets/apple-touch-icon.png` |
| Colours | `tokens.json` here, read from `styles.css` (dark and light) |
| Type | Geist, Geist Mono and Instrument Serif italic, self-hosted in `assets/fonts/` |

`.assetsignore` excludes `docs/`, so none of this is deployed. Nothing in this folder is new artwork: every colour, font and file it names is already on the site.

## Repo avatar and social preview

| File | Where it's used |
|---|---|
| `docs/brand/avatar.png` | GitLab project avatar (Settings > General), 512×512 |
| `docs/brand/social-preview.png` | GitHub social preview (github.com/Ethosan/ethantam.dev, Settings > Social preview), 1280×640 |

Every one of these repos follows the same spec: a 512×512 PNG avatar with the project's own mark on its own background to every edge, since GitLab and GitHub round it themselves; and, for repos mirrored to GitHub, a 1280×640 social preview with the avatar tile, the name and the repo description, no URL. Both are made from the mark, not new artwork.
