# Image naming & collections — how photos get onto the site

This explains how photos are organised, what to name the files, and what info to send along with each one. It's written so either of us can follow it.

## How the site works (30 seconds)

- Photos live in folders inside the private `photos/` library — **one folder per collection**.
- The site is rebuilt from those folders: every photo is automatically downsized for the web (the full-resolution originals are never published — that's deliberate download protection).
- The **order of files inside a folder = the order they appear on the page**, sorted by file name. That's why file names start with a number.
- Every photo gets a **REC catalogue number** (001, 002, …) automatically, running across the whole portfolio in collection order. Never put REC numbers in file names — they're assigned by the build and renumber themselves when photos are added or reordered.

## The naming convention

```
NN-short-name.jpg
```

- **`NN`** — two-digit position within the collection: `01`, `02`, `03`… This controls display order. Leave gaps if you like (`05`, `10`, `15`) so photos can be slotted in between later without renaming everything.
- **`short-name`** — two or three lowercase words joined by hyphens, describing the subject or place: `old-growth`, `moss-and-fog`, `red-cliff`. No spaces, no capitals, no apostrophes or other punctuation.

Real examples currently on the site:

```
photos/rainforest/01-old-growth.jpg
photos/rainforest/02-moss-and-fog.jpg
photos/coast/03-red-cliff.jpg
```

The short name doubles as the photo's fallback title (`02-moss-and-fog` → "Moss and fog") until a proper title is written in the caption sheet, so pick something you wouldn't mind being seen.

**File formats:** JPEG, PNG, TIFF, or WebP. Send the biggest version available — full resolution is fine and preferred, since the site downsizes automatically and never publishes the original.

**Renaming after publishing:** avoid it. The caption sheet links each photo to its file name, so a rename orphans the photo's title/location/year (the build warns when this happens, so it's fixable — just messy).

## The collections

| Folder | Shown on site as | What belongs in it |
|---|---|---|
| `rainforest` | Rainforest | Rainforest and waterfalls — wet gullies, green light, canopy, fog. Any rainforest, anywhere |
| `dawn-dusk` | Dawn & Dusk | Sunrise and sunset over big country — named for the light, not the terrain, so a Flinders shot and a Glass House shot both belong |
| `coast` | Coast | Coastline and beach — headlands, pandanus, long water |
| `black-and-white` | Black & White | B&W work — long exposures, shape and surface. Defined by treatment, not place |
| `people` | People | Portraits, weddings, friends — film and digital together (currently empty, so hidden on the site until it has photos) |

**Sorting a new photo:** black & white or people win first; otherwise sort by what it is — rainforest/waterfall, coast, or dawn/dusk light over anything else. Film isn't a bucket — a 35mm landscape goes in its landscape collection, film portraits go in People. If something genuinely doesn't fit anywhere, don't force it — a new collection is easy to add (new folder + one config entry), just say what it should be called.

**Order within a collection matters twice:** it's the page order, and the first photo in a collection is also its thumbnail on the home page. The home page hero rotates through photos from the first collections, so lead each collection with a strong image.

## What to send with each photo

Up to four details per photo, for the caption shown under it on the site:

1. **Title** — 2–4 words, naming a thing in the frame or a condition it was shot in (e.g. "Old growth"), never a feeling
2. **Location** — real, specific place name ("Binna Burra", not "Scenic Rim")
3. **Year** — when it was taken
4. **Story** *(optional)* — one dry sentence in your voice, shown under the caption (the walk in, the leech count, why you went back four times). Best ratio is about one photo in three; leave the rest blank

Photos don't need to arrive pre-named or pre-sorted — a folder of images plus a note of which collection each belongs to (and the three details above) is enough; the renaming can happen at this end. These details go into the caption sheet (`photos/catalogue.csv`), which the build keeps in sync automatically: any new photo dropped into a folder gets a blank row added, ready to fill in.
