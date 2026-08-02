// Rise-in reveal for the collection prints.
//
// Each print after the first rises up the first time it scrolls into view.
// This used to be a pure-CSS scroll-driven animation (animation-timeline:
// view()), but that keeps every print promoted as its own composited layer
// for the life of the page and samples the animation against scroll every
// frame — which stuttered on the way down the page. Instead an
// IntersectionObserver fires the same mrRise keyframes once, on the time
// axis, and the browser can drop the layer as soon as the 0.6s run is over.
(function () {
  var reduced =
    window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

  var io = null;

  // Rebuilt every time the print blocks in <main> change — including right
  // after transitions.js swaps in a new page client-side (same contract as
  // window.MR.rebindLightbox).
  // Lazy prints download over the #dedbcf plate and their pixels pop in the
  // moment decode finishes — noticeable on mobile networks. Fade in any print
  // image still in flight at bind time; images already complete (cache,
  // back-nav, the eager first two) are never touched so they can't blink.
  // The CSS transition sits on .is-loaded, so .is-pending snaps to opacity 0
  // instantly. Skipped entirely under reduced motion: the CSS there now zeroes
  // transition-duration as well as animation-duration, so the fade would
  // collapse to a pop anyway — better not to touch the images at all.
  function bindImgFade() {
    if (reduced) return; // pop is acceptable under reduced motion
    document.querySelectorAll(".print__img").forEach(function (img) {
      if (img.complete || img.classList.contains("is-pending")) return;
      img.classList.add("is-pending");
      var show = function () {
        // On error too — never leave an invisible plate.
        img.classList.add("is-loaded");
      };
      img.addEventListener("load", show, { once: true });
      img.addEventListener("error", show, { once: true });
    });
  }

  function bind() {
    bindImgFade(); // needs neither IO nor the rise animation below
    if (io) {
      io.disconnect();
      io = null;
    }
    if (reduced || !("IntersectionObserver" in window)) return;
    var blocks = document.querySelectorAll(".print-block:not(:first-child)");
    if (!blocks.length) return;

    io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (en) {
          if (!en.isIntersecting) return;
          en.target.classList.add("is-in");
          io.unobserve(en.target);
        });
      },
      // Fire the moment the print's top crosses the bottom edge. The old
      // -12% margin (matching the old animation-range) meant the rise began
      // only once the print was well inside the viewport — on a mobile fling
      // the observer lags a frame or two on top of that, so prints popped in
      // mid-screen instead of rising at the edge.
      { rootMargin: "0px" }
    );

    // All the reads, then all the writes. Interleaved, this was a classic
    // layout-thrash loop, and it runs immediately after transitions.js has
    // replaced <main>, so each forced reflow would be a full-document layout.
    // It is only harmless today because .will-rise sets opacity and nothing
    // else; the moment anyone gives that class a transform or a size it turns
    // into N synchronous reflows. Cheaper to not depend on that.
    var vh = window.innerHeight;
    var offscreen = [];
    blocks.forEach(function (b) {
      // A block already on screen (tall viewport, restored scroll position)
      // is never hidden at all — hiding it after first paint would flash.
      if (b.getBoundingClientRect().top >= vh) offscreen.push(b);
    });
    offscreen.forEach(function (b) {
      b.classList.add("will-rise");
      io.observe(b);
    });
  }

  bind();
  window.MR = window.MR || {};
  window.MR.rebindReveal = bind;
})();
