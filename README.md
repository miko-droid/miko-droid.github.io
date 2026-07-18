# Michael Robinson — Landscape Photography

A photography portfolio built with [Eleventy](https://www.11ty.dev/). Landscape
work from South East Queensland — rainforest, ranges and coast — catalogued by
REC number.

## Quick start

```bash
npm install
npm start
```

Local dev server at `http://localhost:8080` with live reload.

```bash
npm run build   # outputs the finished site to _site/
```

---

## The photo workflow (important)

Full-resolution originals live in a **private, git-ignored `photos/` folder** and
never leave your machine. On every build, the site **downsizes them to
web-resolution webp** (max 2200px, three sizes) — so the largest image anyone can
save from the site is a downsized copy, never your full-res file.

### Folder layout

```
photos/                          ← git-ignored, never published
├── portfolio.config.json        ← the collections, in order
├── catalogue.csv                ← every photo: title / location / year / status / notes
├── rainforest-canopy/
│   ├── 01-old-growth.jpg        ← your originals (any resolution)
│   └── 02-moss-and-fog.jpg
├── the-ranges/
├── coastal-studies/
├── form-and-texture/
└── film-and-faces/              ← empty; add photos and it appears
```

### To add a photograph

1. Drop the original into the right collection folder.
2. Name it `NN-short-title.jpg` — the `NN-` prefix sets the order; the rest
   becomes the title (`03-cedar-creek.jpg` → "Cedar creek") unless you set one
   in the catalogue (below).
3. `npm start` (or `npm run build`). It's downsized, oriented, numbered, and
   live. **REC numbers renumber themselves** across the whole portfolio.

Orientation (portrait / landscape / panorama sizing) is detected automatically
from each image's real dimensions — you don't set it.

### The catalogue

`photos/catalogue.csv` is a plain spreadsheet — open it in Excel, Numbers, or
Google Sheets. One row per photo:

| collection | filename | title | location | year | status | notes |
| --- | --- | --- | --- | --- | --- | --- |
| rainforest-canopy | 03-cedar-creek | | Springbrook | 2026 | new | |

- **collection** / **filename** are how the row is matched to the actual file
  — leave them alone.
- **title** — optional; leave blank to use the name-derived title.
- **location** / **year** — feed the "LOCATION · YEAR" caption on the site.
- **status** / **notes** — yours to use however's useful (e.g. mark `new` ones
  `published` once you're happy, jot a note to reshoot something in better
  light). The site doesn't read these.

It updates itself: drop a new photo into a collection folder and build (or
`npm start`) — a new row appears at the bottom, blank, `status: new`, waiting
for you to fill in. Edit the sheet and rebuild, and the site picks up your
changes immediately. If a row's file goes missing (renamed, moved, deleted)
the build prints a warning instead of silently dropping the row.

### To add a collection

Make a new folder in `photos/`, add an entry to `photos/portfolio.config.json`
(`dir`, `slug`, `name`, `note`), and drop photos in. A new page and home-page
row generate automatically. Empty collections stay hidden until they have
photos — which is why **Film & Faces** won't show until you add frames to
`photos/film-and-faces/`.

The current catalogue:

| REC       | Collection          |
| --------- | ------------------- |
| 001–005   | Rainforest / Canopy |
| 006–008   | The Ranges          |
| 009–011   | Coastal Studies     |
| 012–013   | Form & Texture      |
| 014–…     | Film & Faces (add)  |

## Words and details

- **Home statement / About text:** `src/index.njk` and `src/about.njk`.
- **Site name, email, location:** `src/_data/site.json`.
- **About portrait:** drop `src/images/portrait.jpg` (a placeholder shows until
  you do).

## Look and feel

- Styling is all in `src/css/style.css` (theme variables at the top).
- **Night theme:** add `data-theme="night"` to `<html>` in
  `src/_includes/base.njk`.
- **Crop marks** around each print: add `class="crop-marks"` to `<html>` (off by
  default).

## Deploy

The site is published with **GitHub Pages** at https://miko-droid.github.io/.
Because the originals are private (git-ignored), the site is built locally and
the finished output is pushed to the `gh-pages` branch:

```bash
npm run deploy   # build + publish the live site
```

Remember: `git push` backs up the source but does **not** update the live
site — run `npm run deploy` for that. Full maintenance guide (adding photos,
collections, copy edits, custom domain setup): **[docs/HANDOFF.md](docs/HANDOFF.md)**.

## Project structure

```
photos/               Private originals (git-ignored) + config + catalogue.csv
src/
├── _data/
│   ├── portfolio.js   Build-time pipeline: downsize, orient, number, assemble
│   └── site.json      Name, tagline, email, location
├── _includes/base.njk Page shell: header, footer, fonts, lightbox
├── css/style.css      All styling
├── js/                hero.js · lightbox.js · transitions.js · flight.js
├── images/            About portrait (optional)
├── index.njk          Home (hero + statement + the record)
├── collection.njk     One page per collection (generated)
└── about.njk          About + contact
_site/                 Build output (git-ignored) — this is what you deploy
```
