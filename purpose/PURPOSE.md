# Purpose — what this site is and what we've learnt building it

**This is a living document.** It gets updated whenever something is decided, learnt, or changes direction — dated entries go in the decisions log, standing truths go in the sections above it. If something here turns out to be wrong, correct it rather than appending a contradiction.

*Last updated: 2026-07-12*

---

## What this site is

A place Michael can send people **that isn't Instagram**. A personal showcase of the photography he's proudest of — not a sales funnel, not a services page, not a growth project.

The anti-Instagram move is **context**: Instagram strips it, this site adds it. That shows up as collection intros, real place names in captions, optional one-line stories under photos, and the deliberate pace of the layout. The photographs lead; the words support.

Prints and the odd wedding enquiry are welcome side effects, not the goal — which is why the About page mentions them in one breath instead of pitching them.

## Who it's for

People Michael hands the link to: friends, family, colleagues, someone met on a trail, a potential print buyer or wedding client who asked. Not search traffic. SEO copy exists (meta descriptions) but is never allowed to bend the visible copy.

## Voice & tone

**Settled with the v3 copy round (2026-07-12) — this is the standing guide; the old `src/_data/tone.md` is retired.**

- **Warm and conversational** - first person, like showing a friend around. The register of benmazefineart.com ("Hey there", "Thanks for stopping by") is the reference point.
- **Sincere, specific, Australian.** No irony, no composed aphorisms, no self-deprecating jokes. Write the sentence you'd say out loud.
- **No em dashes anywhere on the site.** Where a pause is needed: a single hyphen, a dot (·), or a semicolon. This includes generated text (tab titles, meta descriptions, alt text).
- **Smileys are part of the voice** where Michael wrote them (hero headline, prints line) - keep them exactly as written.
- Photo titles stay concrete: name a thing in the frame or a condition it was shot in, never a feeling. Real, specific place names in captions.
- The footer is the one exception to warm: it does legal work, so it's firm (`DO NOT USE WITHOUT PERMISSION`).
- Photo **stories** are one plain sentence about the day ("Third visit before the fog cooperated."), roughly one photo in three; blank is better than forced.

**Working method for copy:** draft and show for a reaction — never wire wording in blind. For big rounds he prefers a blanks-only inventory he can fill in himself (the v3 pattern).

## Identity devices

Understated systemic details Michael responds well to — protect these:

- **REC catalogue numbering** — a continuous 001–… number across the whole portfolio, assigned automatically in collection order. (Currently computed in `portfolio.js` but not rendered anywhere in the templates — decide whether to surface it again or drop it.)
- **Corner registration marks** on photos and the portrait frame.
- **Mono, uppercase caption typography** — title left, `LOCATION · YEAR` right; stories in sentence case because they're a line in Michael's voice, not catalogue data.
- **Download protection** — full-resolution originals live in the git-ignored `photos/` library and are never published; the largest thing on the site is a 2200px webp.
- **Roman numeral collection pager** (`II / V`).

## Decisions log

- **2026-07-12 (later)** — Watermark changed from "© MICHAEL ROBINSON" text to **Michael's handwritten signature** (drawn in Canva, supplied as a PNG). Source lives privately at `photos/signature.png`; the build turns its ink into an alpha mask and composites it white-over-soft-shadow, bottom-right, sized at ~11% of the frame's short side (width-based sizing made portrait marks half-size), onto the full-res original before downsizing (so it's identical in every srcset tier). The old text mark remains as a build fallback if the file is missing. Changing the signature file requires deleting `_site/img/` to force a re-render (the build otherwise reuses existing outputs).

- **2026-07-12 (later)** — Hero headline changed again, Michael's direct call: `Michael Robinson Landscape Photography` (plain and nameplate-style; supersedes v3's `Some of my favourite landscapes :)` and the earlier "name stays out of the hero" reasoning). Subline unchanged.
- **2026-07-12** — v3 copy landed (`docs/SITE-COPY-v3-filled.md`) and wired in. New voice: warm/conversational/sincere, no em dashes site-wide (see Voice & tone above). Changes: hero headline from v3 with the five collection names as the subline; new 5-paragraph bio (day job removed - the page is purely photography now); new notes and intros for all five collections; footer back to firm `DO NOT USE WITHOUT PERMISSION`; prints line with smiley; tab titles and generated meta/alt text switched from em dash to `·`; new meta descriptions; **Instagram added** (@mickjphotos) to the About contact list, the bio's closing line, and the footer. Confirmed unchanged: collection names and URLs, all 51 photo titles, all micro-copy. Stale `tone.md` retired.
- **2026-07-11** — Michael flagged he's unconvinced by the site's tone, the collection names, and the image naming, without being able to say exactly why. Full copy inventory issued as `docs/SITE-COPY-v3.md` (blanks-only, all 51 photo titles, at his request). Stale `tone.md` identified as a likely root cause. This `purpose/` folder started.
- **2026-07-10** — Collections renamed to the current evocative set, Michael's call: **Canopy** (rainforest + waterfalls, leads because it's the biggest body of work), **Dawn & Dusk** (named for the light, not the terrain), **Water** (salt and still merged — coast, lakes, birds), **Form & Texture** (B&W, defined by treatment), **Film & Faces** (people; film and digital together). Folders = slugs. *Under review again as of 2026-07-11.*
- **2026-07-10** — Photo library organised: all 54 real photos sorted and renamed (`NN-short-name`, gaps of 5), catalogued with draft titles and EXIF years. 3 misfits parked in `photos/_holding` (German cliff-forest, Bushranger, fence-line tree) — not a collection, invisible to the build; could seed an "open country" collection later.
- **July 2026 (earlier)** — Captions moved from JSON to `photos/catalogue.csv` (one spreadsheet: title/location/year/status/notes/story; build auto-appends rows for new photos). v2 copy from `docs/SITE-COPY-delivered.md` wired in. "On Film" retired as a collection concept — film is a texture across the site, not a bucket. Waterfalls folded into the rainforest collection rather than standing alone.
- **June–July 2026** — Site pivoted from an old ecommerce/personal site to a photography portfolio. Eleventy, build-time image pipeline (`@11ty/eleventy-img`, webp at 700/1400/2200px), deploy `_site/` only.
- **Standing** — Michael kept five of his own photo titles through the renaming pass: *Fingers of God, Requiem, Trapped in the sky, Bushranger, Mountain Pools.* Treat his own titles as fixed points unless he changes them himself.

## Current state & open items

Copy is settled as of 2026-07-12. What's left is data and photos, roughly in value order:

- **Locations for every photo** — the single highest-value gap. No GPS in any EXIF; only Lamington / Springbrook / Tasmania / Germany known from filenames. Must come from Michael, specific place names (Binna Burra beats Scenic Rim; for the German shots the town or region is plenty).
- **Years unknown** for 8 photos (Mountain Pools, Beech in fog, Trapped in the sky, Requiem, House on stilts, and the three Film & Faces film frames).
- **Portrait photo for the About page** — still missing.
- **Holding photos (3)** — Michael to decide. Framing from the v3 round: German cliff-forest could earn a place in Canopy; Bushranger and fence-line tree may suit Form & Texture if graphic enough; three photos isn't enough to seed a new collection, five collections stays the right number.
- **`film-faces/05-afternoon-rest`** — confirm it belongs on a public site (test: comfortable with a stranger / colleague / wedding enquiry seeing it?).
- **`film-faces/20-the-car-park`** — neither landscape nor face in a four-photo collection; needs a story that earns its place, or park it in `_holding`.
- **Stories** — all blank; aim ~1 in 3, sincere register makes them easier now. Blank is better than forced.
- **`docs/IMAGE-NAMING.md` is stale** — still describes the pre-rename collections (rainforest/coast/people). Collection names are now confirmed stable, so it can be rewritten any time.
- **REC numbers not rendered** — computed each build but not shown anywhere; decide surface-or-drop.

## Practical facts worth not re-learning

- Full-res library: `photos/<collection>/` in-repo (git-ignored) — master exports live at `F:\Photos\Exports`.
- The Eleventy data global is `portfolio`, not `collections` (reserved name in Eleventy).
- `fixOrientation: true` in `portfolio.js` matters — without it, 180°-flagged originals (film scans) publish upside down.
- CSV/JSON written via PowerShell carry a BOM; the build strips it on read and writes one deliberately so Excel opens `catalogue.csv` as UTF-8.
- Renaming a published photo file orphans its catalogue row (build warns, doesn't fail).
- The first photo in each collection folder is its home-page thumbnail, and the home hero pulls from the first collections — lead every collection with a strong image.
