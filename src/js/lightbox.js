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
          display: el.getAttribute("data-display"),
          title: el.getAttribute("data-title") || "",
          meta: el.getAttribute("data-meta") || "",
          story: el.getAttribute("data-story") || "",
        };
      });
    items.forEach(function (it, i) {
      it.el.addEventListener("click", function (ev) {
        ev.preventDefault();
        openAt(i, ev);
      });
    });
  }

  var idx = -1;
  var open = false;
  var closing = false;
  var devTick = 0;
  var lastNav = 0;
  var flights = [];

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
  // the "develop" flourish once the new frame lands (used when stepping).
  function swapFull(src, animClass) {
    var token = ++renderToken;
    var pre = new Image();
    pre.src = src;
    var apply = function () {
      if (token !== renderToken) return;
      if (imgEl.getAttribute("src") !== src) imgEl.src = src;
      imgEl.classList.remove("is-develop-a", "is-develop-b");
      if (animClass) {
        void imgEl.offsetWidth; // restart the develop animation
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
  // size as the in-page print (90vw `sizes`), so the print's own srcset pick
  // is already the right resolution AND usually cached from scrolling. The
  // 2200px `full` (~2x the bytes) is only worth decoding on large screens.
  function bestSrc(it) {
    if (!(window.matchMedia && matchMedia("(max-width: 820px)").matches))
      return it.src;
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
    var now = Date.now();
    if (now - lastNav < 300) return;
    lastNav = now;
    killFlights();
    idx = i;
    open = true;
    closing = false;
    devTick = 0;
    render();
    warmNeighbours();
    box.classList.remove("is-closing");
    box.hidden = false;
    // Lock the page while the lightbox is up — on touch, swipes inside the
    // overlay would otherwise scroll the collection behind it, so closing
    // lands you somewhere else on the page.
    document.documentElement.style.overflow = "hidden";
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
    imgEl.classList.remove("is-develop-a", "is-develop-b");
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
    // or it un-hides the target mid-flight and the photo shows doubled.
    setTimeout(function () {
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
    idx = (idx + d + items.length) % items.length;
    devTick++;
    render();
    warmNeighbours();
    var stepImg = items[idx].el.querySelector("img");
    setAspect(stepImg);
    pickUp(stepImg); // put the previous photo's matt back, empty this one's
    var animClass = reduced ? "" : devTick % 2 ? "is-develop-a" : "is-develop-b";
    swapFull(bestSrc(items[idx]), animClass);
  }

  function close() {
    if (!open || closing) return;
    killFlights();
    closing = true;
    box.classList.add("is-closing");

    var it = items[idx];
    var tgtImg = it ? it.el.querySelector("img") : null;
    var tr = null;
    if (tgtImg) {
      var r = tgtImg.getBoundingClientRect();
      if (r.bottom > 60 && r.top < window.innerHeight - 60) tr = r;
    }
    function finish() {
      open = false;
      closing = false;
      box.hidden = true;
      box.classList.remove("is-closing");
      document.documentElement.style.overflow = "";
      imgEl.style.visibility = "";
      putBack(); // the matt gets its photo back once it's landed
      if (it && it.el) it.el.focus({ preventScroll: true });
    }
    if (reduced || !tr) {
      setTimeout(finish, 320);
      return;
    }
    var fr = imgEl.getBoundingClientRect();
    imgEl.style.visibility = "hidden";
    var clone = window.MR.flight.makeClone(imgEl.currentSrc || it.src, fr);
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        clone.style.left = tr.left + "px";
        clone.style.top = tr.top + "px";
        clone.style.width = tr.width + "px";
        clone.style.height = tr.height + "px";
      });
    });
    setTimeout(function () {
      clone.style.opacity = "0";
      setTimeout(function () {
        if (clone.parentNode) clone.remove();
      }, 220);
      finish();
    }, 600);
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
      step(-1);
    });
  if (nextBtn)
    nextBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      step(1);
    });

  window.addEventListener("keydown", function (e) {
    if (!open) return;
    if (e.key === "Escape") close();
    else if (e.key === "ArrowRight") step(1);
    else if (e.key === "ArrowLeft") step(-1);
  });

  // Touch: swipe left/right steps through the collection, same as the arrow
  // keys. A real swipe never fires the background-click close — browsers
  // suppress the click once the finger has moved more than a few pixels.
  var touchX = null;
  var touchY = null;
  box.addEventListener(
    "touchstart",
    function (e) {
      if (e.touches.length !== 1) return;
      touchX = e.touches[0].clientX;
      touchY = e.touches[0].clientY;
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
        step(dx < 0 ? 1 : -1);
      }
    },
    { passive: true }
  );
})();
