# stoneforgelabs.games

Studio site for **StoneForge Labs** — an independent game studio in Czechia.

Static HTML and CSS. No build step, no framework, no JavaScript.

## Pages

| File | Page |
|---|---|
| `index.html` | Home — studio, games, tools |
| `marble-mill.html` | Marble Mill |

## Local preview

Relative paths need a real server, so `file://` will not do:

```bash
python -m http.server 8000
# → http://localhost:8000
```

## Structure

```
assets/css/tokens.css   design tokens (colour, type, spacing, effects) + base styles
assets/css/site.css     components, layout, responsive rules
assets/img/             images
CNAME                   custom domain for GitHub Pages
.nojekyll               disables Jekyll processing
```

Component classes (`.btn`, `.card`, `.tag`, `.badge`) and the tokens come from
the StoneForge Labs design system.

## Deployment

GitHub Pages serves this repository at <https://stoneforgelabs.games>.
Pushing to `main` publishes.

Site files are synced here from an internal repository — **edit them there, not
in this repo**, or the next sync will overwrite your changes. This README is not
synced and can be edited freely.

## Credits

Type is Space Grotesk, Manrope and JetBrains Mono, all under the SIL Open Font
License, served from Google Fonts.

Marble Mill capsule art and the Forge Logger mark are © StoneForge Labs, s.r.o.
