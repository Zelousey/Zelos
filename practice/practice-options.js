/*!
 * Zelos Practice Account: simulated options.
 *
 * There is no live options feed on the free data plan, so option prices here
 * are MODELED: Black-Scholes on the stock's live price, with volatility
 * estimated from its own recent daily moves (20-day historical volatility,
 * nudged up the way real implied vol usually sits above realized). Bid/ask
 * are a spread around that model price. The page says so wherever a price is
 * shown. Long calls and puts only (buy to open, sell to close), same scope as
 * the Options Scanner; the position model is instrument-based so spreads and
 * other multi-leg strategies can slot in later.
 */
(function (global) {
  'use strict';
  var RATE = 0.04;

  // standard normal CDF (Abramowitz-Stegun)
  function ncdf(x) {
    var t = 1 / (1 + 0.2316419 * Math.abs(x)), d = 0.3989423 * Math.exp(-x * x / 2);
    var p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
    return x > 0 ? 1 - p : p;
  }
  function bs(type, S, K, T, sigma, r) {
    r = r == null ? RATE : r;
    if (T <= 0 || sigma <= 0) return { price: Math.max(0, type === 'call' ? S - K : K - S), delta: type === 'call' ? (S > K ? 1 : 0) : (S < K ? -1 : 0) };
    var sq = sigma * Math.sqrt(T), d1 = (Math.log(S / K) + (r + sigma * sigma / 2) * T) / sq, d2 = d1 - sq;
    if (type === 'call') return { price: S * ncdf(d1) - K * Math.exp(-r * T) * ncdf(d2), delta: ncdf(d1) };
    return { price: K * Math.exp(-r * T) * ncdf(-d2) - S * ncdf(-d1), delta: ncdf(d1) - 1 };
  }
  // annualized volatility from the last `n` daily closes, lifted ~10% toward typical implied vol
  function histVol(closes, n) {
    n = n || 20;
    var c = closes.slice(-(n + 1)); if (c.length < 5) return 0.4;
    var r = []; for (var i = 1; i < c.length; i++) r.push(Math.log(c[i] / c[i - 1]));
    var m = r.reduce(function (a, b) { return a + b; }, 0) / r.length;
    var v = r.reduce(function (a, b) { return a + (b - m) * (b - m); }, 0) / (r.length - 1);
    return Math.min(1.8, Math.max(0.15, Math.sqrt(v * 252) * 1.1));
  }
  function ymd(d) { return d.toISOString().slice(0, 10); }
  // next weekly Fridays plus the next few monthly (3rd-Friday) expirations
  function expirations(todayStr) {
    var out = [], d = new Date(todayStr + 'T12:00:00Z');
    var f = new Date(d); f.setUTCDate(f.getUTCDate() + ((5 - f.getUTCDay() + 7) % 7 || 7));
    for (var k = 0; k < 6; k++) { out.push(ymd(f)); f.setUTCDate(f.getUTCDate() + 7); }
    for (var mth = 0; mth < 5; mth++) {
      var m = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + mth, 1, 12));
      var first = (5 - m.getUTCDay() + 7) % 7; m.setUTCDate(1 + first + 14);
      var s = ymd(m); if (s > todayStr && out.indexOf(s) === -1) out.push(s);
    }
    return out.sort();
  }
  function daysTo(exp, todayStr) { return Math.round((new Date(exp + 'T12:00:00Z') - new Date(todayStr + 'T12:00:00Z')) / 864e5); }
  function strikeStep(S) { return S < 25 ? 0.5 : S < 60 ? 1 : S < 150 ? 2.5 : S < 400 ? 5 : S < 1000 ? 10 : 25; }
  function strikes(S, count) {
    var st = strikeStep(S), atm = Math.round(S / st) * st, out = [], half = Math.floor((count || 15) / 2);
    for (var k = -half; k <= half; k++) { var x = +(atm + k * st).toFixed(2); if (x > 0) out.push(x); }
    return out;
  }
  // model quote for one contract: mid, bid, ask (per share), delta
  function quote(type, S, K, exp, todayStr, sigma) {
    var dte = Math.max(0, daysTo(exp, todayStr));
    var T = Math.max(dte, 0.5) / 365, q = bs(type, S, K, T, sigma);
    var mid = Math.max(0.01, q.price), spread = Math.max(0.02, Math.min(0.5, mid * 0.04));
    return { mid: round2(mid), bid: round2(Math.max(0.01, mid - spread / 2)), ask: round2(mid + spread / 2), delta: q.delta, dte: dte, iv: sigma };
  }
  function round2(x) { return Math.round(x * 100) / 100; }
  function contractId(sym, type, strike, exp) { return sym + ' ' + exp + ' ' + strike + (type === 'call' ? 'C' : 'P'); }
  function label(o) {
    var e = o.exp.slice(5).replace('-', '/');
    return o.sym + ' $' + (+o.strike) + ' ' + (o.type === 'call' ? 'Call' : 'Put') + ' ' + e;
  }

  global.ZelosOptions = { bs: bs, histVol: histVol, expirations: expirations, daysTo: daysTo, strikes: strikes, quote: quote, contractId: contractId, label: label };
})(window);
