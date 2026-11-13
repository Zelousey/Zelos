/**
 * The share card as a picture (1200 × 630, the size social apps preview), drawn on a canvas so it
 * can go to other apps or be saved. The same numbers as the card in the feed.
 */
import type { BattleCard, PostSource, SoloCard } from './posts';

const W = 1200;
const H = 630;
const GREEN = '#3ecb7c';
const RED = '#f0564a';
const FONT = '"IBM Plex Sans", system-ui, -apple-system, sans-serif';

const money = (n: number, signed = false) => (signed && n > 0 ? '+' : n < 0 ? '−' : '') + '$' + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct = (n: number) => (n > 0 ? '+' : n < 0 ? '−' : '') + Math.abs(n).toFixed(2) + '%';
const price = (n: number) => '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const day = (d?: string) => (d ? new Date(d + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '');

function wrap(c: CanvasRenderingContext2D, text: string, max: number, lines: number): string[] {
  const out: string[] = [];
  let line = '';
  for (const word of text.replace(/\s+/g, ' ').trim().split(' ')) {
    const next = line ? line + ' ' + word : word;
    if (c.measureText(next).width > max && line) {
      out.push(line);
      line = word;
      if (out.length === lines) break;
    } else line = next;
  }
  if (out.length < lines && line) out.push(line);
  if (out.length === lines && text.length > out.join(' ').length) out[lines - 1] = out[lines - 1]!.replace(/\s*\S*$/, '') + '…';
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

export async function drawCard(source: PostSource, card: SoloCard | BattleCard, name: string, thesis: string): Promise<HTMLCanvasElement> {
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const c = cv.getContext('2d')!;
  const up = source === 'solo' ? (card as SoloCard).pnl >= 0 : (card as BattleCard).pnlPct >= 0;
  const tone = up ? GREEN : RED;
  // background: dark, with a glow in the result's colour and the house blue
  c.fillStyle = '#0b0d12';
  c.fillRect(0, 0, W, H);
  const g1 = c.createRadialGradient(260, 120, 20, 260, 120, 700);
  g1.addColorStop(0, 'rgba(47,91,216,0.45)');
  g1.addColorStop(1, 'rgba(47,91,216,0)');
  c.fillStyle = g1;
  c.fillRect(0, 0, W, H);
  const g2 = c.createRadialGradient(980, 520, 20, 980, 520, 520);
  g2.addColorStop(0, up ? 'rgba(62,203,124,0.28)' : 'rgba(240,86,74,0.28)');
  g2.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = g2;
  c.fillRect(0, 0, W, H);
  const art = await loadImage(`${import.meta.env.BASE_URL}art/${source === 'battle' ? 'teamup' : 'bull'}.webp`);
  if (art) {
    const h = 400;
    const w = (art.width / art.height) * h;
    c.globalAlpha = 0.9;
    c.drawImage(art, W - w - 40, H - h - 70, w, h);
    c.globalAlpha = 1;
  }
  c.textBaseline = 'alphabetic';
  c.fillStyle = '#ffffff';
  c.font = `800 30px ${FONT}`;
  c.fillText('ZELOS TRADE WAR', 64, 84);
  c.fillStyle = 'rgba(255,255,255,0.6)';
  c.font = `500 22px ${FONT}`;
  c.fillText(source === 'solo' ? 'Solo trade · virtual money, real prices' : 'Trade War battle · virtual money', 64, 118);

  if (source === 'solo') {
    const t = card as SoloCard;
    c.fillStyle = '#ffffff';
    c.font = `800 92px ${FONT}`;
    c.fillText(t.sym, 64, 238);
    if (t.option) {
      c.font = `600 26px ${FONT}`;
      c.fillStyle = 'rgba(255,255,255,0.75)';
      c.fillText(t.option, 64, 276);
    }
    c.fillStyle = tone;
    c.font = `800 84px ${FONT}`;
    c.fillText(pct(t.pct), 64, 370);
    c.font = `700 40px ${FONT}`;
    c.fillText(money(t.pnl, true), 64, 424);
    c.fillStyle = 'rgba(255,255,255,0.8)';
    c.font = `500 26px ${FONT}`;
    const unit = t.option ? (t.qty === 1 ? 'contract' : 'contracts') : t.qty === 1 ? 'share' : 'shares';
    const when = t.openDay && t.closeDay ? ` · ${day(t.openDay)} → ${day(t.closeDay)}` : '';
    c.fillText(`${t.qty} ${unit} · in ${price(t.entry)} · out ${price(t.exit)}${when}`, 64, 472);
  } else {
    const b = card as BattleCard;
    c.fillStyle = '#ffffff';
    c.font = `800 60px ${FONT}`;
    c.fillText(wrap(c, b.name, 640, 1)[0] ?? b.name, 64, 214);
    c.fillStyle = b.rank === 1 ? '#e8b23d' : '#ffffff';
    c.font = `900 110px ${FONT}`;
    const place = b.rank === 1 ? '1st 🏆' : `#${b.rank}`;
    c.fillText(place, 64, 340);
    c.fillStyle = 'rgba(255,255,255,0.8)';
    c.font = `600 30px ${FONT}`;
    c.fillText(`of ${b.of} traders · ${b.trades} trades`, 64, 388);
    c.fillStyle = tone;
    c.font = `800 64px ${FONT}`;
    c.fillText(pct(b.pnlPct), 64, 466);
  }
  // the thesis, then the name
  if (thesis.trim()) {
    c.fillStyle = 'rgba(255,255,255,0.92)';
    c.font = `italic 500 26px ${FONT}`;
    wrap(c, '“' + thesis.trim() + '”', 700, 2).forEach((ln, i) => c.fillText(ln, 64, 528 + i * 34));
  }
  c.fillStyle = 'rgba(255,255,255,0.55)';
  c.font = `600 22px ${FONT}`;
  c.fillText(`${name} · agentictrading.info`, 64, H - 28);
  return cv;
}

export const cardBlob = (cv: HTMLCanvasElement) => new Promise<Blob | null>((res) => cv.toBlob((b) => res(b), 'image/png'));
