// Immersive home hero.
//
// On scroll the full-viewport hero image shrinks into a centred, matted 3:2
// print while the fixed header crossfades from light-on-image to the solid
// bone bar. A 3-image slideshow crossfades between hero photographs.
//
// Ported from the Claude Design "Portfolio v5" syncHero logic. Runs only on the
// home page; degrades to a static full-viewport image under reduced motion.
(function () {
  var hero = document.querySelector("[data-hero]");
  var header = document.querySelector("[data-site-header]");
  if (!hero || !document.body.classList.contains("is-home")) return;

  var reduced =
    window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

  var frame = hero.querySelector("[data-hero-frame]");
  var title = hero.querySelector("[data-hero-title]");
  var dim = hero.querySelector("[data-hero-dim]");
  var cap = hero.querySelector("[data-hero-cap]");
  var capL = hero.querySelector("[data-hero-cap-left]");
  var capR = hero.querySelector("[data-hero-cap-right]");
  var marks = hero.querySelector("[data-hero-marks]");
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

  // How far you scroll (as a fraction of viewport height) before the frame has
  // fully shrunk. Keep in step with `.hero { height }` in the CSS so there is no
  // dead scroll: height 142svh → 42svh of travel → SHRINK = 0.42 (matches v5).
  var SHRINK = 0.42;
  // Gap between the bottom of the shrunk frame (+ its caption) and the
  // collections list once everything has settled.
  var GAP = 56;

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

  function sync() {
    // transitions.js can swap the home content out from under this listener
    // via a client-side pseudo-navigation (no real page unload happens, so
    // this scroll listener stays attached) — bail once the hero is detached.
    if (!document.body.contains(hero)) return;
    var vw = document.documentElement.clientWidth;
    var vh = svhProbe.offsetHeight || window.innerHeight;
    p = Math.max(0, Math.min(1, window.scrollY / (vh * SHRINK)));

    var cs = getComputedStyle(frame);

    // Header colour crossfade (colour only — safe under reduced motion).
    if (header) {
      var pap = px(cs, "--paper", [239, 237, 230]);
      var lin = px(cs, "--line", [216, 212, 197]);
      var ink = px(cs, "--ink", [30, 43, 34]);
      var mut = px(cs, "--muted", [78, 88, 74]);
      var acc = px(cs, "--acc", [65, 87, 58]);
      var ho = Math.max(0, Math.min(1, (p - 0.3) / 0.2));
      var cb = Math.max(0, Math.min(1, (p - 0.32) / 0.22));
      var mix = function (a, b) {
        return (
          "rgb(" +
          a
            .map(function (v, i) {
              return Math.round(v + (b[i] - v) * cb);
            })
            .join(",") +
          ")"
        );
      };
      header.style.background = "rgba(" + pap.join(",") + "," + ho.toFixed(3) + ")";
      header.style.borderBottomColor =
        "rgba(" + lin.join(",") + "," + ho.toFixed(3) + ")";
      header.style.setProperty("--hdr-fg", mix([242, 239, 227], ink));
      header.style.setProperty("--hdr-muted", mix([220, 216, 199], mut));
      header.style.setProperty("--hdr-active-line", mix([220, 216, 199], acc));
    }

    if (reduced) return; // frame stays full-bleed; CSS handles the static layout

    var e = 1 - Math.pow(1 - p, 3);
    var tw = Math.min(780, vw * 0.86, Math.max(320, (vh - 180) * 1.5));
    var w = vw + (tw + 46 - vw) * e;
    var h = vh + ((tw * 2) / 3 + 46 - vh) * e;
    frame.style.width = w + "px";
    frame.style.height = h + "px";
    frame.style.padding = 22 * e + "px";

    var key = px(cs, "--key", [30, 43, 34]);
    var ba = Math.max(0, Math.min(1, (p - 0.45) / 0.35));
    frame.style.borderColor = "rgba(" + key.join(",") + "," + ba + ")";
    // The border only exists once it starts fading in — at rest it is width 0
    // so the full-bleed photo has no 1px mat ring on high-DPI phones. The 2px
    // content-box change lands mid-shrink, while the colour alpha is still 0.
    frame.style.borderWidth = ba > 0 ? "1px" : "0";
    frame.style.boxShadow = p > 0.6 ? "var(--shadow)" : "none";

    if (title) {
      var r = frame.getBoundingClientRect();
      title.style.bottom = Math.max(0, r.bottom - vh) + "px";
      var o = Math.max(0, 1 - p * 2.6);
      title.style.opacity = o;
      title.style.visibility = o <= 0 ? "hidden" : "visible";
    }
    if (dim) dim.style.opacity = Math.max(0, 1 - p * 2.2);

    var cm = Math.max(0, Math.min(1, (p - 0.75) / 0.25));
    if (cap) {
      cap.style.opacity = cm;
      cap.style.width = w + "px";
      cap.style.top = (vh + h) / 2 + 10 + "px";
    }
    if (marks) marks.style.opacity = cm;

    // Pull the collections up so they sit a fixed distance below the shrunk,
    // centred frame — otherwise the sticky viewport leaves a big empty gap and
    // you have to scroll past dead space to reach them.
    if (collections) {
      var frameFinalH = (tw * 2) / 3 + 46 + 40; // frame + caption allowance
      collections.style.marginTop = Math.round(GAP - (vh - frameFinalH) / 2) + "px";
    }
  }

  // ---- Slideshow -----------------------------------------------------------
  var idx = 0;
  function show(n) {
    slides.forEach(function (s, i) {
      s.style.opacity = i === n ? "1" : "0";
      s.classList.toggle("is-active", i === n);
    });
    var a = slides[n];
    if (a && capL) capL.textContent = a.getAttribute("data-cap-left") || "";
    if (a && capR) capR.textContent = a.getAttribute("data-cap-right") || "";
  }
  if (slides.length > 1 && !reduced) {
    // The non-first slides ship with data-src/data-srcset only (see
    // index.njk) — start their downloads once the page itself has finished
    // loading, well before the first 9.5s crossfade needs them. Under reduced
    // motion the slideshow never runs, so they're never fetched at all.
    var hydrate = function () {
      slides.forEach(function (s) {
        if (!s.getAttribute("src") && s.getAttribute("data-src")) {
          if (s.getAttribute("data-srcset")) s.srcset = s.getAttribute("data-srcset");
          s.src = s.getAttribute("data-src");
        }
      });
    };
    if (document.readyState === "complete") hydrate();
    else window.addEventListener("load", hydrate);

    var slideTimer = setInterval(function () {
      if (!document.body.contains(hero)) {
        clearInterval(slideTimer); // home content was swapped out from under us
        return;
      }
      if (p > 0.04 && p < 0.96) return; // only advance near the ends of the scroll
      idx = (idx + 1) % slides.length;
      show(idx);
    }, 9500);
  }

  // ---- Scroll wiring -------------------------------------------------------
  var ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      sync();
      ticking = false;
    });
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);
  sync();
})();
