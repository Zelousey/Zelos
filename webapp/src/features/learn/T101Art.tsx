/**
 * Trading 101's black-and-red look (owner 2026-11-15): the book covers and the level card's red
 * candles. Drawn in code so every book matches, at any size.
 */
import { useId } from 'react';
import { t } from '../../lib/i18n';
import type { Chapter } from './chapters';
import s from './Learn.module.css';

/** Rising red candles with a glow line under them (seeded, so a book always has the same art). */
export function Candles({ seed = 3, n = 22, className }: { seed?: number; n?: number; className?: string }) {
  const gid = useId().replace(/:/g, '');
  let r = seed * 9301 + 49297;
  const rnd = () => ((r = (r * 9301 + 49297) % 233280) / 233280);
  const W = 200, H = 100, bw = W / n;
  const bars: { x: number; o: number; c: number; h: number; l: number }[] = [];
  let p = 78;
  for (let i = 0; i < n; i++) {
    const o = p, c = Math.max(8, p - (rnd() * 9 - 2.2) * (0.6 + i / n));
    bars.push({ x: i * bw + bw * 0.2, o, c, h: Math.min(o, c) - rnd() * 6, l: Math.max(o, c) + rnd() * 6 });
    p = c;
  }
  return (
    <svg className={className} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id={`g${gid}`} x1="0" x2="1">
          <stop offset="0" stopColor="#ff2d2d" stopOpacity="0" />
          <stop offset="1" stopColor="#ff2d2d" stopOpacity="0.9" />
        </linearGradient>
      </defs>
      {bars.map((b, i) => (
        <g key={i} opacity={0.25 + (0.75 * i) / n}>
          <line x1={b.x + bw * 0.3} x2={b.x + bw * 0.3} y1={b.h} y2={b.l} stroke="#ff3b3b" strokeWidth="0.8" />
          <rect x={b.x} y={Math.min(b.o, b.c)} width={bw * 0.6} height={Math.max(1.5, Math.abs(b.o - b.c))} fill={b.c < b.o ? '#e53935' : '#5a1515'} />
        </g>
      ))}
      <path d={`M0,${H - 4} Q${W * 0.6},${H - 8} ${W},${H * 0.35}`} fill="none" stroke={`url(#g${gid})`} strokeWidth="1.5" />
    </svg>
  );
}

const RED = '#ff3b3b';
const DEEP = '#5a1515';
const FAINT = 'rgba(255,255,255,0.18)';

/**
 * Each book's own picture (owner 2026-11-19: "for the different books, I want different images"),
 * in the same black and red: what the book teaches, drawn in code so it stays sharp at any size.
 */
export function BookArt({ id, className }: { id: string; className?: string }) {
  const gid = useId().replace(/:/g, '');
  const glow = `url(#bg${gid})`;
  const art = (() => {
    switch (id) {
      case 'basics': // a company cut into shares, one of them yours, and a price going up
        return (
          <>
            <circle cx="62" cy="54" r="34" fill="none" stroke={FAINT} strokeWidth="1.2" />
            {[0, 60, 120, 180, 240].map((a) => (
              <line key={a} x1="62" y1="54" x2={62 + 34 * Math.cos(((a - 90) * Math.PI) / 180)} y2={54 + 34 * Math.sin(((a - 90) * Math.PI) / 180)} stroke={FAINT} strokeWidth="1" />
            ))}
            <path d="M70,46 L70,12 A34,34 0 0,1 99.4,29 Z" fill={RED} opacity="0.9" />
            <path d="M120,86 L140,70 L156,76 L176,48 L194,30" fill="none" stroke={glow} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M186,28 L195,29 L193,38" fill="none" stroke={RED} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </>
        );
      case 'risk': // a plan: entry, a stop below, a target above
        return (
          <>
            <line x1="6" x2="194" y1="22" y2="22" stroke={RED} strokeWidth="1" strokeDasharray="5 4" opacity="0.9" />
            <line x1="6" x2="194" y1="58" y2="58" stroke="rgba(255,255,255,0.55)" strokeWidth="1" />
            <line x1="6" x2="194" y1="80" y2="80" stroke={RED} strokeWidth="1.4" />
            <rect x="150" y="22" width="44" height="36" fill={RED} opacity="0.12" />
            <rect x="150" y="58" width="44" height="22" fill={DEEP} opacity="0.6" />
            <path d="M6,70 L30,64 L46,72 L70,60 L92,63 L112,52 L132,56 L150,58 L168,44 L186,26" fill="none" stroke={glow} strokeWidth="2.4" strokeLinejoin="round" />
            <circle cx="150" cy="58" r="3.4" fill="#fff" />
          </>
        );
      case 'signals': // price with two averages, and an oscillator underneath
        return (
          <>
            <path d="M4,52 C30,40 44,62 70,46 S110,22 130,34 S170,20 196,10" fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="1.4" />
            <path d="M4,58 C40,52 70,50 100,40 S160,26 196,20" fill="none" stroke={RED} strokeWidth="1.8" />
            <path d="M4,64 C50,62 90,56 130,48 S180,38 196,34" fill="none" stroke={DEEP} strokeWidth="2.2" />
            <line x1="4" x2="196" y1="78" y2="78" stroke={FAINT} strokeDasharray="3 3" />
            <line x1="4" x2="196" y1="94" y2="94" stroke={FAINT} strokeDasharray="3 3" />
            <path d="M4,88 L24,84 L40,90 L60,80 L80,76 L100,84 L120,74 L140,78 L160,70 L180,76 L196,72" fill="none" stroke={glow} strokeWidth="1.6" />
          </>
        );
      case 'patterns': // head and shoulders over its neckline
        return (
          <>
            <line x1="4" x2="196" y1="70" y2="70" stroke={RED} strokeWidth="1" strokeDasharray="5 4" opacity="0.8" />
            <path d="M4,88 L28,46 L48,70 L96,12 L140,70 L162,46 L184,70 L196,92" fill="none" stroke={glow} strokeWidth="2.6" strokeLinejoin="round" />
            <circle cx="96" cy="12" r="3" fill={RED} />
          </>
        );
      case 'options': // a call: flat until the strike, then up
        return (
          <>
            <line x1="4" x2="196" y1="62" y2="62" stroke={FAINT} />
            <line x1="92" x2="92" y1="8" y2="96" stroke={FAINT} strokeDasharray="3 3" />
            <path d="M4,76 L92,76 L196,8" fill="none" stroke={glow} strokeWidth="2.8" strokeLinejoin="round" />
            <path d="M92,76 L114,62 L92,62 Z" fill={DEEP} opacity="0.7" />
            <path d="M114,62 L196,8 L196,62 Z" fill={RED} opacity="0.14" />
          </>
        );
      case 'options-manage': // time decay: what's left of the premium as expiry gets close
        return (
          <>
            <line x1="4" x2="196" y1="92" y2="92" stroke={FAINT} />
            <line x1="184" x2="184" y1="8" y2="92" stroke={RED} strokeDasharray="3 3" opacity="0.8" />
            <path d="M4,14 C80,18 130,28 160,50 S180,86 184,92" fill="none" stroke={glow} strokeWidth="2.6" />
            <path d="M4,14 C80,18 130,28 160,50 S180,86 184,92 L4,92 Z" fill={RED} opacity="0.1" />
            <g transform="translate(40 40)" stroke="rgba(255,255,255,0.6)" strokeWidth="1.2" fill="none">
              <path d="M0,0 h18 M0,30 h18 M2,0 C2,12 16,18 16,30 M16,0 C16,12 2,18 2,30" />
              <path d="M5,26 h8 l-4,-5 z" fill={RED} stroke="none" />
            </g>
          </>
        );
      case 'adv-stocks': // scaling in: three buys up a trend, one sell at the top
        return (
          <>
            <path d="M4,90 L36,76 L52,82 L84,58 L100,64 L132,40 L148,46 L196,14" fill="none" stroke={glow} strokeWidth="2.4" strokeLinejoin="round" />
            {([[36, 76], [84, 58], [132, 40]] as const).map(([x, y]) => (
              <g key={x}>
                <circle cx={x} cy={y} r="5" fill={RED} />
                <path d={`M${x - 2.5},${y} h5 M${x},${y - 2.5} v5`} stroke="#0b0b0d" strokeWidth="1.6" />
              </g>
            ))}
            <circle cx="186" cy="20" r="5" fill="#fff" />
            <path d="M183.5,20 h5" stroke="#0b0b0d" strokeWidth="1.6" />
          </>
        );
      case 'adv-options': // a protective put: the stock can fall, the floor holds
        return (
          <>
            <path d="M4,30 L30,38 L54,26 L80,46 L104,40 L130,70 L150,62 L174,88 L196,84" fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="1.6" strokeDasharray="4 3" />
            <line x1="4" x2="196" y1="58" y2="58" stroke={RED} strokeWidth="2" />
            <path d="M4,30 L30,38 L54,26 L80,46 L104,40 L122,58 L196,58" fill="none" stroke={glow} strokeWidth="2.6" strokeLinejoin="round" />
            <path d="M160,40 l12,4 v9 c0,7 -6,11 -12,13 c-6,-2 -12,-6 -12,-13 v-9 z" fill={DEEP} stroke={RED} strokeWidth="1.2" />
          </>
        );
      case 'mind': // the mental game: a wild pulse that settles down
        return (
          <>
            <path d="M4,50 L20,50 L26,18 L34,86 L42,10 L50,92 L58,30 L64,50 L96,50 L102,38 L108,62 L114,50 L196,50" fill="none" stroke={glow} strokeWidth="2.2" strokeLinejoin="round" />
            <circle cx="196" cy="50" r="3" fill={RED} />
          </>
        );
      default:
        return null;
    }
  })();
  if (!art) return <Candles seed={(id.length || 3) * 7} className={className} />;
  return (
    <svg className={className} viewBox="0 0 200 100" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      <defs>
        <linearGradient id={`bg${gid}`} x1="0" x2="1">
          <stop offset="0" stopColor={RED} stopOpacity="0.35" />
          <stop offset="1" stopColor={RED} stopOpacity="1" />
        </linearGradient>
      </defs>
      {art}
    </svg>
  );
}

/** A book cover: BOOK n, the title with its last words in red, TRADING 101, and the book's own picture. */
export function Cover({ c, big = false }: { c: Chapter; big?: boolean }) {
  const words = c.title.split(' ');
  const cut = Math.max(1, words.length - (words.length > 3 ? 2 : 1));
  return (
    <span className={[s.cover, big && s.coverBig].filter(Boolean).join(' ')} aria-hidden>
      <span className={s.coverN}>{t('ln.bookN', { n: c.n })}</span>
      <b className={s.coverTitle}>
        {words.slice(0, cut).join(' ')} <span className={s.coverRed}>{words.slice(cut).join(' ')}</span>
      </b>
      {c.id === 'charts' ? <Candles seed={c.n * 7} className={s.coverArt} /> : <BookArt id={c.id} className={s.coverArt} />}
      <span className={s.coverMark}>{c.advanced ? t('ln.advanced') : c.open ? t('ln.alwaysOpen') : 'Trading 101'}</span>
    </span>
  );
}
