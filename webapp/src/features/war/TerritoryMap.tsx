/**
 * The War map (W6c, owner's design 2026-10-31, reworked 2026-11-01 to look like their mockup): one
 * island in a dark sea, cut into the 10 sector territories, seen through the whole War. Territories
 * are coloured by who holds them (yours blue, enemies red, neutral grey, contested gold) with glowing
 * borders, a raised coast, small islands and a compass. Each shows a simple sector icon of our own,
 * its name and its holder: no pictures and no real company logos (War prices are simulated).
 * Sectors that aren't in this War are dark. The land shapes come from scripts/gen_war_map.py (a wide
 * map for computers, a tall one for phones). Tapping a territory jumps to its card below.
 */
import type { ReactNode } from 'react';
import { t } from '../../lib/i18n';
import { SECTOR_NAME } from './map';
import { TALL, WIDE, type MapShape } from './mapShapes';
import s from './TerritoryMap.module.css';

export type TerritoryTone = 'mine' | 'enemy' | 'neutral' | 'contested' | 'out';
export type TerritoryView = { tone: TerritoryTone; line: string; extra?: string; hot?: boolean; warn?: 'enemy' | 'heavy' };

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

export function TerritoryMap({
  territories,
  view,
  onPick,
  label,
  status,
}: {
  territories: string[];
  view: Record<string, TerritoryView>;
  onPick: (id: string) => void;
  label: string;
  /** The box in the map's corner: the phase, a big number (time left) and a line (your soldiers). */
  status?: { title: string; big?: string; line?: ReactNode };
}) {
  const legend = (
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
      {territories.length < Object.keys(WIDE.cells).length && (
        <li>
          <i className={s.kOut} />
          {t('wmap.k.out')}
        </li>
      )}
    </ul>
  );
  return (
    <div className={s.wrap}>
      <div className={s.stage}>
        <Board L={WIDE} territories={territories} view={view} onPick={onPick} label={label} className={s.wide ?? ''} />
        <Board L={TALL} territories={territories} view={view} onPick={onPick} label={label} className={s.tall ?? ''} />
        {status && (
          <div className={s.status}>
            <span className={s.statusTitle}>{status.title}</span>
            {status.big && <b className={s.statusBig}>{status.big}</b>}
            {status.line && <span className={s.statusLine}>{status.line}</span>}
          </div>
        )}
        <div className={s.legendBox}>{legend}</div>
      </div>
    </div>
  );
}

function Board({ L, territories, view, onPick, label, className }: { L: MapShape; territories: string[]; view: Record<string, TerritoryView>; onPick: (id: string) => void; label: string; className: string }) {
  const id = L === WIDE ? 'wmw' : 'wmt';
  const font = L === WIDE ? 21 : 25;
  return (
    <svg className={`${s.svg} ${className}`} viewBox={`0 0 ${L.w} ${L.h}`} role="group" aria-label={label}>
      <defs>
        <radialGradient id={`${id}-sea`} cx="50%" cy="45%" r="75%">
          <stop offset="0%" stopColor="#0f1d3a" />
          <stop offset="100%" stopColor="#040812" />
        </radialGradient>
        <pattern id={`${id}-waves`} width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M0 20q10-6 20 0t20 0" fill="none" stroke="#5b7bc0" strokeOpacity="0.08" strokeWidth="1.2" />
        </pattern>
        <pattern id={`${id}-tex`} width="12" height="12" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="3" r="0.9" fill="#fff" opacity="0.06" />
          <circle cx="8" cy="9" r="1.1" fill="#000" opacity="0.16" />
        </pattern>
        <radialGradient id={`${id}-shade`} cx="50%" cy="40%" r="70%">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.16" />
          <stop offset="100%" stopColor="#000" stopOpacity="0.28" />
        </radialGradient>
        <filter id={`${id}-glow`} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="6" />
        </filter>
        <filter id={`${id}-shadow`} x="-10%" y="-10%" width="120%" height="130%">
          <feGaussianBlur stdDeviation="14" />
        </filter>
        <clipPath id={`${id}-land`}>
          <path d={L.coast} />
        </clipPath>
      </defs>
      {/* the sea */}
      <rect width={L.w} height={L.h} fill={`url(#${id}-sea)`} />
      <rect width={L.w} height={L.h} fill={`url(#${id}-waves)`} />
      {L.isles.map((d, i) => (
        <g key={i} className={s.isle}>
          <path d={d} transform="translate(0 5)" className={s.cliff} />
          <path d={d} />
        </g>
      ))}
      {/* the raised coast: a soft shadow in the water and a dark cliff under the land */}
      <path d={L.coast} transform="translate(0 22)" className={s.shadow} filter={`url(#${id}-shadow)`} />
      <path d={L.coast} transform="translate(0 12)" className={s.cliff} />
      {Object.entries(L.cells).map(([cid, c]) => {
        const inWar = territories.includes(cid);
        const v: TerritoryView = inWar ? (view[cid] ?? { tone: 'neutral', line: t('wmap.neutral') }) : { tone: 'out', line: t('wmap.k.out') };
        const name = SECTOR_NAME[cid] ?? cid;
        const nameF = Math.min(font, (L === WIDE ? 200 : 160) / (name.length * 0.68)); // long names shrink to fit their land
        const pick = () => inWar && onPick(cid);
        return (
          <g
            key={cid}
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
            <path d={c.d} className={s.land} />
            <path d={c.d} fill={`url(#${id}-shade)`} className={s.deco} />
            <path d={c.d} fill={`url(#${id}-tex)`} className={s.deco} />
            <g clipPath={`url(#${id}-land)`}>
              <path d={c.d} className={s.glow} filter={`url(#${id}-glow)`} />
            </g>
            <path d={c.d} className={s.rim} />
            <circle cx={c.x} cy={c.y - font * 1.55} r={font * 0.95} className={s.badge} />
            <g transform={`translate(${c.x - font * 0.6} ${c.y - font * 2.15}) scale(${(font * 1.2) / 24})`} className={s.icon}>
              <path d={ICON[cid] ?? ''} />
            </g>
            <text x={c.x} y={c.y + font * 0.55} className={s.name} fontSize={nameF}>
              {name.toUpperCase()}
            </text>
            <text x={c.x} y={c.y + font * 1.5} className={s.line} fontSize={font * 0.64}>
              {v.line}
            </text>
            {v.extra && (
              <text x={c.x} y={c.y + font * 2.3} className={s.line} fontSize={font * 0.56}>
                {v.extra}
              </text>
            )}
            {(v.hot || v.warn) && (
              <text x={c.x} y={c.y + font * (v.extra ? 3.05 : 2.4)} className={v.warn === 'heavy' ? s.flagRed : s.flag} fontSize={font * 0.56}>
                {[v.hot && t('war.hot').toUpperCase(), v.warn && t(v.warn === 'heavy' ? 'wmap.heavy' : 'wmap.enemy').toUpperCase()].filter(Boolean).join(' · ')}
              </text>
            )}
          </g>
        );
      })}
      <Compass x={L === WIDE ? 70 : 60} y={L === WIDE ? L.h - 80 : L.h - 70} r={L === WIDE ? 34 : 30} />
    </svg>
  );
}

function Compass({ x, y, r }: { x: number; y: number; r: number }) {
  return (
    <g className={s.compass} transform={`translate(${x} ${y})`} aria-hidden>
      <circle r={r} />
      <circle r={r * 0.62} />
      <path d={`M0 ${-r * 1.15}L${r * 0.16} 0L0 ${r * 1.15}L${-r * 0.16} 0Z`} />
      <path d={`M${-r * 1.15} 0L0 ${r * 0.16}L${r * 1.15} 0L0 ${-r * 0.16}Z`} />
      <text y={-r * 1.32} fontSize={r * 0.42}>
        N
      </text>
    </g>
  );
}
