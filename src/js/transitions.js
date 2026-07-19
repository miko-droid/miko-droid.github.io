// Home -> collection transition, reproduced from the Claude Design source
// rather than approximated with the browser's native View Transitions API.
//
// That API turned out to be the wrong tool: it's Chromium-only for
// cross-document navigation, and it auto-generates a pixel crossfade between
// old/new screenshots that stretches or letterboxes the photo (the thumbnail
// is a hard 64x46 crop; the destination print keeps its natural aspect
// ratio) — nothing like the design's clean single-image grow.
//
// So instead: intercept the click, fetch the destination page, swap its
// <main> into the current document (a small progressive-enhancement
// pseudo-navigation), and fly a cloned div of the tapped thumbnail into the
// landing photo's frame using the exact FLIP technique from the design (and
// already used locally by lightbox.js) — plain left/top/width/height
// transitions on a background-image:cover clone, so the photo never distorts
// and works identically in every browser. Every other link (back, prev/next,
// nav) is left as an ordinary page load, matching the design's own instant
// cut for those.
(function () {
  var rows = document.querySelectorAll(".col-row");
  if (!rows.length) return;

  var reduced =
    window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduced) return;

  var navigating = false;

  // The destination image is hidden the instant it's found (the design's
  // matt sits empty until the photo "arrives") and only revealed once the
  // clone lands — otherwise the real photo, already loaded from cache, just
  // sits there the whole time while an identical clone flies on top of it.
  function flyTo(src, fromRect, getTarget, onDone) {
    window.MR.flight.start(src, fromRect, getTarget, {
      hideTarget: true,
      onDone: onDone,
    });
  }

  var main = document.querySelector("main");

  rows.forEach(function (row) {
    // Warm the destination's first print at the earliest sign of intent
    // (touchstart fires ~100-300ms before click), so its download runs in
    // parallel with the HTML fetch instead of after it. One-shot per row.
    var warmed = false;
    function warm() {
      if (warmed || !row.getAttribute("data-first-src")) return;
      warmed = true;
      var im = new Image();
      // Must mirror the print <img> in collection.njk exactly, or the
      // browser picks a different srcset candidate and the warm is wasted.
      im.sizes = "(max-width: 820px) 90vw, 760px";
      var ss = row.getAttribute("data-first-srcset");
      if (ss) im.srcset = ss;
      im.src = row.getAttribute("data-first-src");
      if (im.decode) im.decode().catch(function () {});
    }
    ["touchstart", "pointerdown", "mouseenter", "focus"].forEach(function (t) {
      row.addEventListener(t, warm, { passive: true });
    });

    row.addEventListener("click", function (e) {
      if (navigating || e.defaultPrevented || e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

      var href = row.getAttribute("href");
      var img = row.querySelector("img");
      var fromRect = img ? img.getBoundingClientRect() : null;
      if (!href || !main || !fromRect || fromRect.width < 4) return; // let it navigate normally

      e.preventDefault();
      navigating = true;

      var settled = false;
      var fallbackTimer = setTimeout(function () {
        settled = true;
        window.location.href = href; // slow network — a real load beats a stuck clone
      }, 1200);

      fetch(href)
        .then(function (res) {
          if (!res.ok) throw new Error("bad response");
          return res.text();
        })
        .then(function (html) {
          if (settled) return;
          clearTimeout(fallbackTimer);
          settled = true;

          var doc = new DOMParser().parseFromString(html, "text/html");
          var newMain = doc.querySelector("main");
          if (!newMain) throw new Error("no <main> in response");

          document.title = doc.title;
          document.body.className = doc.body.className;
          main.innerHTML = newMain.innerHTML;
          // Hide the destination photo before the browser ever gets a chance
          // to paint it — it's already loaded (from cache), so without this
          // it would sit fully visible in the frame for the whole flight,
          // with the clone flying in on top of an identical copy of itself.
          var landingImg = main.querySelector("[data-print] img");
          if (landingImg) {
            landingImg.style.visibility = "hidden";
            // Decode off-thread while the clone flies, so the reveal paint
            // doesn't stall on a synchronous WebP decode (noticeable on
            // mobile with a cold cache).
            if (landingImg.decode) landingImg.decode().catch(function () {});
          }
          history.pushState({ mr: true }, "", href);
          // `html { scroll-behavior: smooth }` would otherwise turn this into
          // an animated scroll — the flight below measures the destination
          // photo's position within a couple of rAF ticks, so it needs the
          // page already settled at the top, not mid-scroll.
          window.scrollTo({ top: 0, left: 0, behavior: "instant" });
          main.setAttribute("tabindex", "-1");
          main.focus({ preventScroll: true });

          if (window.MR && window.MR.rebindLightbox) window.MR.rebindLightbox();
          if (window.MR && window.MR.rebindReveal) window.MR.rebindReveal();

          flyTo(
            img.currentSrc || img.src,
            fromRect,
            function () {
              return main.querySelector("[data-print] img");
            },
            function () {
              // flight.js only restores images its own poll found in time —
              // on a slow network it can give up before the landing image
              // loads, which would leave it visibility:hidden forever.
              if (landingImg) landingImg.style.visibility = "";
              navigating = false;
            }
          );
        })
        .catch(function () {
          clearTimeout(fallbackTimer);
          window.location.href = href; // any failure — a real load beats a broken page
        });
    });
  });

  // We don't attempt SPA-style history — a swapped-in page has no state to
  // restore, so treat Back the same as a fresh load of whatever URL it left.
  window.addEventListener("popstate", function () {
    window.location.reload();
  });
})();
