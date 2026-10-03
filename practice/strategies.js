/*!
 * Three-Leg Strategies engine (Mockup 18). No page code: math, plug-ins and the scan.
 *
 *   ZelosStrategies.STRATS           [{id, label, bias, desc, build(ctx, adj) -> plan | null}]
 *   ZelosStrategies.scan(id, list)   rank underlyings for one strategy: list = [{sym, name, series, S}]
 *   ZelosStrategies.price(plan, S, today, sigma)   legs priced like the Trade War options model
 *   ZelosStrategies.stats(plan)       cost / max profit / max loss / breakevens / best price
 *
 * A plan is { kind, sym, exp, legs: [{type:'call'|'put', strike, qty}] } with qty > 0 bought and
 * qty < 0 sold, per 1 set (100 shares a contract). Prices come from ZelosOptions.quote (the
 * same Black-Scholes model as Trade War's options): buys pay the ask, sells get the bid.
 * Adding a strategy = one more entry in STRATS (pick strikes, explain, score).
 */
(function (global) {
  'use strict';
  var OPT = global.ZelosOptions;
  function sma(a, n, end) { end = end == null ? a.length : end; if (end < n) return null; var s = 0; for (var i = end - n; i < end; i++) s += a[i]; return s / n; }
  function rsi(c, n) { if (c.length <= n) return 50; var g = 0, l = 0; for (var i = c.length - n; i < c.length; i++) { var d = c[i] - c[i - 1]; if (d > 0) g += d; else l -= d; } return l === 0 ? 100 : 100 - 100 / (1 + g / l); }
  function atr(s, n) { var t = 0, k = 0; for (var i = Math.max(1, s.n - n); i < s.n; i++) { t += Math.max(s.h[i] - s.l[i], Math.abs(s.h[i] - s.c[i - 1]), Math.abs(s.l[i] - s.c[i - 1])); k++; } return k ? t / k : 0; }
  function step(S) { return S < 25 ? 0.5 : S < 60 ? 1 : S < 150 ? 2.5 : S < 400 ? 5 : S < 1000 ? 10 : 25; }
  function snap(x, st) { return +(Math.round(x / st) * st).toFixed(2); }
  function pickExp(today, lo, hi) { lo = lo || 14; hi = hi || 40; var ex = OPT.expirations(today), best = null; ex.forEach(function (e) { var d = OPT.daysTo(e, today); if (!best && d >= lo && d <= hi) best = e; }); return best || ex.filter(function (e) { return OPT.daysTo(e, today) >= 7; })[0] || ex[ex.length - 1]; }
  function context(sym, series, S, today) {
    var c = series.c.slice(0, series.n); if (S) c[c.length - 1] = S; else S = c[c.length - 1];
    var sig = OPT.histVol(c, 20), exp = pickExp(today), dte = OPT.daysTo(exp, today);
    var s20 = sma(c, 20), s50 = sma(c, 50), s20prev = sma(c, 20, c.length - 5);
    return { sym: sym, S: S, sigma: sig, today: today, exp: exp, dte: dte, sma20: s20, sma50: s50, slope20: s20 && s20prev ? (s20 - s20prev) / s20prev * 100 : 0,
      rsi: rsi(c, 14), atr: atr(series, 14), em: S * sig * Math.sqrt(Math.max(dte, 1) / 365), st: step(S), hi20: Math.max.apply(null, c.slice(-20)), lo20: Math.min.apply(null, c.slice(-20)) };
  }
  // ------------------------------------------------------------ pricing + payoff
  function price(plan, S, today, sigma) {
    var net = 0, legs = plan.legs.map(function (l) {
      var q = OPT.quote(l.type, S, l.strike, plan.exp, today, sigma), px = l.qty > 0 ? q.ask : q.bid;
      net += l.qty * px; return { type: l.type, strike: l.strike, qty: l.qty, px: px, bid: q.bid, ask: q.ask, mid: q.mid };
    });
    return { legs: legs, net: Math.round(net * 100) / 100 }; // net > 0: you pay (debit); < 0: you collect (credit)
  }
  function payoffAt(plan, net, x) { return plan.legs.reduce(function (t, l) { return t + l.qty * Math.max(0, l.type === 'call' ? x - l.strike : l.strike - x); }, 0) * 100 - net * 100; }
  function stats(plan, net) {
    var ks = plan.legs.map(function (l) { return l.strike; }), lo = Math.min.apply(null, ks), hi = Math.max.apply(null, ks), span = hi - lo || hi * 0.1;
    var a = Math.max(0.01, lo - span * 2.5), b = hi + span * 2.5, N = 600, best = -Infinity, bestX = null, worst = Infinity, prev = null, bes = [];
    for (var i = 0; i <= N; i++) {
      var x = a + (b - a) * i / N, v = payoffAt(plan, net, x);
      if (v > best + 1e-9) { best = v; bestX = x; } if (v < worst) worst = v;
      if (prev && (prev.v < 0) !== (v < 0)) bes.push(+(prev.x + (x - prev.x) * (-prev.v) / (v - prev.v)).toFixed(2));
      prev = { x: x, v: v };
    }
    // a short put with nothing below it loses up to the strike: show that, not the grid edge
    var downside = payoffAt(plan, net, 0), up = payoffAt(plan, net, hi * 4);
    worst = Math.min(worst, downside, up);
    return { cost: net * 100, maxProfit: Math.round(best * 100) / 100, maxLoss: Math.round(-worst * 100) / 100, best: Math.round(bestX * 100) / 100, breakevens: bes, upsideRisk: up < -Math.max(0, net * 100) - 0.5 };
  }
  // ------------------------------------------------------------ strategies (plug-ins)
  function butterfly(kind) {
    var bull = kind === 'bull', type = bull ? 'call' : 'put';
    return {
      id: bull ? 'bull-fly' : 'bear-fly', label: bull ? 'Bullish Butterfly' : 'Bearish Butterfly', bias: bull ? 'bullish' : 'bearish',
      desc: (bull ? 'Calls' : 'Puts') + ' · debit · best if the stock ' + (bull ? 'rises' : 'falls') + ' to the middle strike by expiration.',
      build: function (x, adj) {
        adj = adj || {};
        var dir = bull ? 1 : -1, center = snap(x.S + dir * Math.max(x.st, 0.6 * x.em), x.st) + (adj.center || 0) * x.st;
        var w = Math.max(x.st, snap(0.6 * x.em, x.st)) + (adj.width || 0) * x.st; if (w < x.st) w = x.st;
        if (center - w <= 0) return null;
        return { kind: this.id, sym: x.sym, exp: x.exp, legs: [{ type: type, strike: +(center - w).toFixed(2), qty: 1 }, { type: type, strike: center, qty: -2 }, { type: type, strike: +(center + w).toFixed(2), qty: 1 }], center: center, width: w };
      },
      score: function (x, st) {
        var trend = bull ? (x.S > x.sma20 && x.sma20 > x.sma50 ? 25 : x.S > x.sma50 ? 12 : 0) + (x.slope20 > 0 ? 10 : 0) : (x.S < x.sma20 && x.sma20 < x.sma50 ? 25 : x.S < x.sma50 ? 12 : 0) + (x.slope20 < 0 ? 10 : 0);
        var r = bull ? (x.rsi >= 50 && x.rsi <= 68 ? 15 : x.rsi > 45 && x.rsi < 75 ? 7 : 0) : (x.rsi >= 32 && x.rsi <= 50 ? 15 : x.rsi > 25 && x.rsi < 55 ? 7 : 0);
        var rr = st.maxLoss > 0 ? Math.min(25, st.maxProfit / st.maxLoss * 5) : 0;
        return Math.round(25 + trend + r + rr);
      },
      why: function (x, plan) {
        var c = plan.center, gap = Math.abs(c / x.S - 1) * 100;
        var t = bull ? (x.S > x.sma20 && x.sma20 > x.sma50 ? ' and trending up (above its 20- and 50-day averages)' : x.S > x.sma50 ? ' and holding above its 50-day average' : ', but it\'s below its 50-day average, so this is a weaker setup')
          : (x.S < x.sma20 && x.sma20 < x.sma50 ? ' and trending down (below its 20- and 50-day averages)' : x.S < x.sma50 ? ' and stalling under its 50-day average' : ', but it\'s still above its 50-day average, so this is a weaker setup');
        return x.sym + ' is ' + gap.toFixed(1) + '% ' + (bull ? 'under' : 'above') + ' $' + c + t +
          '. The butterfly pays most if it finishes right at $' + c + ' on ' + plan.exp + '. Risk is capped at what you pay.';
      }
    };
  }
  var jade = {
    id: 'jade-lizard', label: 'Jade Lizard', bias: 'neutral to bullish',
    desc: 'Credit · neutral to bullish · the credit covers the call spread, so there\'s no risk to the upside.',
    // 30 to 45 days out; tries a few put / call placements and keeps the one with the best
    // credit for its risk where the credit still covers the call spread (no upside risk)
    build: function (x, adj, sig) {
      adj = adj || {};
      var exp = pickExp(x.today, 35, 52), em = x.S * (sig || x.sigma) * Math.sqrt(Math.max(OPT.daysTo(exp, x.today), 1) / 365), w = x.st * Math.max(1, 1 + (adj.width || 0)), best = null;
      [0.1, 0.2, 0.3, 0.45, 0.65, 0.9].forEach(function (pk) { [0.2, 0.35, 0.5].forEach(function (ck) {
        var kp = snap(x.S - Math.max(x.st, pk * em), x.st) + (adj.center || 0) * x.st, kc = snap(x.S + Math.max(x.st, ck * em), x.st) + (adj.center || 0) * x.st;
        if (kp <= 0 || kp >= x.S || kc <= x.S) return;
        var plan = { kind: 'jade-lizard', sym: x.sym, exp: exp, legs: [{ type: 'put', strike: kp, qty: -1 }, { type: 'call', strike: kc, qty: -1 }, { type: 'call', strike: +(kc + w).toFixed(2), qty: 1 }], center: kc, width: w };
        var cr = -price(plan, x.S, x.today, sig || x.sigma).net; if (cr < w) return; // credit must cover the call spread
        var val = cr / Math.max(1, kp - cr) * (1 + pk); // credit for the downside risk, farther puts preferred
        if (!best || val > best.val) best = { val: val, plan: plan };
      }); });
      return best && best.plan;
    },
    score: function (x, st) {
      var trend = x.S > x.sma50 ? 20 : x.S > x.sma50 * 0.97 ? 8 : 0, r = x.rsi >= 40 && x.rsi <= 65 ? 15 : 5;
      var iv = Math.min(25, Math.max(0, (x.sigma - 0.2) * 60)), yieldPct = st.maxLoss > 0 ? Math.min(15, -st.cost / st.maxLoss * 300) : 0;
      return Math.round(25 + trend + r + iv + yieldPct);
    },
    why: function (x, plan) {
      return x.sym + ' is holding ' + (x.S > x.sma50 ? 'above' : 'near') + ' its 50-day average with ' + Math.round(x.sigma * 100) + '% volatility, so the options pay well. You collect the credit up front and keep it all if ' + x.sym + ' finishes between $' + plan.legs[0].strike + ' and $' + plan.legs[1].strike + '. Below $' + plan.legs[0].strike + ' you can lose, like owning the stock.';
    }
  };
  var STRATS = [butterfly('bull'), butterfly('bear'), jade];
  function byId(id) { return STRATS.filter(function (s) { return s.id === id; })[0]; }
  // ------------------------------------------------------------ scan
  function evaluate(strat, item, today, adj) {
    if (!item.series || item.series.n < 60) return null;
    var x = context(item.sym, item.series, item.S, today), plan = strat.build(x, adj, x.sigma); if (!plan) return null;
    var p = price(plan, x.S, today, x.sigma), st = stats(plan, p.net);
    if (st.maxProfit <= 0) return null;
    return { sym: item.sym, name: item.name, ctx: x, plan: plan, priced: p, stats: st, score: Math.max(1, Math.min(99, strat.score(x, st))), why: strat.why(x, plan) };
  }
  function scan(id, list, today, n) {
    var strat = byId(id); if (!strat) return [];
    return list.map(function (it) { try { return evaluate(strat, it, today); } catch (e) { return null; } }).filter(Boolean)
      .sort(function (a, b) { return b.score - a.score; }).slice(0, n || 6);
  }
  global.ZelosStrategies = { STRATS: STRATS, byId: byId, scan: scan, evaluate: evaluate, price: price, stats: stats, payoffAt: payoffAt, context: context };
})(window);
