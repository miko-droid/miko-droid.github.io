# Purpose — what this site is and what we've learnt building it

**This is a living document.** It gets updated whenever something is decided, learnt, or changes direction — dated entries go in the decisions log, standing truths go in the sections above it. If something here turns out to be wrong, correct it rather than appending a contradiction.

*Last updated: 2026-07-31*

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

- **Mono, uppercase caption typography** — title left, `LOCATION · YEAR` right; stories in sentence case because they're a line in Michael's voice, not catalogue data.
- **Download protection** — full-resolution originals live in the git-ignored `photos/` library and are never published; the largest thing on the site is a 2200px webp.
- **Roman numeral collection pager** (`II / V`).

**Decided against and removed (2026-07-31):** REC catalogue numbering, corner registration marks, and the dark "night" theme. All three shipped as unreachable or unrendered code for weeks. Michael's call was that he had opted out of each, so they were deleted rather than left dormant. Don't reintroduce them without a fresh decision.

## Decisions log

- **2026-08-02** — Performance and mobile UX audit. **Payload, the big one:** the `3200` tier is gone (no phone ever picked it; on desktop it made the hero a 1.9MB LCP) and **AVIF now ships alongside webp** through `<picture>`. Home page: **2.84MB → 0.93MB on a laptop, 0.66MB → 0.45MB on a phone.** Webfonts are **self-hosted** from `src/fonts/`, removing the last render-blocking third-party request and two handshakes; the hero photo is preloaded. **Back works properly** — `transitions.js` used to answer every popstate with `window.location.reload()`, making the one navigation a browser can serve instantly the slowest on the site; it now restores the cached home page, its scroll position and its hero. **Two real bugs found while testing:** portrait prints laid out at **0×0** until their image decoded (a `width: auto`/`height: auto` box has no intrinsic size before load), jumping the page mid-scroll; and the collection Back link's enlarged tap target was painted over by the next block, so it measured 45px and accepted taps on 30. **Mobile UX:** `viewport-fit=cover` (the `env(safe-area-inset-*)` rules in the lightbox had been resolving to 0 all along), every tap target now ≥44px, `:active` feedback everywhere hover is gated off, a skip link, a 12px type floor, and a lightbox scroll lock that actually **restores your place** on close. **Hero scroll loop:** early-out when progress hasn't changed, pixel quantisation, cached header writes, shadow moved off the resize path onto an opacity fade, debounced resize, and a proper `init`/`destroy` so it stops listening after a pseudo-navigation. **Considered and rejected:** rewriting the hero shrink to be transform-only. Measured, layout is only ~13% of that scroll's main-thread cost (265ms of 2000ms at 10× throttle) and CSS containment made no difference; the rewrite would have changed when the mat and border appear for a saving the numbers don't justify.

- **2026-07-31** — Full audit pass. **Copy (round 4):** the v3 "warm and conversational" voice was right, but the lines that *rated the work* ("a few of my favourite photos i've ever taken are in here", "Every one was worth getting up for") and *told the viewer how to feel* ("hopefully some of it lands for you too") were what read as cringe. Warmth stays; self-assessment goes. All five collection intros rewritten on that rule, three cuts to the About bio. **The hero is now wordless** — the headline duplicated the wordmark directly above it and its subline listed the same five collections as the section directly below; the page opens on the photograph and the SCROLL cue alone (an `sr-only` `<h1>` carries the document outline). **Removed:** REC numbers, crop marks, night theme (see Identity devices). **Fixed:** three collection pages had browser tabs literally reading `Dawn &amp; Dusk` (double-escaped through `eleventyComputed`); two lightbox race conditions; `:hover` latching on touch. **Mobile jank root-caused** — `hero.js` forced a synchronous reflow every scroll frame and the FLIP clone animated layout properties; both now avoid layout in the hot path. **Added:** Open Graph/Twitter previews, canonical URLs, `404`, `sitemap.xml`, `robots.txt`, a 200px thumbnail tier (−393 KB on the home page).

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

Copy is settled as of 2026-07-31 (round 4, see the decisions log). What's left is data and photos, roughly in value order:

- **Locations for every photo** — the single highest-value gap: 43 of 52 photos have none, and 3 of the 9 that do just say "Germany". No GPS in any EXIF; only Lamington / Springbrook / Tasmania / Germany known from filenames. Must come from Michael, specific place names (Binna Burra beats Scenic Rim; for the German shots the town or region is plenty).
- **Stories** — all 52 blank. The feature is built end to end (caption, lightbox, CSV column) and unused, which makes it the cheapest way to add the context this site exists to provide. Aim ~1 in 3. Blank is better than forced.
- **Years unknown** for 8 photos (Mountain Pools, Beech in fog, Trapped in the sky, Requiem, House on stilts, and the three Film & Faces film frames).
- **`dawn-dusk/45-the-fenceline`** — blank catalogue row; renders with a filename-derived title and no location or year at all.
- **Holding photos (3)** — Michael to decide. Framing from the v3 round: German cliff-forest could earn a place in Canopy; Bushranger and fence-line tree may suit Form & Texture if graphic enough; three photos isn't enough to seed a new collection, five collections stays the right number.
- **`film-faces/05-afternoon-rest`** — confirm it belongs on a public site (test: comfortable with a stranger / colleague / wedding enquiry seeing it?). Now doubly worth settling: it is the lead photo of Film & Faces, so it is the image that shows in a link preview when that collection is shared.
- **`film-faces/20-the-car-park`** — neither landscape nor face in a four-photo collection; needs a story that earns its place, or park it in `_holding`.

Both of the performance items that used to sit here are **done** (2026-08-02): the
webfonts are self-hosted from `src/fonts/`, and AVIF ships alongside webp. See the
decisions log.

## Practical facts worth not re-learning

- Full-res library: `photos/<collection>/` in-repo (git-ignored) — master exports live at `F:\Photos\Exports`.
- The Eleventy data global is `portfolio`, not `collections` (reserved name in Eleventy).
- `fixOrientation: true` in `portfolio.js` matters — without it, 180°-flagged originals (film scans) publish upside down.
- CSV/JSON written via PowerShell carry a BOM; the build strips it on read and writes one deliberately so Excel opens `catalogue.csv` as UTF-8.
- Renaming a published photo file orphans its catalogue row (build warns, doesn't fail).
- The first photo in each collection folder is its home-page thumbnail, its Open Graph link-preview image, and (for the first collections) a home hero slide — lead every collection with a strong image.
- Image tiers are `200 / 700 / 1400 / 2200`, in **both webp and avif**. Pick them **by width**, never by array index (`portfolio.js` has named constants for this): inserting the 200 tier silently repointed `display` from 1400 to 700 the first time round.
- eleventy-img **never upscales**: a requested width past the original's is clamped and deduped. So the build's own cache check has to look for the tiers a given photo can actually produce (`tiersFor()`), not for `WIDTHS`. The two 2075px film scans re-ran the full-res watermark composite on every single build until this was fixed.
- `sizes` for the prints is emitted per shape by `portfolio.js` (`PRINT_SIZES`) and read from `data-first-sizes` by `transitions.js`. It used to be hardcoded in two files with comments begging them to stay in sync, and had drifted from what the CSS renders.
- `.print--p` (portrait) needs an explicit `width`, not `auto`. With `width` and `height` both `auto`, a lazy image has no intrinsic size yet, so portrait prints laid out at **0x0** and snapped to full height on decode — a page jump mid-scroll. The width is derived from `--ar`, emitted per photo.
- Anything preloaded or prefetched outside `<picture>` has to choose its own format: `window.MR.avif()` in `flight.js` is the shared probe (`transitions.js`'s warm and the lightbox's large-screen path both use it). Guessing wrong doesn't break anything visible, it just spends the bytes twice.
- `hero.js` must not read layout inside `sync()`. Everything it needs is measured once in `measure()` and cached; a `getComputedStyle` or `getBoundingClientRect` after the frame's style writes forces a synchronous reflow on every scroll frame, which was the long-running mobile jank.
- `src/images/portrait.jpg` is the committed master and is deliberately **not** published; only `portrait.webp` is passed through.
