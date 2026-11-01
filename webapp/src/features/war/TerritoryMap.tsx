/**
 * The War board (W6c; owner 2026-11-01: "copy the reference image exactly, then we edit from there").
 * The owner's own artwork is the board (board/board.jpg). On top of it, in the same places as the
 * art's panels: the sector list, how it works, the phase box, your deployment and the legend, all
 * live. Each territory's own label is covered by ours (icon, sector, holder): the art's real-company
 * logos and tickers never show (trademarks; War prices are simulated). A territory someone holds is
 * recoloured to its owner (yours blue, enemies red, contested gold) with a glowing edge, keeping the
 * terrain; neutral land turns grey, like the legend says; sectors not in this War go dark. The shapes come
 * from scripts/gen_war_board.py. On a phone the board keeps its layout and scrolls sideways.
 */
import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import { t } from '../../lib/i18n';
import boardUrl from './board/board.jpg';
import { BOARD, SPOTS } from './board/boardShapes';
import { SECTOR_NAME } from './map';
import s from './TerritoryMap.module.css';

export type TerritoryTone = 'mine' | 'enemy' | 'neutral' | 'contested' | 'out';
export type TerritoryView = { tone: TerritoryTone; line: string; extra?: string; hot?: boolean; warn?: 'enemy' | 'heavy' };

const MASKS = import.meta.glob<string>('./board/*.png', { eager: true, query: '?url', import: 'default' });
const mask = (kind: 'm' | 'e', id: string) => MASKS[`./board/${kind}-${id}.png`];

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
const ORDER = Object.keys(SPOTS);

/** A box on the board, in the art's pixels. */
const at = (x: number, y: number, w: number, h: number): CSSProperties => ({
  left: `${(x / BOARD.w) * 100}%`,
  top: `${(y / BOARD.h) * 100}%`,
  width: `${(w / BOARD.w) * 100}%`,
  height: `${(h / BOARD.h) * 100}%`,
});

function SectorIcon({ id, className }: { id: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className}>
      <path d={ICON[id] ?? ''} />
    </svg>
  );
}

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
  /** The phase box: the phase, a big line (time left) and a small one. */
  status?: { title: string; big?: string; line?: ReactNode };
  /** While claiming: your soldiers placed out of your army. */
  deploy?: { placed: number; total: number };
}) {
  const shown = (id: string): TerritoryView => (territories.includes(id) ? (view[id] ?? { tone: 'neutral', line: t('wmap.neutral') }) : { tone: 'out', line: t('wmap.k.out') });
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // on a narrow screen, start with the map in view rather than the left-hand panels
    const el = scroller.current;
    if (el && el.scrollWidth > el.clientWidth) el.scrollLeft = (el.scrollWidth * 205) / BOARD.w;
  }, []);
  const mine = ORDER.filter((id) => territories.includes(id) && shown(id).tone === 'mine');
  const figures = deploy ? Math.round((deploy.placed / Math.max(1, deploy.total)) * 5) : 0;
  return (
    <div className={s.scroller} ref={scroller}>
      <div className={s.board} data-board>
        <img src={boardUrl} alt="" className={s.art} draggable={false} />

        {/* who holds what: owner colours over the terrain, glowing edges, dark fog outside this War */}
        {ORDER.map((id) => {
          const tone = shown(id).tone;
          const m = mask('m', id);
          const e = mask('e', id);
          return (
            <div key={id} aria-hidden>
              <div className={`${s.tint} ${s[tone]}`} style={{ maskImage: `url(${m})`, WebkitMaskImage: `url(${m})` }} />
              {tone !== 'out' && tone !== 'neutral' && <div className={`${s.edge} ${s[tone]}`} style={{ maskImage: `url(${e})`, WebkitMaskImage: `url(${e})` }} />}
            </div>
          );
        })}

        <svg className={s.overlay} viewBox={`0 0 ${BOARD.w} ${BOARD.h}`} role="group" aria-label={label}>
          {ORDER.map((id) => {
            const v = shown(id);
            const { x, y } = SPOTS[id]!;
            const name = (SECTOR_NAME[id] ?? id).toUpperCase();
            return (
              <g key={id} className={`${s.plate} ${s[v.tone]}`} aria-hidden>
                <rect x={x - 52} y={y - 42} width={104} height={v.extra ? 88 : 80} rx={4} className={s.plateBg} />
                <circle cx={x} cy={y - 22} r={12} className={s.plateBadge} />
                <g transform={`translate(${x - 7.5} ${y - 29.5}) scale(0.625)`} className={s.plateIcon}>
                  <path d={ICON[id] ?? ''} />
                </g>
                <text x={x} y={y + 8} className={s.plateName} fontSize={Math.min(13, 132 / name.length)}>
                  {name}
                </text>
                <text x={x} y={y + 23} className={s.plateLine}>
                  {v.line}
                </text>
                {v.extra && (
                  <text x={x} y={y + 36} className={s.plateExtra}>
                    {v.extra}
                  </text>
                )}
                {(v.hot || v.warn) && (
                  <text x={x} y={y - 48} className={v.warn === 'heavy' ? s.plateFlagRed : s.plateFlag}>
                    {[v.hot && t('war.hot').toUpperCase(), v.warn && t(v.warn === 'heavy' ? 'wmap.heavy' : 'wmap.enemy').toUpperCase()].filter(Boolean).join(' · ')}
                  </text>
                )}
              </g>
            );
          })}
          {/* what you tap: each territory in this War */}
          {ORDER.filter((id) => territories.includes(id)).map((id) => {
            const v = shown(id);
            return (
              <polygon
                key={id}
                points={SPOTS[id]!.pts}
                className={s.hit}
                role="button"
                tabIndex={0}
                aria-label={[SECTOR_NAME[id] ?? id, v.line, v.extra, v.hot && t('war.hot'), v.warn && t(v.warn === 'heavy' ? 'wmap.heavy' : 'wmap.enemy')].filter(Boolean).join(', ')}
                onClick={() => onPick(id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onPick(id);
                  }
                }}
              />
            );
          })}
        </svg>

        {/* the left-hand panels */}
        <div className={s.panel} style={at(8, 138, 197, 435)}>
          <h3 className={s.panelTitle}>{t('wmap.sectorsTitle')}</h3>
          <ul className={s.sectors} aria-label={t('wmap.sectors')}>
            {ORDER.map((id) => {
              const v = shown(id);
              return (
                <li key={id}>
                  <button type="button" className={`${s.sector} ${s[v.tone]}`} disabled={v.tone === 'out'} onClick={() => onPick(id)}>
                    <SectorIcon id={id} className={s.sectorIcon} />
                    <span>
                      <b>{SECTOR_NAME[id] ?? id}</b>
                      <small>{v.line}</small>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
        <div className={s.panel} style={at(8, 583, 197, 186)}>
          <h3 className={s.panelTitle}>{t('wmap.howTitle')}</h3>
          <ol className={s.how}>
            <li>{t('wmap.how1')}</li>
            <li>{t('wmap.how2')}</li>
            <li>{t('wmap.how3')}</li>
            <li>{t('wmap.how4')}</li>
          </ol>
        </div>

        {/* the phase box, top right */}
        <div className={s.panel} style={at(1017, 119, 176, 181)}>
          {status && (
            <>
              <span className={s.phaseTitle}>{status.title}</span>
              {status.big && (
                <b className={s.phaseBig} style={{ fontSize: `calc(var(--u) * ${status.big.length > 9 ? 19 : 28})` }}>
                  {status.big}
                </b>
              )}
              {status.line && <span className={s.phaseLine}>{status.line}</span>}
            </>
          )}
        </div>

        {/* your deployment, along the bottom */}
        <div className={`${s.panel} ${s.deployRow}`} style={at(223, 696, 808, 109)}>
          <div className={s.deployBox}>
            <span className={s.deployTitle}>{t('wmap.deploy')}</span>
            <span className={s.deployBody}>
              <span className={s.troops} aria-hidden>
                {Array.from({ length: 5 }, (_, i) => (
                  <svg key={i} viewBox="0 0 12 24" className={!deploy || i < figures ? s.troopOn : s.troopOff}>
                    <circle cx="6" cy="4" r="3.2" />
                    <path d="M2 9.5Q6 7.5 10 9.5L10.8 16H9.2L8.6 23H3.4L2.8 16H1.2Z" />
                  </svg>
                ))}
              </span>
              <b className={s.deployCount}>{deploy ? t('wmap.deployN', { placed: deploy.placed, total: deploy.total }) : t('wmap.deployHeld', { n: mine.length })}</b>
            </span>
          </div>
          <div className={s.chooseBox}>
            <span className={s.deployTitle}>{t('wmap.choose')}</span>
            <span className={s.chips}>
              {Array.from({ length: 5 }, (_, i) => {
                const id = mine[i];
                return id ? (
                  <button key={i} type="button" className={s.chip} onClick={() => onPick(id)}>
                    <SectorIcon id={id} className={s.chipIcon} />
                    <span>{SECTOR_NAME[id]}</span>
                  </button>
                ) : (
                  <span key={i} className={s.chipEmpty}>
                    {i + 1}
                  </span>
                );
              })}
            </span>
          </div>
        </div>

        {/* the legend, bottom right */}
        <div className={s.panel} style={at(1053, 586, 140, 122)}>
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
