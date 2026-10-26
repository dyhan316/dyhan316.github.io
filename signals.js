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

  var topbar = document.getElementById('topbar');
  function onScroll() { topbar.classList.toggle('scrolled', scrollY > 40); }
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- Live multi-channel traces (simulated iEEG) ----------
  var NAMES = ['LTG1', 'LTG2', 'LTG3', 'LTG4', 'RHD1', 'RHD2', 'RHD3', 'RHD4'];
  var N = NAMES.length;
  var canvas = document.getElementById('traces');
  var ctx = canvas.getContext('2d');
  var labels = document.querySelector('.ch-labels');
  labels.innerHTML = NAMES.map(function (n) { return '<span>' + n + '</span>'; }).join('');

  var w = 0, h = 0, buf = [], t = 0;
  var chans = NAMES.map(function (_, i) {
    return { queue: [], walk: 0, lp: 0, alpha: 8 + Math.random() * 4, phase: Math.random() * 6, amp: 0.6 + Math.random() * 0.5, burst: 0, color: i % 3 === 2 ? '#ff2e88' : '#2ef2ff' };
  });
  var pointer = null;

  function sample(c) {
    // Pink-ish background noise + an alpha rhythm + occasional bursts and spikes
    c.walk = c.walk * 0.985 + (Math.random() - 0.5) * 0.35;
    c.lp = c.lp * 0.6 + (Math.random() - 0.5) * 0.5;
    var osc = Math.sin(t * c.alpha * 0.055 + c.phase) * 0.35 * c.amp;
    var gamma = c.burst > 0 ? Math.sin(t * 1.9) * 0.55 * c.burst : 0;
    c.burst *= 0.97;
    var spike = Math.random() < 0.002 ? (Math.random() < 0.5 ? -1 : 1) * 1.6 : 0;
    var evoked = c.queue.length ? c.queue.shift() : 0;
    return c.walk * 0.6 + c.lp * 0.4 + osc + gamma + spike + evoked;
  }

  function resize() {
    var dpr = devicePixelRatio || 1;
    w = canvas.clientWidth; h = canvas.clientHeight;
    canvas.width = w * dpr; canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    buf = chans.map(function (c) { var a = []; for (var i = 0; i < w; i++) { t += 0.25; a.push(sample(c)); } return a; });
  }

  function drawTraces() {
    ctx.clearRect(0, 0, w, h);
    var rowH = h / N;
    for (var k = 0; k < N; k++) {
      var c = chans[k], b = buf[k], mid = rowH * (k + 0.5), scale = rowH * 0.32;
      ctx.beginPath();
      for (var x = 0; x < b.length; x++) {
        var y = mid - b[x] * scale;
        if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = c.color;
      ctx.lineWidth = 1.1;
      ctx.shadowColor = c.color;
      ctx.shadowBlur = 6;
      ctx.globalAlpha = 0.85;
      ctx.stroke();
    }
    ctx.shadowBlur = 0; ctx.globalAlpha = 1;
    if (flash > 0.01) { ctx.fillStyle = 'rgba(255,46,136,' + (flash * 0.12).toFixed(3) + ')'; ctx.fillRect(0, 0, w, h); flash *= 0.9; }
    if (pointer) { // cursor marker, like a time cursor in a viewer
      ctx.strokeStyle = 'rgba(255,46,136,0.5)'; ctx.setLineDash([3, 4]);
      ctx.beginPath(); ctx.moveTo(pointer.x, 0); ctx.lineTo(pointer.x, h); ctx.stroke(); ctx.setLineDash([]);
    }
  }

  function step() {
    for (var s = 0; s < 3; s++) {
      t += 0.25;
      for (var k = 0; k < N; k++) { buf[k].shift(); buf[k].push(sample(chans[k])); }
    }
  }

  // Moving over the traces evokes a burst on the nearest channels
  canvas.addEventListener('pointermove', function (e) {
    var r = canvas.getBoundingClientRect();
    pointer = { x: e.clientX - r.left, y: e.clientY - r.top };
    var k = Math.floor(pointer.y / (h / N));
    for (var j = 0; j < N; j++) chans[j].burst = Math.max(chans[j].burst, Math.max(0, 1 - Math.abs(j - k) * 0.45));
    ecogStim = { x: 72 + pointer.x / w * 190, y: 34 + pointer.y / h * 130 };
  });
  // Click: an evoked response that ripples outward from the clicked channel
  function evoke(k0) {
    for (var j = 0; j < N; j++) {
      var d = Math.abs(j - k0), delay = d * 6, gain = 2.2 * Math.max(0.25, 1 - d * 0.18);
      var q = [];
      for (var i = 0; i < delay; i++) q.push(0);
      for (var i2 = 0; i2 < 40; i2++) { var x = i2 / 40; q.push(gain * Math.sin(x * Math.PI * 2) * Math.exp(-x * 3)); }
      chans[j].queue = q;
      chans[j].burst = Math.max(chans[j].burst, 0.6 - d * 0.07);
    }
    flash = 1;
  }
  var flash = 0;
  canvas.addEventListener('pointerdown', function (e) {
    var r = canvas.getBoundingClientRect();
    evoke(Math.min(N - 1, Math.floor((e.clientY - r.top) / (r.height / N))));
    ecogStim = { x: 72 + (e.clientX - r.left) / r.width * 190, y: 34 + (e.clientY - r.top) / r.height * 130, strong: true };
  });
  canvas.addEventListener('pointerleave', function () { pointer = null; ecogStim = null; });

  // ---------- ECoG grid on a brain (left hemisphere, side view, frontal pole on the left) ----------
  var SVGNS = 'http://www.w3.org/2000/svg';
  var ecog = document.getElementById('ecog');
  ecog.innerHTML =
    '<svg class="brain" viewBox="0 0 300 210" aria-hidden="true">' +
      '<defs><radialGradient id="cortex" cx="40%" cy="40%" r="70%">' +
        '<stop offset="0" stop-color="#1b1236"/><stop offset="1" stop-color="#0b0818"/></radialGradient></defs>' +
      '<ellipse class="cerebellum" cx="252" cy="164" rx="30" ry="16"/>' +
      '<path class="folia" d="M228 162 C242 158 262 158 278 164 M232 170 C246 167 262 167 274 172"/>' +
      '<path class="stem" d="M214 164 C218 182 222 194 220 208"/>' +
      '<path class="cortex" id="cortexPath" d="M64 104 C56 64 92 26 146 20 C204 14 262 36 280 82 C292 114 282 140 262 148 C252 152 240 152 230 150 C222 164 206 172 188 172 C168 180 140 180 120 170 C104 164 96 152 98 140 C90 142 80 140 74 134 C62 126 60 114 64 104 Z"/>' +
      '<g class="sulci">' +
        '<path class="sylvian" d="M98 140 C130 124 170 120 214 128"/>' +
        '<path class="central" d="M176 22 C168 52 182 84 162 116"/>' +
        '<path d="M112 158 C140 150 180 148 220 148"/>' +
        '<path d="M80 70 C110 64 140 66 160 58"/>' +
        '<path d="M70 100 C100 92 130 96 150 90"/>' +
        '<path d="M200 40 C205 70 220 90 250 100"/>' +
        '<path d="M215 112 C235 118 255 116 270 104"/>' +
      '</g>' +
      '<g class="electrodes"></g>' +
      '<g class="region-label"><text id="regionLabel" x="2" y="6"></text></g>' +
    '</svg>';
  var cortexPath = document.getElementById('cortexPath');
  var eg = ecog.querySelector('.electrodes');
  var regionLabel = document.getElementById('regionLabel');
  var cells = [];
  for (var r = 0; r < 8; r++) for (var c = 0; c < 8; c++) {
    var x = 72 + c * 26 + (r % 2) * 4, y = 34 + r * 18 + 7 * Math.sin(c / 7 * Math.PI);
    var pt = cortexPath.ownerSVGElement.createSVGPoint(); pt.x = x; pt.y = y;
    if (!cortexPath.isPointInFill(pt)) continue;
    var dot = document.createElementNS(SVGNS, 'circle');
    dot.setAttribute('cx', x); dot.setAttribute('cy', y); dot.setAttribute('r', 3.4);
    eg.appendChild(dot);
    cells.push({ el: dot, x: x, y: y, ch: cells.length % N });
  }
  var blobs = [0, 1, 2].map(function () { return { x: 80 + Math.random() * 180, y: 40 + Math.random() * 120, vx: (Math.random() - .5) * 1.6, vy: (Math.random() - .5) * 1.2 }; });
  var ecogStim = null;
  cells.forEach(function (cell) {
    cell.el.addEventListener('pointerenter', function () { ecogStim = { x: cell.x, y: cell.y }; chans[cell.ch].burst = 1; });
    cell.el.addEventListener('pointerdown', function (e) { e.preventDefault(); ecogStim = { x: cell.x, y: cell.y, strong: true }; evoke(cell.ch); });
  });
  ecog.addEventListener('pointerleave', function () { ecogStim = null; });
  function drawEcog() {
    blobs.forEach(function (b) {
      b.x += b.vx; b.y += b.vy;
      if (b.x < 70 || b.x > 270) b.vx *= -1;
      if (b.y < 30 || b.y > 170) b.vy *= -1;
    });
    cells.forEach(function (cell) {
      var a = 0;
      var amb = focus ? 0.18 : 1; // background activity quiets down while an intent is active
      blobs.forEach(function (b) { var d = (b.x - cell.x) * (b.x - cell.x) + (b.y - cell.y) * (b.y - cell.y); a += amb * Math.exp(-d / 1400); });
      if (ecogStim) { var d2 = (ecogStim.x - cell.x) * (ecogStim.x - cell.x) + (ecogStim.y - cell.y) * (ecogStim.y - cell.y); a += (ecogStim.strong ? 2.2 : 1.4) * Math.exp(-d2 / 700); }
      if (focus) focus.pts.forEach(function (p) { var d3 = (p[0] - cell.x) * (p[0] - cell.x) + (p[1] - cell.y) * (p[1] - cell.y); a += 1.7 * Math.exp(-d3 / (p[2] || 650)); });
      a = Math.min(1, a * 0.8 + Math.random() * (focus ? 0.04 : 0.08));
      cell.a = a;
      var col = a > 0.7 ? '255,46,136' : '46,242,255';
      cell.el.style.fill = 'rgba(' + col + ',' + (0.12 + a * 0.85).toFixed(2) + ')';
      cell.el.style.filter = a > 0.45 ? 'drop-shadow(0 0 ' + (a * 4).toFixed(1) + 'px rgba(' + col + ',0.9))' : 'none';
    });
  }

  // ---------- Decoder readout ----------
  var INTENTS = ['listening', 'speaking', 'move right hand', 'seeing', 'rest'];
  var list = document.getElementById('intents');
  list.innerHTML = INTENTS.map(function (n) { return '<li><span>' + n + '</span><span class="bar"><b></b></span><span class="p">0.00</span></li>'; }).join('');
  var rows = list.querySelectorAll('li');
  // Where each imagined intent shows up on the grid, and which trace channels respond
  // Anatomy on this left-hemisphere view (frontal pole on the left, central sulcus in magenta).
  // Each intent lights the areas that ECoG studies typically record for it.
  var TARGET = [
    { name: 'superior temporal gyrus · auditory', pts: [[178, 136], [206, 140]] },        // A1 / Heschl's, posterior STG (Wernicke)
    { name: "Broca's area + ventral motor cortex", pts: [[112, 124], [152, 106, 450]] },       // inferior frontal gyrus, mouth area of precentral gyrus
    { name: 'precentral gyrus · hand knob', pts: [[150, 50, 380]] },                           // motor cortex, just in front of the central sulcus
    { name: 'occipital lobe · visual cortex', pts: [[252, 100], [244, 124]] },            // lateral occipital
    null];
  var focus = null, focusIdx = -1, focusUntil = 0;
  rows.forEach(function (li, i) {
    li.tabIndex = 0;
    li.setAttribute('role', 'button');
    li.title = 'Imagine "' + INTENTS[i] + '"';
    function pick() {
      focusIdx = i; focusUntil = performance.now() + 4000; focus = TARGET[i];
      regionLabel.textContent = focus ? focus.name : 'resting state';
      rows.forEach(function (x, j) { x.classList.toggle('picked', j === i); });
      if (focus) evoke(Math.round(focus.pts[0][1] / 210 * (N - 1)));
      decode();
    }
    li.addEventListener('click', pick);
    li.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } });
  });
  var logits = INTENTS.map(function () { return Math.random(); });
  var latency = document.getElementById('latency');
  function decode() {
    if (focusIdx >= 0 && performance.now() > focusUntil) { focusIdx = -1; focus = null; regionLabel.textContent = ''; rows.forEach(function (x) { x.classList.remove('picked'); }); }
    logits = logits.map(function (l, i) { return l * 0.8 + (Math.random() - 0.4) * 1.2 + (focusIdx < 0 && i === 0 ? 0.35 : 0); });
    var ex = logits.map(function (l, i) { return Math.exp(Math.max(-3, Math.min(3, l)) * 1.6 + (i === focusIdx ? 2.2 : 0)); });
    var sum = ex.reduce(function (a, b) { return a + b; }, 0);
    var p = ex.map(function (e) { return e / sum; });
    var top = p.indexOf(Math.max.apply(null, p));
    rows.forEach(function (li, i) {
      li.querySelector('b').style.width = (p[i] * 100).toFixed(1) + '%';
      li.querySelector('.p').textContent = p[i].toFixed(2);
      li.classList.toggle('top', i === top);
    });
    latency.textContent = (9 + Math.round(Math.random() * 6)) + ' ms';
  }

  // ---------- Loop ----------
  resize();
  addEventListener('resize', resize);
  drawTraces(); drawEcog(); decode();
  if (!reduceMotion) {
    var last = 0;
    (function loop(now) {
      step(); drawTraces();
      if (now - last > 90) { drawEcog(); last = now; }
      requestAnimationFrame(loop);
    })(0);
    setInterval(decode, 700);
  }
})();
