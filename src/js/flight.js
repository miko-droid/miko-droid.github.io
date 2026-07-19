// Shared FLIP "fly a cloned thumbnail to its destination" animation.
//
// Used by both transitions.js (home -> collection navigation) and
// lightbox.js (print -> lightbox, and the reverse on close) — the two are
// visually identical operations (grow/shrink a background-image clone from
// one live rect to another) so the mechanics live here once.
(function () {
  window.MR = window.MR || {};

  function makeClone(src, r) {
    var c = document.createElement("div");
    c.className = "mr-flight";
    c.style.backgroundImage = 'url("' + src + '")';
    c.style.left = r.left + "px";
    c.style.top = r.top + "px";
    c.style.width = r.width + "px";
    c.style.height = r.height + "px";
    document.body.appendChild(c);
    return c;
  }

  // Grows/shrinks a clone of `src` from `fromRect` to getTarget()'s live rect
  // once it exists and has laid out. Every path funnels through finish() so a
  // slow image or a missing target can never strand the clone on screen.
  // Returns a handle with .finish() so a caller can cancel early (e.g. the
  // lightbox stepping to a new photo mid-flight).
  function start(src, fromRect, getTarget, opts) {
    opts = opts || {};
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
      }, 240);
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
            clone.style.left = t.left + "px";
            clone.style.top = t.top + "px";
            clone.style.width = t.width + "px";
            clone.style.height = t.height + "px";
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
                finish();
              }
              el.addEventListener("load", onSettle, { once: true });
              el.addEventListener("error", onSettle, { once: true });
            }, opts.dur || 660);
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

  window.MR.flight = { makeClone: makeClone, start: start };
})();
