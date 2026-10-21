/**
 * The pictures in Trading 101 lessons: small SVG scenes that animate in (shares popping in,
 * one flying into your portfolio, a price line drawing itself, a candle growing). Motion is
 * off for people who ask for reduced motion (CSS). Colours come from the theme, so every scene
 * works in the Black and White themes. Scenes are decorative: the lesson text says it all.
 */
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import s from './Scene.module.css';

export type Art =
  | { k: 'shop' }
  | { k: 'shares'; pick?: boolean }
  | { k: 'move'; dir: 'up' | 'down'; from: number; to: number; label: string }
  | { k: 'scale'; heavy: 'buyers' | 'sellers' }
  | { k: 'news'; head: string; good: boolean }
  | { k: 'clock' }
  | { k: 'wallet' }
  | { k: 'split'; cash: number; stocks: number; hide?: boolean }
  | { k: 'big'; top: string; bottom?: string; tone?: 'up' | 'down' }
  | { k: 'candle'; up: boolean; plain?: boolean }
  | { k: 'candles' }
  | { k: 'averages' }
  | { k: 'volume' }
  | { k: 'ticket' }
  | { k: 'stop'; plain?: boolean }
  | { k: 'target' }
  | { k: 'rr'; plain?: boolean }
  | { k: 'race'; plain?: boolean }
  | { k: 'done'; label: string };

const W = 400;
const H = 300;
const d = (sec: number): CSSProperties => ({ animationDelay: `${sec}s` });
const money = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const path = (pts: [number, number][]) => pts.map((p, i) => `${i ? 'L' : 'M'}${p[0]} ${p[1]}`).join(' ');

function Svg({ children }: { children: ReactNode }) {
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={s.svg} aria-hidden="true" focusable="false">
      {children}
    </svg>
  );
}
function Label({ x, y, children, tone = 'mut', anchor = 'middle', delay, size = 'lbl' }: { x: number; y: number; children: ReactNode; tone?: 'mut' | 'ink' | 'up' | 'dn' | 'gold'; anchor?: 'start' | 'middle' | 'end'; delay?: number; size?: 'lbl' | 'big' | 'huge' }) {
  return (
    <text x={x} y={y} textAnchor={anchor} className={[s[size], s[`t_${tone}`], delay != null && s.fade].filter(Boolean).join(' ')} style={delay != null ? d(delay) : undefined}>
      {children}
    </text>
  );
}
function Grid() {
  return (
    <>
      {[70, 115, 160, 205, 250].map((y) => (
        <line key={y} x1={30} x2={370} y1={y} y2={y} className={s.grid} />
      ))}
    </>
  );
}

/** a price figure that counts from one value to another as the line draws */
function CountUp({ from, to, x, y, tone }: { from: number; to: number; x: number; y: number; tone: 'up' | 'dn' }) {
  const [still] = useState(() => !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
  const [v, setV] = useState(still ? to : from);
  useEffect(() => {
    if (still) return;
    let raf = 0;
    let t0: number | null = null;
    const tick = (t: number) => {
      t0 ??= t;
      const k = Math.min(1, (t - t0) / 1500);
      setV(from + (to - from) * (1 - Math.pow(1 - k, 3)));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [from, to, still]);
  return (
    <text x={x} y={y} textAnchor="end" className={[s.big, s[`t_${tone}`]].join(' ')}>
      {money(v)}
    </text>
  );
}

function Shop() {
  return (
    <g transform="translate(140,70)">
      <rect x={0} y={40} width={120} height={70} rx={6} className={s.surf} />
      <path d="M-8 40 L128 40 L116 12 L4 12 Z" className={s.f_gold} />
      <path d="M18 12 L10 40 M40 12 L36 40 M62 12 L62 40 M84 12 L88 40 M106 12 L114 40" className={s.stripes} />
      <circle cx={34} cy={78} r={12} className={s.f_gold} />
      <circle cx={34} cy={78} r={5} className={s.f_surf} />
      <rect x={60} y={62} width={44} height={34} rx={4} className={s.f_accs} />
      <text x={82} y={85} textAnchor="middle" className={[s.lbl, s.t_ink].join(' ')}>
        $
      </text>
    </g>
  );
}

function Shares({ pick }: { pick?: boolean }) {
  const w = 30;
  const g = 6;
  const cx = pick ? 150 : 200;
  const x0 = cx - (5 * w + 4 * g) / 2;
  return (
    <>
      <Label x={200} y={50}>
        {pick ? 'TAP BUY, GET A PIECE' : 'THE WHOLE COMPANY'}
      </Label>
      {Array.from({ length: 10 }, (_, i) => {
        const x = x0 + (i % 5) * (w + g);
        const y = 90 + Math.floor(i / 5) * (w + g);
        const me = pick && i === 4;
        const style = (me ? { ...d(i * 0.07), '--dx': `${300 - x}px`, '--dy': `${196 - y}px` } : d(i * 0.07)) as CSSProperties;
        return <rect key={i} x={x} y={y} width={w} height={w} rx={6} className={[s.pop, me ? s.fly : '', me ? s.f_acc : s.f_gold].join(' ')} style={style} />;
      })}
      {pick ? (
        <>
          <rect x={262} y={160} width={110} height={80} rx={12} className={s.dashed} />
          <Label x={317} y={258}>
            YOUR PORTFOLIO
          </Label>
          <Label x={317} y={152} tone="ink" delay={1.8}>
            1 share · $10
          </Label>
        </>
      ) : (
        <Label x={200} y={230} tone="ink" delay={0.9}>
          10 pieces = 10 shares
        </Label>
      )}
    </>
  );
}

function Move({ dir, from, to, label }: { dir: 'up' | 'down'; from: number; to: number; label: string }) {
  const up = dir === 'up';
  const pts: [number, number][] = up
    ? [[30, 230], [90, 215], [150, 222], [210, 180], [270, 160], [330, 120], [370, 95]]
    : [[30, 110], [90, 125], [150, 118], [210, 170], [270, 190], [330, 215], [370, 230]];
  const last = pts[pts.length - 1]!;
  const diff = to - from;
  return (
    <>
      <Grid />
      <path d={path(pts)} className={[s.line, up ? s.s_up : s.s_dn, s.draw].join(' ')} />
      <circle cx={last[0]} cy={last[1]} r={7} className={[up ? s.f_up : s.f_dn, s.pop].join(' ')} style={d(1.5)} />
      <Label x={30} y={40} anchor="start">
        {label}
      </Label>
      <CountUp from={from} to={to} x={370} y={40} tone={up ? 'up' : 'dn'} />
      <Label x={200} y={285} tone={up ? 'up' : 'dn'} delay={1.6}>
        {`${diff >= 0 ? '+' : '−'}${money(Math.abs(diff))} ${diff >= 0 ? 'profit' : 'loss'}`}
      </Label>
    </>
  );
}

function Scale({ heavy }: { heavy: 'buyers' | 'sellers' }) {
  const tilt = heavy === 'buyers' ? -12 : 12; // the heavy side goes down
  const people = (n: number, x: number, cls: string) =>
    Array.from({ length: n }, (_, i) => <circle key={i} cx={x + (i % 3) * 18 - 18} cy={-14 - Math.floor(i / 3) * 18} r={8} className={[cls, s.pop].join(' ')} style={d(0.3 + i * 0.08)} />);
  return (
    <>
      <path d="M200 250 L180 280 L220 280 Z" className={s.f_border} />
      <g className={s.tilt} style={{ '--tilt': `${tilt}deg` } as CSSProperties}>
        <rect x={60} y={246} width={280} height={8} rx={4} className={s.f_border} />
        <g transform="translate(100,246)">{people(heavy === 'buyers' ? 6 : 2, 0, s.f_up!)}</g>
        <g transform="translate(300,246)">{people(heavy === 'sellers' ? 6 : 2, 0, s.f_dn!)}</g>
      </g>
      <Label x={100} y={60} tone="up">
        BUYERS
      </Label>
      <Label x={300} y={60} tone="dn">
        SELLERS
      </Label>
      <Label x={200} y={130} tone={heavy === 'buyers' ? 'up' : 'dn'} size="huge" delay={1}>
        {heavy === 'buyers' ? 'Price ↑' : 'Price ↓'}
      </Label>
    </>
  );
}

function News({ head, good }: { head: string; good: boolean }) {
  const words = head.split(' ');
  const lines: string[] = [];
  for (const w of words) {
    const cur = lines[lines.length - 1];
    if (cur && (cur + ' ' + w).length <= 24) lines[lines.length - 1] = cur + ' ' + w;
    else lines.push(w);
  }
  return (
    <>
      <rect x={60} y={40} width={210} height={170} rx={10} className={[s.surf, s.pop].join(' ')} />
      <rect x={76} y={56} width={90} height={10} rx={3} className={s.f_border} />
      {lines.slice(0, 4).map((l, i) => (
        <text key={i} x={76} y={96 + i * 24} className={[s.head, s.t_ink, s.fade].join(' ')} style={d(0.3 + i * 0.1)}>
          {l}
        </text>
      ))}
      <rect x={76} y={186} width={170} height={6} rx={3} className={s.f_border} />
      <g className={s.pop} style={d(1)}>
        <circle cx={320} cy={150} r={44} className={good ? s.f_upSoft : s.f_dnSoft} />
        <text x={320} y={166} textAnchor="middle" className={[s.huge, good ? s.t_up : s.t_dn].join(' ')}>
          {good ? '↑' : '↓'}
        </text>
      </g>
      <Label x={200} y={262} tone={good ? 'up' : 'dn'} delay={1.3}>
        {good ? 'MORE BUYERS SHOW UP' : 'MORE SELLERS SHOW UP'}
      </Label>
    </>
  );
}

function Clock() {
  return (
    <>
      <circle cx={200} cy={130} r={74} className={s.surf} />
      {Array.from({ length: 12 }, (_, i) => {
        const a = (i / 12) * Math.PI * 2;
        return <line key={i} x1={200 + Math.sin(a) * 62} y1={130 - Math.cos(a) * 62} x2={200 + Math.sin(a) * 70} y2={130 - Math.cos(a) * 70} className={s.tick} />;
      })}
      <line x1={200} y1={130} x2={200} y2={86} className={[s.hand, s.spin].join(' ')} />
      <line x1={200} y1={130} x2={232} y2={130} className={s.hand} />
      <Label x={200} y={240} tone="ink">
        MON – FRI · 9:30 AM – 4:00 PM
      </Label>
      <Label x={200} y={262}>
        NEW YORK TIME
      </Label>
    </>
  );
}

function Wallet() {
  return (
    <>
      <g className={s.pop}>
        <rect x={90} y={70} width={220} height={140} rx={16} className={s.f_accs} />
        <rect x={250} y={118} width={60} height={44} rx={10} className={s.f_acc} />
        <circle cx={270} cy={140} r={6} className={s.f_surf} />
      </g>
      <Label x={170} y={135} tone="ink" size="big" delay={0.4}>
        $10,000
      </Label>
      <Label x={170} y={160} delay={0.6}>
        PRACTICE MONEY
      </Label>
      <g className={s.stamp} style={d(1.1)}>
        <rect x={210} y={196} width={120} height={34} rx={8} className={s.stampBox} />
        <text x={270} y={219} textAnchor="middle" className={[s.lbl, s.t_gold].join(' ')}>
          VIRTUAL
        </text>
      </g>
    </>
  );
}

function Split({ cash, stocks, hide }: { cash: number; stocks: number; hide?: boolean }) {
  const total = cash + stocks;
  const h = 170;
  const hs = (stocks / total) * h;
  const fmt = (n: number) => `$${n.toLocaleString('en-US')}`;
  return (
    <>
      <rect x={150} y={60 + h - hs} width={100} height={hs} rx={4} className={[s.f_acc, s.grow].join(' ')} />
      <rect x={150} y={60} width={100} height={h - hs} rx={4} className={[s.f_border, s.grow].join(' ')} style={d(0.2)} />
      <Label x={265} y={60 + (h - hs) / 2 + 4} anchor="start" tone="ink" delay={0.8}>
        {hide ? 'Cash: ?' : `Cash ${fmt(cash)}`}
      </Label>
      <Label x={265} y={60 + h - hs / 2 + 4} anchor="start" tone="ink" delay={0.6}>
        {`Stocks ${fmt(stocks)}`}
      </Label>
      <Label x={200} y={262} tone="ink" delay={1.1}>
        {`ACCOUNT VALUE ${fmt(total)}`}
      </Label>
    </>
  );
}

function Big({ top, bottom, tone }: { top: string; bottom?: string; tone?: 'up' | 'down' }) {
  return (
    <>
      <text x={200} y={140} textAnchor="middle" className={[top.length > 14 ? s.big : s.huge, tone === 'up' ? s.t_up : tone === 'down' ? s.t_dn : s.t_ink, s.pop].join(' ')}>
        {top}
      </text>
      {bottom && (
        <Label x={200} y={180} delay={0.4}>
          {bottom}
        </Label>
      )}
    </>
  );
}

function Candle({ up, plain }: { up: boolean; plain?: boolean }) {
  const cls = up ? s.f_up : s.f_dn;
  const [top, bot] = up ? [90, 200] : [90, 200];
  return (
    <>
      <line x1={180} x2={180} y1={50} y2={250} className={[up ? s.s_up : s.s_dn, s.wick, s.grow].join(' ')} />
      <rect x={150} y={top} width={60} height={bot - top} rx={4} className={[cls!, s.grow].join(' ')} style={d(0.2)} />
      {!plain && (
        <>
          <Label x={230} y={54} anchor="start" delay={0.8}>
            HIGH
          </Label>
          <Label x={230} y={top + 4} anchor="start" tone="ink" delay={1}>
            {up ? 'CLOSE' : 'OPEN'}
          </Label>
          <Label x={230} y={bot + 4} anchor="start" tone="ink" delay={1.2}>
            {up ? 'OPEN' : 'CLOSE'}
          </Label>
          <Label x={230} y={254} anchor="start" delay={1.4}>
            LOW
          </Label>
          <Label x={70} y={150} tone={up ? 'up' : 'dn'} size="big" delay={1.6}>
            {up ? '↑' : '↓'}
          </Label>
        </>
      )}
    </>
  );
}

const TREND: [number, number, number, number][] = [
  // open, close, high, low (in chart y, smaller is higher)
  [220, 200, 195, 228], [200, 210, 192, 216], [210, 180, 172, 214], [182, 170, 160, 190], [170, 186, 164, 192],
  [186, 150, 142, 190], [150, 140, 130, 158], [142, 156, 136, 162], [156, 120, 112, 160], [120, 100, 92, 126],
];
function Candles({ withAverages, withVolume }: { withAverages?: boolean; withVolume?: boolean }) {
  const x = (i: number) => 50 + i * 32;
  const avg = (n: number) => TREND.map((_, i) => {
    const from = Math.max(0, i - n + 1);
    const sl = TREND.slice(from, i + 1);
    return [x(i), sl.reduce((a, c) => a + c[1], 0) / sl.length] as [number, number];
  });
  const vol = [18, 14, 30, 16, 12, 34, 20, 14, 38, 30];
  return (
    <>
      <Grid />
      {TREND.map(([o, c, h, l], i) => {
        const up = c < o;
        return (
          <g key={i} className={s.pop} style={d(i * 0.09)}>
            <line x1={x(i)} x2={x(i)} y1={h} y2={l} className={[up ? s.s_up : s.s_dn, s.wickThin].join(' ')} />
            <rect x={x(i) - 9} y={Math.min(o, c)} width={18} height={Math.max(3, Math.abs(o - c))} rx={2} className={up ? s.f_up : s.f_dn} />
          </g>
        );
      })}
      {withAverages && (
        <>
          <path d={path(avg(3))} className={[s.avg, s.s_acc, s.draw].join(' ')} style={d(1)} />
          <path d={path(avg(6))} className={[s.avg, s.s_gold, s.draw].join(' ')} style={d(1.3)} />
          <Label x={370} y={40} anchor="end" tone="ink">
            <tspan className={s.t_acc}>— 20-candle average </tspan>
            <tspan className={s.t_gold}>— 50-candle</tspan>
          </Label>
        </>
      )}
      {withVolume &&
        vol.map((v, i) => {
          const up = TREND[i]![1] < TREND[i]![0];
          return <rect key={i} x={x(i) - 9} y={290 - v} width={18} height={v} className={[up ? s.f_upSoft : s.f_dnSoft, s.grow].join(' ')} style={d(0.6 + i * 0.05)} />;
        })}
      {!withAverages && !withVolume && (
        <Label x={200} y={285} tone="up" delay={1.2}>
          HIGHER HIGHS, HIGHER LOWS = UPTREND
        </Label>
      )}
      {withVolume && (
        <Label x={30} y={40} anchor="start" delay={1}>
          BIG MOVES ON BIG VOLUME
        </Label>
      )}
    </>
  );
}

function Ticket() {
  return (
    <>
      <rect x={90} y={30} width={220} height={240} rx={14} className={[s.surf, s.pop].join(' ')} />
      <Label x={110} y={62} anchor="start" tone="ink">
        BUY AAPL
      </Label>
      <Label x={290} y={62} anchor="end">
        $330.00
      </Label>
      <rect x={110} y={80} width={180} height={40} rx={8} className={s.field} />
      <Label x={124} y={105} anchor="start">
        SHARES
      </Label>
      <Label x={276} y={106} anchor="end" tone="ink" size="big" delay={0.6}>
        3
      </Label>
      <Label x={110} y={150} anchor="start">
        MARKET ORDER
      </Label>
      <Label x={290} y={150} anchor="end" tone="ink" delay={0.9}>
        ≈ $990.00
      </Label>
      <rect x={110} y={200} width={180} height={44} rx={10} className={[s.f_up, s.pop].join(' ')} style={d(1.2)} />
      <text x={200} y={228} textAnchor="middle" className={[s.lbl, s.t_white, s.fade].join(' ')} style={d(1.3)}>
        REVIEW ORDER
      </text>
    </>
  );
}

function StopTarget({ kind, plain }: { kind: 'stop' | 'target'; plain?: boolean }) {
  const stop = kind === 'stop';
  const lineY = stop ? 200 : 90;
  const pts: [number, number][] = stop ? [[30, 140], [90, 130], [150, 150], [210, 165], [270, 185], [320, lineY]] : [[30, 160], [90, 150], [150, 140], [210, 120], [270, 105], [320, lineY]];
  return (
    <>
      <Grid />
      <line x1={30} x2={370} y1={140} y2={140} className={s.entry} />
      <Label x={364} y={132} anchor="end">
        YOU BOUGHT · $100
      </Label>
      <line x1={30} x2={370} y1={lineY} y2={lineY} className={stop ? s.stopLine : s.targetLine} />
      <Label x={364} y={stop ? lineY + 18 : lineY - 8} anchor="end" tone={stop ? 'dn' : 'up'}>
        {stop ? 'STOP-LOSS · $95' : 'TAKE-PROFIT · $110'}
      </Label>
      <path d={path(pts)} className={[s.line, stop ? s.s_dn : s.s_up, s.draw].join(' ')} />
      {!plain && (
        <>
          <circle cx={320} cy={lineY} r={9} className={[stop ? s.f_dn : s.f_up, s.pop].join(' ')} style={d(1.5)} />
          <Label x={200} y={stop ? 270 : 50} tone={stop ? 'dn' : 'up'} delay={1.7}>
            {stop ? 'SOLD FOR YOU AT $95' : 'SOLD FOR YOU AT $110'}
          </Label>
        </>
      )}
    </>
  );
}

function RiskReward({ plain }: { plain?: boolean }) {
  return (
    <>
      <rect x={110} y={150} width={70} height={60} rx={6} className={[s.f_dn, s.grow].join(' ')} />
      <rect x={220} y={90} width={70} height={120} rx={6} className={[s.f_up, s.grow].join(' ')} style={d(0.3)} />
      <Label x={145} y={236} tone="dn">
        RISK $5
      </Label>
      <Label x={255} y={236} tone="up">
        REWARD $10
      </Label>
      {!plain && (
        <Label x={200} y={60} tone="ink" size="big" delay={1}>
          2 : 1
        </Label>
      )}
    </>
  );
}

function Race({ plain }: { plain?: boolean }) {
  const rows = [
    { n: 'You', pct: 8.4, w: 230, cls: s.f_acc },
    { n: 'Sam', pct: 5.1, w: 150, cls: s.f_gold },
    { n: 'Alex', pct: -2.3, w: 50, cls: s.f_dn },
  ];
  return (
    <>
      {rows.map((r, i) => (
        <g key={r.n}>
          <Label x={40} y={92 + i * 64} anchor="start" tone="ink">
            {r.n}
          </Label>
          <rect x={100} y={74 + i * 64} width={r.w} height={26} rx={6} className={[r.cls!, s.growX].join(' ')} style={d(0.2 + i * 0.15)} />
          <Label x={100 + r.w + 8} y={92 + i * 64} anchor="start" tone={r.pct >= 0 ? 'up' : 'dn'} delay={1}>
            {`${r.pct >= 0 ? '+' : '−'}${Math.abs(r.pct).toFixed(1)}%`}
          </Label>
        </g>
      ))}
      {!plain && (
        <Label x={200} y={275} tone="gold" delay={1.4}>
          🏆 BIGGEST % GAIN WINS
        </Label>
      )}
    </>
  );
}

function Done({ label }: { label: string }) {
  return (
    <>
      <g className={s.pop}>
        <circle cx={200} cy={130} r={70} className={s.f_goldSoft} />
        <circle cx={200} cy={130} r={52} className={s.f_gold} />
        <path d="M178 130 l16 16 l30 -34" className={s.check} />
      </g>
      <Label x={200} y={245} delay={0.4}>
        {label}
      </Label>
    </>
  );
}

export function Scene({ art }: { art: Art }) {
  let body: ReactNode;
  switch (art.k) {
    case 'shop':
      body = (
        <>
          <Shop />
          <Label x={200} y={230} delay={0.3}>
            SUNNY LEMONADE CO.
          </Label>
        </>
      );
      break;
    case 'shares':
      body = <Shares pick={art.pick} />;
      break;
    case 'move':
      body = <Move {...art} />;
      break;
    case 'scale':
      body = <Scale heavy={art.heavy} />;
      break;
    case 'news':
      body = <News head={art.head} good={art.good} />;
      break;
    case 'clock':
      body = <Clock />;
      break;
    case 'wallet':
      body = <Wallet />;
      break;
    case 'split':
      body = <Split cash={art.cash} stocks={art.stocks} hide={art.hide} />;
      break;
    case 'big':
      body = <Big top={art.top} bottom={art.bottom} tone={art.tone} />;
      break;
    case 'candle':
      body = <Candle up={art.up} plain={art.plain} />;
      break;
    case 'candles':
      body = <Candles />;
      break;
    case 'averages':
      body = <Candles withAverages />;
      break;
    case 'volume':
      body = <Candles withVolume />;
      break;
    case 'ticket':
      body = <Ticket />;
      break;
    case 'stop':
      body = <StopTarget kind="stop" plain={art.plain} />;
      break;
    case 'target':
      body = <StopTarget kind="target" />;
      break;
    case 'rr':
      body = <RiskReward plain={art.plain} />;
      break;
    case 'race':
      body = <Race plain={art.plain} />;
      break;
    case 'done':
      body = <Done label={art.label} />;
      break;
  }
  return <Svg>{body}</Svg>;
}
