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
    setTimeout(finish, opts.maxTotal || 1500); // watchdog
    var tries = 0;
    (function attempt() {
      if (flight.done) return;
      var el = getTarget();
      var ok =
        el && (el.complete === undefined || (el.complete && el.naturalWidth > 0));
      var r = ok ? el.getBoundingClientRect() : null;
      if (r && r.width > 10 && r.height > 10) {
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
            setTimeout(finish, opts.dur || 660);
          });
        });
      } else if (++tries < 30) {
        requestAnimationFrame(attempt);
      } else {
        finish();
      }
    })();
    return flight;
  }

  window.MR.flight = { makeClone: makeClone, start: start };
})();
