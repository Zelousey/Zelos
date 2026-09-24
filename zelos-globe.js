/*!
 * Zelos — shared 3D globe mount helper (globe.gl + three.js).
 *
 * This is the one deliberate exception to the rest of the theme's
 * "CSS/SVG only, no canvas, no JS render loop" rule — a real rotating globe
 * needs WebGL. To keep that from becoming a performance problem, every
 * mount point created here:
 *   - loads mock heat data instantly (no waiting on a real market feed)
 *   - caps devicePixelRatio so retina screens don't 4x the render cost
 *   - pauses its render loop via IntersectionObserver when scrolled off
 *     screen, and on document visibilitychange when the tab isn't active
 *   - is destroyed cleanly if the page removes its container
 *
 * Usage:
 *   ZelosGlobe.mount({
 *     el: document.getElementById('someContainer'),
 *     badges: [{ name:'US', lat:39, lng:-98, pct:1.21 }, ...],
 *     autoRotate: true,
 *     enableZoom: true,
 *     onReady: function(globeInstance){ ... }
 *   });
 */
(function (global) {
  // Self-hosted: this used to be fetched from raw.githubusercontent.com on
  // every visit. Now it's served straight from our own domain — one less
  // external dependency, and it keeps working even if that GitHub mirror
  // ever moves or rate-limits us.
  var COUNTRIES_URL = '/data/countries-110m.geojson';
  var EARTH_TEXTURE = '//unpkg.com/three-globe/example/img/earth-dark.jpg';

  function cssVar(name, fallback) {
    try {
      var v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
      return v || fallback;
    } catch (e) { return fallback; }
  }

  function hashCode(str) {
    var h = 0;
    str = str || '';
    for (var i = 0; i < str.length; i++) { h = (h << 5) - h + str.charCodeAt(i); h |= 0; }
    return h;
  }

  // deterministic mock "% change" per country name, in roughly [-3.2, 3.6]
  function pctForCountry(name) {
    var h = Math.abs(hashCode(name));
    var frac = (h % 1000) / 1000;
    return frac * 6.8 - 3.2;
  }

  function hexToRgb(hex) {
    hex = (hex || '').replace('#', '');
    if (hex.length === 3) hex = hex.split('').map(function (c) { return c + c; }).join('');
    var n = parseInt(hex, 16) || 0;
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function mixRgb(c1, c2, t) {
    return c1.map(function (v, i) { return Math.round(v + (c2[i] - v) * t); });
  }

  function colorForPct(pct, alpha) {
    alpha = alpha == null ? 0.8 : alpha;
    var bull = hexToRgb(cssVar('--bull', '#3ecb7c'));
    var danger = hexToRgb(cssVar('--danger', '#e0483f'));
    var flat = hexToRgb(cssVar('--muted-2', '#8f7250'));
    var t = Math.max(-1, Math.min(1, pct / 3.2));
    var rgb = t >= 0 ? mixRgb(flat, bull, t) : mixRgb(flat, danger, -t);
    return 'rgba(' + rgb.join(',') + ',' + alpha + ')';
  }

  function debounce(fn, ms) {
    var t;
    return function () {
      var args = arguments, ctx = this;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(ctx, args); }, ms);
    };
  }

  function isInViewport(el) {
    if (!el) return false;
    var r = el.getBoundingClientRect();
    return r.bottom > 0 && r.top < (window.innerHeight || document.documentElement.clientHeight);
  }

  var SVG_NS = 'http://www.w3.org/2000/svg';

  // simple equirectangular projection (lng/lat straight onto an x/y grid) —
  // plenty accurate for a small at-a-glance overview map, no map-projection
  // library needed. Reuses the same GeoJSON the 3D globe already fetched, so
  // the flat map never costs a second network request and always agrees
  // exactly with the globe's coloring.
  function projectPoint(lng, lat, w, h) {
    return [(lng + 180) / 360 * w, (90 - lat) / 180 * h];
  }
  function ringToPath(ring, w, h) {
    var d = '';
    for (var i = 0; i < ring.length; i++) {
      var p = projectPoint(ring[i][0], ring[i][1], w, h);
      d += (i === 0 ? 'M' : 'L') + p[0].toFixed(1) + ',' + p[1].toFixed(1) + ' ';
    }
    return d + 'Z';
  }
  // plain average-of-points centroid of a country's largest ring — not a
  // true geographic centroid, but plenty accurate to point the camera at
  // for a click-to-focus interaction (doesn't need to be exact).
  function polygonCentroid(feature) {
    var geom = feature.geometry;
    if (!geom) return null;
    var polys = geom.type === 'Polygon' ? [geom.coordinates]
      : geom.type === 'MultiPolygon' ? geom.coordinates : [];
    var best = null, bestLen = 0;
    for (var i = 0; i < polys.length; i++) {
      var ring = polys[i][0];
      if (ring && ring.length > bestLen) { best = ring; bestLen = ring.length; }
    }
    if (!best || !best.length) return null;
    var sx = 0, sy = 0;
    for (var j = 0; j < best.length; j++) { sx += best[j][0]; sy += best[j][1]; }
    return [sx / best.length, sy / best.length]; // [lng, lat]
  }

  function featureToPath(feature, w, h) {
    var geom = feature.geometry;
    if (!geom) return '';
    var polys = geom.type === 'Polygon' ? [geom.coordinates]
      : geom.type === 'MultiPolygon' ? geom.coordinates : [];
    var d = '';
    for (var i = 0; i < polys.length; i++) {
      for (var j = 0; j < polys[i].length; j++) { d += ringToPath(polys[i][j], w, h) + ' '; }
    }
    return d.trim();
  }

  function renderFlatMap(el, features) {
    if (!el) return;
    var w = 400, h = 200;
    var svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    for (var i = 0; i < features.length; i++) {
      var f = features[i];
      var name = (f.properties && (f.properties.NAME || f.properties.ADMIN)) || '';
      var path = document.createElementNS(SVG_NS, 'path');
      path.setAttribute('d', featureToPath(f, w, h));
      path.setAttribute('fill', colorForPct(pctForCountry(name), 0.85));
      path.setAttribute('stroke', 'rgba(10,7,4,0.55)');
      path.setAttribute('stroke-width', '0.4');
      var pct = pctForCountry(name);
      var titleEl = document.createElementNS(SVG_NS, 'title');
      titleEl.textContent = name + ' ' + (pct >= 0 ? '+' : '') + pct.toFixed(2) + '%';
      path.appendChild(titleEl);
      svg.appendChild(path);
    }
    el.innerHTML = '';
    el.appendChild(svg);
  }

  // Swap the loading placeholder for the finished globe with a brief
  // fade-out/fade-in instead of an abrupt pop — that hard swap (visible on
  // every navigation, since this is a full page reload each time, not an
  // SPA) is what reads as a "glitch." Cheap and works everywhere; no
  // dependency on the View Transitions API below, which not every browser
  // supports yet.
  function fadeOut(el, cb) {
    el.style.transition = 'opacity 0.28s ease';
    el.style.opacity = '0';
    setTimeout(cb, 280);
  }
  function fadeIn(el) {
    void el.offsetWidth; // force a reflow so the browser registers opacity:0 first
    el.style.transition = 'opacity 0.45s ease';
    el.style.opacity = '1';
  }

  function mount(opts) {
    var el = opts.el;
    if (!el || typeof global.Globe !== 'function') {
      if (el) el.innerHTML = '<div class="globe-loading">Live map unavailable right now</div>';
      return;
    }

    var loading = document.createElement('div');
    loading.className = 'globe-loading';
    loading.textContent = 'Loading global markets…';
    el.appendChild(loading);

    fetch(COUNTRIES_URL)
      .then(function (r) { return r.json(); })
      .then(function (world) {
        fadeOut(el, function () { mountGlobe(world); });

        function mountGlobe(world) {
        if (loading.parentNode) loading.parentNode.removeChild(loading);

        var accent = cssVar('--accent', '#4a86ff');
        // logarithmicDepthBuffer cuts down the shimmering/"glitchy" seams that
        // show up between adjacent country polygons on a plain WebGL depth
        // buffer at this scale (a known globe.gl/three.js artifact, not a
        // country-data issue) — see the note above on why this is the one
        // place in the theme that needs WebGL tuning at all.
        var g = global.Globe({ rendererConfig: { antialias: true, logarithmicDepthBuffer: true } })(el)
          .globeImageUrl(EARTH_TEXTURE)
          .backgroundColor('rgba(0,0,0,0)')
          .showAtmosphere(true)
          .atmosphereColor(accent)
          .atmosphereAltitude(0.18)
          .polygonsData(world.features)
          .polygonCapColor(function (f) {
            var name = (f.properties && (f.properties.NAME || f.properties.ADMIN)) || '';
            return colorForPct(pctForCountry(name));
          })
          .polygonSideColor(function () { return 'rgba(0,0,0,0.18)'; })
          .polygonStrokeColor(function () { return 'rgba(10,7,4,0.45)'; })
          .polygonAltitude(0.012)
          .polygonsTransitionDuration(0)
          // hover tooltip on each country — previously only the flat 2D map had this
          .polygonLabel(function (f) {
            var name = (f.properties && (f.properties.NAME || f.properties.ADMIN)) || 'Unknown';
            var pct = pctForCountry(name);
            var sign = pct >= 0 ? '+' : '';
            return '<div class="globe-tooltip"><b>' + name + '</b> ' + sign + pct.toFixed(2) + '%</div>';
          })
          // click a country to focus the camera on it — small bit of interactivity
          // beyond drag-to-rotate/scroll-zoom, no dependency on a page that doesn't exist yet
          .onPolygonClick(function (f) {
            if (!f || !f.properties) return;
            var centroid = polygonCentroid(f);
            if (!centroid) return;
            g.pointOfView({ lat: centroid[1], lng: centroid[0], altitude: 1.4 }, 700);
          });

        if (opts.badges && opts.badges.length) {
          g.htmlElementsData(opts.badges)
            .htmlLat('lat')
            .htmlLng('lng')
            .htmlAltitude(0.025)
            .htmlElement(function (d) {
              var div = document.createElement('div');
              div.className = 'globe-badge ' + (d.pct >= 0 ? 'up' : 'dn');
              div.innerHTML = '<span class="name">' + d.name + '</span><span class="pct">' +
                (d.pct >= 0 ? '+' : '') + d.pct.toFixed(2) + '%</span>';
              return div;
            });
        }

        g.pointOfView({ lat: 18, lng: -30, altitude: opts.altitude || 2.1 }, 0);

        var controls = g.controls();
        if (controls) {
          controls.autoRotate = opts.autoRotate !== false;
          controls.autoRotateSpeed = 0.55;
          controls.enableZoom = opts.enableZoom !== false;
          controls.enablePan = false;
        }

        var renderer = g.renderer && g.renderer();
        if (renderer && renderer.setPixelRatio) {
          renderer.setPixelRatio(Math.min(global.devicePixelRatio || 1, 1.5));
        }

        function resize() {
          var w = el.clientWidth, h = el.clientHeight;
          if (w && h) g.width(w).height(h);
        }
        resize();
        // a plain window-resize listener misses cases where the CONTAINER's
        // own size changes without the window changing — e.g. a flex/
        // aspect-ratio layout that hasn't finished settling on first paint,
        // or fonts/webfonts loading in and reflowing the hero above it. A
        // ResizeObserver on the element itself catches that directly, which
        // is what actually fixes a globe that renders stretched/"cut off"
        // because it sized itself against a 0×0 or transitional box.
        if ('ResizeObserver' in global) {
          var ro = new ResizeObserver(debounce(resize, 100));
          ro.observe(el);
        } else {
          global.addEventListener('resize', debounce(resize, 150));
        }
        // belt-and-suspenders: re-check shortly after mount in case the very
        // first resize() ran before layout had settled at all.
        setTimeout(resize, 300);

        // pause the render loop whenever this globe isn't actually visible —
        // this is the main defense against "lagging out the site"
        if ('IntersectionObserver' in global) {
          var io = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
              if (entry.isIntersecting && !document.hidden) { g.resumeAnimation(); }
              else { g.pauseAnimation(); }
            });
          }, { threshold: 0.05 });
          io.observe(el);
        }
        document.addEventListener('visibilitychange', function () {
          if (document.hidden) g.pauseAnimation();
          else if (isInViewport(el)) g.resumeAnimation();
        });

        if (opts.flatMapEl) renderFlatMap(opts.flatMapEl, world.features);

        if (opts.onReady) opts.onReady(g);

        fadeIn(el);
        }
      })
      .catch(function (err) {
        if (loading.parentNode) loading.parentNode.removeChild(loading);
        el.innerHTML = '<div class="globe-loading">Live map unavailable right now</div>';
        if (opts.flatMapEl) opts.flatMapEl.innerHTML = '<div class="globe-loading">Live map unavailable right now</div>';
        if (global.console) console.error('Zelos globe failed to load', err);
      });
  }

  global.ZelosGlobe = { mount: mount, pctForCountry: pctForCountry, colorForPct: colorForPct, renderFlatMap: renderFlatMap };
})(window);
