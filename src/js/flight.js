// Shared FLIP "fly a cloned thumbnail to its destination" animation.
//
// Used by both transitions.js (home -> collection navigation) and
// lightbox.js (print -> lightbox, and the reverse on close) — the two are
// visually identical operations (grow/shrink a background-image clone from
// one live rect to another) so the mechanics live here once.
//
// Two ways of moving the clone, picked per flight:
//
//   transform mode (preferred) — the clone is positioned at its DESTINATION
//   rect and pre-transformed back onto the source rect, then animated to
//   `transform: none`. Runs entirely on the compositor.
//
//   rect mode (fallback) — the old left/top/width/height transition. Layout
//   and paint on every frame, so it stutters on mobile, but it is the only
//   one of the two that survives an aspect-ratio CHANGE without distorting
//   the photo: a uniform scale can't turn a 64x46 cover-cropped thumbnail
//   into a portrait print.
//
// In practice transform mode covers every lightbox open and close (same photo
// at both ends, so the scale is uniform by construction) and any home ->
// collection navigation whose lead photo is roughly 3:2, which the 64x46
// thumbnail already is. Portrait and panoramic lead photos take the fallback.
(function () {
  window.MR = window.MR || {};

  // ---- Shared AVIF support probe -------------------------------------------
  // Photographs ship as <picture> with an AVIF <source> over a webp <img>, so
  // the markup negotiates format by itself. Two places can't use markup and
  // have to ask: transitions.js prefetches with a bare Image(), and lightbox.js
  // assigns .src directly. Picking the wrong ladder there doesn't break
  // anything visible, it just throws the prefetch away and spends the bytes
  // twice. A 1x1 decode settles in about a millisecond, long before any tap.
  var avifOk = false;
  (function () {
    var probe = new Image();
    probe.onload = function () { avifOk = probe.width > 0; };
    probe.src =
      "data:image/avif;base64,AAAAHGZ0eXBhdmlmAAAAAGF2aWZtaWYxbWlhZgAAAOptZXRhAAAAAAAAACFoZGxyAAAAAAAAAABwaWN0AAAAAAAAAAAAAAAAAAAAAA5waXRtAAAAAAABAAAAImlsb2MAAAAAREAAAQABAAAAAAEOAAEAAAAAAAAAFwAAACNpaW5mAAAAAAABAAAAFWluZmUCAAAAAAEAAGF2MDEAAAAAamlwcnAAAABLaXBjbwAAABNjb2xybmNseAABAA0ABoAAAAAMYXYxQ4EgAgAAAAAUaXNwZQAAAAAAAAABAAAAAQAAABBwaXhpAAAAAAMICAgAAAAXaXBtYQAAAAAAAAABAAEEAYIDBAAAAB9tZGF0EgAKBzgABhAQ0GkyCh+QP///xAAAr+4=";
  })();
  // Callers read this at interaction time, never at load time.
  window.MR.avif = function () { return avifOk; };

  // ---- Timings -------------------------------------------------------------
  // Read from the stylesheet rather than hardcoded, so the waits below always
  // match the transition they're waiting on. Under reduced motion the CSS
  // collapses every transition to .001ms, and these used to sit and wait 900ms
  // anyway before cleaning up — a long dead hold for someone who asked for
  // less movement, not more.
  function cssMs(name, fallback) {
    var v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    if (!v) return fallback;
    var n = parseFloat(v);
    if (isNaN(n)) return fallback;
    return /ms$/.test(v) ? n : n * 1000;
  }
  // The CSS values can't change at runtime, but the motion preference can, so
  // that half is re-read per flight rather than latched at load.
  var cssDur = cssMs("--flight-dur", 600);
  var cssFade = cssMs("--flight-fade", 220);
  function isReduced() {
    return !!(
      window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  }
  function durations() {
    return isReduced() ? { dur: 0, fade: 0 } : { dur: cssDur, fade: cssFade };
  }

  // Scale is uniform enough to run on the compositor without visibly
  // squashing the photo. 2% is well below the eye's threshold across a 600ms
  // move and comfortably admits the 64x46 thumb (1.391) standing in for a
  // 3:2 print (1.414).
  var UNIFORM_TOLERANCE = 0.02;

  function isUniform(from, to) {
    if (!from || !to || !to.width || !to.height) return false;
    var sx = from.width / to.width;
    var sy = from.height / to.height;
    return Math.abs(sx - sy) / Math.max(sx, sy) < UNIFORM_TOLERANCE;
  }

  function setRect(el, r) {
    el.style.left = r.left + "px";
    el.style.top = r.top + "px";
    el.style.width = r.width + "px";
    el.style.height = r.height + "px";
  }

  // Re-anchor `el` onto `to` while leaving it looking exactly where it is:
  // it takes the destination's box, plus the transform that maps that box
  // back onto `from`. Done with transitions suppressed and flushed, so the
  // swap is invisible; the caller then animates to `transform: none`.
  function rebase(el, from, to) {
    var prev = el.style.transition;
    el.style.transition = "none";
    setRect(el, to);
    el.style.transform =
      "translate(" +
      (from.left - to.left) +
      "px," +
      (from.top - to.top) +
      "px) scale(" +
      from.width / to.width +
      "," +
      from.height / to.height +
      ")";
    void el.offsetWidth; // flush, so the transform below is a transition not a jump
    el.style.transition = prev;
    el.mrTransform = true;
  }

  // `toRect` is optional: pass it when the destination is already known and
  // the clone can start out in transform mode. start() omits it because it
  // has to put a clone on screen before the destination has laid out.
  function makeClone(src, r, toRect) {
    var c = document.createElement("div");
    c.className = "mr-flight";
    // Quotes and parens in a filename would otherwise close the url() early
    // and the clone would fly blank, with nothing logged anywhere.
    c.style.backgroundImage = 'url("' + String(src).replace(/["\\]/g, "\\$&") + '")';
    setRect(c, r);
    document.body.appendChild(c);
    if (toRect && isUniform(r, toRect)) rebase(c, r, toRect);
    return c;
  }

  // Move a clone to `r`, using whichever mode it was set up for.
  function moveTo(clone, r) {
    if (clone.mrTransform) clone.style.transform = "none";
    else setRect(clone, r);
  }

  // Grows/shrinks a clone of `src` from `fromRect` to getTarget()'s live rect
  // once it exists and has laid out. Every path funnels through finish() so a
  // slow image or a missing target can never strand the clone on screen.
  // Returns a handle with .finish() so a caller can cancel early (e.g. the
  // lightbox stepping to a new photo mid-flight).
  function start(src, fromRect, getTarget, opts) {
    opts = opts || {};
    var t = durations();
    var clone = makeClone(src, fromRect);
    var flight = { done: false, hidden: null };
    function finish() {
      if (flight.done) return;
      flight.done = true;
      if (flight.hidden) {
        flight.hidden.style.visibility = "";
        flight.hidden = null;
      }
      clone.style.opacity = "0";
      setTimeout(function () {
        if (clone.parentNode) clone.remove();
      }, t.fade);
      if (opts.onDone) opts.onDone();
    }
    flight.finish = finish;
    // Watchdog for the wait-for-target phase only. It MUST be cleared once
    // the slide starts: on a slow connection the slide can begin late enough
    // that a still-armed watchdog fires mid-flight, un-hiding the destination
    // image underneath the still-moving clone — the photo visibly doubled.
    var watchdog = setTimeout(finish, opts.maxTotal || 1500);
    var tries = 0;
    (function attempt() {
      if (flight.done) return;
      var el = getTarget();
      // The destination only needs layout, not pixels — width/height
      // attributes give a still-downloading image its correct rect, so the
      // slide starts immediately instead of parking the clone at the origin
      // while the photo downloads. The clone covers the frame until then.
      var r = el ? el.getBoundingClientRect() : null;
      if (r && r.width > 10 && r.height > 10) {
        clearTimeout(watchdog);
        if (opts.hideTarget) {
          el.style.visibility = "hidden";
          flight.hidden = el;
        }
        requestAnimationFrame(function () {
          requestAnimationFrame(function () {
            if (flight.done) return;
            var r2 = el.getBoundingClientRect();
            var t = r2 && r2.width > 10 ? r2 : r;
            // Now that the destination is known, upgrade to the compositor
            // path if the shape allows it. The clone is still sitting on
            // fromRect, so that is what we rebase from.
            if (isUniform(fromRect, t)) rebase(clone, fromRect, t);
            moveTo(clone, t);
            setTimeout(function () {
              // Landed. Hold the clone over the frame until the real image
              // has pixels — finishing sooner would reveal an empty mat.
              var loaded =
                el.complete === undefined ||
                (el.complete && el.naturalWidth > 0);
              if (loaded) return finish();
              var hold = setTimeout(finish, 4000);
              function onSettle() {
                clearTimeout(hold);
                // Exactly one of these fires, so the other would otherwise
                // stay attached to the image for the life of the page.
                el.removeEventListener("load", onSettle);
                el.removeEventListener("error", onSettle);
                finish();
              }
              el.addEventListener("load", onSettle);
              el.addEventListener("error", onSettle);
            }, opts.dur !== undefined ? opts.dur : t.dur);
          });
        });
      } else if (++tries < 90) {
        requestAnimationFrame(attempt);
      } else {
        finish();
      }
    })();
    return flight;
  }

  window.MR.flight = {
    makeClone: makeClone,
    moveTo: moveTo,
    start: start,
    // Exposed so the lightbox's close path — which drives a clone by hand with
    // makeClone/moveTo rather than going through start() — waits on the same
    // numbers, and collapses them under reduced motion the same way.
    durations: durations,
  };
})();
