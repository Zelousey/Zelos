/* zelos-market.js — Zelos' own market widgets (replaces the TradingView
 * ticker tape, mini symbol overview and market-quotes embeds).
 *
 * Reads data/market-snapshot.json (built by scripts/build_market_snapshot.py
 * from Robinhood market data) and renders into any of:
 *
 *   <div data-zm="tape"></div>                 scrolling ticker banner
 *   <div data-zm="overview" data-sym="SPX"></div>  mini chart card (1M)
 *   <div data-zm="quotes"></div>               Indices + Sectors table
 *
 * TradingView is only used for the full Live Chart now.
 */
(function(){
  var SRC = 'data/market-snapshot.json';
  // pages in sub-folders (learn/, scan/) need a relative prefix
  var base = (document.currentScript && document.currentScript.getAttribute('data-base')) || '';

  function esc(s){ return String(s).replace(/[&<>"]/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }
  function fmt(n, kind){
    if (n == null || isNaN(n)) return '—';
    var d = 2;
    return n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
  }
  function signed(n, digits){
    if (n == null || isNaN(n)) return '—';
    var s = Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
    return (n > 0 ? '+' : n < 0 ? '−' : '') + s;
  }
  function dir(n){ return n > 0 ? 'up' : n < 0 ? 'dn' : 'flat'; }
  function asOfLabel(iso){
    try {
      var d = new Date(iso);
      return d.toLocaleString('en-US', { timeZone:'America/New_York', month:'short', day:'numeric', hour:'numeric', minute:'2-digit' }) + ' ET';
    } catch(e){ return ''; }
  }
  function closeLabel(data){
    var spx = data.items && data.items.SPX;
    var iso = (spx && spx.asOf) || data.generatedAt;
    try {
      return 'Close ' + new Date(iso).toLocaleDateString('en-US', { timeZone:'America/New_York', month:'short', day:'numeric' });
    } catch(e){ return ''; }
  }

  // ---------------------------------------------------------------- tape
  function renderTape(el, data){
    var syms = data.groups.tape || [];
    var cells = syms.map(function(s){
      var it = data.items[s]; if (!it) return '';
      return '<span class="zm-tick ' + dir(it.chg) + '">' +
        '<b>' + esc(it.label) + '</b>' +
        '<span class="px">' + fmt(it.price) + '</span>' +
        '<span class="ch">' + signed(it.chg, 2) + ' (' + signed(it.pct, 2) + '%)</span>' +
      '</span>';
    }).join('<span class="zm-sep" aria-hidden="true"></span>');
    var stamp = '<span class="zm-stamp">' + esc(closeLabel(data)) + ' · Robinhood data</span>';
    // content is doubled so the CSS marquee loops seamlessly
    el.innerHTML =
      '<div class="zm-tape" role="marquee" aria-label="Market prices, ' + esc(closeLabel(data)) + '">' +
        '<div class="zm-track">' +
          '<div class="zm-run">' + stamp + cells + '</div>' +
          '<div class="zm-run" aria-hidden="true">' + stamp + cells + '</div>' +
        '</div>' +
      '</div>';
    var run = el.querySelector('.zm-run');
    if (run) el.querySelector('.zm-track').style.setProperty('--zm-dur', Math.max(28, run.scrollWidth / 45) + 's');
  }

  // ---------------------------------------------------------------- overview
  function renderOverview(el, data){
    var sym = el.getAttribute('data-sym') || 'SPX';
    var sp = data.spark && data.spark[sym];
    var it = data.items[sym];
    if (!sp || !it || sp.points.length < 2){ el.innerHTML = '<div class="zm-empty">Market data unavailable.</div>'; return; }
    var pts = sp.points, W = 320, H = 130, P = 6;
    var vals = pts.map(function(p){ return p.c; });
    var lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals);
    var pad = (hi - lo) * 0.12 || 1; lo -= pad; hi += pad;
    function x(i){ return P + i * (W - 2*P) / (pts.length - 1); }
    function y(v){ return P + (hi - v) * (H - 2*P) / (hi - lo); }
    var line = pts.map(function(p, i){ return (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(p.c).toFixed(1); }).join(' ');
    var area = line + ' L' + x(pts.length-1).toFixed(1) + ' ' + H + ' L' + x(0).toFixed(1) + ' ' + H + ' Z';
    var first = pts[0].c, last = pts[pts.length-1].c, m1 = (last - first) / first * 100;
    var gid = 'zmg' + Math.random().toString(36).slice(2, 8);
    var lastX = x(pts.length-1), lastY = y(last);
    function dlabel(d){ var p = d.split('-'); return ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][+p[1]-1] + ' ' + (+p[2]); }

    el.innerHTML =
      '<div class="zm-ov ' + dir(it.chg) + '">' +
        '<div class="zm-ov-head">' +
          '<div><div class="zm-ov-name">' + esc(sp.label) + '</div>' +
          '<div class="zm-ov-px">' + fmt(it.price) + '</div></div>' +
          '<div class="zm-ov-chg"><span class="ch">' + signed(it.chg, 2) + ' (' + signed(it.pct, 2) + '%)</span>' +
          '<span class="m1">1M ' + signed(m1, 2) + '%</span></div>' +
        '</div>' +
        '<svg class="zm-ov-svg" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" role="img" aria-label="' + esc(sp.label) + ' daily closes, last month">' +
          '<defs><linearGradient id="' + gid + '" x1="0" y1="0" x2="0" y2="1">' +
            '<stop offset="0" stop-color="currentColor" stop-opacity="0.28"/><stop offset="1" stop-color="currentColor" stop-opacity="0"/>' +
          '</linearGradient></defs>' +
          '<path d="' + area + '" fill="url(#' + gid + ')"/>' +
          '<path d="' + line + '" fill="none" stroke="currentColor" stroke-width="1.8" vector-effect="non-scaling-stroke" stroke-linejoin="round"/>' +
          '<circle cx="' + lastX.toFixed(1) + '" cy="' + lastY.toFixed(1) + '" r="3" fill="currentColor"/>' +
        '</svg>' +
        '<div class="zm-ov-axis"><span>' + dlabel(pts[0].d) + '</span><span>' + esc(closeLabel(data)) + '</span></div>' +
      '</div>';

    // hover readout
    var svg = el.querySelector('svg'), readout = document.createElement('div');
    readout.className = 'zm-ov-tip'; el.querySelector('.zm-ov').appendChild(readout);
    svg.addEventListener('mousemove', function(e){
      var r = svg.getBoundingClientRect();
      var i = Math.round((e.clientX - r.left) / r.width * (pts.length - 1));
      i = Math.max(0, Math.min(pts.length - 1, i));
      readout.textContent = dlabel(pts[i].d) + ' · ' + fmt(pts[i].c);
      readout.style.left = (x(i) / W * 100) + '%';
      readout.style.opacity = 1;
    });
    svg.addEventListener('mouseleave', function(){ readout.style.opacity = 0; });
  }

  // ---------------------------------------------------------------- quotes table
  function renderQuotes(el, data){
    var groups = [['Indices', data.groups.indices || []], ['Sectors', data.groups.sectors || []]];
    var maxAbs = 0;
    groups.forEach(function(g){ g[1].forEach(function(s){ var it = data.items[s]; if (it) maxAbs = Math.max(maxAbs, Math.abs(it.pct || 0)); }); });
    maxAbs = maxAbs || 1;
    el.innerHTML = '<div class="zm-quotes">' + groups.map(function(g){
      if (!g[1].length) return '';
      return '<div class="zm-q-group">' + esc(g[0]) + '</div>' + g[1].map(function(s){
        var it = data.items[s]; if (!it) return '';
        var w = Math.min(100, Math.abs(it.pct || 0) / maxAbs * 100);
        return '<div class="zm-q-row ' + dir(it.chg) + '">' +
          '<span class="nm"><b>' + esc(it.label) + '</b><small>' + (it.kind !== 'index' ? esc(s) + ' · ' : '') + fmt(it.price) + '</small></span>' +
          '<span class="bar"><i style="width:' + w.toFixed(0) + '%"></i></span>' +
          '<span class="ch">' + signed(it.pct, 2) + '%</span>' +
        '</div>';
      }).join('');
    }).join('') + '<div class="zm-q-foot">' + esc(closeLabel(data)) + ' · Robinhood market data</div></div>';
  }

  var targets = document.querySelectorAll('[data-zm]');
  if (!targets.length) return;
  fetch(base + SRC + '?v=' + Math.floor(Date.now() / 600000), { cache: 'no-cache' })
    .then(function(r){ if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(function(data){
      targets.forEach(function(el){
        var t = el.getAttribute('data-zm');
        try {
          if (t === 'tape') renderTape(el, data);
          else if (t === 'overview') renderOverview(el, data);
          else if (t === 'quotes') renderQuotes(el, data);
        } catch(e){ el.innerHTML = '<div class="zm-empty">Market data unavailable.</div>'; }
      });
    })
    .catch(function(){
      targets.forEach(function(el){ if (el.getAttribute('data-zm') !== 'tape') el.innerHTML = '<div class="zm-empty">Market data unavailable.</div>'; });
    });
})();
