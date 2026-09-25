/* zelos-market.js — Zelos' own market widgets (replaces the TradingView
 * ticker tape, mini symbol overview and market-quotes embeds).
 *
 * Reads data/market-snapshot.json (refreshed after every close by the
 * "Update market data" GitHub Action, scripts/update_market_snapshot.py)
 * and renders into any of:
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

  // Styles ship with the script so the widgets never render unstyled
  // (e.g. when a cached/older zelos-theme.css is served).
  if (!document.getElementById('zm-styles')){
    var st = document.createElement('style'); st.id = 'zm-styles';
    st.textContent = ".ticker-strip{ background:var(--surface,#15161c); }\n.zm-tape{ overflow:hidden; position:relative; height:42px; display:flex; align-items:center;\n  -webkit-mask-image:linear-gradient(90deg,transparent,#000 4%,#000 96%,transparent);\n          mask-image:linear-gradient(90deg,transparent,#000 4%,#000 96%,transparent); }\n.zm-track{ display:flex; width:max-content; animation:zm-scroll var(--zm-dur,40s) linear infinite; }\n.zm-tape:hover .zm-track{ animation-play-state:paused; }\n.zm-run{ display:flex; align-items:center; flex:none; padding-right:28px; }\n@keyframes zm-scroll{ from{ transform:translateX(0); } to{ transform:translateX(-50%); } }\n@media (prefers-reduced-motion:reduce){ .zm-track{ animation:none; } .zm-tape{ overflow-x:auto; } }\n.zm-tick{ display:inline-flex; align-items:baseline; gap:8px; white-space:nowrap; font-family:var(--mono,'IBM Plex Mono', ui-monospace, Menlo, monospace); font-size:0.8rem; }\n.zm-tick b{ font-family:inherit; font-weight:600; color:var(--ink,#f3f4f7); letter-spacing:0.02em; }\n.zm-tick .px{ color:var(--ink-2,#d6d9e0); }\n.zm-tick .ch{ font-weight:600; }\n.zm-tick.up .ch, .zm-ov.up .ch, .zm-q-row.up .ch{ color:var(--bull,#3ecb7c); }\n.zm-tick.dn .ch, .zm-ov.dn .ch, .zm-q-row.dn .ch{ color:var(--danger,#e0483f); }\n.zm-sep{ width:1px; height:14px; background:var(--border,#2a2d38); margin-inline:22px; flex:none; }\n.zm-stamp{ font-family:var(--mono,'IBM Plex Mono', ui-monospace, Menlo, monospace); font-size:0.7rem; text-transform:uppercase; letter-spacing:0.08em; color:var(--muted-2,#6b7180);\n  border:1px solid var(--border-soft,#1f222b); border-radius:4px; padding:3px 7px; margin-right:22px; white-space:nowrap; }\n\n.zm-ov{ position:relative; }\n.zm-ov.up{ color:var(--bull,#3ecb7c); } .zm-ov.dn{ color:var(--danger,#e0483f); } .zm-ov.flat{ color:var(--accent,#4a86ff); }\n.zm-ov-head{ display:flex; justify-content:space-between; align-items:flex-end; gap:12px; margin-bottom:10px; }\n.zm-ov-name{ font-size:0.78rem; color:var(--muted,#9aa0ad); text-transform:uppercase; letter-spacing:0.06em; }\n.zm-ov-px{ font-family:var(--mono,'IBM Plex Mono', ui-monospace, Menlo, monospace); font-size:1.45rem; font-weight:600; color:var(--ink,#f3f4f7); line-height:1.2; }\n.zm-ov-chg{ text-align:right; display:flex; flex-direction:column; gap:2px; font-family:var(--mono,'IBM Plex Mono', ui-monospace, Menlo, monospace); font-size:0.82rem; }\n.zm-ov-chg .m1{ color:var(--muted,#9aa0ad); font-size:0.74rem; }\n.zm-ov-svg{ display:block; width:100%; height:130px; background:var(--bg-soft,#101116); border:1px solid var(--border-soft,#1f222b); border-radius:8px; cursor:crosshair; }\n.zm-ov-axis{ display:flex; justify-content:space-between; font-family:var(--mono,'IBM Plex Mono', ui-monospace, Menlo, monospace); font-size:0.7rem; color:var(--muted-2,#6b7180); margin-top:6px; }\n.zm-ov-tip{ position:absolute; top:52px; transform:translateX(-50%); background:var(--surface-2,#1d1f27); color:var(--ink,#f3f4f7); border:1px solid var(--border,#2a2d38);\n  font-family:var(--mono,'IBM Plex Mono', ui-monospace, Menlo, monospace); font-size:0.72rem; padding:3px 7px; border-radius:4px; pointer-events:none; opacity:0; transition:opacity .12s; white-space:nowrap; }\n\n.zm-quotes{ font-size:0.86rem; }\n.zm-q-group{ font-size:0.7rem; text-transform:uppercase; letter-spacing:0.08em; color:var(--muted-2,#6b7180); margin:14px 0 4px; }\n.zm-q-group:first-child{ margin-top:0; }\n.zm-q-row{ display:grid; grid-template-columns:minmax(0,1fr) 44px 64px; align-items:center; gap:12px; padding:8px 0; border-bottom:1px solid var(--border-soft,#1f222b); }\n.zm-q-row .nm{ min-width:0; display:flex; flex-direction:column; line-height:1.3; }\n.zm-q-row .nm b{ font-weight:600; color:var(--ink,#f3f4f7); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }\n.zm-q-row .nm small{ color:var(--muted,#9aa0ad); font-family:var(--mono,'IBM Plex Mono', ui-monospace, Menlo, monospace); font-size:0.72rem; }\n.zm-q-row .ch{ font-family:var(--mono,'IBM Plex Mono', ui-monospace, Menlo, monospace); font-weight:600; text-align:right; }\n.zm-q-row .bar{ height:4px; background:var(--border-soft,#1f222b); border-radius:2px; overflow:hidden; }\n.zm-q-row .bar i{ display:block; height:100%; border-radius:2px; }\n.zm-q-row.up .bar i{ background:var(--bull,#3ecb7c); } .zm-q-row.dn .bar i{ background:var(--danger,#e0483f); margin-left:auto; }\n.zm-q-foot{ font-family:var(--mono,'IBM Plex Mono', ui-monospace, Menlo, monospace); font-size:0.7rem; color:var(--muted-2,#6b7180); margin-top:10px; }\n.zm-empty{ color:var(--muted,#9aa0ad); font-size:0.85rem; padding:12px 0; }";
    document.head.appendChild(st);
  }

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
  function srcName(data){ return data.sourceShort || 'Market data'; }
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
    var stamp = '<span class="zm-stamp">' + esc(closeLabel(data)) + ' · ' + esc(srcName(data)) + '</span>';
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
    }).join('') + '<div class="zm-q-foot">' + esc(closeLabel(data)) + ' · ' + esc(srcName(data)) + '</div></div>';
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
