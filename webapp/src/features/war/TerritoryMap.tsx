/**
 * The War map (W6c, owner's design 2026-10-31; reworked 2026-11-01 to look like their mockup): one
 * raised island in a dark sea, cut into the 10 sector territories and seen through the whole War.
 * The land has hills and valleys made in code (light and shade over generated noise, not pictures),
 * a thick coast and glowing borders coloured by who holds each territory (yours blue, enemies red,
 * neutral slate, contested gold). Each shows a simple sector icon of our own, its name and holder:
 * no pictures and no real company logos (War prices are simulated). Sectors that aren't in this
 * War are dark. Around the map, like the mockup: the sector list (computers), a phase box, the
 * legend and, while claiming, your deployment. Shapes come from scripts/gen_war_map.py (a wide
 * island for computers, a tall one for phones). Tapping a territory jumps to its card below.
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
const ORDER = Object.keys(WIDE.cells);

export function TerritoryMap({
  territories,
  view,
  onPick,
  label,
  status,
  deploy,
}: {
  territories: string[];
  view: Record<string, TerritoryView>;
  onPick: (id: string) => void;
  label: string;
  /** The phase box in the map's corner: the phase, a big line (time left) and a small one. */
  status?: { title: string; big?: string; line?: ReactNode };
  /** While claiming: your soldiers placed out of your army. */
  deploy?: { placed: number; total: number };
}) {
  const shown = (id: string): TerritoryView => (territories.includes(id) ? (view[id] ?? { tone: 'neutral', line: t('wmap.neutral') }) : { tone: 'out', line: t('wmap.k.out') });
  return (
    <div className={s.wrap}>
      <ul className={s.sectors} aria-label={t('wmap.sectors')}>
        {ORDER.filter((id) => territories.includes(id)).map((id) => {
          const v = shown(id);
          return (
            <li key={id}>
              <button type="button" className={`${s.sector} ${s[v.tone]}`} onClick={() => onPick(id)}>
                <svg viewBox="0 0 24 24" aria-hidden className={s.sectorIcon}>
                  <path d={ICON[id] ?? ''} />
                </svg>
                <span>
                  <b>{SECTOR_NAME[id] ?? id}</b>
                  <small>{v.line}</small>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <div className={s.stage}>
        <Board L={WIDE} territories={territories} shown={shown} onPick={onPick} label={label} className={s.wide ?? ''} />
        <Board L={TALL} territories={territories} shown={shown} onPick={onPick} label={label} className={s.tall ?? ''} />
        {status && (
          <div className={s.status}>
            <span className={s.statusTitle}>{status.title}</span>
            {status.big && <b className={s.statusBig}>{status.big}</b>}
            {status.line && <span className={s.statusLine}>{status.line}</span>}
          </div>
        )}
        {deploy && (
          <div className={s.deploy}>
            <span className={s.statusTitle}>{t('wmap.deploy')}</span>
            <span className={s.troops} aria-hidden>
              {Array.from({ length: 10 }, (_, i) => (
                <svg key={i} viewBox="0 0 12 24" className={i < Math.round((deploy.placed / Math.max(1, deploy.total)) * 10) ? s.troopOn : s.troopOff}>
                  <circle cx="6" cy="4" r="3.2" />
                  <path d="M2 9.5Q6 7.5 10 9.5L10.8 16H9.2L8.6 23H3.4L2.8 16H1.2Z" />
                </svg>
              ))}
            </span>
            <b className={s.deployCount}>{t('wmap.deployN', { placed: deploy.placed, total: deploy.total })}</b>
          </div>
        )}
        <div className={s.legendBox}>
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
            {territories.length < ORDER.length && (
              <li>
                <i className={s.kOut} />
                {t('wmap.k.out')}
              </li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}

function Board({ L, territories, shown, onPick, label, className }: { L: MapShape; territories: string[]; shown: (id: string) => TerritoryView; onPick: (id: string) => void; label: string; className: string }) {
  const id = L === WIDE ? 'wmw' : 'wmt';
  const font = L === WIDE ? 21 : 25;
  const cells = Object.entries(L.cells);
  return (
    <svg className={`${s.svg} ${className}`} viewBox={`0 0 ${L.w} ${L.h}`} role="group" aria-label={label}>
      <defs>
        <radialGradient id={`${id}-sea`} cx="50%" cy="48%" r="72%">
          <stop offset="0%" stopColor="#10234a" />
          <stop offset="60%" stopColor="#081430" />
          <stop offset="100%" stopColor="#03070f" />
        </radialGradient>
        <pattern id={`${id}-chart`} width="60" height="60" patternUnits="userSpaceOnUse">
          <path d="M60 0H0V60" fill="none" stroke="#3d6bc4" strokeOpacity="0.08" strokeWidth="1" />
        </pattern>
        <linearGradient id={`${id}-cliff`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1a2847" />
          <stop offset="100%" stopColor="#060b17" />
        </linearGradient>
        {/* hills and valleys: light falling on generated noise, multiplied into the land colours */}
        <filter id={`${id}-relief`} x="0" y="0" width={L.w} height={L.h} filterUnits="userSpaceOnUse">
          <feTurbulence type="fractalNoise" baseFrequency="0.012" numOctaves="5" seed="11" result="n" />
          <feDiffuseLighting in="n" surfaceScale="6" lightingColor="#ffffff" result="lit">
            <feDistantLight azimuth="235" elevation="34" />
          </feDiffuseLighting>
          <feComposite in="SourceGraphic" in2="lit" operator="arithmetic" k1="1.8" k2="0" k3="0" k4="0" result="shaded" />
          <feComposite in="shaded" in2="SourceAlpha" operator="in" />
        </filter>
        <filter id={`${id}-glow`} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="7" />
        </filter>
        <filter id={`${id}-shadow`} x="-10%" y="-10%" width="120%" height="140%">
          <feGaussianBlur stdDeviation="16" />
        </filter>
        <clipPath id={`${id}-land`}>
          <path d={L.coast} />
        </clipPath>
      </defs>

      <rect width={L.w} height={L.h} fill={`url(#${id}-sea)`} />
      <rect width={L.w} height={L.h} fill={`url(#${id}-chart)`} />
      {L.isles.map((d, i) => (
        <g key={i} className={s.isle}>
          <path d={d} transform="translate(0 6)" fill={`url(#${id}-cliff)`} />
          <path d={d} />
        </g>
      ))}

      {/* the raised island: a shadow in the water, then a thick cliff under the land */}
      <path d={L.coast} transform="translate(0 30)" className={s.shadow} filter={`url(#${id}-shadow)`} />
      {[18, 12, 6].map((dy) => (
        <path key={dy} d={L.coast} transform={`translate(0 ${dy})`} fill={`url(#${id}-cliff)`} className={s.cliff} />
      ))}

      {/* land colours with the terrain light in them */}
      <g filter={`url(#${id}-relief)`}>
        {cells.map(([cid, c]) => (
          <path key={cid} d={c.d} className={`${s.land} ${s[shown(cid).tone]}`} />
        ))}
      </g>

      {/* borders: a soft glow inside the coast, a bright rim, a thin light bevel */}
      <g clipPath={`url(#${id}-land)`}>
        {cells.map(([cid, c]) => (
          <path key={cid} d={c.d} className={`${s.glow} ${s[shown(cid).tone]}`} filter={`url(#${id}-glow)`} />
        ))}
      </g>
      {cells.map(([cid, c]) => (
        <path key={cid} d={c.d} className={`${s.rim} ${s[shown(cid).tone]}`} />
      ))}
      <path d={L.coast} className={s.coastLine} />

      {/* labels */}
      {cells.map(([cid, c]) => {
        const v = shown(cid);
        const name = SECTOR_NAME[cid] ?? cid;
        const nameF = Math.min(font, (L === WIDE ? 200 : 160) / (name.length * 0.68)); // long names shrink to fit their land
        return (
          <g key={cid} className={`${s.label} ${s[v.tone]}`} aria-hidden>
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

      {/* what you tap: one invisible shape per territory in this War, on top of everything */}
      {cells
        .filter(([cid]) => territories.includes(cid))
        .map(([cid, c]) => {
          const v = shown(cid);
          const name = SECTOR_NAME[cid] ?? cid;
          return (
            <path
              key={cid}
              d={c.d}
              className={s.hit}
              role="button"
              tabIndex={0}
              aria-label={[name, v.line, v.extra, v.hot && t('war.hot'), v.warn && t(v.warn === 'heavy' ? 'wmap.heavy' : 'wmap.enemy')].filter(Boolean).join(', ')}
              onClick={() => onPick(cid)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onPick(cid);
                }
              }}
            />
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
