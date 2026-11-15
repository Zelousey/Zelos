/*
 * zelos-scroll-chart.js — the homepage's background chart (owner 2026-11-15).
 *
 * A short sale, drawn by scrolling: a stock price line runs behind the page, and the further you
 * scroll the further it draws, mostly downhill with realistic bounces. A small tag rides the tip
 * of the line with the short position's profit. Scroll back up and it undraws.
 * It's an illustration (the tag says so), not a real stock or a real trade.
 *
 * Light: one SVG behind everything, redrawn at most once a frame while scrolling. With "reduce
 * motion" on it shows the whole line once and stays still.
 */
(function () {
  'use strict';
  var d = document, w = window;
  if (!d.querySelector('[data-scroll-chart]')) return;
  var host = d.querySelector('[data-scroll-chart]');
  var NS = 'http://www.w3.org/2000/svg';
  var N = 220, SHARES = 50, ENTRY = 184.2;
  var still = w.matchMedia && w.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // a seeded walk: a steady slide with pullbacks and two relief rallies, like a stock that's
  // losing a trend (seeded so every visitor sees the same chart)
  var seed = 7;
  function rnd() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
  var prices = [ENTRY], p = ENTRY;
  for (var i = 1; i < N; i++) {
    var drift = -0.24;
    if (i > 60 && i < 78) drift = 0.35;      // a relief rally
    if (i > 140 && i < 152) drift = 0.42;    // and another
    p = Math.max(90, p + drift + (rnd() - 0.5) * 2.6);
    prices.push(p);
  }
  var lo = Math.min.apply(null, prices) - 6, hi = ENTRY + 6;

  var svg = d.createElementNS(NS, 'svg');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('class', 'sc-svg');
  function el(tag, cls) { var e = d.createElementNS(NS, tag); if (cls) e.setAttribute('class', cls); svg.appendChild(e); return e; }
  var area = el('path', 'sc-area');
  var entry = el('line', 'sc-entry');
  var entryLbl = el('text', 'sc-entry-label');
  var line = el('path', 'sc-line');
  var dot = el('circle', 'sc-dot');
  host.appendChild(svg);
  var tag = d.createElement('div');
  tag.className = 'sc-tag';
  tag.innerHTML = '<span class="sc-tag-k">Short 50 shares · example</span><b class="sc-tag-v">+$0.00</b>';
  host.appendChild(tag);
  var tagV = tag.querySelector('.sc-tag-v');

  var W = 0, H = 0, top = 0, bottom = 0;
  function size() {
    W = w.innerWidth; H = w.innerHeight;
    top = H * 0.34; bottom = H * 0.94; // below the headline area at the top of the screen
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    var ey = y(ENTRY);
    entry.setAttribute('x1', 0); entry.setAttribute('x2', W); entry.setAttribute('y1', ey); entry.setAttribute('y2', ey);
    entryLbl.setAttribute('x', W - 12); entryLbl.setAttribute('y', ey - 8);
    entryLbl.textContent = 'Short entry $' + ENTRY.toFixed(2);
  }
  function x(i) { return (i / (N - 1)) * W; }
  function y(v) { return top + ((hi - v) / (hi - lo)) * (bottom - top); }

  function draw(frac) {
    var f = Math.max(0.02, Math.min(1, frac)) * (N - 1);
    var k = Math.floor(f), t = f - k;
    var dd = '';
    for (var i = 0; i <= k; i++) dd += (i ? 'L' : 'M') + x(i).toFixed(1) + ',' + y(prices[i]).toFixed(1);
    var tipV = k < N - 1 ? prices[k] + (prices[k + 1] - prices[k]) * t : prices[k];
    var tx = k < N - 1 ? x(k) + (x(k + 1) - x(k)) * t : x(k), ty = y(tipV);
    dd += 'L' + tx.toFixed(1) + ',' + ty.toFixed(1);
    line.setAttribute('d', dd);
    area.setAttribute('d', dd + 'L' + tx.toFixed(1) + ',' + H + 'L0,' + H + 'Z');
    dot.setAttribute('cx', tx); dot.setAttribute('cy', ty); dot.setAttribute('r', 4);
    var pnl = (ENTRY - tipV) * SHARES;
    tagV.textContent = (pnl >= 0 ? '+' : '−') + '$' + Math.abs(pnl).toFixed(2);
    tag.classList.toggle('is-down', pnl < 0);
    tag.classList.toggle('is-hidden', frac < 0.035); // appears once you start scrolling
    // the tag sits just above-left of the tip, kept on screen
    var tw = tag.offsetWidth || 150;
    tag.style.transform = 'translate(' + Math.round(Math.min(W - tw - 10, Math.max(10, tx - tw - 14))) + 'px,' + Math.round(Math.max(10, ty - 52)) + 'px)';
  }

  function progress() {
    var max = d.documentElement.scrollHeight - H;
    return max > 0 ? w.scrollY / max : 1;
  }
  var queued = false;
  function onScroll() {
    if (queued) return;
    queued = true;
    w.requestAnimationFrame(function () { queued = false; draw(progress()); });
  }
  size();
  draw(still ? 1 : progress());
  w.addEventListener('resize', function () { size(); draw(still ? 1 : progress()); });
  if (!still) w.addEventListener('scroll', onScroll, { passive: true });
})();
