(function () {
  // Spam protection: the address is never written in the HTML. It is put together only when clicked.
  document.querySelectorAll('a.email').forEach(function (a) {
    function reveal() {
      a.href = 'mailto:' + a.dataset.u + String.fromCharCode(64) + a.dataset.d + '.' + a.dataset.t;
    }
    a.addEventListener('mousedown', reveal);
    a.addEventListener('touchstart', reveal, { passive: true });
    a.addEventListener('keydown', function (e) { if (e.key === 'Enter') reveal(); });
  });

  // Nav bar is transparent over the sky and turns solid once you scroll into the water.
  var topbar = document.getElementById('topbar');
  function onScroll() { topbar.classList.toggle('scrolled', scrollY > 60); }
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Depth gauge: shows how deep you are, and doubles as a scrollbar you can click or drag.
  var MAX_DEPTH = 1000; // metres at the bottom of the page
  var TRACK = 240;
  var gauge = document.querySelector('.gauge');
  var track = document.querySelector('.gauge-track');
  var mark = document.querySelector('.gauge-mark');
  var label = document.querySelector('.gauge-label');
  function maxScroll() { return document.documentElement.scrollHeight - innerHeight; }
  function updateGauge() {
    var max = maxScroll();
    var f = max > 0 ? Math.min(1, Math.max(0, scrollY / max)) : 0;
    var y = f * TRACK;
    mark.style.top = y + 'px';
    label.style.top = y + 'px';
    var depth = Math.round(f * MAX_DEPTH);
    label.textContent = depth + ' m';
    gauge.setAttribute('aria-valuenow', depth);
  }
  function scrollToPointer(e) {
    var r = track.getBoundingClientRect();
    var f = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
    window.scrollTo({ top: f * maxScroll(), behavior: 'instant' });
  }
  gauge.addEventListener('pointerdown', function (e) {
    e.preventDefault();
    gauge.setPointerCapture(e.pointerId);
    gauge.classList.add('dragging');
    scrollToPointer(e);
  });
  gauge.addEventListener('pointermove', function (e) {
    if (gauge.hasPointerCapture(e.pointerId)) scrollToPointer(e);
  });
  function endDrag(e) {
    if (gauge.hasPointerCapture(e.pointerId)) gauge.releasePointerCapture(e.pointerId);
    gauge.classList.remove('dragging');
  }
  gauge.addEventListener('pointerup', endDrag);
  gauge.addEventListener('pointercancel', endDrag);
  gauge.addEventListener('keydown', function (e) {
    var step = { ArrowDown: 0.1, ArrowUp: -0.1, PageDown: 0.25, PageUp: -0.25 }[e.key];
    if (e.key === 'Home') step = -1;
    if (e.key === 'End') step = 1;
    if (step === undefined) return;
    e.preventDefault();
    window.scrollBy({ top: step * maxScroll(), behavior: 'smooth' });
  });
  addEventListener('scroll', updateGauge, { passive: true });
  addEventListener('resize', updateGauge);
  updateGauge();

  // Bubbles: faint ambient ones drifting up everywhere, plus a stream from the diver's regulator.
  var canvas = document.getElementById('bubbles');
  var ctx = canvas.getContext('2d');
  var regulator = document.getElementById('regulator');
  var bubbles = [], ambientCount = 0, w = 0, h = 0, lastBreath = 0;

  function bubble(x, y, fromDiver) {
    return {
      x: x, y: y,
      r: fromDiver ? Math.random() * 2.5 + 1.2 : Math.random() * 1.8 + 0.5,
      vy: fromDiver ? Math.random() * 0.4 + 0.6 : Math.random() * 0.3 + 0.15,
      phase: Math.random() * Math.PI * 2,
      a: fromDiver ? 0.55 : Math.random() * 0.3 + 0.12,
      diver: fromDiver
    };
  }

  function resize() {
    var dpr = devicePixelRatio || 1;
    w = innerWidth; h = innerHeight;
    canvas.width = w * dpr; canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ambientCount = Math.round(w * h / 22000);
    bubbles = [];
    for (var i = 0; i < ambientCount; i++) bubbles.push(bubble(Math.random() * w, Math.random() * h, false));
  }

  function drawBubble(b, x) {
    ctx.beginPath();
    ctx.arc(x, b.y, b.r, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(200, 238, 248,' + b.a + ')';
    ctx.lineWidth = b.r > 1.5 ? 1 : 0.7;
    ctx.stroke();
    if (b.r > 1.5) {
      ctx.beginPath();
      ctx.arc(x - b.r * 0.35, b.y - b.r * 0.35, b.r * 0.28, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(235, 250, 255,' + b.a + ')';
      ctx.fill();
    }
  }

  function breathe(t) {
    // Every few seconds, while the diver is on screen, exhale a short burst.
    if (!regulator || t - lastBreath < 3800) return;
    var rect = regulator.getBoundingClientRect();
    if (rect.bottom < 0 || rect.top > h) return;
    lastBreath = t;
    var n = 5 + Math.floor(Math.random() * 5);
    for (var i = 0; i < n; i++) {
      bubbles.push(bubble(rect.left + rect.width / 2 + (Math.random() - 0.5) * 6, rect.top + i * 7, true));
    }
  }

  function draw(t) {
    ctx.clearRect(0, 0, w, h);
    if (!reduceMotion) breathe(t);
    for (var i = bubbles.length - 1; i >= 0; i--) {
      var b = bubbles[i];
      if (!reduceMotion) {
        b.y -= b.vy;
        b.vy *= b.diver ? 1.002 : 1; // diver bubbles speed up as they rise
        if (b.y < -10) {
          if (b.diver) { bubbles.splice(i, 1); continue; }
          b.y = h + 10; b.x = Math.random() * w; b.vy = Math.random() * 0.3 + 0.15;
        }
      }
      var x = b.x + Math.sin(t / (b.diver ? 400 : 1400) + b.phase) * (b.diver ? 2.5 : 4);
      drawBubble(b, x);
    }
    if (!reduceMotion) requestAnimationFrame(draw);
  }

  addEventListener('resize', resize);
  resize();
  requestAnimationFrame(draw);
})();
