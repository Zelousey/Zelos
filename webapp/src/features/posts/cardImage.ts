/**
 * The share card as a picture to download and post anywhere (Snapchat, Instagram…), 1080 × 1350
 * (owner 2026-11-13: bold, professional, the chart with the buy and the sale, what you put in and
 * what you made, your username and the app's name; no "virtual money" on the picture).
 */
import { instrument } from '../../data/universe';
import type { CardChart } from './chartData';
import { heldFor, type BattleCard, type PostSource, type SoloCard } from './posts';

const W = 1080;
const H = 1350;
const UP = '#2fd67b';
const DOWN = '#ff5a1f';
const FONT = '"IBM Plex Sans", "Helvetica Neue", Arial, sans-serif';

const money = (n: number, signed = true) => (signed ? (n >= 0 ? '+' : '−') : n < 0 ? '−' : '') + '$' + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct = (n: number) => (n >= 0 ? '+' : '−') + Math.abs(n).toFixed(2) + '%';
const day = (d?: string) => (d ? new Date(d + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '');

function round(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

function fit(c: CanvasRenderingContext2D, text: string, max: number): string {
  if (c.measureText(text).width <= max) return text;
  let s = text;
  while (s.length > 1 && c.measureText(s + '…').width > max) s = s.slice(0, -1);
  return s + '…';
}

function wrap(c: CanvasRenderingContext2D, text: string, max: number, lines: number): string[] {
  const out: string[] = [];
  let line = '';
  const words = text.replace(/\s+/g, ' ').trim().split(' ');
  for (let i = 0; i < words.length; i++) {
    const next = line ? line + ' ' + words[i] : words[i]!;
    if (c.measureText(next).width > max && line) {
      out.push(line);
      line = words[i]!;
      if (out.length === lines) {
        out[lines - 1] = fit(c, out[lines - 1]! + ' ' + words.slice(i).join(' '), max);
        return out;
      }
    } else line = next;
  }
  if (line) out.push(line);
  return out;
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((res) => {
    const im = new Image();
    im.onload = () => res(im);
    im.onerror = () => res(null);
    im.src = src;
  });
}

function drawLine(c: CanvasRenderingContext2D, ch: CardChart, color: string, x0: number, y0: number, w: number, h: number, base?: number) {
  const ys = ch.p;
  const ref = base ?? (ch.buy != null ? ys[ch.buy]! : ys[0]!);
  const lo = Math.min(...ys, ref);
  const hi = Math.max(...ys, ref);
  const span = hi - lo || 1;
  const X = (i: number) => x0 + (i / (ys.length - 1)) * w;
  const Y = (v: number) => y0 + (1 - (v - lo) / span) * h;
  // dotted line at the buy price (or the start)
  c.save();
  c.strokeStyle = 'rgba(255,255,255,0.38)';
  c.lineWidth = 3;
  c.lineCap = 'round';
  c.setLineDash([2, 14]);
  c.beginPath();
  c.moveTo(x0, Y(ref));
  c.lineTo(x0 + w, Y(ref));
  c.stroke();
  c.restore();
  // the area under the line, then the line
  c.beginPath();
  ys.forEach((v, i) => (i ? c.lineTo(X(i), Y(v)) : c.moveTo(X(i), Y(v))));
  c.lineTo(X(ys.length - 1), y0 + h + 40);
  c.lineTo(X(0), y0 + h + 40);
  c.closePath();
  const g = c.createLinearGradient(0, y0, 0, y0 + h + 40);
  g.addColorStop(0, color + '55');
  g.addColorStop(1, color + '00');
  c.fillStyle = g;
  c.fill();
  c.beginPath();
  ys.forEach((v, i) => (i ? c.lineTo(X(i), Y(v)) : c.moveTo(X(i), Y(v))));
  c.strokeStyle = color;
  c.lineWidth = 6;
  c.lineJoin = 'round';
  c.lineCap = 'round';
  c.shadowColor = color;
  c.shadowBlur = 18;
  c.stroke();
  c.shadowBlur = 0;
  const mark = (i: number, plus: boolean) => {
    const x = X(i);
    const y = Y(ys[i]!);
    c.beginPath();
    c.arc(x, y, 24, 0, Math.PI * 2);
    c.fillStyle = color;
    c.fill();
    c.lineWidth = 6;
    c.strokeStyle = '#06070a';
    c.stroke();
    c.beginPath();
    c.moveTo(x - 10, y);
    c.lineTo(x + 10, y);
    if (plus) {
      c.moveTo(x, y - 10);
      c.lineTo(x, y + 10);
    }
    c.strokeStyle = '#06070a';
    c.lineWidth = 5;
    c.stroke();
  };
  if (ch.buy != null) mark(ch.buy, true);
  if (ch.sell != null) mark(ch.sell, false);
  if (ch.buy == null) {
    c.beginPath();
    c.arc(X(ys.length - 1), Y(ys[ys.length - 1]!), 14, 0, Math.PI * 2);
    c.fillStyle = color;
    c.fill();
  }
}

export async function drawCard(source: PostSource, card: SoloCard | BattleCard, name: string, username: string | null | undefined, thesis: string): Promise<HTMLCanvasElement> {
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const c = cv.getContext('2d')!;
  if (document.fonts?.ready) await document.fonts.ready;
  const solo = source === 'solo';
  const sc = card as SoloCard;
  const bc = card as BattleCard;
  const up = solo ? sc.pnl >= 0 : bc.pnlPct >= 0;
  const color = up ? UP : DOWN;

  // background: near black, a blue glow up top and the result's colour down low
  c.fillStyle = '#06070a';
  c.fillRect(0, 0, W, H);
  const g1 = c.createRadialGradient(180, 0, 10, 180, 0, 900);
  g1.addColorStop(0, 'rgba(47,91,216,0.42)');
  g1.addColorStop(1, 'rgba(47,91,216,0)');
  c.fillStyle = g1;
  c.fillRect(0, 0, W, H);
  const g2 = c.createRadialGradient(W, H, 10, W, H, 900);
  g2.addColorStop(0, up ? 'rgba(47,214,123,0.22)' : 'rgba(255,90,31,0.22)');
  g2.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = g2;
  c.fillRect(0, 0, W, H);

  // the brand bar: logo and the app's name
  const logo = await loadImage(`${import.meta.env.BASE_URL}icons/icon-192.png`);
  if (logo) {
    c.save();
    round(c, 72, 64, 72, 72, 16);
    c.clip();
    c.drawImage(logo, 72, 64, 72, 72);
    c.restore();
  }
  c.fillStyle = '#ffffff';
  c.font = `900 40px ${FONT}`;
  c.textBaseline = 'middle';
  c.fillText('ZELOS TRADE WAR', logo ? 164 : 72, 100);

  // who: the trader
  const handle = username ? '@' + username : name;
  c.beginPath();
  c.arc(108, 228, 36, 0, Math.PI * 2);
  c.fillStyle = '#1b2233';
  c.fill();
  c.fillStyle = '#ffffff';
  c.font = `800 34px ${FONT}`;
  c.textAlign = 'center';
  c.fillText((name || '?').slice(0, 1).toUpperCase(), 108, 230);
  c.textAlign = 'left';
  c.font = `800 40px ${FONT}`;
  c.fillText(fit(c, handle, 700), 168, 212);
  c.fillStyle = 'rgba(255,255,255,0.6)';
  c.font = `500 30px ${FONT}`;
  c.fillText(solo ? (sc.openDay && sc.closeDay ? `Closed a trade · ${day(sc.openDay)} → ${day(sc.closeDay)} · ${heldFor(sc.openDay, sc.closeDay)}` : 'Closed a trade') : 'Finished a Trade War battle', 168, 254);

  // the thesis, if any
  let y = 316;
  if (thesis.trim()) {
    c.fillStyle = '#ffffff';
    c.font = `500 36px ${FONT}`;
    c.textBaseline = 'alphabetic';
    for (const ln of wrap(c, thesis.trim(), W - 144, 3)) {
      y += 46;
      c.fillText(ln, 72, y);
    }
    y += 34;
  } else y += 10;

  // the card
  const cx = 56;
  const cw = W - 112;
  const cy = y;
  const ch = H - 150 - cy;
  round(c, cx, cy, cw, ch, 36);
  c.fillStyle = '#000000';
  c.fill();
  c.lineWidth = 3;
  c.strokeStyle = 'rgba(255,255,255,0.16)';
  c.stroke();
  c.textBaseline = 'alphabetic';
  c.fillStyle = 'rgba(255,255,255,0.62)';
  c.font = `500 32px ${FONT}`;
  c.fillText(fit(c, solo ? (sc.option ?? instrument(sc.sym)?.name ?? sc.sym) : bc.name, cw - 96), cx + 48, cy + 74);
  c.fillStyle = solo ? color : '#ffffff';
  c.font = `900 92px ${FONT}`;
  c.fillText(solo ? money(sc.pnl) : bc.rank === 1 ? '1st place 🏆' : `#${bc.rank} of ${bc.of}`, cx + 44, cy + 172);
  c.fillStyle = color;
  c.font = `800 40px ${FONT}`;
  const chg = `${up ? '▲' : '▼'} ${pct(solo ? sc.pct : bc.pnlPct)}`;
  c.fillText(chg, cx + 48, cy + 230);
  const cw2 = c.measureText(chg).width;
  c.fillStyle = 'rgba(255,255,255,0.7)';
  c.font = `500 34px ${FONT}`;
  c.fillText(solo ? `  ${sc.qty.toLocaleString('en-US')} ${sc.option ? (sc.qty === 1 ? 'contract' : 'contracts') : sc.qty === 1 ? 'share' : 'shares'}` : `  ${bc.trades} trades`, cx + 48 + cw2, cy + 230);

  const footH = 190;
  const lineTop = cy + 290;
  const lineH = ch - (lineTop - cy) - footH - 50;
  const chart = card.chart;
  if (chart) drawLine(c, chart, color, cx + 40, lineTop, cw - 80, Math.max(160, lineH), solo ? undefined : (bc.start ?? undefined));

  // footer: the order and the result in a bold pill
  const fy = cy + ch - footH;
  c.strokeStyle = 'rgba(255,255,255,0.14)';
  c.lineWidth = 3;
  c.beginPath();
  c.moveTo(cx, fy);
  c.lineTo(cx + cw, fy);
  c.stroke();
  c.fillStyle = '#ffffff';
  c.font = `900 46px ${FONT}`;
  c.fillText(solo ? sc.sym : 'Trade War', cx + 48, fy + 72);
  c.fillStyle = 'rgba(255,255,255,0.85)';
  c.font = `500 32px ${FONT}`;
  const invested = solo ? sc.entry * sc.qty * (sc.option ? 100 : 1) : (bc.start ?? 0);
  c.fillText(solo ? `Buy ${sc.qty.toLocaleString('en-US')} @ ${money(sc.entry, false)} · Sell @ ${money(sc.exit, false)}` : bc.start != null && bc.final != null ? `${money(bc.start, false)} → ${money(bc.final, false)}` : `${bc.of} traders`, cx + 48, fy + 120);
  c.fillStyle = 'rgba(255,255,255,0.55)';
  c.font = `500 28px ${FONT}`;
  c.fillText(solo ? `Put in ${money(invested, false)}` : `${bc.of} traders`, cx + 48, fy + 160);
  const pill = money(solo ? sc.pnl : bc.pnl);
  c.font = `900 50px ${FONT}`;
  const pw = c.measureText(pill).width + 64;
  round(c, cx + cw - 48 - pw, fy + 52, pw, 92, 18);
  c.fillStyle = color;
  c.fill();
  c.fillStyle = '#06070a';
  c.textBaseline = 'middle';
  c.fillText(pill, cx + cw - 48 - pw + 32, fy + 100);

  // the app, down below
  c.textBaseline = 'alphabetic';
  c.fillStyle = '#ffffff';
  c.font = `800 34px ${FONT}`;
  c.textAlign = 'center';
  c.fillText('Trade it on Zelos Trade War', W / 2, H - 82);
  c.fillStyle = 'rgba(255,255,255,0.6)';
  c.font = `500 28px ${FONT}`;
  c.fillText('agentictrading.info', W / 2, H - 40);
  c.textAlign = 'left';
  return cv;
}

export const cardBlob = (cv: HTMLCanvasElement) => new Promise<Blob | null>((res) => cv.toBlob((b) => res(b), 'image/png'));
