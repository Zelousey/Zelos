/**
 * The War map (W6c, owner's design 2026-10-31): one board of the 10 sectors, seen through the whole
 * War. Territories are coloured by who holds them (yours blue, enemies red, neutral grey, contested
 * gold), with a soft glow and a faint texture, a simple sector icon of our own, the sector's name
 * and its holder. No pictures and no real company logos (War prices are simulated). Sectors that
 * aren't in this War are shown dark. Drawn as SVG so it updates live and scales to a phone: a wide
 * 4-3-3 board on bigger screens and a 2-column board on phones. Tapping a territory jumps to its
 * card below, where the actions are.
 */
import { t } from '../../lib/i18n';
import { SECTOR_NAME } from './map';
import s from './TerritoryMap.module.css';

export type TerritoryTone = 'mine' | 'enemy' | 'neutral' | 'contested' | 'out';
export type TerritoryView = { tone: TerritoryTone; line: string; extra?: string; hot?: boolean; warn?: 'enemy' | 'heavy' };

type Cell = { id: string; x0: number; x1: number; y0: number; y1: number };
type Layout = { w: number; h: number; cells: Cell[]; font: number };

const row = (ids: string[], y0: number, y1: number, x0: number, x1: number): Cell[] => {
  const step = (x1 - x0) / ids.length;
  return ids.map((id, i) => ({ id, x0: x0 + i * step, x1: x0 + (i + 1) * step, y0, y1 }));
};
const WIDE: Layout = {
  w: 1000,
  h: 640,
  font: 26,
  cells: [
    ...row(['tech', 'comms', 'health'], 40, 230, 80, 920),
    ...row(['consumer', 'finance', 'energy', 'industrials'], 230, 420, 40, 960),
    ...row(['realestate', 'materials', 'utilities'], 420, 600, 120, 880),
  ],
};
const TALL: Layout = {
  w: 600,
  h: 1000,
  font: 30,
  cells: [
    ...row(['tech', 'comms'], 30, 218, 30, 570),
    ...row(['health', 'consumer'], 218, 406, 30, 570),
    ...row(['finance', 'energy'], 406, 594, 30, 570),
    ...row(['industrials', 'realestate'], 594, 782, 30, 570),
    ...row(['materials', 'utilities'], 782, 970, 30, 570),
  ],
};

/** A small, repeatable wobble so shared borders line up exactly between neighbours. */
function wobble(a: number, b: number, amp: number) {
  const v = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453;
  return (v - Math.floor(v) - 0.5) * amp;
}
const STEP = 24;
function edge(fixed: number, from: number, to: number, horizontal: boolean, amp: number): [number, number][] {
  const pts: [number, number][] = [];
  const dir = to > from ? 1 : -1;
  const first = dir > 0 ? Math.ceil((from + 1) / STEP) * STEP : Math.floor((from - 1) / STEP) * STEP;
  for (let v = first; dir > 0 ? v < to : v > to; v += dir * STEP) {
    const j = wobble(horizontal ? v : fixed, horizontal ? fixed : v, amp);
    pts.push(horizontal ? [v, fixed + j] : [fixed + j, v]);
  }
  return pts;
}
function outline(c: Cell, L: Layout): string {
  const amp = (x: number, y: number, horizontal: boolean) => {
    const outer = horizontal ? !L.cells.some((o) => o !== c && (o.y1 === y || o.y0 === y) && o.x0 < c.x1 && o.x1 > c.x0) : x === Math.min(...L.cells.filter((o) => o.y0 === c.y0).map((o) => o.x0)) || x === Math.max(...L.cells.filter((o) => o.y0 === c.y0).map((o) => o.x1));
    return outer ? 26 : 14;
  };
  const corner = (x: number, y: number): [number, number] => [x, y + wobble(x, y, 14)]; // the same point for every cell that meets here
  const pts: [number, number][] = [
    corner(c.x0, c.y0),
    ...edge(c.y0, c.x0, c.x1, true, amp(0, c.y0, true)),
    corner(c.x1, c.y0),
    ...edge(c.x1, c.y0, c.y1, false, amp(c.x1, 0, false)),
    corner(c.x1, c.y1),
    ...edge(c.y1, c.x1, c.x0, true, amp(0, c.y1, true)),
    corner(c.x0, c.y1),
    ...edge(c.x0, c.y1, c.y0, false, amp(c.x0, 0, false)),
  ];
  return 'M' + pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join('L') + 'Z';
}

/** Our own simple line icons, one per sector (24×24). */
const ICON: Record<string, string> = {
  tech: 'M7 7h10v10H7zM10 10h4v4h-4zM9 3v4M15 3v4M9 17v4M15 17v4M3 9h4M3 15h4M17 9h4M17 15h4',
  finance: 'M3 9l9-5 9 5M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20h18',
  health: 'M9 3h6v6h6v6h-6v6H9v-6H3V9h6z',
  energy: 'M13 2L5 14h6l-1 8 8-12h-6z',
  consumer: 'M5 8h14l-1 13H6zM9 8V6a3 3 0 016 0v2',
  comms: 'M12 12v9M8 21h8M8.5 8.5a5 5 0 017 0M5.5 5.5a9 9 0 0113 0M12 12a1 1 0 100-.01',
  industrials: 'M3 21V11l6 3v-3l6 3V5h4v16zM7 17h2M12 17h2',
  realestate: 'M3 11l9-7 9 7M5 10v11h14V10M10 21v-6h4v6',
  materials: 'M12 3l8 4.5v9L12 21l-8-4.5v-9zM12 12l8-4.5M12 12v9M12 12L4 7.5',
  utilities: 'M12 3s6 7 6 11a6 6 0 01-12 0c0-4 6-11 6-11z',
};

export function TerritoryMap({ territories, view, onPick, label }: { territories: string[]; view: Record<string, TerritoryView>; onPick: (id: string) => void; label: string }) {
  return (
    <div className={s.wrap}>
      <Board L={WIDE} territories={territories} view={view} onPick={onPick} label={label} className={s.wide ?? ''} />
      <Board L={TALL} territories={territories} view={view} onPick={onPick} label={label} className={s.tall ?? ''} />
      <ul className={s.legend} aria-label={t('wmap.legend')}>
        <li>
          <i className={s.kMine} />
          {t('wmap.k.mine')}
        </li>
        <li>
          <i className={s.kEnemy} />
          {t('wmap.k.enemy')}
        </li>
        <li>
          <i className={s.kNeutral} />
          {t('wmap.k.neutral')}
        </li>
        <li>
          <i className={s.kContested} />
          {t('wmap.k.contested')}
        </li>
        {territories.length < WIDE.cells.length && (
          <li>
            <i className={s.kOut} />
            {t('wmap.k.out')}
          </li>
        )}
      </ul>
    </div>
  );
}

function Board({ L, territories, view, onPick, label, className }: { L: Layout; territories: string[]; view: Record<string, TerritoryView>; onPick: (id: string) => void; label: string; className: string }) {
  const id = `wm${L.w}`;
  return (
    <svg className={`${s.svg} ${className}`} viewBox={`0 0 ${L.w} ${L.h}`} role="group" aria-label={label}>
      <defs>
        <pattern id={`${id}-tex`} width="14" height="14" patternUnits="userSpaceOnUse">
          <circle cx="3" cy="3" r="1" fill="#fff" opacity="0.07" />
          <circle cx="10" cy="9" r="0.8" fill="#000" opacity="0.18" />
        </pattern>
        <filter id={`${id}-glow`} x="-10%" y="-10%" width="120%" height="120%">
          <feGaussianBlur stdDeviation="5" />
        </filter>
      </defs>
      {L.cells.map((c) => {
        const inWar = territories.includes(c.id);
        const v: TerritoryView = inWar ? (view[c.id] ?? { tone: 'neutral', line: t('wmap.neutral') }) : { tone: 'out', line: t('wmap.k.out') };
        const d = outline(c, L);
        const cx = (c.x0 + c.x1) / 2;
        const cy = (c.y0 + c.y1) / 2;
        const name = SECTOR_NAME[c.id] ?? c.id;
        const f = L.font;
        const nameF = Math.min(f, ((c.x1 - c.x0) * 0.84) / (name.length * 0.74)); // long names shrink to fit their land
        const pick = () => inWar && onPick(c.id);
        return (
          <g
            key={c.id}
            className={`${s.terr} ${s[v.tone]}`}
            {...(inWar
              ? {
                  role: 'button',
                  tabIndex: 0,
                  'aria-label': [name, v.line, v.extra, v.hot && t('war.hot'), v.warn && t(v.warn === 'heavy' ? 'wmap.heavy' : 'wmap.enemy')].filter(Boolean).join(', '),
                  onClick: pick,
                  onKeyDown: (e: React.KeyboardEvent) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      pick();
                    }
                  },
                }
              : { 'aria-hidden': true })}
          >
            <path d={d} className={s.glow} filter={`url(#${id}-glow)`} />
            <path d={d} className={s.land} />
            <path d={d} fill={`url(#${id}-tex)`} className={s.tex} />
            <path d={d} className={s.rim} />
            <g transform={`translate(${cx - f * 0.6} ${cy - f * 2.4}) scale(${(f * 1.2) / 24})`} className={s.icon}>
              <path d={ICON[c.id] ?? ''} />
            </g>
            <text x={cx} y={cy + f * 0.35} className={s.name} fontSize={nameF}>
              {name.toUpperCase()}
            </text>
            <text x={cx} y={cy + f * 1.45} className={s.line} fontSize={f * 0.72}>
              {v.line}
            </text>
            {v.extra && (
              <text x={cx} y={cy + f * 2.3} className={s.line} fontSize={f * 0.6}>
                {v.extra}
              </text>
            )}
            {(v.hot || v.warn) && (
              <text x={cx} y={cy + f * (v.extra ? 3.1 : 2.45)} className={v.warn === 'heavy' ? s.flagRed : s.flag} fontSize={f * 0.62}>
                {[v.hot && t('war.hot').toUpperCase(), v.warn && t(v.warn === 'heavy' ? 'wmap.heavy' : 'wmap.enemy').toUpperCase()].filter(Boolean).join(' · ')}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
