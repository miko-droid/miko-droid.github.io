// The portfolio, assembled at build time from the private photos/ library.
//
// Michael drops full-resolution originals into photos/<collection>/ (folders and
// order defined in photos/portfolio.config.json). On every build this file:
//   1. reads each collection folder in order,
//   2. stamps a quiet "© MICHAEL ROBINSON" into the bottom-right corner of
//      the pixels themselves (see markSvg below),
//   3. downsizes every original to web-resolution webp (max 2200px) with
//      @11ty/eleventy-img — the full-res files are NEVER published, so the
//      largest image anyone can pull from the site is a downsized,
//      watermarked copy,
//   4. detects orientation from the real pixel dimensions,
//   5. hides any collection that has no photos yet.
//
// (A continuous "REC" catalogue number used to be assigned here. It was never
// rendered anywhere and was dropped on 2026-07-31 — see purpose/PURPOSE.md.)
//
// Caption data (title/location/year) and Michael's own tracking notes live in
// one spreadsheet, photos/catalogue.csv — see loadCatalogue below. Any photo
// found on disk without a row yet gets one appended automatically (blank,
// status "new"), so the sheet always catches up with what's actually on disk.
//
// Originals live outside src/ and are git-ignored; only the downsized webp in
// _site/img/ ship. See README.md for the upload flow.

const fs = require("fs");
const os = require("os");
const path = require("path");
const Image = require("@11ty/eleventy-img");
const sharp = require("sharp");

const PHOTOS_DIR = path.join(__dirname, "..", "..", "photos");
const CATALOGUE_PATH = path.join(PHOTOS_DIR, "catalogue.csv");
// "story" sits last: parseCsvLine reads positionally, so appending keeps
// pre-story rows parse-compatible.
const CATALOGUE_FIELDS = ["collection", "filename", "title", "location", "year", "status", "notes", "story"];
const OUTPUT_DIR = "_site/img";
const URL_PATH = "/img/";
// thumb / display / lightbox / hero — no full-res. Everything, the home hero
// included, is capped at 2200. The 3200 tier was dropped 2026-08-02: it only
// ever won on desktop, where `sizes="100vw"` made it the LCP at up to 3.5MB
// for one photograph (1.86MB for the hero on a 1440x900 laptop, plus another
// 950KB for the two slideshow images behind it). A 2200 across a 1440 CSS-px
// viewport is still ~1.5x, and phones never picked 3200 at all. The 200 tier
// is only ever the home page's 64x46 collection thumbnails, which used to be
// served the 700 (five of them, on the page most likely to be opened on a
// phone).
const WIDTHS = [200, 700, 1400, 2200];
// webp is the baseline; avif rides alongside it in a <source> and is ~30%
// lighter for these photographs. Order matters only for readability - the
// templates decide precedence.
const FORMATS = ["webp", "avif"];
const WEB_MAX = 2200;
// Named tiers, so inserting a width can't silently change which file a field
// points at. `display` in particular was `web[1]`, which meant 1400 before the
// 200 tier existed and would have become 700 after it.
const THUMB_W = 200;
const DISPLAY_W = 1400;
// The thumbnail is far too small to be a candidate for any print `sizes`
// value; leaving it in the srcset only risks a browser picking it.
const SRCSET_MIN = 700;
const IMG_RE = /\.(jpe?g|png|tiff?|webp)$/i;
// The `sizes` attribute for each print shape, derived from the widths the CSS
// actually renders (.print--l/--pano/--p in style.css). Emitted with the image
// so the templates and transitions.js's warm() prefetch can never drift apart:
// they all read this string rather than each hardcoding their own copy, which
// is how a print ended up advertising 90vw while the CSS drew it at 86vw.
const PRINT_SIZES = {
  l: "(max-width: 820px) 86vw, 760px",
  pano: "(max-width: 820px) 92vw, 960px",
  // Portrait prints are height-capped (max-height: min(70svh, 680px)), so the
  // rendered width depends on the photo's ratio; 680 is the tallest it gets.
  p: "(max-width: 820px) 86vw, 680px",
};

// "01-old-growth" -> "Old growth"
function titleFromName(name) {
  const cleaned = name.replace(/^\d+[-_.\s]*/, "").replace(/[-_]+/g, " ").trim();
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

function readJson(file, fallback) {
  try {
    // Strip a leading BOM — files saved via PowerShell's `-Encoding utf8`
    // carry one, and JSON.parse throws on it (silently landing here as a
    // parse failure otherwise, discarding every caption in the file).
    let text = fs.readFileSync(file, "utf8");
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
    return JSON.parse(text);
  } catch (e) {
    return fallback;
  }
}

// ---- catalogue.csv --------------------------------------------------------
// A small, hand-rolled CSV reader/writer — no dependency needed for a file
// this size. Fields are always quoted on write so commas and apostrophes
// ("D'Aguilar Range, Scenic Rim") round-trip safely.
function parseCsvLine(line) {
  const fields = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      fields.push(cur);
      cur = "";
    } else {
      cur += c;
    }
  }
  fields.push(cur);
  return fields;
}

function csvField(v) {
  return '"' + String(v == null ? "" : v).replace(/"/g, '""') + '"';
}

// Keyed by "<collection dir>/<filename without extension>". Existing rows
// keep their place in the sheet; new photos are appended when found.
function loadCatalogue() {
  const map = new Map();
  if (!fs.existsSync(CATALOGUE_PATH)) return map;
  let text = fs.readFileSync(CATALOGUE_PATH, "utf8");
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const lines = text.split(/\r\n|\n/).filter((l) => l.length > 0);
  for (let i = 1; i < lines.length; i++) {
    // skip the header row
    const [collection, filename, title, location, year, status, notes, story] = parseCsvLine(lines[i]);
    if (!collection || !filename) continue;
    map.set(collection + "/" + filename, {
      collection,
      filename,
      title: title || "",
      location: location || "",
      year: year || "",
      status: status || "",
      notes: notes || "",
      story: story || "",
    });
  }
  return map;
}

function saveCatalogue(map) {
  const lines = [CATALOGUE_FIELDS.map(csvField).join(",")];
  for (const entry of map.values()) {
    lines.push(CATALOGUE_FIELDS.map((f) => csvField(entry[f])).join(","));
  }
  // Leading BOM: not for us (we strip it on read) but so Excel opens the
  // file as UTF-8 instead of guessing Windows-1252 and mangling names.
  fs.writeFileSync(CATALOGUE_PATH, "﻿" + lines.join("\r\n") + "\r\n", "utf8");
}

// ---- Watermark -------------------------------------------------------------
// Michael's signature sits in the bottom-right of every published image —
// composited onto the full-res original BEFORE downsizing, so the mark scales
// with the photo, lands in every srcset tier identically, and can't be
// avoided by fetching a different size. White ink over a soft dark shadow so
// it reads on both bright skies and rainforest shadow. Sized off the frame's
// SHORT side (~11%) so portraits and landscapes carry the same visual weight —
// width-based sizing left portrait marks looking half-size.
//
// The source is photos/signature.png (black ink on white) — private like the
// rest of photos/; only the baked-in mark ever ships. If the file is missing
// the old "© MICHAEL ROBINSON" text mark is used so a bare checkout still
// builds.
const SIGNATURE_PATH = path.join(PHOTOS_DIR, "signature.png");
const MARK_TEXT = "© MICHAEL ROBINSON";

// Flattened, trimmed to the ink, inverted: stroke darkness becomes an alpha
// mask (black ink -> opaque, white paper -> transparent). Loaded once.
let signaturePromise;
function loadSignatureMask() {
  if (!signaturePromise) {
    signaturePromise = fs.existsSync(SIGNATURE_PATH)
      ? sharp(SIGNATURE_PATH)
          .flatten({ background: "#ffffff" })
          .greyscale()
          .trim()
          .negate()
          .png()
          .toBuffer()
      : Promise.resolve(null);
  }
  return signaturePromise;
}

// The two composite layers for one photo: a blurred dark shadow and the white
// signature, both cut from the same alpha mask so they register exactly.
async function signatureLayers(mask, width, height) {
  const short = Math.min(width, height);
  const targetW = Math.round(short * 0.11);
  const pad = Math.round(short * 0.025);
  const off = Math.max(1, Math.round(targetW * 0.012));

  const alpha = await sharp(mask).resize(targetW).png().toBuffer();
  const { width: w, height: h } = await sharp(alpha).metadata();

  // linear() scales the mask's values, i.e. the layer's opacity.
  const tint = async (rgb, opacity, blur) => {
    let a = sharp(alpha).linear(opacity, 0);
    if (blur) a = a.blur(blur);
    return sharp({ create: { width: w, height: h, channels: 3, background: rgb } })
      .joinChannel(await a.png().toBuffer())
      .png()
      .toBuffer();
  };
  const [shadow, ink] = await Promise.all([
    tint("#000000", 0.35, Math.max(0.5, targetW * 0.006)),
    tint("#ffffff", 0.55),
  ]);

  const left = width - pad - w;
  const top = height - pad - h;
  return [
    { input: shadow, left: left + off, top: top + off },
    { input: ink, left, top },
  ];
}

function markSvg(width, height) {
  const font = Math.round(width * 0.012);
  const pad = Math.round(width * 0.018);
  const spacing = (font * 0.14).toFixed(1);
  const off = Math.max(1, Math.round(font * 0.05));
  const text = (dx, dy, fill, opacity) =>
    `<text x="${width - pad + dx}" y="${height - pad + dy}" text-anchor="end" ` +
    `font-family="Arial, Helvetica, sans-serif" font-size="${font}" ` +
    `letter-spacing="${spacing}" fill="${fill}" fill-opacity="${opacity}">${MARK_TEXT.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</text>`;
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">` +
      text(off, off, "#000000", "0.3") +
      text(0, 0, "#ffffff", "0.5") +
      `</svg>`
  );
}

// Rotate() first bakes any EXIF orientation into the pixels (the reason the
// old pipeline passed fixOrientation to eleventy-img — the intermediate
// carries no EXIF, so the correction has to happen here now). High-quality
// jpeg as the intermediate: it only lives for the handoff to eleventy-img's
// webp encode. Written to a TEMP FILE, not passed as a buffer — eleventy-img
// pins buffer inputs in its in-memory cache, which OOMs node on a library of
// full-res originals; path inputs stay light.
async function watermarked(file, tmpPath) {
  const oriented = await sharp(file).rotate().toBuffer();
  const meta = await sharp(oriented).metadata();
  const mask = await loadSignatureMask();
  const layers = mask
    ? await signatureLayers(mask, meta.width, meta.height)
    : [{ input: markSvg(meta.width, meta.height), top: 0, left: 0 }];
  await sharp(oriented).composite(layers).jpeg({ quality: 95 }).toFile(tmpPath);
  return tmpPath;
}

// eleventy-img metadata -> the work's image fields. `webp` is the baseline
// every browser gets; `avif` is the same ladder ~30% lighter, offered through
// a <source> so anything that can't decode it silently falls back.
function shapeImage(sizes, avifSizes) {
  const web = sizes.filter((s) => s.width <= WEB_MAX);
  const largest = web[web.length - 1] || sizes[sizes.length - 1];
  // Pick by width, never by index — see the tier constants above.
  const at = (w) => sizes.find((s) => s.width === w) || largest;
  const prints = web.filter((s) => s.width >= SRCSET_MIN);
  const ratio = largest.width / largest.height;
  const o = ratio > 1.7 ? "pano" : ratio < 0.9 ? "p" : "l";
  const setOf = (list) => {
    const w = list.filter((s) => s.width <= WEB_MAX);
    const p = w.filter((s) => s.width >= SRCSET_MIN);
    return (p.length ? p : w).map((s) => `${s.url} ${s.width}w`).join(", ");
  };
  const avif = avifSizes || [];
  const avifLargest = avif.filter((s) => s.width <= WEB_MAX).pop();
  return {
    thumb: at(THUMB_W).url,
    thumbAvif: (avif.find((s) => s.width === THUMB_W) || {}).url || "",
    display: at(DISPLAY_W).url,
    full: largest.url,
    fullAvif: (avifLargest || {}).url || "",
    // One srcset for every context now that the hero shares the 2200 ceiling.
    // (There used to be a separate `heroSrcset` carrying the 3200 tier.)
    srcset: setOf(sizes),
    srcsetAvif: avif.length ? setOf(avif) : "",
    sizes: PRINT_SIZES[o],
    width: largest.width,
    height: largest.height,
    // Emitted into the print's style attribute so the CSS can give portrait
    // prints a definite width. See .print--p in style.css.
    ratio: Math.round(ratio * 10000) / 10000,
    o,
  };
}

// eleventy-img never upscales: a requested width past the original's is
// clamped to the original, and duplicates collapse. So the tiers a photo
// actually produces depend on its own width, and the cache check below has to
// look for those rather than for WIDTHS. Getting this wrong is not theoretical:
// the two 2075px film scans could never satisfy a check that wanted a 2200
// file, so they re-ran the full-res watermark composite on every single build.
// Reads the header only, not the pixels, so it stays cheap on 80MB originals.
async function tiersFor(file) {
  const m = await sharp(file).metadata();
  // watermarked() bakes EXIF orientation in with .rotate() before eleventy-img
  // sees the file, so the width that matters is the oriented one.
  const srcW = m.orientation && m.orientation >= 5 ? m.height : m.width;
  return [...new Set(WIDTHS.map((w) => Math.min(w, srcW)))];
}

async function processImage(file, slug) {
  const base = path.basename(file, path.extname(file));
  const outName = (w, f) => `${slug}-${base}-${w}.${f}`;

  // Fast path: the watermark composite happens before eleventy-img ever sees
  // the image, so its own output-exists check can't save us from re-running
  // it (full-res composite + encode, seconds per photo) on every build. If
  // every tier this photo can produce, in every format, is already on disk,
  // reuse them.
  const widths = await tiersFor(file);
  const pathsFor = (f) => widths.map((w) => path.join(OUTPUT_DIR, outName(w, f)));
  if (FORMATS.every((f) => pathsFor(f).every((p) => fs.existsSync(p)))) {
    const read = async (f) =>
      Promise.all(
        pathsFor(f).map(async (p, i) => {
          const m = await sharp(p).metadata();
          return { url: URL_PATH + outName(widths[i], f), width: m.width, height: m.height };
        })
      );
    return shapeImage(await read("webp"), await read("avif"));
  }

  const tmpPath = path.join(os.tmpdir(), `mr-watermark-${slug}-${base}.jpg`);
  try {
    const metadata = await Image(await watermarked(file, tmpPath), {
      widths: WIDTHS,
      formats: FORMATS,
      outputDir: OUTPUT_DIR,
      urlPath: URL_PATH,
      // avif at 50 is the sweet spot for these photographs: ~30% under the
      // webp at visually the same quality. At 65 it comes out *larger* than
      // the webp, which is the whole reason for pinning it explicitly.
      sharpAvifOptions: { quality: 50, effort: 4 },
      // stable, readable output names: rainforest-old-growth-1400.webp
      filenameFormat: (id, src, width, format) => `${slug}-${base}-${width}.${format}`,
    });
    return shapeImage(metadata.webp, metadata.avif);
  } finally {
    fs.rmSync(tmpPath, { force: true });
  }
}

module.exports = async function () {
  if (!fs.existsSync(PHOTOS_DIR)) return [];
  const config = readJson(path.join(PHOTOS_DIR, "portfolio.config.json"), {
    collections: [],
  });

  const catalogue = loadCatalogue();
  let catalogueChanged = false;

  const out = [];

  for (const col of config.collections) {
    const dir = path.join(PHOTOS_DIR, col.dir);
    if (!fs.existsSync(dir)) continue;

    const files = fs
      .readdirSync(dir)
      .filter((f) => IMG_RE.test(f))
      .sort();
    if (!files.length) continue; // hide empty collections

    const works = [];

    for (const file of files) {
      const base = path.basename(file, path.extname(file));
      const key = col.dir + "/" + base;
      let entry = catalogue.get(key);
      if (!entry) {
        entry = {
          collection: col.dir,
          filename: base,
          title: "",
          location: "",
          year: "",
          status: "new",
          notes: "",
          story: "",
        };
        catalogue.set(key, entry);
        catalogueChanged = true;
      }

      const img = await processImage(path.join(dir, file), col.slug);
      works.push({
        title: entry.title || titleFromName(base),
        loc: entry.location,
        year: entry.year,
        // Right-hand caption: "LOCATION · YEAR", gracefully dropping either.
        meta: [entry.location, entry.year].filter(Boolean).join(" · "),
        story: entry.story,
        ...img,
      });
    }

    out.push({
      slug: col.slug,
      name: col.name,
      note: col.note,
      intro: col.intro,
      count: works.length,
      works,
    });
  }

  // Flag rows whose photo has disappeared (renamed/moved/deleted) instead of
  // silently dropping them — could be a mistake, could be mid-reorganisation.
  const missing = [];
  for (const [key, entry] of catalogue) {
    const dir = path.join(PHOTOS_DIR, entry.collection);
    const stillThere =
      fs.existsSync(dir) &&
      fs.readdirSync(dir).some((f) => path.basename(f, path.extname(f)) === entry.filename);
    if (!stillThere) missing.push(key);
  }
  if (missing.length) {
    console.warn(
      `[portfolio] catalogue.csv has ${missing.length} row(s) with no matching file on disk: ${missing.join(", ")}`
    );
  }

  if (catalogueChanged) {
    saveCatalogue(catalogue);
    console.log("[portfolio] catalogue.csv: added new photo(s) — fill in title/location/year at photos/catalogue.csv");
  }

  return out;
};
