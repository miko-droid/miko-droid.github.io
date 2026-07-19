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
  function bind() {
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

    blocks.forEach(function (b) {
      // A block already on screen (tall viewport, restored scroll position)
      // is never hidden at all — hiding it after first paint would flash.
      if (b.getBoundingClientRect().top < window.innerHeight) return;
      b.classList.add("will-rise");
      io.observe(b);
    });
  }

  bind();
  window.MR = window.MR || {};
  window.MR.rebindReveal = bind;
})();
