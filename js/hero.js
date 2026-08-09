// Immersive home hero.
//
// On scroll the full-viewport hero image shrinks into a centred, matted 3:2
// print while the fixed header crossfades from light-on-image to the solid
// bone bar. A 3-image slideshow crossfades between hero photographs.
//
// Ported from the Claude Design "Portfolio v5" syncHero logic. Runs only on the
// home page; degrades to a static full-viewport image under reduced motion.
//
// Structured as init()/destroy() rather than a bare IIFE because transitions.js
// swaps <main> out from under it for the home -> collection pseudo-navigation,
// and now restores it again on Back. Without a teardown the scroll and resize
// listeners lived for the life of the document, so every scroll frame on a
// collection page still scheduled a rAF and walked the DOM to discover there
// was nothing to do.
(function () {
  window.MR = window.MR || {};

  var SHRINK = 0.42; // see .hero { height: 142svh } — 142 - 100 = 42svh of travel
  var GAP = 56; // gap under the settled frame + caption before the collections
  // Scroll progress is rounded to this many steps before anything is written.
  // The frame's height travels ~620px on a phone, so a step of 1/500 is still
  // finer than one device pixel — but it means a flick that jitters `scrollY`
  // by a pixel no longer relays out a full-viewport subtree for a change
  // nobody can see.
  var P_STEPS = 500;

  var teardown = null;

  function init() {
    var hero = document.querySelector("[data-hero]");
    var header = document.querySelector("[data-site-header]");
    if (!hero || !document.body.classList.contains("is-home")) return null;

    var reducedMq =
      window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)");
    var reduced = !!(reducedMq && reducedMq.matches);

    var frame = hero.querySelector("[data-hero-frame]");
    var title = hero.querySelector("[data-hero-title]");
    var dim = hero.querySelector("[data-hero-dim]");
    var cap = hero.querySelector("[data-hero-cap]");
    var capL = hero.querySelector("[data-hero-cap-left]");
    var capR = hero.querySelector("[data-hero-cap-right]");
    var collections = document.querySelector("[data-collections]");
    var slides = Array.prototype.slice.call(
      hero.querySelectorAll("[data-hero-slide]")
    );

    // The CSS sizes the hero in svh (stable while the mobile URL bar collapses);
    // measure the same 100svh so the scroll math never desyncs from the sticky
    // frame. Where svh is unsupported the CSS falls back too, so innerHeight is
    // again the consistent choice.
    var svhProbe = document.createElement("div");
    svhProbe.style.cssText =
      "position:fixed;top:0;left:0;width:0;height:100svh;visibility:hidden;pointer-events:none;";
    document.body.appendChild(svhProbe);

    // Read a "#rrggbb" custom property into [r,g,b], falling back if unset.
    function px(cs, name, fb) {
      var v = (cs.getPropertyValue(name) || "").trim();
      if (/^#[0-9a-f]{6}$/i.test(v)) {
        return [
          parseInt(v.slice(1, 3), 16),
          parseInt(v.slice(3, 5), 16),
          parseInt(v.slice(5, 7), 16),
        ];
      }
      return fb;
    }

    var p = 0; // cached scroll progress, also read by the slideshow

    // Everything in here is a layout or style READ. Doing any of it inside
    // sync() made every scroll frame a read-write-read sandwich: the three
    // frame.style writes below invalidate layout, so a getComputedStyle or a
    // getBoundingClientRect after them forces a synchronous reflow of a
    // full-viewport element, every frame, on the main thread. That was the
    // mobile scroll jank. These values only change on resize, so they are
    // measured once here and cached.
    var vw, vh, tw, ink, mut, acc, key, papStr, linStr;

    // Last values actually written, so a frame that would write the same
    // string again writes nothing. Custom properties are the ones that matter:
    // every setProperty on the header invalidates style for each descendant
    // that inherits it (the wordmark and both nav links).
    var lastP = -1;
    var lastHo = -1;
    var lastCb = -1;
    var lastShadow = null;
    var lastBorderW = null;

    function measure() {
      vw = document.documentElement.clientWidth;
      vh = svhProbe.offsetHeight || window.innerHeight;
      // The frame's final (fully shrunk) width, and everything derived from it.
      tw = Math.min(780, vw * 0.86, Math.max(320, (vh - 180) * 1.5));

      var cs = getComputedStyle(frame);
      var pap = px(cs, "--paper", [239, 237, 230]);
      var lin = px(cs, "--line", [216, 212, 197]);
      ink = px(cs, "--ink", [30, 43, 34]);
      mut = px(cs, "--muted", [78, 88, 74]);
      acc = px(cs, "--acc", [65, 87, 58]);
      key = px(cs, "--key", [30, 43, 34]);
      // These two only ever vary in alpha, so the rgb triplet is joined once
      // here rather than on every scroll frame.
      papStr = pap[0] + "," + pap[1] + "," + pap[2];
      linStr = lin[0] + "," + lin[1] + "," + lin[2];

      // Pull the collections up so they sit a fixed distance below the shrunk,
      // centred frame — otherwise the sticky viewport leaves a big empty gap and
      // you have to scroll past dead space to reach them. Depends only on the
      // viewport, so it belongs here rather than in the scroll path.
      if (collections) {
        var frameFinalH = (tw * 2) / 3 + 46 + 40; // frame + caption allowance
        collections.style.marginTop =
          Math.round(GAP - (vh - frameFinalH) / 2) + "px";
      }

      // Geometry changed, so the cached "already written" values are stale.
      lastP = -1;
      lastHo = -1;
      lastCb = -1;
      lastShadow = null;
      lastBorderW = null;
    }

    // Interpolate a fixed bone colour towards a themed one. Written out
    // longhand: the array .map().join() this replaced allocated a dozen
    // objects and strings per scroll frame, three times over.
    function mix(a0, a1, a2, b, t) {
      return (
        "rgb(" +
        Math.round(a0 + (b[0] - a0) * t) +
        "," +
        Math.round(a1 + (b[1] - a1) * t) +
        "," +
        Math.round(a2 + (b[2] - a2) * t) +
        ")"
      );
    }

    function sync() {
      // transitions.js can swap the home content out from under this listener
      // via a client-side pseudo-navigation — bail once the hero is detached.
      if (!document.body.contains(hero)) return;

      var raw = Math.max(0, Math.min(1, window.scrollY / (vh * SHRINK)));
      p = Math.round(raw * P_STEPS) / P_STEPS;
      // The whole rest of the home page scrolls with p pinned at 1. Without
      // this every one of those frames re-wrote identical values to a
      // full-viewport subtree, for the entire length of the page.
      if (p === lastP) return;
      lastP = p;

      // Header colour crossfade (colour only — safe under reduced motion).
      if (header) {
        var ho = Math.max(0, Math.min(1, (p - 0.3) / 0.2));
        var cb = Math.max(0, Math.min(1, (p - 0.32) / 0.22));
        if (ho !== lastHo) {
          lastHo = ho;
          var a = ho.toFixed(3);
          header.style.background = "rgba(" + papStr + "," + a + ")";
          header.style.borderBottomColor = "rgba(" + linStr + "," + a + ")";
        }
        if (cb !== lastCb) {
          lastCb = cb;
          header.style.setProperty("--hdr-fg", mix(242, 239, 227, ink, cb));
          header.style.setProperty("--hdr-muted", mix(220, 216, 199, mut, cb));
          header.style.setProperty(
            "--hdr-active-line",
            mix(220, 216, 199, acc, cb)
          );
        }
      }

      if (reduced) return; // frame stays full-bleed; CSS handles the static layout

      var e = 1 - Math.pow(1 - p, 3);
      // Rounded to whole pixels: the browser lays out on subpixels, so an
      // unrounded width churns layout for changes below the display's
      // resolution.
      var w = Math.round(vw + (tw + 46 - vw) * e);
      var h = Math.round(vh + ((tw * 2) / 3 + 46 - vh) * e);
      frame.style.width = w + "px";
      frame.style.height = h + "px";
      frame.style.padding = Math.round(22 * e) + "px";

      var ba = Math.max(0, Math.min(1, (p - 0.45) / 0.35));
      frame.style.borderColor = "rgba(" + key[0] + "," + key[1] + "," + key[2] + "," + ba + ")";
      // The border only exists once it starts fading in — at rest it is width 0
      // so the full-bleed photo has no 1px mat ring on high-DPI phones. The 2px
      // content-box change lands mid-shrink, while the colour alpha is still 0.
      var bw = ba > 0 ? "1px" : "0";
      if (bw !== lastBorderW) {
        lastBorderW = bw;
        frame.style.borderWidth = bw;
      }
      // Toggled through a class, and only on the frame where it actually
      // flips. Assigning box-shadow every frame restarted a 600ms paint-heavy
      // blur transition on an element that is simultaneously relaying out.
      var shadow = p > 0.6;
      if (shadow !== lastShadow) {
        lastShadow = shadow;
        frame.classList.toggle("is-lifted", shadow);
      }

      if (title) {
        // The frame is centred in a 100svh sticky flex container, so its bottom
        // edge is (vh + h) / 2 and its overhang past the fold is (h - vh) / 2.
        // Computed rather than measured on purpose: reading
        // frame.getBoundingClientRect() here, immediately after the three style
        // writes above, forced a synchronous reflow on every single scroll
        // frame. (.hero__cap below already derived its position this way.)
        title.style.bottom = Math.max(0, Math.round((h - vh) / 2)) + "px";
        var o = Math.max(0, 1 - p * 2.6);
        title.style.opacity = o;
        title.style.visibility = o <= 0 ? "hidden" : "visible";
      }
      if (dim) dim.style.opacity = Math.max(0, 1 - p * 2.2);

      var cm = Math.max(0, Math.min(1, (p - 0.75) / 0.25));
      if (cap) {
        cap.style.opacity = cm;
        cap.style.width = w + "px";
        cap.style.top = Math.round((vh + h) / 2) + 10 + "px";
      }
    }

    // ---- Slideshow ---------------------------------------------------------
    var idx = 0;
    var slideTimer = null;
    function show(n) {
      slides.forEach(function (s, i) {
        s.style.opacity = i === n ? "1" : "0";
        s.classList.toggle("is-active", i === n);
      });
      var a = slides[n];
      if (a && capL) capL.textContent = a.getAttribute("data-cap-left") || "";
      if (a && capR) capR.textContent = a.getAttribute("data-cap-right") || "";
    }

    function hydrate() {
      slides.forEach(function (s) {
        if (s.getAttribute("src") || !s.getAttribute("data-src")) return;
        // The AVIF <source> has to be filled before the <img>: once the img
        // gets a src the browser runs picture selection, and a <source> with
        // an empty srcset at that moment is simply skipped.
        var src = s.parentNode && s.parentNode.querySelector("[data-hero-source]");
        if (src && src.getAttribute("data-srcset")) {
          src.srcset = src.getAttribute("data-srcset");
        }
        if (s.getAttribute("data-srcset")) s.srcset = s.getAttribute("data-srcset");
        s.src = s.getAttribute("data-src");
      });
    }

    if (slides.length > 1 && !reduced) {
      // The non-first slides ship with data-src/data-srcset only (see
      // index.njk) — start their downloads once the page itself has finished
      // loading, well before the first 9.5s crossfade needs them. Under reduced
      // motion the slideshow never runs, so they're never fetched at all.
      if (document.readyState === "complete") hydrate();
      else window.addEventListener("load", hydrate);

      slideTimer = setInterval(function () {
        if (!document.body.contains(hero)) {
          clearInterval(slideTimer); // home content was swapped out from under us
          slideTimer = null;
          return;
        }
        // Don't crossfade a hidden tab: it burns a 2.4s transition on two
        // full-viewport layers nobody is looking at.
        if (document.hidden) return;
        if (p > 0.04 && p < 0.96) return; // only advance near the ends of the scroll
        idx = (idx + 1) % slides.length;
        show(idx);
      }, 9500);
    }

    // ---- Scroll wiring -----------------------------------------------------
    var ticking = false;
    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () {
        sync();
        ticking = false;
      });
    }

    // Resize fires in bursts on mobile — during the URL bar collapsing, during
    // an orientation change, and continuously while a desktop window is
    // dragged. measure() writes collections.style.marginTop, so running it per
    // event is a layout shift per event.
    var resizeTimer = null;
    var lastVW = 0;
    var lastVH = 0;
    function doResize() {
      resizeTimer = null;
      if (!document.body.contains(hero)) return;
      var nvw = document.documentElement.clientWidth;
      var nvh = svhProbe.offsetHeight || window.innerHeight;
      // The URL bar collapsing changes innerHeight but NOT 100svh, which is
      // the unit both the CSS and the scroll maths use. So when svh hasn't
      // moved there is genuinely nothing to recompute, and re-running measure()
      // would only risk nudging the caption — the historical mobile bug.
      if (nvw === lastVW && Math.abs(nvh - lastVH) < 2) return;
      lastVW = nvw;
      lastVH = nvh;
      measure();
      sync();
    }
    function onResize() {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(doResize, 150);
    }

    function onMotionPref() {
      // Re-init so the change takes effect without a reload: `reduced` gates
      // the geometry writes and whether the slideshow runs at all, and both
      // are decided at init.
      window.MR.rebindHero();
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    if (reducedMq && reducedMq.addEventListener) {
      reducedMq.addEventListener("change", onMotionPref);
    }

    lastVW = document.documentElement.clientWidth;
    lastVH = svhProbe.offsetHeight || window.innerHeight;
    measure();
    sync();

    return function destroy() {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("load", hydrate);
      if (reducedMq && reducedMq.removeEventListener) {
        reducedMq.removeEventListener("change", onMotionPref);
      }
      if (resizeTimer) clearTimeout(resizeTimer);
      if (slideTimer) clearInterval(slideTimer);
      if (svhProbe.parentNode) svhProbe.parentNode.removeChild(svhProbe);
      // Drop every inline style sync() wrote. Usually the element is about to
      // be discarded anyway, but when the teardown is a reduced-motion toggle
      // the SAME elements come back under a stylesheet that no longer animates
      // them - and a leftover `title { opacity: 0 }` would hide the scroll cue
      // for good. (The frame's geometry is the one thing already covered, by
      // the !important rules in the reduced-motion block.)
      [frame, title, dim, cap].forEach(function (el) {
        if (el) el.removeAttribute("style");
      });
      if (frame) frame.classList.remove("is-lifted");
      // Hand the header back to the stylesheet. transitions.js does this too
      // for its own navigation, but a teardown that leaves a half-faded
      // header behind is a trap for every other caller.
      if (header) {
        header.style.background = "";
        header.style.borderBottomColor = "";
        header.style.removeProperty("--hdr-fg");
        header.style.removeProperty("--hdr-muted");
        header.style.removeProperty("--hdr-active-line");
      }
    };
  }

  // transitions.js restores the cached home <main> on Back, which means a
  // fresh hero element with no listeners on it. Same contract as
  // rebindLightbox / rebindReveal.
  window.MR.rebindHero = function () {
    if (teardown) teardown();
    teardown = init();
  };

  teardown = init();
})();
