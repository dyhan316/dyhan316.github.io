(function () {
  // City-level map of where research has taken me. Positions are generic city centres, never real coordinates.
  var section = document.getElementById('places');
  var svg = document.getElementById('placesMap');
  var list = document.getElementById('placeList');
  if (!section || !svg) return;

  var PLACES = [
    { id: 'seoul',        name: 'Seoul',        note: 'Seoul National University',               ll: [126.978, 37.567],  region: 'asia' },
    { id: 'daegu',        name: 'Daegu',        note: 'Daegu Il Science High School',            ll: [128.601, 35.871],  region: 'asia' },
    { id: 'jeju',         name: 'Jeju',         note: '',                                        ll: [126.531, 33.500],  region: 'asia' },
    { id: 'tokyo',        name: 'Tokyo',        note: '',                                        ll: [139.650, 35.676],  region: 'asia' },
    { id: 'princeton',    name: 'Princeton',    note: 'Hasson Lab, Princeton University',        ll: [-74.667, 40.357],  region: 'ne' },
    { id: 'nyc',          name: 'New York',     note: 'CCN 2026',                                ll: [-74.006, 40.713],  region: 'ne' },
    { id: 'philly',       name: 'Philadelphia', note: '',                                        ll: [-75.165, 39.953],  region: 'ne' },
    { id: 'minneapolis',  name: 'Minneapolis',  note: 'University of Minnesota, Neurosurgery',   ll: [-93.265, 44.978],  region: 'usa' },
    { id: 'atlanta',      name: 'Atlanta',      note: 'IEEE MLSP 2026',                          ll: [-84.388, 33.749],  region: 'usa' },
    { id: 'sf',           name: 'San Francisco', note: '',                                       ll: [-122.419, 37.775], region: 'usa' },
    { id: 'sanjose',      name: 'San Jose',     note: 'Bay Area',                                ll: [-121.886, 37.338], region: 'usa' }
  ];
  var REGIONS = {
    world: { c: [10, 25],      s: 130,   labels: [] },
    asia:  { c: [133, 35.5],   s: 2800,  labels: ['seoul', 'daegu', 'jeju', 'tokyo'] },
    usa:   { c: [-98.5, 39],    s: 720,   labels: ['minneapolis', 'atlanta'] },
    ne:    { c: [-74.9, 40.35], s: 15000, labels: ['princeton', 'nyc', 'philly'] }
  };

  // Place list (always works, even if the map libraries fail to load)
  list.innerHTML = PLACES.map(function (p) {
    return '<li><button type="button" data-id="' + p.id + '"><span class="pn">' + p.name + '</span>' +
      (p.note ? '<span class="pr">' + p.note + '</span>' : '') + '</button></li>';
  }).join('');

  if (typeof d3 === 'undefined' || typeof topojson === 'undefined') { section.classList.add('no-map'); return; }

  var W = 860, H = 430, NS = 'http://www.w3.org/2000/svg';
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var proj = d3.geoMercator().translate([W / 2, H / 2]);
  var path = d3.geoPath(proj);
  var grat = d3.geoGraticule10();
  var land = null;

  function el(tag, attrs, parent) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  var gratEl = el('path', { class: 'grat' }, svg);
  var landEl = el('path', { class: 'land' }, svg);
  var ptsG = el('g', {}, svg);
  var pts = PLACES.map(function (p) {
    var g = el('g', { class: 'pt', 'data-id': p.id }, ptsG);
    el('circle', { class: 'halo', r: 9 }, g);
    el('circle', { class: 'dot', r: 3.6 }, g);
    var t = el('text', { class: 'lbl', x: 9, y: 4 }, g);
    t.textContent = p.name;
    return { p: p, g: g };
  });

  var region = 'world', focus = null;
  var cur = { c: REGIONS.world.c.slice(), s: REGIONS.world.s };

  function labelFont() { // keep labels readable when the SVG is scaled down on phones
    var w = svg.clientWidth || W;
    svg.style.setProperty('--lbl', (11 / (w / W)).toFixed(1) + 'px');
  }

  function render() {
    proj.center(cur.c).scale(cur.s);
    gratEl.setAttribute('d', path(grat) || '');
    if (land) landEl.setAttribute('d', path(land) || '');
    pts.forEach(function (o) {
      var xy = proj(o.p.ll);
      var on = xy && xy[0] > -30 && xy[0] < W + 30 && xy[1] > -30 && xy[1] < H + 30;
      o.g.style.display = on ? '' : 'none';
      if (!on) return;
      o.g.setAttribute('transform', 'translate(' + xy[0].toFixed(1) + ',' + xy[1].toFixed(1) + ')');
      var showLbl = REGIONS[region].labels.indexOf(o.p.id) >= 0 || focus === o.p.id;
      o.g.classList.toggle('show', showLbl);
      o.g.classList.toggle('focus', focus === o.p.id);
    });
  }

  // The coarse 110m outline is fine for the world view; fetch the sharper 50m one the first time someone zooms in.
  var sharp = false;
  function loadSharp() {
    if (sharp) return; sharp = true;
    fetch('data/land-50m.json').then(function (r) { return r.json(); }).then(function (topo) {
      land = topojson.feature(topo, topo.objects.land); render();
    }).catch(function () { sharp = false; });
  }

  var raf = null;
  function goTo(name) {
    region = name;
    if (name !== 'world') loadSharp();
    var to = REGIONS[name], from = { c: cur.c.slice(), s: cur.s };
    document.querySelectorAll('.map-tabs button').forEach(function (b) {
      b.setAttribute('aria-selected', b.dataset.region === name ? 'true' : 'false');
    });
    if (raf) cancelAnimationFrame(raf);
    if (reduceMotion) { cur = { c: to.c.slice(), s: to.s }; render(); return; }
    var t0 = performance.now(), dur = 700;
    (function frame(now) {
      var k = Math.min(1, (now - t0) / dur);
      var e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      cur.c = [from.c[0] + (to.c[0] - from.c[0]) * e, from.c[1] + (to.c[1] - from.c[1]) * e];
      cur.s = Math.exp(Math.log(from.s) + (Math.log(to.s) - Math.log(from.s)) * e);
      render();
      if (k < 1) raf = requestAnimationFrame(frame);
    })(t0);
  }

  function setFocus(id) { focus = id; render(); list.querySelectorAll('button').forEach(function (b) { b.classList.toggle('on', b.dataset.id === id); }); }
  function byId(id) { return PLACES.filter(function (p) { return p.id === id; })[0]; }

  document.querySelectorAll('.map-tabs button').forEach(function (b) {
    b.addEventListener('click', function () { setFocus(null); goTo(b.dataset.region); });
  });
  list.querySelectorAll('button').forEach(function (b) {
    b.addEventListener('mouseenter', function () { setFocus(b.dataset.id); });
    b.addEventListener('focus', function () { setFocus(b.dataset.id); });
    b.addEventListener('mouseleave', function () { setFocus(null); });
    b.addEventListener('blur', function () { setFocus(null); });
    b.addEventListener('click', function () {
      var p = byId(b.dataset.id);
      setFocus(p.id);
      if (region !== p.region) goTo(p.region);
    });
  });
  pts.forEach(function (o) {
    o.g.addEventListener('mouseenter', function () { setFocus(o.p.id); });
    o.g.addEventListener('mouseleave', function () { setFocus(null); });
  });

  addEventListener('resize', labelFont);
  labelFont();
  render();

  fetch('data/land-110m.json').then(function (r) { return r.json(); }).then(function (topo) {
    land = topojson.feature(topo, topo.objects.land);
    render();
    section.classList.add('map-ready');
  }).catch(function () { section.classList.add('no-map'); });
})();
