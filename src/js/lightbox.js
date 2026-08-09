// Lightbox for the collection prints.
//
// Click a matted print to open it fullscreen; arrows / ← → cycle within the
// collection; Esc or a background click closes. Opening and closing "fly" a
// clone of the image between the thumbnail and the fullscreen position (FLIP),
// with a guaranteed cleanup path so a slow-loading image can never strand the
// animation. Ported from the Claude Design "Portfolio v5" lightbox logic.
(function () {
  var box = document.querySelector("[data-lightbox]");
  if (!box) return;

  var imgEl = box.querySelector("[data-lightbox-img]");
  var titleEl = box.querySelector("[data-lightbox-title]");
  var locEl = box.querySelector("[data-lightbox-loc]");
  var storyEl = box.querySelector("[data-lightbox-story]");
  var countEl = box.querySelector("[data-lightbox-count]");
  var closeBtn = box.querySelector("[data-lightbox-close]");
  var prevBtn = box.querySelector("[data-lightbox-prev]");
  var nextBtn = box.querySelector("[data-lightbox-next]");

  var reduced =
    window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Rebuilt every time the print buttons in <main> change — including right
  // after transitions.js swaps in a new page client-side, when a fresh set of
  // [data-print] elements exists but never had listeners of its own.
  var items = [];
  function bindPrints() {
    items = Array.prototype.slice
      .call(document.querySelectorAll("[data-print]"))
      .map(function (el) {
        return {
          el: el,
          src: el.getAttribute("data-src"),
          srcAvif: el.getAttribute("data-src-avif"),
          display: el.getAttribute("data-display"),
          title: el.getAttribute("data-title") || "",
          meta: el.getAttribute("data-meta") || "",
          story: el.getAttribute("data-story") || "",
        };
      });
    items.forEach(function (it, i) {
      // Idempotent: today this is only ever called against freshly-swapped
      // nodes, so a second call couldn't double-bind. That's an invariant
      // living in another file, and a double-bound print opens the lightbox
      // twice per tap.
      if (it.el.mrBound) return;
      it.el.mrBound = true;
      it.el.addEventListener("click", function (ev) {
        ev.preventDefault();
        openAt(items.indexOf(it), ev);
      });
    });
  }

  // ---- Page scroll lock ----------------------------------------------------
  // `html { overflow: hidden }` alone was not enough. It leaves the document
  // programmatically scrollable, it does not survive iOS Safari's rubber-band
  // reliably, and above all it does not REMEMBER anything: scroll away behind
  // an open lightbox and closing it drops you somewhere else entirely.
  // Pinning the body at a negative offset holds the page exactly where it was,
  // visually unchanged, and restores it on the way out.
  var lockedY = 0;
  var locked = false;
  function lockScroll() {
    if (locked) return;
    locked = true;
    lockedY = window.scrollY;
    var s = document.body.style;
    s.position = "fixed";
    s.top = -lockedY + "px";
    s.left = "0";
    s.right = "0";
    s.width = "100%";
    // The scrollbar disappearing would otherwise shift the whole page
    // sideways under a backdrop you can see through. On touch there is no
    // scrollbar to lose (and style.css deliberately keeps scrollbar-gutter
    // off there), so this only applies where one exists.
    document.documentElement.style.overflow = "hidden";
  }
  function unlockScroll() {
    if (!locked) return;
    locked = false;
    var s = document.body.style;
    s.position = "";
    s.top = "";
    s.left = "";
    s.right = "";
    s.width = "";
    document.documentElement.style.overflow = "";
    // `instant`, or html { scroll-behavior: smooth } animates the restore and
    // the fly-back below measures a moving target.
    window.scrollTo({ top: lockedY, left: 0, behavior: "instant" });
  }

  var idx = -1;
  var open = false;
  var closing = false;
  var lastNav = 0;
  var flights = [];
  // Both of these outlive the interaction that armed them, so every entry
  // point has to be able to cancel them (see clearTimers).
  var unhideTimer = null; // openAt's belt-and-braces un-hide
  var closeTimer = null; // close()'s deferred finish()

  function clearTimers() {
    if (unhideTimer) {
      clearTimeout(unhideTimer);
      unhideTimer = null;
    }
    if (closeTimer) {
      clearTimeout(closeTimer);
      closeTimer = null;
    }
  }

  // One guard for all pointer-driven navigation (open, prev/next click,
  // swipe) — a swipe's synthetic click, or any other double-fire, lands
  // inside the window and is dropped. Keyboard arrows bypass it on purpose:
  // rapid keyboard stepping is safe (swapFull's token supersedes stale
  // decodes) and throttling it feels broken.
  function navGuard() {
    var now = Date.now();
    if (now - lastNav < 300) return false;
    lastNav = now;
    return true;
  }

  // ---- FLIP clone helpers --------------------------------------------------
  function killFlights() {
    flights.slice().forEach(function (f) {
      f.finish();
    });
    flights = [];
  }

  // The on-page print currently "picked up" into the lightbox — hidden so its
  // matt sits empty in the grid instead of the photo just sitting there
  // visible behind the (not fully opaque) backdrop. Only ever one at a time;
  // switching to a different photo puts the previous one back automatically.
  var pickedUp = null;
  function pickUp(img) {
    if (pickedUp && pickedUp !== img) pickedUp.style.visibility = "";
    pickedUp = img || null;
    if (pickedUp) pickedUp.style.visibility = "hidden";
  }
  function putBack() {
    if (pickedUp) pickedUp.style.visibility = "";
    pickedUp = null;
  }

  function startFlight(src, fromRect, getTarget, opts) {
    opts = opts || {};
    var onDone = opts.onDone;
    var flight = window.MR.flight.start(src, fromRect, getTarget, {
      hideTarget: opts.hideTarget,
      maxTotal: opts.maxTotal,
      dur: opts.dur,
      onDone: function () {
        flights = flights.filter(function (f) {
          return f !== flight;
        });
        if (onDone) onDone();
      },
    });
    flights.push(flight);
  }

  // ---- Rendering -----------------------------------------------------------
  var renderToken = 0;

  // Captions only — the image itself is managed by openAt (seed + upgrade) and
  // step (decode-swap), so the two paths can size and animate independently.
  function render() {
    var it = items[idx];
    if (!it) return;
    imgEl.alt = it.title;
    titleEl.textContent = it.title.toUpperCase();
    locEl.textContent = it.meta.toUpperCase();
    if (storyEl) {
      // Sentence case on purpose — the story is a line in Michael's voice,
      // not catalogue data like the title/location above it.
      storyEl.textContent = it.story;
      storyEl.hidden = !it.story;
    }
    countEl.textContent = idx + 1 + " / " + items.length;
  }

  // Decode `src` off-screen, then swap it into the main image. Guarded by a
  // token so a newer navigation supersedes a slow decode (no blank flash — the
  // current frame holds until the next is ready). `animClass` optionally plays
  // a fade once the new frame lands (used when stepping).
  function swapFull(src, animClass) {
    var token = ++renderToken;
    var pre = new Image();
    pre.src = src;
    var apply = function () {
      if (token !== renderToken) return;
      if (imgEl.getAttribute("src") !== src) imgEl.src = src;
      imgEl.classList.remove("is-fade");
      if (animClass) {
        void imgEl.offsetWidth; // restart the fade animation
        imgEl.classList.add(animClass);
      }
    };
    if (pre.decode) pre.decode().then(apply).catch(apply);
    else if (pre.complete) apply();
    else {
      pre.onload = apply;
      pre.onerror = apply;
    }
  }

  function setAspect(imgForRatio) {
    // Fall back to the width/height attributes when the on-page print hasn't
    // loaded yet (stepping fast into lazy territory) — without a real ratio
    // the frame snaps to the 1.5 default and the photo distorts to fill it.
    var w =
      imgForRatio &&
      (imgForRatio.naturalWidth || +imgForRatio.getAttribute("width"));
    var h =
      imgForRatio &&
      (imgForRatio.naturalHeight || +imgForRatio.getAttribute("height"));
    if (w && h) imgEl.style.setProperty("--ar", w / h);
    else imgEl.style.removeProperty("--ar");
  }

  // On phones the lightbox shows the photo at ~92vw — essentially the same
  // size as the in-page print (86vw `sizes`), so the print's own srcset pick
  // is already the right resolution AND usually cached from scrolling. The
  // 2200px `full` (~2x the bytes) is only worth decoding on large screens.
  //
  // `currentSrc` on the phone path already reflects whatever the <picture>
  // negotiated, so it is AVIF for free. The large-screen path assigns .src
  // directly with no <picture> to negotiate for it, so it has to ask.
  function bestSrc(it) {
    if (!(window.matchMedia && matchMedia("(max-width: 820px)").matches)) {
      return (window.MR.avif() && it.srcAvif) || it.src;
    }
    var im = it.el.querySelector("img");
    return (im && im.currentSrc) || it.display || it.src;
  }

  // Warm the neighbours so left/right feel instant.
  function warmNeighbours() {
    [idx - 1, idx + 1].forEach(function (k) {
      var n = items[(k + items.length) % items.length];
      if (n) {
        var warm = new Image();
        warm.src = bestSrc(n);
      }
    });
  }

  function openAt(i, ev) {
    if (!navGuard()) return;
    killFlights();
    // A close still in its 600ms fly-back would otherwise run finish() on top
    // of the lightbox we're about to open — hiding it again and unlocking the
    // page a moment after it appeared. Land that close now instead of racing
    // it. (navGuard's 300ms window is shorter than the close, so it can't
    // catch this on its own.)
    if (closing) finishClose();
    clearTimers();
    idx = i;
    open = true;
    closing = false;
    render();
    warmNeighbours();
    box.classList.remove("is-closing");
    box.hidden = false;
    lockScroll();
    if (closeBtn) closeBtn.focus({ preventScroll: true });

    var srcImg =
      ev && ev.currentTarget
        ? ev.currentTarget.querySelector("img")
        : items[i].el.querySelector("img");

    pickUp(srcImg); // the matt goes empty right away, like the print's been lifted off it

    // Fix the frame's aspect ratio from the already-loaded on-page thumbnail
    // rather than letting the <img>'s own intrinsic resolution size the box —
    // otherwise the frame visibly resizes the moment the full-res swap below
    // lands, even though it's the same photo at the same shape throughout.
    setAspect(srcImg);

    // Seed the lightbox with the print's ALREADY-LOADED image. It's cached
    // (so it lays out instantly instead of stalling the animation on the
    // full-res download); full-res is upgraded once settled. On phones
    // bestSrc IS the seed, so no upgrade fetch/decode happens at all.
    var full = bestSrc(items[i]);
    var seed = (srcImg && srcImg.currentSrc) || full;
    ++renderToken; // supersede any in-flight swap from the previous photo
    imgEl.classList.remove("is-fade");
    imgEl.src = seed;

    var fr = srcImg ? srcImg.getBoundingClientRect() : null;
    if (reduced || !fr || fr.width < 4) {
      if (seed !== full) swapFull(full, ""); // no flight — just upgrade quietly
      return;
    }

    imgEl.style.visibility = "hidden";
    startFlight(
      seed,
      fr,
      function () {
        return imgEl;
      },
      {
        hideTarget: true,
        maxTotal: 1300,
        onDone: function () {
          imgEl.style.visibility = "";
          if (seed !== full) swapFull(full, ""); // upgrade after the morph
        },
      }
    );
    // Belt-and-braces: never leave the main image hidden. Must comfortably
    // outlast the flight's wait phase (maxTotal 1300) PLUS the 660ms slide,
    // or it un-hides the target mid-flight and the photo shows doubled. Held
    // in unhideTimer because it also has to be cancelled across interactions:
    // open -> close -> reopen inside 2.4s used to let the FIRST open's timer
    // fire during the SECOND open's flight, showing the photo twice.
    unhideTimer = setTimeout(function () {
      unhideTimer = null;
      imgEl.style.visibility = "";
    }, 2400);
  }

  function step(d) {
    if (closing) return;
    // Don't drop the tap because the opening flight (up to ~2s on a slow
    // connection) hasn't landed — cancel it and step; reads as a freeze
    // otherwise. killFlights() finishes the flight cleanly (restores the
    // hidden image), and swapFull's token supersedes its pending upgrade.
    if (flights.length) killFlights();
    // The opening flight is gone, so its un-hide safety net is moot — and
    // leaving it armed would fire mid-step.
    clearTimers();
    imgEl.style.visibility = "";
    idx = (idx + d + items.length) % items.length;
    render();
    warmNeighbours();
    var stepImg = items[idx].el.querySelector("img");
    setAspect(stepImg);
    pickUp(stepImg); // put the previous photo's matt back, empty this one's
    swapFull(bestSrc(items[idx]), reduced ? "" : "is-fade");
  }

  // The tail of close(), split out so it can be landed early: reopening while
  // a close is still flying used to leave the old close's timer to fire on top
  // of the new lightbox. Module-scoped state (rather than closure state) is
  // what makes that possible.
  var closeClone = null;
  var closeItem = null;

  function finishClose(skipFocus) {
    if (!closing) return;
    clearTimers();
    open = false;
    closing = false;
    box.hidden = true;
    box.classList.remove("is-closing");
    imgEl.style.visibility = "";
    if (closeClone) {
      if (closeClone.parentNode) closeClone.remove();
      closeClone = null;
    }
    putBack(); // the matt gets its photo back once it's landed
    // Skipped when openAt is landing this close on its way in — it is about to
    // focus the close button itself, and focusing the print first would flash
    // a focus ring on the way past.
    if (!skipFocus && closeItem && closeItem.el)
      closeItem.el.focus({ preventScroll: true });
    closeItem = null;
  }

  function close() {
    if (!open || closing) return;
    killFlights();
    clearTimers();
    closing = true;
    box.classList.add("is-closing");
    // Unlock immediately rather than inside finishClose: the fade-out is
    // pointer-events:none, so holding the page locked for another 600ms only
    // means a scroll gesture during the close does nothing. Unlocking here
    // also means the fly-back below measures the print at its real resting
    // position.
    unlockScroll();

    var it = items[idx];
    closeItem = it;
    var tgtImg = it ? it.el.querySelector("img") : null;
    var tr = null;
    if (tgtImg) {
      var r = tgtImg.getBoundingClientRect();
      if (r.bottom > 60 && r.top < window.innerHeight - 60) tr = r;
    }
    var t = window.MR.flight.durations();
    if (reduced || !t.dur || !tr) {
      // No fly-back: just let the backdrop fade out. Zero under reduced
      // motion, where the CSS has collapsed that fade to nothing and any wait
      // here is a dead hold on a closed lightbox.
      closeTimer = setTimeout(finishClose, t.dur ? 320 : 0);
      return;
    }
    var fr = imgEl.getBoundingClientRect();
    imgEl.style.visibility = "hidden";
    closeClone = window.MR.flight.makeClone(imgEl.currentSrc || it.src, fr, tr);
    var clone = closeClone;
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        if (closeClone === clone) window.MR.flight.moveTo(clone, tr);
      });
    });
    closeTimer = setTimeout(function () {
      closeTimer = null;
      // Landed. Put the photo back on its matt BEFORE fading the clone, never
      // after: the clone is sitting exactly on the print's rect by now, so the
      // real image appearing underneath it is invisible, and the fade then
      // dissolves one photo into an identical one. Leaving it to finishClose
      // (which also calls putBack, harmlessly, a second time) meant the clone
      // spent its whole 220ms fade dissolving into an EMPTY matt — the photo
      // washed out to bone white and then snapped back on. Same ordering the
      // opening flight uses in flight.js's finish().
      putBack();
      clone.style.opacity = "0";
      // Let the opacity transition play before finishClose removes the node.
      closeTimer = setTimeout(finishClose, t.fade);
    }, t.dur);
  }

  // ---- Wiring --------------------------------------------------------------
  bindPrints();
  window.MR = window.MR || {};
  window.MR.rebindLightbox = bindPrints;

  box.addEventListener("click", function (e) {
    if (e.target.closest("[data-lightbox-meta]")) return;
    if (e.target.closest("button")) return;
    close();
  });
  if (closeBtn)
    closeBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      close();
    });
  if (prevBtn)
    prevBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      if (navGuard()) step(-1);
    });
  if (nextBtn)
    nextBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      if (navGuard()) step(1);
    });

  window.addEventListener("keydown", function (e) {
    if (!open) return;
    if (e.key === "Escape") return close();
    if (e.key === "ArrowRight") return step(1);
    if (e.key === "ArrowLeft") return step(-1);
    if (e.key !== "Tab") return;
    // Focus trap. The dialog is only ever these three buttons, so cycling
    // them by hand beats a general tabbable-node query. Without it, Tab off
    // the last button walks into the scroll-locked page behind the overlay.
    var focusable = [prevBtn, nextBtn, closeBtn].filter(Boolean);
    if (!focusable.length) return;
    var i = focusable.indexOf(document.activeElement);
    var next = e.shiftKey ? i - 1 : i + 1;
    if (i === -1) next = e.shiftKey ? focusable.length - 1 : 0;
    else if (next < 0) next = focusable.length - 1;
    else if (next >= focusable.length) next = 0;
    e.preventDefault();
    focusable[next].focus();
  });

  // Touch: swipe left/right steps through the collection, same as the arrow
  // keys. Browsers only suppress a swipe's synthetic click for scroll
  // gestures — with the page scroll-locked behind the lightbox, a horizontal
  // swipe still dispatches a click where the finger lifted (a nav button →
  // second step, the backdrop → close), so a handled swipe must
  // preventDefault to cancel it. touchend isn't scroll-blocking, so the
  // non-passive listener costs nothing; touchstart stays passive.
  var touchX = null;
  var touchY = null;
  box.addEventListener(
    "touchstart",
    function (e) {
      // A second finger means a pinch, not a swipe. Abandon the gesture
      // rather than just ignoring this event: leaving the first finger's
      // origin in place let the eventual touchend measure dx from it and
      // step the collection in the middle of a pinch-zoom.
      if (e.touches.length !== 1) {
        touchX = touchY = null;
        return;
      }
      touchX = e.touches[0].clientX;
      touchY = e.touches[0].clientY;
    },
    { passive: true }
  );
  // An interrupted gesture (a call, the app backgrounding) must not leave a
  // stale origin behind for the next touchend to measure against.
  box.addEventListener(
    "touchcancel",
    function () {
      touchX = touchY = null;
    },
    { passive: true }
  );
  box.addEventListener(
    "touchend",
    function (e) {
      if (touchX === null || !open) return;
      var dx = e.changedTouches[0].clientX - touchX;
      var dy = e.changedTouches[0].clientY - touchY;
      touchX = touchY = null;
      if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.5) {
        e.preventDefault(); // plain taps never reach here — their clicks survive
        if (navGuard()) step(dx < 0 ? 1 : -1);
      }
    },
    { passive: false }
  );
})();
