/** The website's Z token image (zelos-tokens.js --zt-coin): hex coin, ridged gold edge, blue enamel, white Z. */
export const COIN_URL = "data:image/svg+xml,%3Csvg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cdefs%3E%3ClinearGradient id='zg' x1='0' y1='0' x2='1' y2='1'%3E%3Cstop offset='0' stop-color='%23ffe9a3'/%3E%3Cstop offset='.45' stop-color='%23f0b434'/%3E%3Cstop offset='1' stop-color='%239a6a0c'/%3E%3C/linearGradient%3E%3ClinearGradient id='zt' x1='0' y1='0' x2='0' y2='1'%3E%3Cstop offset='0' stop-color='%23fff4cc'/%3E%3Cstop offset='1' stop-color='%23d99a1e'/%3E%3C/linearGradient%3E%3CradialGradient id='zb' cx='38%25' cy='30%25' r='80%25'%3E%3Cstop offset='0' stop-color='%238fb8ff'/%3E%3Cstop offset='.5' stop-color='%233f74e8'/%3E%3Cstop offset='1' stop-color='%23173a8f'/%3E%3C/radialGradient%3E%3C/defs%3E%3Cpolygon points='50.00,2.00 91.57,26.00 91.57,74.00 50.00,98.00 8.43,74.00 8.43,26.00' fill='url(%23zg)' stroke='%235c3f06' stroke-width='2' stroke-linejoin='round'/%3E%3Cpolygon points='50.00,6.50 87.67,28.25 87.67,71.75 50.00,93.50 12.33,71.75 12.33,28.25' fill='none' stroke='%237a5208' stroke-width='7' stroke-dasharray='2.1 2.3' stroke-linejoin='round' opacity='.85'/%3E%3Cpolygon points='50.00,11.00 83.77,30.50 83.77,69.50 50.00,89.00 16.23,69.50 16.23,30.50' fill='url(%23zt)' stroke='%237a5208' stroke-width='1.2' stroke-linejoin='round'/%3E%3Cpolygon points='50.00,16.00 79.44,33.00 79.44,67.00 50.00,84.00 20.56,67.00 20.56,33.00' fill='url(%23zb)' stroke='%230f2a6b' stroke-width='2' stroke-linejoin='round'/%3E%3Cpath d='M36 34 H64 V41 L46 60 H64 V67 H36 V60 L54 41 H36 Z' fill='%230f2a6b' transform='translate(1.6 2)' opacity='.55'/%3E%3Cpath d='M36 34 H64 V41 L46 60 H64 V67 H36 V60 L54 41 H36 Z' fill='%23ffffff' stroke='%23e8b23d' stroke-width='1.6' stroke-linejoin='round'/%3E%3Cpath d='M37.5 35.5 H62.5' stroke='%23ffffff' stroke-width='1' opacity='.9'/%3E%3Cpath d='M24 30 L44 19' stroke='%23ffffff' stroke-width='3' stroke-linecap='round' opacity='.25'/%3E%3C/svg%3E";

// ---------------------------------------------------------------- coin reward (zelos-tokens.js reward)
// Tokens credited (check-in, Trade War reward, purchase): pixel coins burst from the middle of
// the screen, spin, and fly into your token chip, which counts up and bumps. ~1.5 s on a
// temporary canvas that removes itself; skipped with reduced motion or when no chip is shown.
const PAL: Record<string, string> = { o: '#3a2604', g: '#f0b434', y: '#ffe08a', G: '#b07a12', b: '#3f74e8', B: '#2452b8', l: '#8fb8ff', w: '#ffffff' };
let GRID: string[][] | null = null;

function coinGrid(): string[][] {
  const rows = [[7, 8], [5, 10], [3, 12], [1, 14], [1, 14], [1, 14], [1, 14], [1, 14], [1, 14], [1, 14], [1, 14], [1, 14], [1, 14], [3, 12], [5, 10], [7, 8]];
  const N = 16;
  const depth: number[][] = rows.map(([a, b]) => Array.from({ length: N }, (_, x) => (x >= a! && x <= b! ? 99 : -1)));
  for (let dd = 0; dd < 6; dd++)
    for (let y = 0; y < N; y++)
      for (let x = 0; x < N; x++) {
        if (depth[y]![x] !== 99) continue;
        const edge = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([qx, qy]) => {
          const a = y + qy!, b = x + qx!;
          return a < 0 || b < 0 || a >= N || b >= N || (depth[a]![b] !== 99 && depth[a]![b]! < dd) || (depth[a]![b] === -1 && dd === 0);
        });
        if (edge) depth[y]![x] = dd;
      }
  const g: string[][] = depth.map((r, yy) => r.map((v, xx): string => (v < 0 ? '.' : v === 0 ? 'o' : v === 1 ? ((xx + yy) % 2 ? 'G' : 'g') : v === 2 ? 'y' : xx + yy < 11 ? 'l' : yy > 10 ? 'B' : 'b')));
  for (const [x, y] of [[5, 5], [6, 5], [7, 5], [8, 5], [9, 5], [10, 5], [9, 6], [8, 7], [7, 8], [6, 9], [5, 10], [6, 10], [7, 10], [8, 10], [9, 10], [10, 10]]) g[y!]![x!] = 'w';
  return g;
}

function drawCoin(ctx: CanvasRenderingContext2D, cx: number, cy: number, frame: number, S: number) {
  GRID ??= coinGrid();
  const f = ((frame % 8) + 8) % 8;
  const squash = [1, 0.78, 0.48, 0.2, 0.2, 0.2, 0.48, 0.78][f]!;
  const edge = f >= 3 && f <= 5;
  const back = f > 4;
  const x0 = Math.round(cx);
  const y0 = Math.round(cy) - 8;
  if (f === 4) {
    for (let y = 0; y < 16; y++) {
      ctx.fillStyle = y === 0 || y === 15 ? PAL.o! : y % 2 ? '#f0b434' : '#b07a12';
      ctx.fillRect((x0 - 1) * S, (y0 + y) * S, 2 * S, S);
    }
    ctx.fillStyle = PAL.o!;
    ctx.fillRect((x0 - 2) * S, (y0 + 1) * S, S, 14 * S);
    ctx.fillRect((x0 + 1) * S, (y0 + 1) * S, S, 14 * S);
    return;
  }
  const w = Math.max(3, Math.round(16 * squash));
  const left = x0 - Math.floor(w / 2);
  for (let j = 0; j < w; j++) {
    const sx = Math.min(15, Math.floor(((j + 0.5) / w) * 16));
    for (let yy = 0; yy < 16; yy++) {
      let v = GRID[yy]![sx]!;
      if (v === '.') continue;
      if (back && v === 'w') v = 'B';
      if (edge && v !== 'o' && j > 0 && j < w - 1) v = yy % 2 ? 'g' : 'G';
      ctx.fillStyle = PAL[v]!;
      ctx.fillRect((left + j) * S, (y0 + yy) * S, S, S);
    }
  }
}

/**
 * Play the coin reward into `target` (the token chip). `onCount` gets the number to show while
 * coins land (null when done). Returns false (nothing played) with reduced motion.
 */
export function playCoinReward(amount: number, from: number, target: HTMLElement, onCount: (n: number | null) => void): boolean {
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return false;
  const S = window.innerWidth < 600 ? 2 : 3;
  const cv = document.createElement('canvas');
  const W = Math.ceil(window.innerWidth / S);
  const H = Math.ceil(window.innerHeight / S);
  cv.width = W * S;
  cv.height = H * S;
  cv.setAttribute('aria-hidden', 'true');
  cv.style.cssText = `position:fixed;inset:0;width:${W * S}px;height:${H * S}px;z-index:2200;pointer-events:none`;
  document.body.appendChild(cv);
  const ctx = cv.getContext('2d');
  if (!ctx) {
    cv.remove();
    return false;
  }
  ctx.imageSmoothingEnabled = false;
  const tr = (target.querySelector('[data-coin]') ?? target).getBoundingClientRect();
  const tx = (tr.left + tr.width / 2) / S;
  const ty = (tr.top + tr.height / 2) / S;
  const ox = W / 2;
  const oy = H * 0.55;
  const n = Math.max(3, Math.min(18, Math.round(Math.sqrt(amount) * 1.6)));
  const step = amount / n;
  let shown = from;
  onCount(shown);
  type P = { x: number; y: number; vx: number; vy: number; age: number; delay: number; home: number; frame: number; sx?: number; sy?: number };
  const parts: P[] = Array.from({ length: n }, (_, i) => ({ x: ox, y: oy, vx: (Math.random() - 0.5) * (2.2 + n / 12), vy: -2.4 - Math.random() * 2.2, age: 0, delay: i * 1.5, home: 30 + Math.random() * 14, frame: Math.floor(Math.random() * 8) }));
  const sparks: { x: number; y: number; life: number; age: number }[] = [];
  const sparkle = (x: number, y: number, k: number, spread: number) => {
    for (let q = 0; q < k; q++) sparks.push({ x: x + (Math.random() - 0.5) * spread, y: y + (Math.random() - 0.5) * spread, life: 14 + Math.random() * 14, age: 0 });
  };
  const star = (x: number, y: number, a: number) => {
    x = Math.round(x);
    y = Math.round(y);
    ctx.fillStyle = a > 0.5 ? '#ffffff' : '#ffd970';
    ctx.fillRect(x * S, y * S, S, S);
    ctx.fillStyle = '#f0b434';
    for (const [qx, qy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) ctx.fillRect((x + qx!) * S, (y + qy!) * S, S, S);
  };
  sparkle(ox, oy, 8 + n / 2, 26);
  const plus = document.createElement('div');
  plus.textContent = `+${amount}`;
  plus.setAttribute('aria-hidden', 'true');
  plus.style.cssText = `position:fixed;left:50%;top:${oy * S - 40}px;transform:translateX(-50%);z-index:2201;pointer-events:none;font:800 1.4rem "IBM Plex Mono",monospace;color:#ffe08a;text-shadow:2px 2px 0 #5c3f06;transition:transform 1.1s ease-out,opacity 1.1s ease-in`;
  document.body.appendChild(plus);
  requestAnimationFrame(() => {
    plus.style.transform = 'translate(-50%,-40px)';
    plus.style.opacity = '0';
  });
  const started = Date.now();
  const loop = () => {
    ctx.clearRect(0, 0, cv.width, cv.height);
    for (let k = parts.length - 1; k >= 0; k--) {
      const p = parts[k]!;
      if (p.delay > 0) {
        p.delay--;
        continue;
      }
      p.age++;
      if (p.age % 3 === 0) p.frame++;
      if (p.age < p.home) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.16;
        p.vx *= 0.985;
      } else {
        const tt = Math.min(1, (p.age - p.home) / 22);
        const e = tt * tt * tt;
        p.sx ??= p.x;
        p.sy ??= p.y;
        p.x = p.sx + (tx - p.sx) * e;
        p.y = p.sy + (ty - p.sy) * e - Math.sin(tt * Math.PI) * 14;
        if (tt >= 1) {
          parts.splice(k, 1);
          shown = parts.length ? Math.min(from + amount, Math.round(shown + step)) : from + amount;
          onCount(shown);
          target.animate?.([{ transform: 'scale(1)' }, { transform: 'scale(1.18)' }, { transform: 'scale(1)' }], { duration: 280, easing: 'cubic-bezier(.3,1.6,.5,1)' });
          sparkle(tx, ty, 2, 10);
          continue;
        }
      }
      drawCoin(ctx, p.x, p.y, p.frame, S);
    }
    for (let j = sparks.length - 1; j >= 0; j--) {
      const sp = sparks[j]!;
      sp.age++;
      if (sp.age > sp.life) {
        sparks.splice(j, 1);
        continue;
      }
      if ((sp.age >> 1) % 3 !== 2) star(sp.x, sp.y, 1 - sp.age / sp.life);
    }
    if ((parts.length || sparks.length) && Date.now() - started < 4000) requestAnimationFrame(loop);
    else {
      cv.remove();
      plus.remove();
      onCount(null);
    }
  };
  requestAnimationFrame(loop);
  return true;
}
