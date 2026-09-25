/*!
 * Zelos Globe v2: a self-contained WebGL globe. No three.js, no globe.gl,
 * no external textures.
 *
 * Everything the globe draws is generated in the browser from the one
 * GeoJSON file we already self-host (/data/countries-110m.geojson): the land
 * mask, coastlines, borders, desert/ice regions and night-time city lights
 * are painted onto offscreen canvases once and uploaded as textures. The
 * surface itself is rendered by a single fragment shader (ray-sphere
 * intersection per pixel), so the whole thing is one draw call per frame.
 *
 * What's real on it:
 *   - The day/night terminator uses the actual position of the sun right
 *     now (subsolar point from the date and UTC time).
 *   - Exchange markers show whether each exchange is inside its regular
 *     trading hours right now, computed from its own local time zone.
 *     (Public holidays and half-days are NOT accounted for, which the
 *     tooltip says.)
 *
 * Styles:  'realistic' | 'futuristic' | 'blend' (default)
 *
 * Usage (same entry point as v1, so existing pages keep working):
 *   ZelosGlobe.mount({
 *     el: document.getElementById('someContainer'),
 *     style: 'blend',
 *     autoRotate: true,
 *     enableZoom: true,
 *     altitude: 2.1,          // v1-compatible zoom hint; bigger = further away
 *     exchanges: true,        // exchange markers + open/closed state
 *     arcs: true,             // animated arcs between open exchanges
 *     heat: false,            // colour countries by opts.heatFn(name) -> pct
 *     badges: [...],          // optional {name,lat,lng,pct} chips (v1 API)
 *     flatMapEl: el2,         // optional flat SVG overview map (v1 API)
 *     onReady: function(ctrl){}
 *   });
 *
 * Performance: devicePixelRatio is capped, the render loop pauses when the
 * globe is scrolled off-screen or the tab is hidden, and the loop stops
 * entirely if the container is removed from the page.
 */
(function (global) {
  'use strict';

  // resolved relative to this script, so the globe works from any page depth
  // and from preview hosts that don't serve the site at the domain root
  var COUNTRIES_URL = (function () {
    try {
      var src = document.currentScript && document.currentScript.src;
      if (src) return new URL('data/countries-110m.geojson', src).href;
    } catch (e) {}
    return '/data/countries-110m.geojson';
  })();
  var MARKETS_URL = COUNTRIES_URL.replace('countries-110m.geojson', 'globe-markets.json');
  // live copy published by the daily market-map job (public read); the static
  // file above is the fallback, so the globe always has something to show
  var MARKETS_FIRESTORE = 'https://firestore.googleapis.com/v1/projects/leaderboard-agentictrading/databases/(default)/documents/markets/globe';
  var marketsPromise = null;
  function loadMarkets() {
    if (marketsPromise) return marketsPromise;
    function fromStatic() { return fetch(MARKETS_URL).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }); }
    marketsPromise = fetch(MARKETS_FIRESTORE).then(function (r) { return r.ok ? r.json() : null; })
      .then(function (doc) {
        var j = doc && doc.fields && doc.fields.json && doc.fields.json.stringValue;
        var live = j ? JSON.parse(j) : null;
        return fromStatic().then(function (st) {
          if (!live) return st;
          if (st && st.asOf && live.asOf && st.asOf > live.asOf) return st;
          return live;
        });
      })
      .catch(fromStatic);
    return marketsPromise;
  }
  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function pctHtml(v) {
    if (v == null || isNaN(v)) return '<span class="gc-na">n/a</span>';
    return '<span class="' + (v >= 0 ? 'gc-up' : 'gc-dn') + '">' + (v >= 0 ? '+' : '&minus;') + Math.abs(v).toFixed(2) + '%</span>';
  }
  function niceDate(iso) {
    if (!iso) return '';
    var m = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return m[parseInt(iso.slice(5, 7), 10) - 1] + ' ' + parseInt(iso.slice(8, 10), 10);
  }
  var TEX_W = 2048, TEX_H = 1024;
  var DEG = Math.PI / 180;

  // ------------------------------------------------------------ helpers
  function cssVar(name, fallback) {
    try {
      var v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
      return v || fallback;
    } catch (e) { return fallback; }
  }
  function hexToRgb(hex) {
    hex = (hex || '').replace('#', '').trim();
    if (hex.length === 3) hex = hex.split('').map(function (c) { return c + c; }).join('');
    var n = parseInt(hex, 16);
    if (isNaN(n)) n = 0x4a86ff;
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function mixRgb(c1, c2, t) { return c1.map(function (v, i) { return Math.round(v + (c2[i] - v) * t); }); }
  function hashCode(str) {
    var h = 0; str = str || '';
    for (var i = 0; i < str.length; i++) { h = (h << 5) - h + str.charCodeAt(i); h |= 0; }
    return h;
  }
  // v1 compatibility: deterministic illustrative value per country.
  // Only used when a page explicitly turns heat mode on.
  function pctForCountry(name) {
    var h = Math.abs(hashCode(name));
    return ((h % 1000) / 1000) * 6.8 - 3.2;
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
    return function () { var a = arguments, c = this; clearTimeout(t); t = setTimeout(function () { fn.apply(c, a); }, ms); };
  }
  function featureName(f) { return (f.properties && (f.properties.NAME || f.properties.ADMIN)) || ''; }
  function seeded(seed) {
    var s = seed >>> 0;
    return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  }
  function llToVec(lat, lng) {
    var la = lat * DEG, lo = lng * DEG;
    return [Math.cos(la) * Math.sin(lo), Math.sin(la), Math.cos(la) * Math.cos(lo)];
  }
  function dot3(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  function cross3(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
  function norm3(a) { var l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }

  // Subsolar point (where the sun is directly overhead) for a given moment.
  // Declination from day-of-year, longitude from UTC time. Ignores the
  // equation of time (under ~4 degrees of error), plenty for a terminator.
  function sunVector(date) {
    var start = Date.UTC(date.getUTCFullYear(), 0, 0);
    var doy = (date.getTime() - start) / 86400000;
    var decl = -23.44 * Math.cos((2 * Math.PI / 365) * (doy + 10));
    var utcH = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;
    var lng = -15 * (utcH - 12);
    return llToVec(decl, lng);
  }

  // ------------------------------------------------------------ exchanges
  // Regular sessions in each exchange's local time. Lunch breaks included
  // where they exist. Holidays are not modelled.
  var EXCHANGES = [
    { id: 'NYSE', name: 'NYSE / Nasdaq', city: 'New York', lat: 40.71, lng: -74.01, tz: 'America/New_York', s: [[570, 960]], hub: true },
    { id: 'TSX', name: 'TSX', city: 'Toronto', lat: 43.65, lng: -79.38, tz: 'America/Toronto', s: [[570, 960]] },
    { id: 'BMV', name: 'BMV', city: 'Mexico City', lat: 19.43, lng: -99.13, tz: 'America/Mexico_City', s: [[510, 900]] },
    { id: 'B3', name: 'B3', city: 'São Paulo', lat: -23.55, lng: -46.63, tz: 'America/Sao_Paulo', s: [[600, 1020]] },
    { id: 'LSE', name: 'LSE', city: 'London', lat: 51.51, lng: -0.09, tz: 'Europe/London', s: [[480, 990]], hub: true },
    { id: 'ENX', name: 'Euronext', city: 'Paris', lat: 48.86, lng: 2.35, tz: 'Europe/Paris', s: [[540, 1050]] },
    { id: 'XETRA', name: 'Xetra', city: 'Frankfurt', lat: 50.11, lng: 8.68, tz: 'Europe/Berlin', s: [[540, 1050]] },
    { id: 'SIX', name: 'SIX', city: 'Zurich', lat: 47.37, lng: 8.54, tz: 'Europe/Zurich', s: [[540, 1050]] },
    { id: 'JSE', name: 'JSE', city: 'Johannesburg', lat: -26.2, lng: 28.05, tz: 'Africa/Johannesburg', s: [[540, 1020]] },
    { id: 'TADAWUL', name: 'Tadawul', city: 'Riyadh', lat: 24.71, lng: 46.68, tz: 'Asia/Riyadh', s: [[600, 900]], days: [0, 1, 2, 3, 4] },
    { id: 'NSE', name: 'NSE', city: 'Mumbai', lat: 19.08, lng: 72.88, tz: 'Asia/Kolkata', s: [[555, 930]] },
    { id: 'SSE', name: 'SSE', city: 'Shanghai', lat: 31.23, lng: 121.47, tz: 'Asia/Shanghai', s: [[570, 690], [780, 900]] },
    { id: 'HKEX', name: 'HKEX', city: 'Hong Kong', lat: 22.32, lng: 114.17, tz: 'Asia/Hong_Kong', s: [[570, 720], [780, 960]], hub: true },
    { id: 'TSE', name: 'TSE', city: 'Tokyo', lat: 35.68, lng: 139.77, tz: 'Asia/Tokyo', s: [[540, 690], [750, 930]], hub: true },
    { id: 'KRX', name: 'KRX', city: 'Seoul', lat: 37.57, lng: 126.98, tz: 'Asia/Seoul', s: [[540, 930]] },
    { id: 'SGX', name: 'SGX', city: 'Singapore', lat: 1.29, lng: 103.85, tz: 'Asia/Singapore', s: [[540, 720], [780, 1020]] },
    { id: 'ASX', name: 'ASX', city: 'Sydney', lat: -33.87, lng: 151.21, tz: 'Australia/Sydney', s: [[600, 960]] }
  ];
  var WD = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  function localParts(tz, date) {
    try {
      var parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(date);
      var o = {};
      parts.forEach(function (p) { o[p.type] = p.value; });
      return { wd: WD[o.weekday], min: (parseInt(o.hour, 10) % 24) * 60 + parseInt(o.minute, 10) };
    } catch (e) { return null; }
  }
  function fmtMin(m) {
    var h = Math.floor(m / 60), mm = m % 60;
    return (h < 10 ? '0' : '') + h + ':' + (mm < 10 ? '0' : '') + mm;
  }
  function exchangeStatus(x, date) {
    var lp = localParts(x.tz, date);
    if (!lp) return { open: false, label: 'Hours unavailable' };
    var days = x.days || [1, 2, 3, 4, 5];
    var local = fmtMin(lp.min);
    if (days.indexOf(lp.wd) === -1) return { open: false, label: 'Closed for the weekend' };
    for (var i = 0; i < x.s.length; i++) {
      if (lp.min >= x.s[i][0] && lp.min < x.s[i][1]) return { open: true, label: 'Open · closes ' + fmtMin(x.s[i][1]) + ' local' };
    }
    for (var j = 0; j < x.s.length; j++) {
      if (lp.min < x.s[j][0]) return { open: false, label: (j ? 'Lunch break' : 'Pre-open') + ' · opens ' + fmtMin(x.s[j][0]) + ' local' };
    }
    return { open: false, label: 'Closed · opens ' + fmtMin(x.s[0][0]) + ' local' };
  }

  // Major metro areas for the night-lights texture: [lat, lng, weight].
  var CITIES = [
    [40.7, -74, 1], [34.05, -118.25, .9], [41.88, -87.63, .8], [29.76, -95.37, .7], [33.75, -84.39, .6], [25.76, -80.19, .6],
    [32.78, -96.8, .7], [37.77, -122.42, .7], [47.61, -122.33, .5], [39.95, -75.17, .6], [38.9, -77.04, .6], [42.36, -71.06, .6],
    [33.45, -112.07, .5], [39.74, -104.99, .4], [44.98, -93.27, .4], [42.33, -83.05, .5], [29.95, -90.07, .3], [36.17, -115.14, .4],
    [35.23, -80.84, .4], [30.27, -97.74, .4], [45.5, -73.57, .5], [43.65, -79.38, .6], [49.28, -123.12, .4], [51.05, -114.07, .3],
    [19.43, -99.13, .9], [20.67, -103.35, .5], [25.69, -100.32, .5], [23.13, -82.38, .3], [4.71, -74.07, .6], [10.48, -66.9, .4],
    [-12.05, -77.04, .6], [-33.45, -70.67, .6], [-34.6, -58.38, .8], [-23.55, -46.63, 1], [-22.91, -43.17, .8], [-19.92, -43.94, .5],
    [-15.79, -47.88, .4], [-3.72, -38.54, .4], [-8.05, -34.9, .4], [-30.03, -51.23, .4], [-0.18, -78.47, .3],
    [51.51, -0.13, 1], [48.86, 2.35, .9], [52.52, 13.4, .7], [40.42, -3.7, .7], [41.39, 2.17, .6], [41.9, 12.5, .6], [45.46, 9.19, .7],
    [52.37, 4.9, .6], [50.85, 4.35, .5], [48.21, 16.37, .5], [50.08, 14.44, .4], [52.23, 21.01, .5], [47.5, 19.04, .4], [53.48, -2.24, .5],
    [55.95, -3.19, .3], [53.35, -6.26, .4], [59.33, 18.07, .4], [55.68, 12.57, .4], [59.91, 10.75, .3], [60.17, 24.94, .3], [38.72, -9.14, .4],
    [37.98, 23.73, .5], [44.43, 26.1, .4], [42.7, 23.32, .3], [44.79, 20.45, .3], [50.45, 30.52, .5], [55.76, 37.62, 1], [59.94, 30.31, .6],
    [41.01, 28.98, .9], [39.93, 32.86, .5], [51.23, 6.78, .6], [50.94, 6.96, .5], [48.14, 11.58, .5], [53.55, 9.99, .5], [45.76, 4.84, .4],
    [43.3, 5.37, .4], [30.04, 31.24, .9], [31.2, 29.92, .5], [36.75, 3.06, .4], [33.57, -7.59, .5], [36.81, 10.18, .3], [6.52, 3.38, .7],
    [5.6, -0.19, .4], [9.03, 38.74, .4], [-1.29, 36.82, .4], [-6.79, 39.21, .3], [-26.2, 28.05, .7], [-33.92, 18.42, .5], [-29.86, 31.02, .4],
    [-4.44, 15.27, .4], [15.5, 32.56, .3], [14.72, -17.47, .3], [-8.84, 13.23, .3],
    [24.71, 46.68, .6], [21.49, 39.19, .4], [25.2, 55.27, .6], [24.45, 54.38, .4], [25.29, 51.53, .4], [29.38, 47.99, .4], [26.23, 50.59, .3],
    [35.69, 51.39, .8], [33.31, 44.37, .5], [31.95, 35.93, .3], [32.08, 34.78, .4], [33.89, 35.5, .3], [24.86, 67.01, .8], [31.55, 74.34, .6],
    [33.68, 73.05, .4], [28.61, 77.21, 1], [19.08, 72.88, 1], [12.97, 77.59, .7], [13.08, 80.27, .7], [22.57, 88.36, .8], [17.39, 78.49, .6],
    [23.02, 72.57, .5], [18.52, 73.86, .5], [26.85, 80.95, .5], [26.91, 75.79, .4], [23.81, 90.41, .8], [27.72, 85.32, .3], [6.93, 79.85, .3],
    [39.9, 116.4, 1], [31.23, 121.47, 1], [22.54, 114.06, .9], [23.13, 113.26, .9], [30.57, 104.07, .7], [29.56, 106.55, .7], [30.59, 114.31, .7],
    [34.34, 108.94, .6], [39.34, 117.36, .6], [32.06, 118.8, .6], [30.27, 120.16, .6], [36.07, 120.38, .5], [41.8, 123.43, .5], [45.8, 126.53, .4],
    [38.04, 114.51, .5], [34.75, 113.62, .6], [28.23, 112.94, .5], [26.07, 119.3, .4], [25.04, 102.71, .4], [43.83, 87.62, .3], [22.32, 114.17, .8],
    [25.03, 121.57, .7], [22.63, 120.3, .4], [37.57, 126.98, .9], [35.18, 129.08, .5], [39.02, 125.75, .15], [35.68, 139.77, 1], [34.69, 135.5, .8],
    [35.18, 136.91, .6], [33.59, 130.4, .4], [43.06, 141.35, .3], [38.27, 140.87, .3], [14.6, 120.98, .8], [10.32, 123.9, .3], [13.76, 100.5, .8],
    [21.03, 105.85, .6], [10.82, 106.63, .7], [3.14, 101.69, .6], [1.29, 103.85, .6], [-6.21, 106.85, .9], [-7.25, 112.75, .5], [-6.91, 107.61, .4],
    [16.87, 96.2, .4], [11.56, 104.93, .3], [-33.87, 151.21, .7], [-37.81, 144.96, .7], [-27.47, 153.03, .4], [-31.95, 115.86, .4],
    [-34.93, 138.6, .3], [-36.85, 174.76, .3], [-41.29, 174.78, .2], [55.03, 82.92, .4], [56.84, 60.6, .4], [55.8, 49.11, .3], [48.7, 44.5, .3],
    [43.24, 76.95, .3], [41.3, 69.24, .4], [40.41, 49.87, .3], [41.72, 44.79, .2], [40.18, 44.51, .2], [53.9, 27.57, .3]
  ];

  // Rough desert / ice-sheet regions: [latMin, latMax, lngMin, lngMax, strength]
  var DESERTS = [
    [15, 32, -16, 33, 1], [16, 31, 36, 58, 1], [24, 36, 50, 70, .8], [-31, -19, 118, 143, .9], [30, 40, -118, -105, .6],
    [37, 46, 88, 112, .7], [36, 41, 76, 90, .9], [-28, -18, 13, 24, .7], [-27, -19, -71, -68, .6], [23, 30, 68, 74, .5]
  ];

  // ------------------------------------------------------------ textures
  // Longitudes are unwrapped so rings crossing the antimeridian stay
  // continuous; each ring is then drawn at -360/0/+360 so the wrap lines up.
  function traceFeatures(ctx, features, filterFn) {
    var sx = TEX_W / 360, sy = TEX_H / 180;
    features.forEach(function (f) {
      if (filterFn && !filterFn(f)) return;
      var g = f.geometry; if (!g) return;
      var polys = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
      polys.forEach(function (poly) {
        poly.forEach(function (ring) {
          var pts = [], prev = null;
          for (var i = 0; i < ring.length; i++) {
            var lng = ring[i][0], lat = ring[i][1];
            if (prev !== null) { while (lng - prev > 180) lng -= 360; while (prev - lng > 180) lng += 360; }
            prev = lng; pts.push([lng, lat]);
          }
          [-360, 0, 360].forEach(function (off) {
            for (var k = 0; k < pts.length; k++) {
              var x = (pts[k][0] + off + 180) * sx, y = (90 - pts[k][1]) * sy;
              if (k === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
            }
            ctx.closePath();
          });
        });
      });
    });
  }
  function makeCanvas(w, h) { var c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

  // tex0: R = land, G = borders/coastlines, B = blurred land (coastal shallows / glow)
  function buildLandTexture(features) {
    var c = makeCanvas(TEX_W, TEX_H), ctx = c.getContext('2d');
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, TEX_W, TEX_H);
    // blurred land into blue (drawn first, then masked to the B channel)
    var blur = makeCanvas(TEX_W, TEX_H), bctx = blur.getContext('2d');
    bctx.fillStyle = '#000'; bctx.fillRect(0, 0, TEX_W, TEX_H);
    if ('filter' in bctx) bctx.filter = 'blur(10px)';
    bctx.fillStyle = '#fff'; bctx.beginPath(); traceFeatures(bctx, features); bctx.fill('evenodd');
    ctx.globalCompositeOperation = 'lighter';
    // blue channel: blurred land
    ctx.drawImage(blur, 0, 0);
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = '#0000ff'; ctx.fillRect(0, 0, TEX_W, TEX_H);
    ctx.globalCompositeOperation = 'lighter';
    // red channel: land
    ctx.fillStyle = '#ff0000'; ctx.beginPath(); traceFeatures(ctx, features); ctx.fill('evenodd');
    // green channel: borders + coastlines
    ctx.strokeStyle = '#00ff00'; ctx.lineWidth = 1.3; ctx.beginPath(); traceFeatures(ctx, features); ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
    return c;
  }

  // tex1: R = desert, G = city lights, B = ice sheet (Greenland; Antarctica comes from latitude)
  function buildBiomeTexture() {
    var c = makeCanvas(TEX_W, TEX_H), ctx = c.getContext('2d');
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, TEX_W, TEX_H);
    var sx = TEX_W / 360, sy = TEX_H / 180;
    ctx.globalCompositeOperation = 'lighter';
    if ('filter' in ctx) ctx.filter = 'blur(14px)';
    DESERTS.forEach(function (d) {
      ctx.fillStyle = 'rgba(255,0,0,' + d[4] + ')';
      ctx.beginPath();
      ctx.ellipse(((d[2] + d[3]) / 2 + 180) * sx, (90 - (d[0] + d[1]) / 2) * sy, (d[3] - d[2]) / 2 * sx, (d[1] - d[0]) / 2 * sy, 0, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.fillStyle = '#0000ff';
    ctx.beginPath(); ctx.ellipse((-41 + 180) * sx, (90 - 73) * sy, 30 * sx, 14 * sy, 0, 0, Math.PI * 2); ctx.fill();
    if ('filter' in ctx) ctx.filter = 'none';
    // city lights: a soft core plus a scatter of small points around it
    var rnd = seeded(7);
    CITIES.forEach(function (cty) {
      var cx = (cty[1] + 180) * sx, cy = (90 - cty[0]) * sy, w = cty[2];
      var stretch = 1 / Math.max(0.25, Math.cos(cty[0] * DEG));
      var r = (1.6 + 3.2 * w);
      var g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * stretch);
      g.addColorStop(0, 'rgba(0,255,0,' + (0.55 + 0.45 * w) + ')');
      g.addColorStop(1, 'rgba(0,255,0,0)');
      ctx.fillStyle = g; ctx.fillRect(cx - r * stretch, cy - r * stretch, 2 * r * stretch, 2 * r * stretch);
      var n = Math.round(60 + 160 * w);
      for (var i = 0; i < n; i++) {
        var ang = rnd() * Math.PI * 2, dist = Math.pow(rnd(), 2.2) * (10 + 26 * w);
        ctx.fillStyle = 'rgba(0,255,0,' + (0.12 + 0.55 * rnd() * (1 - dist / 40)) + ')';
        ctx.fillRect(cx + Math.cos(ang) * dist * stretch, cy + Math.sin(ang) * dist, 1, 1);
      }
    });
    ctx.globalCompositeOperation = 'source-over';
    return c;
  }

  // tex3: country id (R = index+1, G = 255 coverage flag, B = checksum), read
  // with NEAREST filtering so the shader can light up exactly one country.
  function buildIdTexture(features) {
    var c = makeCanvas(TEX_W, TEX_H), ctx = c.getContext('2d');
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, TEX_W, TEX_H);
    features.forEach(function (f, i) {
      var id = i + 1;
      ctx.fillStyle = 'rgb(' + id + ',255,' + ((id * 37) % 256) + ')';
      ctx.beginPath(); traceFeatures(ctx, [f]); ctx.fill('evenodd');
    });
    return c;
  }

  // tex2: per-country heat colours (only when heat mode is on)
  function buildHeatTexture(features, heatFn) {
    var c = makeCanvas(TEX_W, TEX_H), ctx = c.getContext('2d');
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, TEX_W, TEX_H);
    features.forEach(function (f) {
      ctx.fillStyle = colorForPct(heatFn(featureName(f)), 1);
      ctx.beginPath(); traceFeatures(ctx, [f]); ctx.fill('evenodd');
    });
    return c;
  }

  // ------------------------------------------------------------ shaders
  var VERT = 'attribute vec2 aPos; void main(){ gl_Position = vec4(aPos, 0.0, 1.0); }';
  var FRAG = [
    'precision highp float;',
    'uniform vec2 uRes; uniform vec2 uCenter; uniform float uR;',
    'uniform vec3 uRight; uniform vec3 uUp; uniform vec3 uFwd;',
    'uniform vec3 uSun; uniform float uTime; uniform float uStyle; uniform float uHeat;',
    'uniform vec3 uAccent; uniform sampler2D uLand; uniform sampler2D uBiome; uniform sampler2D uHeatTex;',
    'uniform sampler2D uIdTex; uniform float uHoverId; uniform vec3 uHoverCol; uniform float uHoverAmt;',
    'float idHit(vec3 c){ return step(abs(c.r*255.0 - uHoverId), 0.5) * step(0.98, c.g) * step(abs(c.b*255.0 - mod(uHoverId*37.0, 256.0)), 0.5); }',
    '#define PI 3.14159265',
    'float hash(vec3 p){ p = fract(p*0.3183099 + 0.1); p *= 17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }',
    'float vnoise(vec3 x){ vec3 i = floor(x); vec3 f = fract(x); f = f*f*(3.0-2.0*f);',
    '  return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x), mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),',
    '             mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x), mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z); }',
    'float fbm(vec3 p){ float a = 0.5, s = 0.0; for(int i=0;i<5;i++){ s += a*vnoise(p); p *= 2.03; a *= 0.5; } return s; }',
    'void main(){',
    '  vec2 p = (gl_FragCoord.xy - uCenter) / uR;',
    '  float d2 = dot(p,p);',
    '  float isReal = step(uStyle, 0.5);',            // style 0
    '  float isFut = step(1.5, uStyle);',              // style 2
    '  float isBlend = 1.0 - isReal - isFut;',         // style 1
    '  vec3 atmo = mix(vec3(0.35,0.62,1.0), uAccent, isFut + 0.55*isBlend);',
    '  if (d2 > 1.0) {',
    '    float d = sqrt(d2);',
    '    vec3 nl = normalize(uRight*p.x + uUp*p.y);',
    '    float day = smoothstep(-0.35, 0.45, dot(nl, uSun));',
    '    float g = exp(-(d-1.0)*mix(16.0, 11.0, isFut));',
    '    float a = g * mix(0.25 + 0.75*day, 0.85, isFut + 0.5*isBlend);',
    '    a = clamp(a, 0.0, 1.0) * smoothstep(1.25, 1.0, d);',
    '    gl_FragColor = vec4(atmo*a, a); return;',
    '  }',
    '  vec3 v = vec3(p, sqrt(1.0 - d2));',
    '  vec3 n = normalize(uRight*v.x + uUp*v.y + uFwd*v.z);',
    '  float lat = asin(clamp(n.y,-1.0,1.0)); float lng = atan(n.x, n.z);',
    '  vec2 uv = vec2(lng/(2.0*PI) + 0.5, 0.5 - lat/PI);',
    '  vec3 L = texture2D(uLand, uv).rgb; vec3 B = texture2D(uBiome, uv).rgb;',
    '  float land = smoothstep(0.35, 0.65, L.r);',
    '  float latd = abs(lat) * 57.29578;',
    '  float ndl = dot(n, uSun);',
    '  float day = smoothstep(-0.10, 0.20, ndl);',
    '  float rim = pow(1.0 - v.z, 2.6);',
    '  float nz = fbm(n*7.0);',
    // ---- realistic surface
    '  vec3 forest = vec3(0.07,0.16,0.06), grass = vec3(0.24,0.30,0.13), desert = vec3(0.66,0.53,0.34);',
    '  vec3 tundra = vec3(0.36,0.36,0.30), ice = vec3(0.90,0.93,0.97);',
    '  vec3 lc = mix(forest, grass, smoothstep(0.35, 0.75, nz + 0.15*smoothstep(25.0,45.0,latd)));',
    '  lc = mix(lc, desert, clamp(B.r*1.25,0.0,1.0) * smoothstep(0.25,0.55,nz+0.2));',
    '  lc = mix(lc, tundra, smoothstep(55.0, 66.0, latd + nz*8.0));',
    '  float iceAmt = max(smoothstep(0.35,0.7,B.b), smoothstep(62.0, 66.0, -lat*57.29578 + nz*4.0));',
    '  iceAmt = max(iceAmt, smoothstep(76.0, 82.0, latd));',
    '  lc = mix(lc, ice, iceAmt);',
    '  lc *= 0.85 + 0.3*fbm(n*38.0);',
    '  vec3 deep = vec3(0.012,0.06,0.17), shallow = vec3(0.03,0.22,0.34);',
    '  vec3 oc = mix(deep, shallow, smoothstep(0.05, 0.9, L.b) * 0.75) * (0.9 + 0.2*fbm(n*12.0));',
    '  oc = mix(oc, ice*0.8, smoothstep(72.0, 80.0, lat*57.29578 + nz*6.0) * 0.8);',
    '  vec3 surf = mix(oc, lc, land);',
    '  vec3 q = n*4.0 + vec3(uTime*0.006, 0.0, uTime*0.002); q += 0.6*vec3(fbm(q*1.7), fbm(q*1.7+5.2), fbm(q*1.7+9.1));',
    '  float cl = fbm(q*1.6);',
    '  float band = 0.55 + 0.45*abs(sin(lat*3.0));',
    '  float cloud = smoothstep(0.50, 0.78, cl*band + 0.10) * 0.8;',
    '  vec3 hv = normalize(uSun + uFwd);',
    '  float spec = pow(max(dot(n, hv), 0.0), 220.0) * (1.0 - land) * (1.0 - cloud) * 0.35 * (1.0 - isBlend);',
    '  vec3 dayCol = surf * (0.18 + 1.05*clamp(ndl, 0.0, 1.0)) + vec3(1.0,0.95,0.85)*spec;',
    '  dayCol = mix(dayCol, vec3(0.95)*(0.25 + 0.9*clamp(ndl,0.0,1.0)), cloud);',
    '  float lights = B.g * land * (0.75 + 0.5*nz);',
    '  vec3 nightCol = surf*0.045 + vec3(1.0, 0.72, 0.38) * lights * 1.35 * (1.0 - 0.6*cloud) + vec3(0.02,0.03,0.05)*cloud;',
    '  vec3 real = mix(nightCol, dayCol, day);',
    '  real += vec3(0.55, 0.22, 0.06) * exp(-pow(ndl/0.05, 2.0)) * 0.12;',
    '  real += vec3(0.35,0.62,1.0) * rim * (0.15 + 0.6*day);',
    // ---- futuristic surface: equal-area dot grid, glowing borders, sweep
    '  float sp = 1.35; float latD = lat*57.29578; float lngD = lng*57.29578;',
    '  float row = floor((latD + 90.0)/sp); float latC = (row + 0.5)*sp - 90.0;',
    '  float nCols = max(1.0, floor(360.0*cos(latC*0.0174533)/sp)); float cw = 360.0/nCols;',
    '  float col = floor((lngD + 180.0)/cw); float lngC = (col + 0.5)*cw - 180.0;',
    '  vec2 dd = vec2((lngD - lngC)*cos(latD*0.0174533), latD - latC);',
    '  float dotMask = 1.0 - smoothstep(0.26*sp, 0.40*sp, length(dd));',
    '  float cellLand = step(0.5, texture2D(uLand, vec2((lngC+180.0)/360.0, (90.0-latC)/180.0)).r);',
    '  float tw = 0.55 + 0.45*sin(uTime*1.6 + hash(vec3(row, col, 3.0))*6.283);',
    '  float sweepLat = mod(uTime*9.0, 220.0) - 110.0;',
    '  float sweep = exp(-pow((latD - sweepLat)/4.0, 2.0));',
    '  float pix = 57.29578/(uR*max(v.z, 0.15));',
    '  float gl = min(abs(mod(latD + 7.5, 15.0) - 7.5), abs(mod(lngD + 7.5, 15.0) - 7.5)*cos(lat));',
    '  float grat = 1.0 - smoothstep(0.0, pix*1.2, gl);',
    '  vec3 fut = vec3(0.006, 0.012, 0.03) + uAccent * 0.05 * (1.0 - land);',
    '  fut += uAccent * dotMask * cellLand * (0.35 + 0.45*tw + 1.2*sweep);',
    '  fut += uAccent * dotMask * (1.0 - cellLand) * 0.05;',
    '  fut += uAccent * L.g * 0.55;',
    '  fut += uAccent * grat * 0.10;',
    '  fut += uAccent * sweep * 0.06;',
    '  fut += uAccent * rim * 0.85;',
    '  fut += vec3(1.0, 0.8, 0.5) * B.g * land * (1.0 - day) * 0.35;',
    // ---- blend: realistic night-leaning earth + a quiet data layer
    '  vec3 bl = real;',
    '  bl = mix(bl, bl*0.55 + vec3(0.0,0.01,0.03), 0.35);',
    '  bl += uAccent * L.g * 0.22 * (1.0 - 0.5*day);',
    '  bl += uAccent * grat * 0.06;',
    '  bl += uAccent * dotMask * cellLand * (1.0 - day) * 0.16 * tw;',
    '  bl += uAccent * rim * 0.35;',
    '  vec3 col3 = real*isReal + fut*isFut + bl*isBlend;',
    // ---- hovered country: faint fill, tinted dots, brighter border
    '  if (uHoverAmt > 0.001) {',
    '    float pixHit = idHit(texture2D(uIdTex, uv).rgb);',
    '    float cellHit = idHit(texture2D(uIdTex, vec2((lngC+180.0)/360.0, (90.0-latC)/180.0)).rgb);',
    '    col3 = mix(col3, col3*0.55 + uHoverCol*0.16, pixHit*uHoverAmt);',
    '    col3 += uHoverCol * dotMask * cellHit * uHoverAmt * (0.7 + 0.3*tw);',
    '    col3 += uHoverCol * L.g * pixHit * uHoverAmt * 0.7;',
    '  }',
    // ---- optional heat overlay (country colours)
    '  vec3 heat = texture2D(uHeatTex, uv).rgb;',
    '  col3 = mix(col3, heat*(0.35 + 0.75*max(day, 0.35)) + uAccent*L.g*0.2, uHeat * land * 0.85);',
    '  float edge = smoothstep(1.0, 0.988, sqrt(d2));',
    '  vec3 nl0 = normalize(uRight*p.x + uUp*p.y);',
    '  float aEdge = mix(0.25 + 0.75*smoothstep(-0.35, 0.45, dot(nl0, uSun)), 0.85, isFut + 0.5*isBlend);',
    '  gl_FragColor = vec4(mix(atmo*aEdge, col3, edge), mix(aEdge, 1.0, edge));',
    '}'
  ].join('\n');

  function compile(gl, type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  }
  function uploadTex(gl, unit, canvas, nearest) {
    var t = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, nearest ? gl.NEAREST : gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, nearest ? gl.NEAREST : gl.LINEAR);
    return t;
  }

  // point-in-polygon for hover lookups (on the unwrapped ring)
  function ringContains(ring, lng, lat) {
    var inside = false;
    for (var i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      var xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
      if (((yi > lat) !== (yj > lat)) && (lng < (xj - xi) * (lat - yi) / (yj - yi) + xi)) inside = !inside;
    }
    return inside;
  }
  function findCountry(features, lat, lng) {
    for (var i = 0; i < features.length; i++) {
      var g = features[i].geometry; if (!g) continue;
      var polys = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
      for (var k = 0; k < polys.length; k++) {
        var ring = polys[k][0];
        if (ringContains(ring, lng, lat) || ringContains(ring, lng + 360, lat) || ringContains(ring, lng - 360, lat)) return features[i];
      }
    }
    return null;
  }

  // ------------------------------------------------------------ flat map (v1 API)
  var SVG_NS = 'http://www.w3.org/2000/svg';
  function renderFlatMap(el, features, heatFn) {
    if (!el) return;
    heatFn = heatFn || pctForCountry;
    var w = 400, h = 200;
    var svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    features.forEach(function (f) {
      var g = f.geometry; if (!g) return;
      var polys = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
      var d = '';
      polys.forEach(function (poly) {
        poly.forEach(function (ring) {
          ring.forEach(function (pt, i) {
            d += (i ? 'L' : 'M') + ((pt[0] + 180) / 360 * w).toFixed(1) + ',' + ((90 - pt[1]) / 180 * h).toFixed(1) + ' ';
          });
          d += 'Z ';
        });
      });
      var name = featureName(f), pct = heatFn(name);
      var path = document.createElementNS(SVG_NS, 'path');
      path.setAttribute('d', d.trim());
      path.setAttribute('fill', colorForPct(pct, 0.85));
      path.setAttribute('stroke', 'rgba(10,7,4,0.55)');
      path.setAttribute('stroke-width', '0.4');
      var t = document.createElementNS(SVG_NS, 'title');
      t.textContent = name + ' ' + (pct >= 0 ? '+' : '') + pct.toFixed(2) + '%';
      path.appendChild(t); svg.appendChild(path);
    });
    el.innerHTML = ''; el.appendChild(svg);
  }

  // ------------------------------------------------------------ mount
  var STYLE_ID = { realistic: 0, blend: 1, futuristic: 2 };
  var cachedWorld = null;

  function loadWorld() {
    if (cachedWorld) return Promise.resolve(cachedWorld);
    return fetch(COUNTRIES_URL).then(function (r) { return r.json(); }).then(function (w) { cachedWorld = w; return w; });
  }

  function mount(opts) {
    opts = opts || {};
    var el = opts.el;
    if (!el) return null;
    var styleName = opts.style || el.getAttribute('data-globe-style') || 'blend';
    var style = STYLE_ID.hasOwnProperty(styleName) ? STYLE_ID[styleName] : 1;
    var showEx = opts.exchanges !== undefined ? opts.exchanges : style !== 0;
    var showArcs = opts.arcs !== undefined ? opts.arcs : style !== 0;
    var heatFn = typeof opts.heatFn === 'function' ? opts.heatFn : pctForCountry;

    var loading = document.createElement('div');
    loading.className = 'globe-loading';
    loading.textContent = 'Loading globe…';
    el.appendChild(loading);

    var host = document.createElement('div');
    host.className = 'globe-canvas-host';
    host.style.cssText = 'position:absolute;inset:0;z-index:1;opacity:0;transition:opacity .6s ease;touch-action:none;';
    var cGL = document.createElement('canvas');
    var c2D = document.createElement('canvas');
    cGL.style.cssText = c2D.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;';
    c2D.style.pointerEvents = 'none';
    host.appendChild(cGL); host.appendChild(c2D);
    var tip = document.createElement('div');
    tip.className = 'globe-tooltip';
    tip.style.cssText = 'position:absolute;z-index:5;display:none;transform:translate(-50%,calc(-100% - 12px));white-space:nowrap;';
    var badgeLayer = document.createElement('div');
    badgeLayer.style.cssText = 'position:absolute;inset:0;z-index:4;pointer-events:none;';
    el.appendChild(host); el.appendChild(badgeLayer); el.appendChild(tip);

    var gl = cGL.getContext('webgl', { premultipliedAlpha: true, alpha: true, antialias: false }) ||
             cGL.getContext('experimental-webgl');
    if (!gl) {
      loading.textContent = 'Globe needs WebGL, which this browser has turned off';
      return null;
    }
    var ctx2 = c2D.getContext('2d');

    var state = {
      lat: opts.lat != null ? opts.lat : 22, lng: opts.lng != null ? opts.lng : -40,
      zoom: 1, targetZoom: 1, dragging: false, vx: 0, vy: 0,
      autoRotate: opts.autoRotate !== false, running: false, visible: true, destroyed: false,
      features: [], hover: null, focus: null
    };
    // v1 "altitude" -> screen radius factor
    var baseScale = opts.scale || (opts.altitude ? Math.min(0.92, 1.72 / (opts.altitude + 0.1)) : 0.78);

    var prog, uni = {}, dpr = Math.min(global.devicePixelRatio || 1, 1.75), W = 0, H = 0;
    var t0 = performance.now(), last = t0, raf = 0, sun = sunVector(new Date()), sunAt = 0;
    var accentRgb = hexToRgb(opts.accent || cssVar('--accent', '#4a86ff'));
    var accent = accentRgb.map(function (v) { return v / 255; });
    var exState = EXCHANGES.map(function (x) { return { x: x, v: llToVec(x.lat, x.lng), st: exchangeStatus(x, new Date()) }; });
    var exAt = 0;
    var hl = { id: 0, col: [0, 0, 0], amt: 0, target: null };
    var markets = null, pinned = null, hoverIso = null;
    var bullRgb = hexToRgb(cssVar('--bull', '#3ecb7c')).map(function (v) { return v / 255; });
    var bearRgb = hexToRgb(cssVar('--danger', '#e0483f')).map(function (v) { return v / 255; });
    var card = document.createElement('div');
    card.className = 'globe-card';
    card.style.display = 'none';
    el.appendChild(card);
    if (opts.markets !== false) loadMarkets().then(function (m) { markets = m; });

    function isoOf(f) { return (f && f.properties && (f.properties.ADM0_A3 || f.properties.ISO_A3)) || ''; }
    function countryColor(m) {
      if (!m || m.chg == null) return accent;
      var t = Math.min(1, 0.45 + Math.abs(m.chg) / 3);
      var base = m.chg >= 0 ? bullRgb : bearRgb;
      return base.map(function (v) { return v * t; });
    }
    function setHighlight(f) {
      if (!f) { hl.target = null; return; }
      var idx = state.features.indexOf(f);
      var m = markets && markets.countries && markets.countries[isoOf(f)];
      hl.target = { id: idx + 1, col: countryColor(m) };
    }
    function cardHtml(f, full) {
      var iso = isoOf(f), m = markets && markets.countries && markets.countries[iso], name = featureName(f);
      if (!m) return '<div class="gc-head"><b>' + esc(name) + '</b></div><div class="gc-sub">No US-listed market data mapped for this country yet.</div>';
      var h = '<div class="gc-head"><b>' + esc(m.name) + '</b>' + (m.chg != null ? '<span class="gc-big">' + pctHtml(m.chg) + '</span>' : '') + '</div>';
      h += '<div class="gc-sub">' + (m.etf ? esc(m.etfLabel || m.etf) + ' country ETF, daily move' + (m.m1 != null ? ' · 1-month ' + pctHtml(m.m1) : '') : 'No US-listed country ETF') + '</div>';
      if (m.trending) {
        var t = m.trending;
        h += '<div class="gc-sec">Trending here</div><div class="gc-row"><span><b>' + esc(t.sym) + '</b> ' + esc(t.name) + '</span>' + pctHtml(t.chg) + '</div>';
        if (t.headline) h += '<div class="gc-news">&ldquo;' + esc(t.headline.title) + '&rdquo; <span>' + esc(t.headline.publisher || '') + '</span></div>';
      }
      var us = (m.us || []);
      if (us.length) {
        h += '<div class="gc-sec">Linked US-listed stocks</div>';
        us.slice(0, full ? 6 : 2).forEach(function (u) {
          h += '<div class="gc-row"><span><b>' + esc(u.sym) + '</b></span>' + pctHtml(u.chg) + '</div><div class="gc-why">' + esc(u.why) + '</div>';
        });
      }
      if (full && m.local && m.local.length) {
        h += '<div class="gc-sec">Companies based here</div>';
        m.local.forEach(function (l) {
          h += '<div class="gc-row"><span>' + esc(l.name) + ' ' + (l.sym ? '<b>' + esc(l.sym) + '</b>' : '<em>not US-listed</em>') + '</span>' + (l.sym ? pctHtml(l.chg) : '') + '</div>';
        });
      }
      h += '<div class="gc-foot">' + (full ? '' : 'Click the country for more · ') + 'As of ' + esc(niceDate(markets.asOf)) + ' close. Business links, not recommendations.</div>';
      return h;
    }
    function placeCard(x, y) {
      var narrow = W < 520;
      card.classList.toggle('is-docked', narrow);
      if (narrow) { card.style.left = '8px'; card.style.right = '8px'; card.style.top = ''; card.style.bottom = '8px'; return; }
      card.style.right = ''; card.style.bottom = '';
      var cw = card.offsetWidth || 280, chh = card.offsetHeight || 200;
      var left = x + 18, top = y - chh / 2;
      if (left + cw > W - 8) left = x - cw - 18;
      left = Math.max(8, Math.min(W - cw - 8, left));
      top = Math.max(8, Math.min(H - chh - 8, top));
      card.style.left = left + 'px'; card.style.top = top + 'px';
    }
    function showCard(f, x, y, full) {
      card.innerHTML = (full ? '<button class="gc-close" type="button" aria-label="Close">&times;</button>' : '') + cardHtml(f, full);
      card.classList.toggle('is-pinned', !!full);
      card.style.display = 'block';
      placeCard(x, y);
      var cb = card.querySelector('.gc-close');
      if (cb) cb.addEventListener('click', function (ev) { ev.stopPropagation(); unpin(); });
    }
    function hideCard() { if (!pinned) card.style.display = 'none'; }
    function unpin() { pinned = null; card.style.display = 'none'; setHighlight(null); }
    function pin(f, x, y) { pinned = f; setHighlight(f); showCard(f, x, y, true); if (opts.onCountryClick) opts.onCountryClick(featureName(f), f); }

    function setupGL(world) {
      prog = gl.createProgram();
      gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
      gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG));
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
      gl.useProgram(prog);
      var buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      var loc = gl.getAttribLocation(prog, 'aPos');
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      ['uRes', 'uCenter', 'uR', 'uRight', 'uUp', 'uFwd', 'uSun', 'uTime', 'uStyle', 'uHeat', 'uAccent', 'uLand', 'uBiome', 'uHeatTex', 'uIdTex', 'uHoverId', 'uHoverCol', 'uHoverAmt']
        .forEach(function (n) { uni[n] = gl.getUniformLocation(prog, n); });
      uploadTex(gl, 0, buildLandTexture(world.features));
      uploadTex(gl, 1, buildBiomeTexture());
      uploadTex(gl, 2, opts.heat ? buildHeatTexture(world.features, heatFn) : makeCanvas(4, 4));
      uploadTex(gl, 3, buildIdTexture(world.features), true);
      gl.uniform1i(uni.uLand, 0); gl.uniform1i(uni.uBiome, 1); gl.uniform1i(uni.uHeatTex, 2); gl.uniform1i(uni.uIdTex, 3);
    }

    function resize() {
      var w = el.clientWidth, h = el.clientHeight;
      if (!w || !h) return;
      W = w; H = h;
      cGL.width = c2D.width = Math.round(w * dpr);
      cGL.height = c2D.height = Math.round(h * dpr);
      gl.viewport(0, 0, cGL.width, cGL.height);
      if (!state.running) frame(performance.now(), true);
    }

    function basis() {
      var f = llToVec(state.lat, state.lng);
      var right = norm3(cross3([0, 1, 0], f));
      var up = cross3(f, right);
      return { f: f, r: right, u: up };
    }
    function radiusPx() { return Math.min(W, H) * 0.5 * baseScale * state.zoom; }

    // world vector (optionally raised by alt) -> screen px; returns null when hidden behind the globe
    function project(vec, alt, b, R) {
      var s = 1 + (alt || 0);
      var x = dot3(vec, b.r) * s, y = dot3(vec, b.u) * s, z = dot3(vec, b.f) * s;
      var sx = W / 2 + x * R, sy = H / 2 - y * R;
      var behind = (z < 0 && (x * x + y * y) < 1) || z < -0.12;
      return { x: sx, y: sy, z: z, hidden: behind };
    }

    function slerp(a, b, t) {
      var d = Math.max(-1, Math.min(1, dot3(a, b))), om = Math.acos(d);
      if (om < 1e-4) return a;
      var s = Math.sin(om), k1 = Math.sin((1 - t) * om) / s, k2 = Math.sin(t * om) / s;
      return [a[0] * k1 + b[0] * k2, a[1] * k1 + b[1] * k2, a[2] * k1 + b[2] * k2];
    }

    function arcPairs() {
      var open = exState.filter(function (e) { return e.st.open; });
      var hubs = exState.filter(function (e) { return e.x.hub; });
      var pairs = [];
      // every open exchange links to its nearest hub; hubs link to each other
      // each exchange links to its nearest hub (live if it's open); hubs
      // link to their nearest neighbouring hub. Long, far-side arcs are
      // skipped so nothing loops around the back of the globe.
      exState.forEach(function (e) {
        if (e.x.hub) return;
        var best = null, bd = -2;
        hubs.forEach(function (h) { var d = dot3(h.v, e.v); if (d > bd) { bd = d; best = h; } });
        if (best && bd > -0.2) pairs.push([e, best, e.st.open]);
      });
      hubs.forEach(function (h) {
        var best = null, bd = -2;
        hubs.forEach(function (o) { if (o !== h) { var d = dot3(o.v, h.v); if (d > bd) { bd = d; best = o; } } });
        if (best) pairs.push([h, best, h.st.open || best.st.open]);
      });
      return pairs;
    }
    var pairsCache = null;

    function drawOverlay(time, b, R) {
      var c = ctx2;
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.clearRect(0, 0, W, H);
      var acc = 'rgb(' + accentRgb.join(',') + ')';
      var bull = cssVar('--bull', '#3ecb7c');
      if (showArcs) {
        if (!pairsCache) pairsCache = arcPairs();
        c.lineCap = 'round';
        pairsCache.forEach(function (pr, idx) {
          var a = pr[0].v, bb = pr[1].v, live = pr[2];
          var ang = Math.acos(Math.max(-1, Math.min(1, dot3(a, bb))));
          var maxAlt = 0.04 + 0.22 * ang / Math.PI;
          var N = 48, pts = [];
          for (var i = 0; i <= N; i++) {
            var t = i / N;
            pts.push(project(slerp(a, bb, t), maxAlt * Math.sin(Math.PI * t), b, R));
          }
          c.strokeStyle = acc;
          c.globalAlpha = live ? 0.42 : 0.14;
          c.lineWidth = live ? 1.3 : 0.9;
          c.beginPath();
          var pen = false;
          for (var k = 0; k < pts.length; k++) {
            if (pts[k].hidden) { pen = false; continue; }
            if (!pen) { c.moveTo(pts[k].x, pts[k].y); pen = true; } else c.lineTo(pts[k].x, pts[k].y);
          }
          c.stroke();
          if (live) {
            var head = ((time * 0.00022 + idx * 0.173) % 1);
            for (var q = 0; q < 6; q++) {
              var tt = head - q * 0.018; if (tt < 0) continue;
              var hp = project(slerp(a, bb, tt), maxAlt * Math.sin(Math.PI * tt), b, R);
              if (hp.hidden) continue;
              c.globalAlpha = 0.9 * (1 - q / 6);
              c.fillStyle = q ? acc : '#ffffff';
              c.beginPath(); c.arc(hp.x, hp.y, q ? 1.6 : 2.1, 0, Math.PI * 2); c.fill();
            }
          }
        });
        c.globalAlpha = 1;
      }
      if (showEx) {
        exState.forEach(function (e) {
          var pt = project(e.v, 0.004, b, R);
          if (pt.hidden || pt.z < 0.05) return;
          var fade = Math.min(1, pt.z * 3);
          if (e.st.open) {
            var ph = ((time * 0.0009) + (hashCode(e.x.id) % 100) / 100) % 1;
            c.globalAlpha = fade * (1 - ph) * 0.7;
            c.strokeStyle = bull; c.lineWidth = 1.2;
            c.beginPath(); c.arc(pt.x, pt.y, 3 + ph * 12, 0, Math.PI * 2); c.stroke();
            c.globalAlpha = fade; c.fillStyle = bull;
            c.beginPath(); c.arc(pt.x, pt.y, 3, 0, Math.PI * 2); c.fill();
          } else {
            c.globalAlpha = fade * 0.75; c.fillStyle = 'rgba(210,220,235,0.7)';
            c.beginPath(); c.arc(pt.x, pt.y, 2.1, 0, Math.PI * 2); c.fill();
          }
          if (opts.labels !== false && R > 150 && (e.st.open || e.x.hub)) {
            c.globalAlpha = fade * (e.st.open ? 0.95 : 0.55);
            c.font = '600 10px "IBM Plex Mono", ui-monospace, monospace';
            c.fillStyle = e.st.open ? '#e9fff2' : 'rgba(220,228,240,0.8)';
            c.fillText(e.x.id, pt.x + 7, pt.y + 3.5);
          }
          e._pt = pt;
        });
        c.globalAlpha = 1;
      }
    }

    // v1 badges (HTML chips pinned to lat/lng)
    var badgeEls = (opts.badges || []).map(function (d) {
      var div = document.createElement('div');
      var hasPct = typeof d.pct === 'number';
      div.className = 'globe-badge ' + (hasPct ? (d.pct >= 0 ? 'up' : 'dn') : '');
      div.innerHTML = '<span class="name">' + d.name + '</span>' +
        (hasPct ? '<span class="pct">' + (d.pct >= 0 ? '+' : '') + d.pct.toFixed(2) + '%</span>' : (d.text ? '<span class="pct">' + d.text + '</span>' : ''));
      badgeLayer.appendChild(div);
      return { d: d, el: div, v: llToVec(d.lat, d.lng) };
    });

    function frame(now, once) {
      if (state.destroyed) return;
      var dt = Math.min(64, now - last); last = now;
      var time = now - t0;
      if (now - sunAt > 30000) { sun = sunVector(new Date()); sunAt = now; }
      if (now - exAt > 30000) {
        var d = new Date();
        exState.forEach(function (e) { e.st = exchangeStatus(e.x, d); });
        pairsCache = null; exAt = now;
      }
      if (!state.dragging) {
        if (Math.abs(state.vx) > 0.001 || Math.abs(state.vy) > 0.001) {
          state.lng -= state.vx * dt; state.lat += state.vy * dt;
          state.vx *= 0.94; state.vy *= 0.94;
        } else if (state.autoRotate && !state.hover && !pinned) {
          state.lng += dt * 0.0045;
        }
        if (state.focus) {
          var f = state.focus, k = 1 - Math.pow(0.001, dt / 700);
          var dl = ((f.lng - state.lng + 540) % 360) - 180;
          state.lng += dl * k; state.lat += (f.lat - state.lat) * k;
          if (Math.abs(dl) < 0.05 && Math.abs(f.lat - state.lat) < 0.05) state.focus = null;
        }
      }
      state.lat = Math.max(-75, Math.min(75, state.lat));
      state.lng = ((state.lng + 540) % 360) - 180;
      state.zoom += (state.targetZoom - state.zoom) * Math.min(1, dt / 120);

      var b = basis(), R = radiusPx();
      gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform2f(uni.uRes, cGL.width, cGL.height);
      gl.uniform2f(uni.uCenter, cGL.width / 2, cGL.height / 2);
      gl.uniform1f(uni.uR, R * dpr);
      gl.uniform3fv(uni.uRight, b.r); gl.uniform3fv(uni.uUp, b.u); gl.uniform3fv(uni.uFwd, b.f);
      gl.uniform3fv(uni.uSun, sun);
      gl.uniform1f(uni.uTime, time / 1000);
      gl.uniform1f(uni.uStyle, style);
      gl.uniform1f(uni.uHeat, opts.heat ? 1 : 0);
      gl.uniform3f(uni.uAccent, accent[0], accent[1], accent[2]);
      var hk = 1 - Math.pow(0.001, dt / 350);
      hl.amt += ((hl.target ? 1 : 0) - hl.amt) * hk;
      if (hl.target) { hl.id = hl.target.id; hl.col = hl.target.col; }
      gl.uniform1f(uni.uHoverId, hl.id);
      gl.uniform3f(uni.uHoverCol, hl.col[0], hl.col[1], hl.col[2]);
      gl.uniform1f(uni.uHoverAmt, hl.amt < 0.01 ? 0 : hl.amt);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      drawOverlay(time, b, R);
      badgeEls.forEach(function (bd) {
        var pt = project(bd.v, 0.02, b, R);
        bd.el.style.display = (pt.hidden || pt.z < 0.1) ? 'none' : 'flex';
        bd.el.style.left = pt.x + 'px'; bd.el.style.top = pt.y + 'px';
      });
      if (!once && state.running) raf = requestAnimationFrame(frame);
    }

    function start() { if (state.running || state.destroyed) return; state.running = true; last = performance.now(); raf = requestAnimationFrame(frame); }
    function stop() { state.running = false; cancelAnimationFrame(raf); }

    // pointer -> lat/lng on the globe (or null if off the sphere)
    function pick(clientX, clientY) {
      var rect = el.getBoundingClientRect();
      var x = clientX - rect.left, y = clientY - rect.top;
      var R = radiusPx(), px = (x - W / 2) / R, py = -(y - H / 2) / R, d2 = px * px + py * py;
      if (d2 > 1) return { x: x, y: y, hit: false };
      var b = basis(), pz = Math.sqrt(1 - d2);
      var n = [b.r[0] * px + b.u[0] * py + b.f[0] * pz, b.r[1] * px + b.u[1] * py + b.f[1] * pz, b.r[2] * px + b.u[2] * py + b.f[2] * pz];
      return { x: x, y: y, hit: true, lat: Math.asin(n[1]) / DEG, lng: Math.atan2(n[0], n[2]) / DEG };
    }

    function showTip(x, y, html) { tip.innerHTML = html; tip.style.left = x + 'px'; tip.style.top = y + 'px'; tip.style.display = 'block'; }
    function hideTip() { tip.style.display = 'none'; }

    function onHover(e) {
      if (state.dragging) return;
      var p = pick(e.clientX, e.clientY);
      if (!p.hit) { state.hover = null; hideTip(); if (!pinned) { setHighlight(null); hideCard(); hoverIso = null; } return; }
      state.hover = true;
      // exchange markers win over countries
      if (showEx) {
        for (var i = 0; i < exState.length; i++) {
          var pt = exState[i]._pt;
          if (pt && !pt.hidden && Math.hypot(pt.x - p.x, pt.y - p.y) < 11) {
            var ex = exState[i];
            showTip(pt.x, pt.y, '<b>' + ex.x.name + '</b> · ' + ex.x.city + '<br><span style="color:' +
              (ex.st.open ? 'var(--bull)' : 'var(--muted)') + '">' + ex.st.label + '</span>' +
              '<br><span style="opacity:.6">Regular hours · holidays not included</span>');
            return;
          }
        }
      }
      var f = findCountry(state.features, p.lat, p.lng);
      if (!f) { hideTip(); if (!pinned) { setHighlight(null); hideCard(); } return; }
      hideTip();
      if (pinned) return;
      setHighlight(f);
      if (opts.markets === false) {
        var extra = '';
        if (opts.heat) { var pc = heatFn(featureName(f)); extra = ' ' + (pc >= 0 ? '+' : '') + pc.toFixed(2) + '%'; }
        showTip(p.x, p.y, '<b>' + featureName(f) + '</b>' + extra);
        return;
      }
      if (hoverIso !== isoOf(f) || card.style.display === 'none') { hoverIso = isoOf(f); showCard(f, p.x, p.y, false); }
      else placeCard(p.x, p.y);
    }

    var lastX = 0, lastY = 0, lastT = 0, downX = 0, downY = 0;
    host.addEventListener('pointerdown', function (e) {
      state.dragging = true; state.focus = null; lastX = downX = e.clientX; lastY = downY = e.clientY; lastT = performance.now();
      state.vx = state.vy = 0; hideTip();
      try { host.setPointerCapture(e.pointerId); } catch (err) {}
    });
    host.addEventListener('pointermove', function (e) {
      if (!state.dragging) { onHover(e); return; }
      var R = radiusPx(), now = performance.now(), dt = Math.max(1, now - lastT);
      var dx = (e.clientX - lastX) / R / DEG, dy = (e.clientY - lastY) / R / DEG;
      state.lng -= dx; state.lat += dy;
      state.vx = dx / dt; state.vy = dy / dt;
      lastX = e.clientX; lastY = e.clientY; lastT = now;
      if (!state.running) frame(now, true);
    });
    function endDrag(e) {
      if (!state.dragging) return;
      state.dragging = false;
      if (performance.now() - lastT > 80) { state.vx = state.vy = 0; }
      var moved = Math.hypot(e.clientX - downX, e.clientY - downY);
      if (moved < 4) {
        var p = pick(e.clientX, e.clientY);
        if (p.hit) {
          var f = findCountry(state.features, p.lat, p.lng);
          if (f && opts.markets !== false) { pin(f, p.x, p.y); }
          else {
            if (pinned) unpin();
            state.focus = { lat: p.lat, lng: p.lng };
            if (f && opts.onCountryClick) opts.onCountryClick(featureName(f), f);
          }
        } else if (pinned) { unpin(); }
      }
    }
    host.addEventListener('pointerup', endDrag);
    host.addEventListener('pointercancel', endDrag);
    host.addEventListener('pointerleave', function () { state.hover = null; hideTip(); hoverIso = null; if (!pinned) { setHighlight(null); hideCard(); } });
    if (opts.enableZoom !== false) {
      host.addEventListener('wheel', function (e) {
        e.preventDefault();
        state.targetZoom = Math.max(0.7, Math.min(3.2, state.targetZoom * Math.exp(-e.deltaY * 0.0012)));
      }, { passive: false });
    }

    var ctrl = {
      setStyle: function (s) { if (STYLE_ID.hasOwnProperty(s)) { style = STYLE_ID[s]; showEx = opts.exchanges !== undefined ? opts.exchanges : style !== 0; showArcs = opts.arcs !== undefined ? opts.arcs : style !== 0; } },
      pointOfView: function (p) { if (p) { state.focus = { lat: p.lat, lng: p.lng }; if (p.zoom) state.targetZoom = p.zoom; } },
      pauseAnimation: stop, resumeAnimation: start,
      markets: function () { return loadMarkets(); },
      focusCountry: function (iso) {
        var f = state.features.filter(function (x) { return isoOf(x) === iso; })[0];
        if (!f) return;
        var c = null, g = f.geometry, polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates, best = null;
        polys.forEach(function (pp) { if (!best || pp[0].length > best.length) best = pp[0]; });
        var sx = 0, sy = 0; best.forEach(function (pt) { sx += pt[0]; sy += pt[1]; });
        c = { lng: sx / best.length, lat: sy / best.length };
        state.focus = { lat: Math.max(-60, Math.min(60, c.lat)), lng: c.lng };
        pin(f, W, H / 2); // card docks to the right edge so the country stays visible
      },
      exchanges: function () { return exState.map(function (e) { return { id: e.x.id, name: e.x.name, city: e.x.city, open: e.st.open, label: e.st.label }; }); },
      destroy: function () { state.destroyed = true; stop(); if (host.parentNode) el.innerHTML = ''; }
    };

    loadWorld().then(function (world) {
      state.features = world.features;
      try { setupGL(world); }
      catch (err) {
        loading.textContent = 'Globe unavailable right now';
        if (global.console) console.error('Zelos globe shader failed', err);
        return;
      }
      if (loading.parentNode) loading.parentNode.removeChild(loading);
      resize();
      if ('ResizeObserver' in global) new ResizeObserver(debounce(resize, 80)).observe(el);
      else global.addEventListener('resize', debounce(resize, 150));
      setTimeout(resize, 300);
      host.style.opacity = '1';

      var reduce = global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (reduce) state.autoRotate = false;

      if ('IntersectionObserver' in global) {
        new IntersectionObserver(function (entries) {
          entries.forEach(function (en) {
            state.visible = en.isIntersecting;
            if (en.isIntersecting && !document.hidden) start(); else stop();
          });
        }, { threshold: 0.02 }).observe(el);
      } else start();
      document.addEventListener('visibilitychange', function () {
        if (document.hidden) stop(); else if (state.visible) start();
      });
      // stop for good if the page removes the container
      if ('MutationObserver' in global && el.parentNode) {
        new MutationObserver(function () { if (!document.body.contains(el)) ctrl.destroy(); })
          .observe(document.body, { childList: true, subtree: true });
      }
      if (opts.flatMapEl) renderFlatMap(opts.flatMapEl, world.features, heatFn);
      if (opts.onReady) opts.onReady(ctrl);
    }).catch(function (err) {
      loading.textContent = 'Globe unavailable right now';
      if (opts.flatMapEl) opts.flatMapEl.innerHTML = '<div class="globe-loading">Map unavailable right now</div>';
      if (global.console) console.error('Zelos globe failed to load', err);
    });

    return ctrl;
  }

  global.ZelosGlobe = {
    mount: mount, pctForCountry: pctForCountry, colorForPct: colorForPct,
    renderFlatMap: function (el, features, fn) { renderFlatMap(el, features, fn); },
    exchanges: function (date) { date = date || new Date(); return EXCHANGES.map(function (x) { var s = exchangeStatus(x, date); return { id: x.id, name: x.name, city: x.city, tz: x.tz, open: s.open, label: s.label }; }); },
    version: 2
  };
})(window);
