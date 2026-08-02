// Home -> collection transition, reproduced from the Claude Design source
// rather than approximated with the browser's native View Transitions API.
//
// That API turned out to be the wrong tool: it's Chromium-only for
// cross-document navigation, and it auto-generates a pixel crossfade between
// old/new screenshots that stretches or letterboxes the photo (the thumbnail
// is a hard 64x46 crop; the destination print keeps its natural aspect
// ratio) â€” nothing like the design's clean single-image grow.
//
// So instead: intercept the click, fetch the destination page, swap its
// <main> into the current document (a small progressive-enhancement
// pseudo-navigation), and fly a cloned div of the tapped thumbnail into the
// landing photo's frame using the exact FLIP technique from the design (and
// already used locally by lightbox.js) â€” plain left/top/width/height
// transitions on a background-image:cover clone, so the photo never distorts
// and works identically in every browser. Every other link (back, prev/next,
// nav) is left as an ordinary page load, matching the design's own instant
// cut for those.
(function () {
  window.MR = window.MR || {};

  var main = document.querySelector("main");
  var header = document.querySelector("[data-site-header]");
  if (!main || !document.querySelector(".col-row")) return;

  var reduced =
    window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduced) return;

  var navigating = false;
  // The home page as it was before a swap, so popstate can put it back
  // without a network round trip. Title and body class are read now, while
  // they still describe the home page.
  var homeCache = null;
  var homeTitle = document.title;
  var homeBodyClass = document.body.className;
  // Mark the entry we're on, so the popstate below can tell "back to the home
  // page we swapped away from" apart from any other same-document entry.
  if (!history.state) history.replaceState({ mr: "home" }, "");

  // The destination image is hidden the instant it's found (the design's
  // matt sits empty until the photo "arrives") and only revealed once the
  // clone lands â€” otherwise the real photo, already loaded from cache, just
  // sits there the whole time while an identical clone flies on top of it.
  function flyTo(src, fromRect, getTarget, onDone) {
    window.MR.flight.start(src, fromRect, getTarget, {
      hideTarget: true,
      onDone: onDone,
    });
  }

  // Called again after Back restores the home page, against nodes that did not
  // exist when this file first ran. Guarded so it can never double-bind: two
  // click handlers on one row would fire two navigations for one tap.
  function bindRows() {
    document.querySelectorAll(".col-row").forEach(function (row) {
      if (row.mrBound) return;
      row.mrBound = true;

      // Warm the destination's first print at the earliest sign of intent
      // (pointerdown fires ~100-300ms before click), so its download runs in
      // parallel with the HTML fetch instead of after it. One-shot per row.
      var warmed = false;
      var hoverTimer = null;
      function warm() {
        if (warmed || !row.getAttribute("data-first-src")) return;
        warmed = true;
        var im = new Image();
        // Mirrors the print <img> in collection.njk: same `sizes`, same ladder,
        // or the browser picks a different candidate and the warm is wasted.
        // Both strings are emitted by portfolio.js so they cannot drift.
        im.sizes = row.getAttribute("data-first-sizes") || "";
        var wantAvif = window.MR.avif && window.MR.avif();
        var ss =
          (wantAvif && row.getAttribute("data-first-srcset-avif")) ||
          row.getAttribute("data-first-srcset");
        if (ss) im.srcset = ss;
        im.src = row.getAttribute("data-first-src");
        if (im.decode) im.decode().catch(function () {});
      }
      // pointerdown already covers touch, so touchstart would only double up.
      ["pointerdown", "focus"].forEach(function (t) {
        row.addEventListener(t, warm, { passive: true });
      });
      // Hover needs a dwell gate: without one, a mouse sweeping down the list
      // preloads every collection's lead photo on the way past.
      row.addEventListener("mouseenter", function () {
        hoverTimer = setTimeout(warm, 120);
      }, { passive: true });
      row.addEventListener("mouseleave", function () {
        clearTimeout(hoverTimer);
      }, { passive: true });

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
        // Abort the in-flight fetch when we give up on it: otherwise the real
        // navigation the fallback triggers has to share the connection with a
        // download nobody is going to use, on exactly the slow link that made
        // us give up in the first place.
        var ctrl = typeof AbortController === "function" ? new AbortController() : null;
        var fallbackTimer = setTimeout(function () {
          settled = true;
          if (ctrl) ctrl.abort();
          window.location.href = href; // slow network â€” a real load beats a stuck clone
        }, 1200);
  
        fetch(href, ctrl ? { signal: ctrl.signal } : undefined)
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
            // hero.js paints the header inline (it crossfades it from
            // light-on-photo to solid bone as you scroll) and stops running the
            // moment the hero leaves the DOM below. Without this the collection
            // page inherits whatever the header looked like at the instant of
            // the tap, so a tap made high up the page lands on near-white text
            // over a transparent bar.
            if (header) {
              header.style.background = "";
              header.style.borderBottomColor = "";
              header.style.removeProperty("--hdr-fg");
              header.style.removeProperty("--hdr-muted");
              header.style.removeProperty("--hdr-active-line");
            }
            // Keep the home page so Back can put it straight back (see popstate
            // at the bottom). Captured before the swap, obviously.
            homeCache = {
              html: main.innerHTML,
              title: homeTitle,
              bodyClass: homeBodyClass,
              scrollY: window.scrollY,
            };
            // adoptNode + replaceChildren instead of `main.innerHTML =
            // newMain.innerHTML`: the response was already parsed into `doc`
            // above, so assigning innerHTML serialised that tree back to a
            // string and made the browser parse the whole collection page a
            // second time, synchronously, inside a click handler.
            main.replaceChildren.apply(
              main,
              Array.prototype.slice.call(document.adoptNode(newMain).childNodes)
            );
            // Hide the destination photo before the browser ever gets a chance
            // to paint it â€” it's already loaded (from cache), so without this
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
            history.pushState({ mr: "collection" }, "", href);
            // `html { scroll-behavior: smooth }` would otherwise turn this into
            // an animated scroll â€” the flight below measures the destination
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
                // flight.js only restores images its own poll found in time â€”
                // on a slow network it can give up before the landing image
                // loads, which would leave it visibility:hidden forever.
                if (landingImg) landingImg.style.visibility = "";
                navigating = false;
              }
            );
          })
          .catch(function (err) {
            // The abort above is our own doing and the hard navigation is
            // already under way; treating it as a failure would fire a second.
            if (err && err.name === "AbortError") return;
            clearTimeout(fallbackTimer);
            window.location.href = href; // any failure â€” a real load beats a broken page
          });
      });
    });
  }

  bindRows();

  // Back out of a swapped-in collection puts the cached home page straight
  // back. This used to be an unconditional window.location.reload(), which
  // meant the one navigation the browser can normally serve instantly - going
  // back - was the slowest on the site: a full network round trip and a white
  // flash, worse than if none of this file existed. It also fired for any
  // same-document history entry, not just the ones pushed above.
  window.addEventListener("popstate", function (e) {
    var st = e.state;
    // Anything this file didn't create (or a forward into a collection we no
    // longer hold the markup for) still gets the honest fallback.
    if (!homeCache || (st && st.mr === "collection")) {
      window.location.reload();
      return;
    }
    main.innerHTML = homeCache.html;
    document.title = homeCache.title;
    document.body.className = homeCache.bodyClass;
    if (header) {
      header.style.background = "";
      header.style.borderBottomColor = "";
      header.style.removeProperty("--hdr-fg");
      header.style.removeProperty("--hdr-muted");
      header.style.removeProperty("--hdr-active-line");
    }
    // The hero is a fresh element with no listeners on it, and the row
    // handlers below were bound to nodes that no longer exist.
    if (window.MR.rebindHero) window.MR.rebindHero();
    if (window.MR.rebindLightbox) window.MR.rebindLightbox();
    if (window.MR.rebindReveal) window.MR.rebindReveal();
    bindRows();
    // Restore where they were in the list, not the top of the page. Instant,
    // for the same reason the forward navigation is.
    window.scrollTo({ top: homeCache.scrollY, left: 0, behavior: "instant" });
    navigating = false;
  });
})();
