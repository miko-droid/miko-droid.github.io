# Michael Robinson — Landscape Photography

A photography portfolio built with [Eleventy](https://www.11ty.dev/). Landscape
work from South East Queensland — rainforest, ranges and coast — plus portraits
on film.

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
web-resolution webp** and stamps your signature into the pixels — so the largest
image anyone can save from the site is a downsized, watermarked copy, never your
full-res file.

Four sizes are generated per photo — `200` (home-page thumbnails) and `700 /
1400 / 2200` (everything else, hero included) — each in **both AVIF and webp**.
Every photo is served through `<picture>`: browsers that can decode AVIF take
it and save around 30% of the bytes, the rest fall back to webp.

A `3200` tier used to exist for the home hero. It was dropped on 2026-08-02: no
phone ever selected it, and on desktop it made the hero a 1.9MB LCP (up to
3.5MB for the heaviest photo). Capping at 2200 cut the home page from 2.84MB to
1.44MB on a laptop; AVIF took it the rest of the way to 0.93MB.

### Folder layout

```
photos/                          ← git-ignored, never published
├── portfolio.config.json        ← the collections, in order
├── catalogue.csv                ← every photo: title / location / year / status / notes / story
├── signature.png                ← the watermark source
├── canopy/
│   ├── 05-fingers-of-god.jpg    ← your originals (any resolution)
│   └── 10-under-the-beeches.jpg
├── dawn-dusk/
├── water/
├── form-texture/
├── film-faces/
└── _holding/                    ← not a collection; parking spot for undecided shots
```

### To add a photograph

1. Drop the original into the right collection folder.
2. Name it `NN-short-title.jpg` — the `NN-` prefix sets the order; the rest
   becomes the title (`03-cedar-creek.jpg` → "Cedar creek") unless you set one
   in the catalogue (below).
3. `npm start` (or `npm run build`). It's watermarked, downsized, oriented and
   live.

Orientation (portrait / landscape / panorama sizing) is detected automatically
from each image's real dimensions — you don't set it.

### The catalogue

`photos/catalogue.csv` is a plain spreadsheet — open it in Excel, Numbers, or
Google Sheets. One row per photo:

| collection | filename | title | location | year | status | notes | story |
| --- | --- | --- | --- | --- | --- | --- | --- |
| canopy | 03-cedar-creek | | Springbrook | 2026 | new | | |

- **collection** / **filename** are how the row is matched to the actual file
  — leave them alone.
- **title** — optional; leave blank to use the name-derived title.
- **location** / **year** — feed the "LOCATION · YEAR" caption on the site.
- **story** — an optional plain sentence about the day, shown under the caption
  and in the lightbox. Blank shows nothing, and blank is better than forced.
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
(`dir`, `slug`, `name`, `note`, `intro`), and drop photos in. A new page and
home-page row generate automatically. Empty collections stay hidden until they
have photos.

The current portfolio (52 photographs):

| Collection     | URL              | Photographs |
| -------------- | ---------------- | ----------- |
| Canopy         | `/canopy/`       | 17          |
| Dawn & Dusk    | `/dawn-dusk/`    | 9           |
| Water          | `/water/`        | 13          |
| Form & Texture | `/form-texture/` | 9           |
| Film & Faces   | `/film-faces/`   | 4           |

The **first photo in each folder** does triple duty: home-page thumbnail, the
image shown when a link to that collection is shared, and (for the first few
collections) a home hero slide. Lead each collection with a strong image.

## Words and details

- **Collection names, notes and intros:** `photos/portfolio.config.json`.
- **About text:** `src/about.njk`. The home page is deliberately wordless.
- **Site name, tagline, email, Instagram, prints line:** `src/_data/site.json`.
- **About portrait:** `src/images/portrait.jpg` is the committed master and is
  *not* published; `portrait.webp` beside it is what ships. Regenerate it with
  `sharp` if you replace the master.

## Look and feel

Styling is all in `src/css/style.css`, with the palette and motion variables at
the top. One theme, one stylesheet, no build step for CSS.

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
│   ├── portfolio.js   Build-time pipeline: watermark, downsize, orient, assemble
│   └── site.json      Name, tagline, url, email, Instagram, prints line
├── _includes/base.njk Page shell: head/meta, header, footer, lightbox
├── css/style.css      All styling
├── js/                flight.js · transitions.js · hero.js · lightbox.js · reveal.js
├── images/            About portrait (master .jpg + published .webp)
├── index.njk          Home (full-bleed hero + the collection list)
├── collection.njk     One page per collection (generated)
├── about.njk          About + contact
├── 404.njk            Served by GitHub Pages for any unmatched URL
├── sitemap.njk        → /sitemap.xml
└── robots.njk         → /robots.txt
_site/                 Build output (git-ignored) — this is what you deploy
```

Notes for anyone editing the front-end:

- `hero.js` must not read layout inside its scroll handler. Everything it needs
  is measured once in `measure()`; a `getComputedStyle` or
  `getBoundingClientRect` after the frame's style writes forces a synchronous
  reflow on every scroll frame.
- Image tiers are picked **by width** in `portfolio.js`, never by array index.
- `.claude/skills/verify/SKILL.md` has the recipe for driving the built site in
  headless Chrome to check changes.
