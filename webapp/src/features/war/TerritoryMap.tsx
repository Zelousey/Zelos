/**
 * The War board (W6c; owner 2026-11-01: "copy the reference image exactly, then we edit from there").
 * The owner's own artwork is the board (board/board.jpg). On top of it, in the same places as the
 * art's panels: the sector list, how it works, the phase box, your deployment and the legend, all
 * live. Each territory's own label is covered by ours (icon, sector, holder): the art's real-company
 * logos and tickers never show (trademarks; War prices are simulated).
 *
 * Map polish (owner 2026-11-01): territory shapes and borders are vector lines traced once from the
 * art (scripts/gen_war_board.py), so neighbours share exactly the same line. Every border is a thin
 * shared line; a held territory adds an inner band in its owner's colour (yours blue, enemies red,
 * contested gold) and its terrain is recoloured to match; neutral land turns grey; sectors not in this
 * War go dark. Ownership is never colour alone: a blue shield with a check (yours), a red shield with
 * the holder's initial (enemy), crossed swords with bull vs bear (contested), a grey flag (neutral).
 * Activity tags come from the same simulated prices the battles use (see activityOf). On a phone the
 * board keeps its layout and scrolls sideways.
 */
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { formatMoney } from '../../lib/format';
import { t } from '../../lib/i18n';
import { useNow } from '../../lib/useNow';
import boardUrl from './board/board.jpg';
import { BOARD, BORDERS, REGIONS, SPOTS } from './board/boardShapes';
import { activityOf, companiesOf, SECTOR_NAME, type Activity } from './map';
import { chaosNow, useWarChaos, useWarQuotes } from './war';
import s from './TerritoryMap.module.css';

export type TerritoryTone = 'mine' | 'enemy' | 'neutral' | 'contested' | 'out';
export type TerritoryView = { tone: TerritoryTone; line: string; extra?: string; hot?: boolean; warn?: 'enemy' | 'heavy'; initial?: string; claimable?: boolean };

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

const LOGO = `${import.meta.env.BASE_URL}icons/icon-192.png`;

/** Bring a part of the War page into view and put the keyboard there. */
function goTo(target: string) {
  const el = document.getElementById(target);
  if (!el) return;
  el.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1');
  el.focus({ preventScroll: true });
}

/** A soldier: helmet, vest, rifle at the ready (our own drawing, one colour). */
export function Soldier({ on = true, className }: { on?: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 16 32" aria-hidden className={`${on ? s.troopOn : s.troopOff} ${className ?? ''}`}>
      <path d="M3 7.4Q3.2 1.6 8 1.4Q12.8 1.6 13 7.4L14.2 8.2H1.8Z" />
      <path d="M5.6 9.2H10.4V10.6Q10.2 12.6 8 12.8Q5.8 12.6 5.6 10.6Z" />
      <path d="M3.2 14.2Q8 12.4 12.8 14.2L13.4 22.2H2.6Z" />
      <path className={s.troopDetail} d="M5 15.6H11M5 18.4H11" />
      <path d="M3 22.6H7.5L7.1 31H4.1ZM8.5 22.6H13L11.9 31H8.9Z" />
      <path d="M0.6 19.8L13.6 12.2L14.6 13.6L1.6 21.2Z" />
      <path d="M12.6 12.8L15.4 11.2L15.9 12L13.1 13.6Z" />
    </svg>
  );
}

const TONE_KEY = { mine: 'wmap.k.mine', enemy: 'wmap.k.enemy', neutral: 'wmap.k.neutral', contested: 'wmap.k.contested', out: 'wmap.k.out' } as const;

/** One territory up close: who holds it, your soldiers, activity, its 3 companies on War Zone prices. */
function Details({ id, v, act, q, onClose, onGo, goLabel }: { id: string; v: TerritoryView; act: Activity | null; q: { prices: Record<string, { p: number; ref: number }> } | null; onClose: () => void; onGo: () => void; goLabel: string }) {
  return (
    <div className={`${s.detailsBody} ${s[v.tone]}`}>
      <div className={s.detailsHead}>
        <SectorIcon id={id} className={s.sectorIcon} />
        <h3 className={s.detailsName}>{SECTOR_NAME[id] ?? id}</h3>
        <button type="button" className={s.detailsClose} aria-label={t('wmap.closeDetails')} onClick={onClose}>
          ×
        </button>
      </div>
      <dl className={s.detailsFacts}>
        <dt>{t('wmap.d.holder')}</dt>
        <dd>
          <i className={s.dot} /> {t(TONE_KEY[v.tone])}: {v.line}
        </dd>
        {v.extra && (
          <>
            <dt>{t('wmap.d.defenders')}</dt>
            <dd>{v.extra}</dd>
          </>
        )}
        {(act || v.hot) && (
          <>
            <dt>{t('wmap.d.activity')}</dt>
            <dd>{[v.hot && t('war.hot'), act && t(ACTIVITY_KEY[act])].filter(Boolean).join(' · ')}</dd>
          </>
        )}
      </dl>
      <ul className={s.detailsCos} aria-label={t('wmap.d.companies')}>
        {companiesOf(id).map((c) => {
          const x = q?.prices[c.sym];
          const chg = x && x.ref ? (x.p / x.ref - 1) * 100 : null;
          return (
            <li key={c.sym}>
              <span>
                <b>{c.sym}</b>
                <small>{c.name}</small>
              </span>
              <span className={s.detailsPx}>
                {x ? formatMoney(x.p) : '…'}
                {chg !== null && <small className={chg >= 0 ? s.up : s.down}>{`${chg >= 0 ? '+' : ''}${chg.toFixed(2)}%`}</small>}
              </span>
            </li>
          );
        })}
      </ul>
      <button type="button" className={s.detailsGo} onClick={onGo}>
        {goLabel} ↓
      </button>
    </div>
  );
}

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
  title,
  nav = [],
  pickLabel,
}: {
  territories: string[];
  view: Record<string, TerritoryView>;
  /** Go to a territory's card (its buttons), from the details panel. */
  onPick: (id: string) => void;
  label: string;
  /** The War's name, in the board's top bar. */
  title?: string;
  /** The top bar's buttons: each scrolls to a part of the War page (by element id). */
  nav?: { label: string; target: string }[];
  /** The details panel's button: what you do on a territory's card ("Place soldiers", "Claim or attack"). */
  pickLabel?: string;
  /** The phase box: the phase, a big line (time left) and a small one. */
  status?: { title: string; big?: string; line?: ReactNode };
  /** While claiming: your soldiers placed out of your army. */
  deploy?: { placed: number; total: number };
}) {
  const shown = (id: string): TerritoryView => (territories.includes(id) ? (view[id] ?? { tone: 'neutral', line: t('wmap.neutral') }) : { tone: 'out', line: t('wmap.k.out') });
  const quotes = useWarQuotes();
  const chaosDoc = useWarChaos();
  const now = useNow(60000);
  const chaos = chaosDoc.status === 'ready' ? chaosDoc.data : null;
  const surging = chaos && chaosNow(chaos, now).banner === 'live' ? chaos.scope : null;
  const activity = (id: string): Activity | null => (territories.includes(id) ? activityOf(id, quotes.status === 'ready' ? quotes.data : null, surging) : null);
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // on a narrow screen, start with the map in view rather than the left-hand panels
    const el = scroller.current;
    if (el && el.scrollWidth > el.clientWidth) el.scrollLeft = (el.scrollWidth * 205) / BOARD.w;
  }, []);
  const mine = ORDER.filter((id) => territories.includes(id) && shown(id).tone === 'mine');
  const [sel, setSel] = useState<string | null>(null);
  const pick = (id: string) => setSel((cur) => (cur === id ? null : id));
  const q = quotes.status === 'ready' ? quotes.data : null;
  const figures = deploy ? Math.round((deploy.placed / Math.max(1, deploy.total)) * 5) : 0;
  return (
    <div className={s.scroller} ref={scroller}>
      <div className={s.board} data-board>
        <Board territories={territories} shown={shown} activity={activity} onPick={pick} label={label} selected={sel} />

        {/* the top bar: our logo, the War's name, and buttons to each part of the War page */}
        <div className={s.topBar} style={at(0, 0, BOARD.w, 116)}>
          <span className={s.brand}>
            <img src={LOGO} alt="" />
            <span>
              <b>ZELOS</b>
              <small>{t('wmap.brandSub')}</small>
            </span>
          </span>
          {nav.length > 0 && (
            <nav className={s.topNav} aria-label={t('wmap.navLabel')}>
              {nav.map((n) => (
                <button key={n.target} type="button" className={s.topBtn} onClick={() => goTo(n.target)}>
                  {n.label}
                </button>
              ))}
            </nav>
          )}
          {title && (
            <span className={s.topTitle}>
              <b>{title}</b>
              <small>{t('war.sim')}</small>
            </span>
          )}
        </div>

        {/* the left-hand panels */}
        <div className={s.panel} style={at(8, 138, 197, 435)}>
          <h3 className={s.panelTitle}>{t('wmap.sectorsTitle')}</h3>
          <ul className={s.sectors} aria-label={t('wmap.sectors')}>
            {ORDER.map((id) => {
              const v = shown(id);
              return (
                <li key={id}>
                  <button type="button" className={`${s.sector} ${s[v.tone]} ${sel === id ? s.sectorOn : ''}`} disabled={v.tone === 'out'} aria-pressed={sel === id} onClick={() => pick(id)}>
                    <SectorIcon id={id} className={s.sectorIcon} />
                    <span>
                      <b>{SECTOR_NAME[id] ?? id}</b>
                      <small>{[v.line, v.extra].filter(Boolean).join(' · ')}</small>
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
                  <Soldier key={i} on={!deploy || i < figures} />
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
                  <button key={i} type="button" className={`${s.chip} ${sel === id ? s.chipOn : ''}`} aria-pressed={sel === id} onClick={() => pick(id)}>
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

        {/* the details of the territory you tapped, right side */}
        <div className={`${s.panel} ${s.details}`} style={at(1017, 308, 176, 270)} role="region" aria-label={t('wmap.details')} aria-live="polite">
          {sel ? (
            <Details id={sel} v={shown(sel)} act={activity(sel)} q={q} onClose={() => setSel(null)} onGo={() => onPick(sel)} goLabel={pickLabel ?? t('wmap.goCard')} />
          ) : (
            <p className={s.detailsHint}>{t('wmap.detailsHint')}</p>
          )}
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

const TONE_RANK: Record<TerritoryTone, number> = { out: 0, neutral: 1, enemy: 2, mine: 3, contested: 4 };
const ACTIVITY_KEY = { surge: 'wmap.act.surge', major: 'wmap.act.major', high: 'wmap.act.high', low: 'wmap.act.low' } as const;

/** The art, then owner colours over the terrain, borders, labels with ownership markers, and what you tap. */
function Board({
  territories,
  shown,
  activity,
  onPick,
  label,
  selected,
}: {
  territories: string[];
  shown: (id: string) => TerritoryView;
  activity: (id: string) => Activity | null;
  onPick: (id: string) => void;
  label: string;
  selected: string | null;
}) {
  const ids = ORDER;
  return (
    <svg className={s.overlay} viewBox={`0 0 ${BOARD.w} ${BOARD.h}`} role="group" aria-label={label}>
      <defs>
        {ids.map((id) => (
          <clipPath key={id} id={`wb-clip-${id}`}>
            <path d={REGIONS[id]} clipRule="evenodd" />
          </clipPath>
        ))}
        <filter id="wb-soft" x="-5%" y="-5%" width="110%" height="110%">
          <feGaussianBlur stdDeviation="3" />
        </filter>
      </defs>
      <image href={boardUrl} width={BOARD.w} height={BOARD.h} preserveAspectRatio="none" />

      {/* owner colours over the terrain */}
      {ids.map((id) => (
        <path key={id} d={REGIONS[id]} fillRule="evenodd" className={`${s.fill} ${s[shown(id).tone]}`} />
      ))}

      {/* every border once, thin; then an inner band in the owner's colour, the same width everywhere */}
      {BORDERS.map((b, i) => {
        const top = Math.max(b.a === 'sea' ? 0 : TONE_RANK[shown(b.a).tone], b.b === 'sea' ? 0 : TONE_RANK[shown(b.b).tone]);
        return <path key={i} d={b.d} className={`${b.a === 'sea' || b.b === 'sea' ? s.coastLine : s.borderLine} ${top === 0 ? s.faint : ''}`} />;
      })}
      {ids.map((id) => {
        const tone = shown(id).tone;
        if (tone === 'neutral' || tone === 'out') return null;
        return (
          <g key={id} clipPath={`url(#wb-clip-${id})`} className={s[tone]}>
            <path d={REGIONS[id]} className={s.halo} filter="url(#wb-soft)" />
            <path d={REGIONS[id]} className={s.band} />
          </g>
        );
      })}

      {/* the territory you tapped */}
      {selected && REGIONS[selected] && <path d={REGIONS[selected]} fillRule="evenodd" className={s.selOutline} />}

      {/* labels (they cover the art's own logos and tickers), with ownership markers and activity */}
      {ids.map((id) => {
        const v = shown(id);
        const act = activity(id);
        const { x, y } = SPOTS[id]!;
        const name = (SECTOR_NAME[id] ?? id).toUpperCase();
        const tags = [v.hot && t('war.hot').toUpperCase(), act && t(ACTIVITY_KEY[act]), v.warn && t(v.warn === 'heavy' ? 'wmap.heavy' : 'wmap.enemy').toUpperCase()].filter(Boolean) as string[];
        const tall = v.extra ? 82 : 74;
        return (
          <g key={id} className={`${s.plate} ${s[v.tone]} ${act === 'surge' || act === 'major' || v.hot ? s.pulse : ''}`} aria-hidden>
            <rect x={x - 54} y={y - 38} width={108} height={tall} rx={4} className={s.plateBg} />
            <Marker x={x} y={y - 38} v={v} />
            <g transform={`translate(${x - 6} ${y - 18}) scale(0.5)`} className={s.plateIcon}>
              <path d={ICON[id] ?? ''} />
            </g>
            <text x={x} y={y + 6} className={s.plateName} fontSize={Math.min(13, 132 / name.length)}>
              {name}
            </text>
            <text x={x} y={y + 21} className={s.plateLine}>
              {v.line}
            </text>
            {v.extra && (
              <text x={x} y={y + 33} className={s.plateExtra}>
                {v.extra}
              </text>
            )}
            {v.claimable && (
              <text x={x} y={y + (v.extra ? 45 : 33)} className={s.plateClaim}>
                {t('wmap.claimHere')}
              </text>
            )}
            {tags.length > 0 && (
              <g className={act === 'low' && !v.hot ? s.tagQuiet : s.tag}>
                <rect x={x - 54} y={y - 38 + tall + 3} width={108} height={15} rx={3} />
                <text x={x} y={y - 38 + tall + 13.5}>
                  {(act === 'surge' || act === 'major' ? '⚡ ' : v.hot ? '▲ ' : '') + tags.join(' · ')}
                </text>
              </g>
            )}
          </g>
        );
      })}

      {/* what you tap: each territory in this War, its whole shape */}
      {ids
        .filter((id) => territories.includes(id))
        .map((id) => {
          const v = shown(id);
          const act = activity(id);
          return (
            <path
              key={id}
              d={REGIONS[id]}
              fillRule="evenodd"
              className={s.hit}
              role="button"
              tabIndex={0}
              aria-pressed={selected === id}
              aria-label={[SECTOR_NAME[id] ?? id, v.line, v.extra, v.hot && t('war.hot'), act && t(ACTIVITY_KEY[act]), v.warn && t(v.warn === 'heavy' ? 'wmap.heavy' : 'wmap.enemy')]
                .filter(Boolean)
                .join(', ')}
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
  );
}

const SHIELD = 'M0,-12 L10,-8 L10,1 Q10,9 0,13 Q-10,9 -10,1 L-10,-8 Z';

/** The ownership marker on top of a label: shapes as well as colours, so it reads at a glance. */
function Marker({ x, y, v }: { x: number; y: number; v: TerritoryView }) {
  if (v.tone === 'out') return null;
  return (
    <g transform={`translate(${x} ${y})`} className={s.marker}>
      {v.tone === 'mine' && (
        <>
          <path d={SHIELD} className={s.mkMine} />
          <path d="M-4.5,0.5 L-1,4 L5,-3.5" className={s.mkStroke} />
        </>
      )}
      {v.tone === 'enemy' && (
        <>
          <path d={SHIELD} className={s.mkEnemy} />
          <text y={4.5} className={s.mkInitial}>
            {(v.initial ?? '?').slice(0, 1).toUpperCase()}
          </text>
        </>
      )}
      {v.tone === 'neutral' && (
        <>
          <circle r={11} className={s.mkNeutral} />
          <path d="M-3.5,7 L-3.5,-7 M-3.5,-6.5 L5,-4 L-3.5,-1" className={s.mkStroke} />
        </>
      )}
      {v.tone === 'contested' && (
        <>
          <circle r={12} className={s.mkContested} />
          <path d="M-6,-6 L6,6 M6,-6 L-6,6 M-6,2.5 L-2.5,6 M6,2.5 L2.5,6" className={s.mkStroke} />
          {/* bull vs bear: the two sides of the battle */}
          <g transform="translate(-20 3)" className={s.mkBull}>
            <circle r={5} />
            <path d="M-4,-3 Q-7,-7 -5,-9 M4,-3 Q7,-7 5,-9" />
          </g>
          <g transform="translate(20 3)" className={s.mkBear}>
            <circle r={5} />
            <circle cx={-3.6} cy={-4} r={2} />
            <circle cx={3.6} cy={-4} r={2} />
          </g>
        </>
      )}
    </g>
  );
}
