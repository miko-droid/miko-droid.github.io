# Handoff — running michaelrobinson's site

Everything you need to add photos, edit words, and publish. No web-dev
knowledge assumed. When in doubt: you can't break anything permanently —
the live site only changes when you run `npm run deploy`, and the source
is backed up on GitHub.

## The mental model (30 seconds)

There are three separate things:

1. **`photos/`** — your full-resolution originals, plus `catalogue.csv` and
   `portfolio.config.json`. This folder is private: it is git-ignored and
   **only exists on your machine** (masters also live at `F:\Photos\Exports`).
   Back it up yourself — GitHub does not have a copy.
2. **The source code** — everything else in this folder. Backed up to GitHub
   at `github.com/miko-droid/miko-droid.github.io` (branch `main`) whenever
   you `git push`.
3. **The live site** — https://miko-droid.github.io/ — built on your machine
   and published with `npm run deploy`. Only downsized, watermarked webp
   copies of your photos ever leave your computer.

Pushing to GitHub does **not** update the live site, and deploying does
**not** back up your source. They're separate on purpose (your photos are
private, so GitHub can't build the site for you). Do both when you finish a
session.

## Everyday commands

Open a terminal in this folder (`C:\Users\micgr\Documents\Projects\Website`):

| Command | What it does |
| --- | --- |
| `npm start` | Preview at http://localhost:8080 — live-reloads as you edit. Ctrl-C to stop. |
| `npm run build` | Build the site into `_site/` without serving it. |
| `npm run deploy` | Build and **publish to the live site**. Takes a minute or two to appear. |

First build after adding photos is slow (watermarking + resizing each new
image); after that it's fast — already-processed images are reused.

## Adding a photograph

1. Export the image and drop it into the right collection folder, e.g.
   `photos/canopy/`. Name it `NN-short-title.jpg` — the `NN-` number sets
   the order within the collection, the rest becomes the default title
   (`12-cedar-creek.jpg` → "Cedar creek"). See `docs/IMAGE-NAMING.md`.
2. Run `npm start` (or `npm run build`). The photo is watermarked with your
   signature, downsized and oriented automatically.
   A new blank row also appears at the bottom of `photos/catalogue.csv`
   with `status` = `new`.
3. Open `photos/catalogue.csv` (Excel or Google Sheets is fine) and fill in
   the row — see below. Rebuild and check it at localhost:8080.
4. Happy? `npm run deploy`, then commit and push (see Publishing).

## The catalogue (`photos/catalogue.csv`)

One row per photo. Columns:

| Column | Used on the site? | What it does |
| --- | --- | --- |
| collection, filename | — | How the row matches the file on disk. Don't edit these. |
| title | yes | Overrides the filename-derived title. Blank = use filename. |
| location, year | yes | The right-hand caption: "LOCATION · YEAR". Either can be blank. |
| status, notes | no | Yours to track things (e.g. flip `new` → `published`). The site ignores them. |
| story | yes | A sentence or two shown under the caption and in the lightbox. Blank = nothing shows. |

If you rename, move, or delete a photo file, its old row stays and the build
prints a warning naming it — delete the stale row (or fix the filename)
when you see one.

## Adding or reordering collections

Collections are defined in `photos/portfolio.config.json`, in display order.
Each entry has:

- `dir` — the folder name inside `photos/`
- `slug` — the URL (`/canopy/`)
- `name` — the display name ("Dawn & Dusk")
- `note` — the line under the name on the home page
- `intro` — the one-liner at the top of the collection's own page

To add one: make the folder, add an entry, drop photos in. To reorder:
reorder the entries. Empty folders stay hidden until
they have photos. `photos/_holding/` is not a collection — it's the parking
spot for shots that don't fit anywhere yet.

## Editing words

- **Name, tagline, email, Instagram, prints line:** `src/_data/site.json`
- **Collection names, home-page notes and intros:** `photos/portfolio.config.json`
- **About page text:** `src/about.njk` (the home page has no words by design)
- **About portrait:** replace `src/images/portrait.jpg`, then regenerate the six
  published copies (three widths, in both formats):
  `node -e "const s=require('sharp');[480,720,960].forEach(w=>{s('src/images/portrait.jpg').resize({width:w}).webp({quality:80}).toFile('src/images/portrait-'+w+'.webp');s('src/images/portrait.jpg').resize({width:w}).avif({quality:50,effort:4}).toFile('src/images/portrait-'+w+'.avif')})"`.
  Only the resized copies are published; the `.jpg` stays as your master.
- Past copy drafts live in `docs/SITE-COPY*.md` for reference.

Preview with `npm start`, then deploy + push as usual.

## Publishing (do both)

```bash
npm run deploy                       # updates the live site
git add -A && git commit -m "..."    # then back up the source
git push
```

`npm run deploy` pushes the built site to a branch called `gh-pages`, which
GitHub Pages serves. You never edit that branch by hand. If the live site
looks stale a few minutes after deploying, hard-refresh (Ctrl-F5).

## Setting up a new machine

1. Install [Node.js](https://nodejs.org) (LTS) and [Git](https://git-scm.com).
2. `git clone https://github.com/miko-droid/miko-droid.github.io.git`
3. Copy your `photos/` folder into the cloned folder (from backup — it's not
   on GitHub). Without it the site builds empty.
4. `npm install`, then `npm start`.

## Custom domain (when you're ready)

Say you buy `michaelrobinson.photography` (any registrar — Cloudflare,
Namecheap, Porkbun...). Five steps, no code changes needed:

1. **DNS, at your registrar:** add these records:
   - Apex/root (`@`): four `A` records → `185.199.108.153`,
     `185.199.109.153`, `185.199.110.153`, `185.199.111.153`
   - `www`: a `CNAME` record → `miko-droid.github.io`
2. **GitHub:** repo → Settings → Pages → "Custom domain" → enter your
   domain → Save. (Also worth doing once: your GitHub account Settings →
   Pages → "Add a verified domain" — stops anyone else claiming it.)
3. **The deploy script:** in `package.json`, add `--cname yourdomain.com` to
   the end of the `deploy` script. This makes every deploy carry the domain
   file — without it, your next `npm run deploy` would knock the custom
   domain off.
4. Wait up to an hour for DNS + GitHub's certificate, then back in
   Settings → Pages tick **"Enforce HTTPS"**.
5. `npm run deploy` once more and check the domain loads.

The old https://miko-droid.github.io/ address will redirect to the new
domain automatically.

## Troubleshooting

| Symptom | Cause / fix |
| --- | --- |
| Site builds but portfolio is empty | The `photos/` folder is missing (new machine?). Restore it from backup. |
| Live site doesn't show my changes | You previewed but didn't `npm run deploy` — or wait 2 min / hard-refresh. |
| Build warning: "catalogue.csv has N row(s) with no matching file" | A photo was renamed/moved/deleted. Fix or delete that CSV row. |
| A collection vanished from the site | Its folder is empty — collections hide until they have photos. |
| Captions came out mangled after editing the CSV | Save the CSV as **UTF-8** (Excel: "CSV UTF-8"). |
| `npm` not recognised | Node.js isn't installed (new machine) — see setup above. |
