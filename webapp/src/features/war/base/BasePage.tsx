/**
 * /war/base: your War base (owner 2026-11-01, prototype). An isometric piece of land with your
 * buildings as separate pieces you select, place, move and upgrade; zoom and pan with the mouse,
 * a finger or the buttons. Gold comes from Gold Mines while you're away; up to 3 things build at
 * once, in minutes. Every action goes to the server (war_lobby base*), which checks the gold, the
 * land and the timers; the screen only shows what the server decided (and counts the time down).
 *
 * The building pictures are stand-ins cut from the owner's reference until the owner's own
 * separate pieces arrive (one picture per building, swapped in base/*.webp).
 */
import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent, type WheelEvent } from 'react';
import { Link } from 'react-router';
import { t, type MessageKey } from '../../../lib/i18n';
import { useNow } from '../../../lib/useNow';
import { Button, LoadingState, PageHeader, useToast } from '../../../ui';
import { errorText } from '../../invites/invites';
import { WarGate } from '../Gate';
import barracksUrl from './barracks.webp';
import {
  baseAction,
  busyCount,
  cantPlace,
  cantUpgrade,
  CONFIG,
  fits,
  formatLeft,
  GRID,
  hqLevel,
  isBusy,
  shownLevel,
  SLOTS,
  storedNow,
  LAND,
  TILE_W,
  toScreen,
  toTile,
  useWarBase,
  type Base,
  type Building,
  type Kind,
} from './base';
import hqUrl from './hq.webp';
import landUrl from './land.webp';
import mineUrl from './mine.webp';
import s from './Base.module.css';

// the owner's building pictures (2026-11-02), cut from their sheet; aspect = height / width
const SPRITE: Record<Kind, { url: string; aspect: number; widen: number }> = {
  hq: { url: hqUrl, aspect: 420 / 421, widen: 1.05 },
  mine: { url: mineUrl, aspect: 303 / 373, widen: 1.05 },
  barracks: { url: barracksUrl, aspect: 354 / 402, widen: 1.05 },
};
const WORLD_W = LAND.w;
const WORLD_H = LAND.h;
const BUILDABLE: Kind[] = ['mine', 'barracks'];
const at = toScreen;

export default function BasePage() {
  return <WarGate>{(uid) => <BaseScreen uid={uid} />}</WarGate>;
}

type Mode = { type: 'place'; kind: Kind; x: number; y: number } | { type: 'move'; id: string; kind: Kind; x: number; y: number } | null;

function BaseScreen({ uid }: { uid: string }) {
  const live = useWarBase(uid);
  const toast = useToast();
  const now = useNow(1000);
  const [ready, setReady] = useState(false);
  const [sel, setSel] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    // makes this season's base (with its starter gold) the first time, and settles finished work
    baseAction({ action: 'baseOpen' })
      .catch((err) => toast.show(errorText(err, t('warl.failed')), 'error'))
      .finally(() => setReady(true));
  }, [toast]);
  const base = live.status === 'ready' ? live.data : null;
  const picked = base?.buildings.find((b) => b.id === sel) ?? null;

  async function act(req: Parameters<typeof baseAction>[0], done?: (r: Awaited<ReturnType<typeof baseAction>>) => void) {
    setBusy(true);
    try {
      const r = await baseAction(req);
      done?.(r);
    } catch (err) {
      toast.show(errorText(err, t('warl.failed')), 'error');
    } finally {
      setBusy(false);
    }
  }
  function startPlace(kind: Kind) {
    if (!base) return;
    const spot = firstFree(base, kind);
    if (!spot) return toast.show(t('wbase.noRoom'), 'error');
    setSel(null);
    setMode({ type: 'place', kind, ...spot });
  }
  function confirm() {
    if (!mode || !base || !fits(base, mode.kind, mode.x, mode.y, mode.type === 'move' ? mode.id : undefined)) return;
    const m = mode;
    if (m.type === 'place')
      void act({ action: 'basePlace', kind: m.kind, x: m.x, y: m.y }, () => {
        setMode(null);
        toast.show(t('wbase.started', { name: CONFIG[m.kind].name }), 'success');
      });
    else void act({ action: 'baseMove', id: m.id, x: m.x, y: m.y }, () => setMode(null));
  }

  if (!ready || live.status === 'loading') return <LoadingState rows={6} />;
  if (!base) return <LoadingState rows={6} />;
  const mines = base.buildings.filter((b) => b.kind === 'mine');
  const waiting = Math.floor(mines.reduce((n, m) => n + storedNow(m, now), 0));
  return (
    <>
      <Link to="/war" className={s.back}>
        ← {t('wbase.back')}
      </Link>
      <PageHeader title={t('wbase.title')} subtitle={t('wbase.sub')} keepOnPhone />
      <div className={s.hud} role="group" aria-label={t('wbase.hud')}>
        <span className={s.res}>
          <i className={s.coin} aria-hidden />
          <b>{Math.floor(base.gold).toLocaleString('en-US')}</b>
          <small>{t('wbase.gold')}</small>
        </span>
        <span className={s.res}>
          <b>
            {busyCount(base, now)} / {SLOTS}
          </b>
          <small>{t('wbase.builders')}</small>
        </span>
        <span className={s.res}>
          <b>{t('wbase.level', { n: hqLevel(base) })}</b>
          <small>{t('wbase.hqShort')}</small>
        </span>
        <Button
          size="sm"
          variant="secondary"
          disabled={busy || waiting < 1}
          onClick={() =>
            void act({ action: 'baseCollect' }, (r) =>
              toast.show(
                t('wbase.collected', {
                  n: r.collected.toLocaleString('en-US'),
                }),
                'success',
              ),
            )
          }
        >
          {t('wbase.collectAll', { n: waiting.toLocaleString('en-US') })}
        </Button>
      </div>

      <World base={base} now={now} sel={sel} onSelect={(id) => (mode ? undefined : setSel((c) => (c === id ? null : id)))} mode={mode} setMode={setMode} onConfirm={confirm} />

      {mode ? (
        <div className={s.panel} role="region" aria-label={t('wbase.placing')}>
          <p className={s.panelTitle}>{mode.type === 'place' ? t('wbase.placeTitle', { name: CONFIG[mode.kind].name }) : t('wbase.moveTitle', { name: CONFIG[mode.kind].name })}</p>
          <p className={s.muted}>{t('wbase.placeHelp')}</p>
          {!fits(base, mode.kind, mode.x, mode.y, mode.type === 'move' ? mode.id : undefined) && <p className={s.warn}>{t('wbase.blocked')}</p>}
          <div className={s.row}>
            <Button variant="primary" disabled={busy || !fits(base, mode.kind, mode.x, mode.y, mode.type === 'move' ? mode.id : undefined)} onClick={confirm}>
              {mode.type === 'place' ? t('wbase.placeHere', { cost: CONFIG[mode.kind].cost[0]! }) : t('wbase.moveHere')}
            </Button>
            <Button variant="ghost" onClick={() => setMode(null)}>
              {t('wbase.cancel')}
            </Button>
          </div>
        </div>
      ) : picked ? (
        <Details
          b={base}
          x={picked}
          now={now}
          busy={busy}
          onUpgrade={() => void act({ action: 'baseUpgrade', id: picked.id }, () => toast.show(t('wbase.upgrading', { name: CONFIG[picked.kind].name }), 'success'))}
          onCollect={() =>
            void act({ action: 'baseCollect', id: picked.id }, (r) =>
              toast.show(
                t('wbase.collected', {
                  n: r.collected.toLocaleString('en-US'),
                }),
                'success',
              ),
            )
          }
          onMove={() =>
            setMode({
              type: 'move',
              id: picked.id,
              kind: picked.kind,
              x: picked.x,
              y: picked.y,
            })
          }
          onClose={() => setSel(null)}
        />
      ) : (
        <BuildMenu base={base} now={now} onPick={startPlace} />
      )}
    </>
  );
}

/** The first free spot for a building of this kind, scanning from the Headquarters outward. */
function firstFree(b: Base, kind: Kind): { x: number; y: number } | null {
  const spots: { x: number; y: number; d: number }[] = [];
  for (let y = 0; y < GRID; y++) for (let x = 0; x < GRID; x++) spots.push({ x, y, d: Math.abs(x - GRID / 2) + Math.abs(y - GRID / 2) });
  spots.sort((a, c) => a.d - c.d);
  // leave a tile of grass around it when there's room, so buildings don't touch
  const roomy = (p: { x: number; y: number }) =>
    p.x > 0 &&
    p.y > 0 &&
    fits(b, kind, p.x, p.y) &&
    b.buildings.every((o) => {
      const n = CONFIG[o.kind].size;
      const m = CONFIG[kind].size;
      return !(p.x - 1 < o.x + n && o.x < p.x + m + 1 && p.y - 1 < o.y + n && o.y < p.y + m + 1);
    });
  return spots.find(roomy) ?? spots.find((p) => fits(b, kind, p.x, p.y)) ?? null;
}

function World({ base, now, sel, onSelect, mode, setMode, onConfirm }: { base: Base; now: number; sel: string | null; onSelect: (id: string) => void; mode: Mode; setMode: (m: Mode) => void; onConfirm: () => void }) {
  const box = useRef<HTMLDivElement>(null);
  const [view, setView] = useState({ x: 0, y: 0, z: 0.7 });
  const drag = useRef<{
    id: number;
    x: number;
    y: number;
    vx: number;
    vy: number;
    moved: boolean;
  } | null>(null);
  const pinch = useRef<Map<number, { x: number; y: number }>>(new Map());
  useEffect(() => {
    // start with the whole base in view
    const el = box.current;
    if (!el) return;
    const z = Math.min(1.1, Math.max(0.55, Math.max(el.clientWidth / WORLD_W, el.clientHeight / WORLD_H)));
    setView({
      x: (el.clientWidth - WORLD_W * z) / 2,
      y: (el.clientHeight - WORLD_H * z) / 2,
      z,
    });
  }, []);
  const zoom = (f: number, cx?: number, cy?: number) =>
    setView((v) => {
      const el = box.current;
      const px = cx ?? (el ? el.clientWidth / 2 : 0);
      const py = cy ?? (el ? el.clientHeight / 2 : 0);
      const z = Math.min(1.6, Math.max(0.3, v.z * f));
      return {
        z,
        x: px - ((px - v.x) * z) / v.z,
        y: py - ((py - v.y) * z) / v.z,
      };
    });
  function tileAt(clientX: number, clientY: number) {
    const el = box.current!.getBoundingClientRect();
    const wx = (clientX - el.left - view.x) / view.z;
    const wy = (clientY - el.top - view.y) / view.z;
    return toTile(wx, wy);
  }
  function down(e: PointerEvent) {
    pinch.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch.current.size === 1)
      drag.current = {
        id: e.pointerId,
        x: e.clientX,
        y: e.clientY,
        vx: view.x,
        vy: view.y,
        moved: false,
      };
  }
  function move(e: PointerEvent) {
    const prev = pinch.current.get(e.pointerId);
    if (pinch.current.size === 2 && prev) {
      const [a, b] = [...pinch.current.values()];
      const before = Math.hypot(a!.x - b!.x, a!.y - b!.y);
      pinch.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const [c, d] = [...pinch.current.values()];
      const after = Math.hypot(c!.x - d!.x, c!.y - d!.y);
      if (before > 0) zoom(after / before);
      return;
    }
    if (prev) pinch.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const d = drag.current;
    if (d && d.id === e.pointerId) {
      const dx = e.clientX - d.x;
      const dy = e.clientY - d.y;
      if (!d.moved && Math.hypot(dx, dy) > 5) d.moved = true;
      if (d.moved) setView((v) => ({ ...v, x: d.vx + dx, y: d.vy + dy }));
    } else if (mode && e.pointerType === 'mouse') {
      const tl = tileAt(e.clientX, e.clientY);
      const half = Math.floor(CONFIG[mode.kind].size / 2);
      setMode({ ...mode, x: tl.x - half, y: tl.y - half });
    }
  }
  function up(e: PointerEvent) {
    pinch.current.delete(e.pointerId);
    const d = drag.current;
    drag.current = null;
    if (!d || d.moved || !mode) return;
    // a tap in placing mode puts the building's footprint there (tap again or press the button to confirm)
    const tl = tileAt(e.clientX, e.clientY);
    const half = Math.floor(CONFIG[mode.kind].size / 2);
    const nx = tl.x - half;
    const ny = tl.y - half;
    if (nx === mode.x && ny === mode.y) onConfirm();
    else setMode({ ...mode, x: nx, y: ny });
  }
  function wheel(e: WheelEvent) {
    const el = box.current!.getBoundingClientRect();
    zoom(e.deltaY < 0 ? 1.1 : 1 / 1.1, e.clientX - el.left, e.clientY - el.top);
  }
  function key(e: KeyboardEvent) {
    if (!mode) return;
    const step: Record<string, [number, number]> = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
    };
    const k = step[e.key];
    if (k) {
      e.preventDefault();
      setMode({ ...mode, x: mode.x + k[0], y: mode.y + k[1] });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      onConfirm();
    } else if (e.key === 'Escape') setMode(null);
  }
  const sorted = useMemo(() => [...base.buildings].sort((a, b) => a.x + a.y + CONFIG[a.kind].size - (b.x + b.y + CONFIG[b.kind].size)), [base.buildings]);
  const ghostOk = mode ? fits(base, mode.kind, mode.x, mode.y, mode.type === 'move' ? mode.id : undefined) : false;
  return (
    <div
      className={s.viewport}
      ref={box}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      onWheel={wheel}
      onKeyDown={key}
      tabIndex={mode ? 0 : -1}
      aria-label={t('wbase.land')}
      role="application"
    >
      <div
        className={s.world}
        style={{
          width: WORLD_W,
          height: WORLD_H,
          transform: `translate(${view.x}px, ${view.y}px) scale(${view.z})`,
        }}
      >
        <Ground />
        {mode && <Footprint kind={mode.kind} x={mode.x} y={mode.y} ok={ghostOk} />}
        {sorted.map((b) => (mode?.type === 'move' && mode.id === b.id ? null : <Piece key={b.id} b={b} now={now} selected={sel === b.id} onSelect={() => onSelect(b.id)} />))}
        {mode && (
          <Piece
            b={{
              id: 'ghost',
              kind: mode.kind,
              x: mode.x,
              y: mode.y,
              level: 1,
              to: null,
              busyUntil: null,
              stored: 0,
              prodAt: null,
            }}
            now={now}
            ghost
            ok={ghostOk}
          />
        )}
      </div>
      <div className={s.zoom} onPointerDown={(e) => e.stopPropagation()}>
        <button type="button" aria-label={t('wbase.zoomIn')} onClick={() => zoom(1.2)}>
          +
        </button>
        <button type="button" aria-label={t('wbase.zoomOut')} onClick={() => zoom(1 / 1.2)}>
          −
        </button>
      </div>
    </div>
  );
}

/** The land: the owner's own picture of the grass, trees, cliffs and water. */
function Ground() {
  return <img className={s.land} src={landUrl} alt="" width={WORLD_W} height={WORLD_H} draggable={false} />;
}

function Footprint({ kind, x, y, ok }: { kind: Kind; x: number; y: number; ok: boolean }) {
  const n = CONFIG[kind].size;
  const a = at(x, y);
  const b = at(x + n, y);
  const c = at(x + n, y + n);
  const d = at(x, y + n);
  return (
    <svg className={s.ground} width={WORLD_W} height={WORLD_H} aria-hidden>
      <path d={`M${a.sx} ${a.sy}L${b.sx} ${b.sy}L${c.sx} ${c.sy}L${d.sx} ${d.sy}Z`} className={ok ? s.footOk : s.footBad} />
    </svg>
  );
}

/** One building: its picture standing on its footprint, its level, and its timer while building. */
function Piece({ b, now, selected, onSelect, ghost, ok }: { b: Building; now: number; selected?: boolean; onSelect?: () => void; ghost?: boolean; ok?: boolean }) {
  const cfg = CONFIG[b.kind];
  const sp = SPRITE[b.kind];
  const n = cfg.size;
  const foot = at(b.x + n, b.y + n); // the front corner
  const w = n * TILE_W * sp.widen;
  const h = w * sp.aspect;
  const style: CSSProperties = {
    left: foot.sx - w / 2,
    top: foot.sy - h + TILE_W * 0.12,
    width: w,
    height: h,
    zIndex: 10 + b.x + b.y + n,
  };
  const building = isBusy(b, now);
  const lvl = shownLevel(b, now);
  const left = b.busyUntil ? b.busyUntil - now : 0;
  const total = (cfg.time[(b.to ?? 1) - 1] ?? 1) * 1000;
  const label = `${cfg.name}, ${lvl < 1 ? t('wbase.underConstruction') : t('wbase.level', { n: lvl })}${building ? `, ${t('wbase.readyIn', { t: formatLeft(left) })}` : ''}`;
  const pic = <img src={sp.url} alt="" draggable={false} className={`${s.sprite} ${building ? s.building : ''}`} />;
  if (ghost)
    return (
      <div className={`${s.piece} ${s.ghost} ${ok ? '' : s.ghostBad}`} style={style} aria-hidden>
        {pic}
      </div>
    );
  return (
    <button
      type="button"
      className={`${s.piece} ${selected ? s.selected : ''}`}
      style={style}
      aria-label={label}
      aria-pressed={selected}
      onPointerDown={(e) => e.stopPropagation()}
      onPointerUp={(e) => e.stopPropagation()}
      onClick={onSelect}
    >
      {pic}
      <span className={s.tag}>
        {cfg.name}
        <small>{lvl < 1 ? t('wbase.underConstruction') : t('wbase.level', { n: lvl })}</small>
      </span>
      {building && (
        <span className={s.timer}>
          <span className={s.bar}>
            <i
              style={{
                width: `${Math.min(100, Math.max(0, 100 - (left / total) * 100))}%`,
              }}
            />
          </span>
          {formatLeft(left)}
        </span>
      )}
      {b.kind === 'mine' && !building && storedNow(b, now) >= 1 && <span className={s.bubble}>+{Math.floor(storedNow(b, now))}</span>}
      {b.kind === 'barracks' && lvl >= 1 && !building && (
        <span className={s.guards} aria-hidden>
          {Array.from({ length: Math.min(4, lvl + 1) }, (_, i) => (
            <svg key={i} viewBox="0 0 16 32" className={s.guard}>
              <path d="M3 7.4Q3.2 1.6 8 1.4Q12.8 1.6 13 7.4L14.2 8.2H1.8ZM5.6 9.2H10.4V10.6Q10.2 12.6 8 12.8Q5.8 12.6 5.6 10.6ZM3.2 14.2Q8 12.4 12.8 14.2L13.4 22.2H2.6ZM3 22.6H7.5L7.1 31H4.1ZM8.5 22.6H13L11.9 31H8.9ZM0.6 19.8L13.6 12.2L14.6 13.6L1.6 21.2Z" />
            </svg>
          ))}
        </span>
      )}
    </button>
  );
}

const WHY_PLACE: Record<'count' | 'gold' | 'slots', MessageKey> = {
  count: 'wbase.why.count',
  gold: 'wbase.why.gold',
  slots: 'wbase.why.slots',
};
const WHY_UP: Record<'max' | 'hq' | 'busy' | 'slots' | 'gold', MessageKey> = {
  max: 'wbase.why.max',
  hq: 'wbase.why.hq',
  busy: 'wbase.why.busy',
  slots: 'wbase.why.slots',
  gold: 'wbase.why.gold',
};

function BuildMenu({ base, now, onPick }: { base: Base; now: number; onPick: (k: Kind) => void }) {
  return (
    <div className={s.panel} role="region" aria-label={t('wbase.build')}>
      <p className={s.panelTitle}>{t('wbase.build')}</p>
      <ul className={s.menu}>
        {BUILDABLE.map((k) => {
          const cfg = CONFIG[k];
          const why = cantPlace(base, k, now);
          const have = base.buildings.filter((b) => b.kind === k).length;
          return (
            <li key={k}>
              <button type="button" className={s.card} disabled={!!why} onClick={() => onPick(k)}>
                <img src={SPRITE[k].url} alt="" />
                <span>
                  <b>{cfg.name}</b>
                  <small>{t(k === 'mine' ? 'wbase.what.mine' : 'wbase.what.barracks')}</small>
                  <small>
                    {t('wbase.costTime', {
                      cost: cfg.cost[0]!,
                      t: formatLeft(cfg.time[0]! * 1000),
                    })}{' '}
                    ·{' '}
                    {t('wbase.have', {
                      n: have,
                      max: cfg.count[hqLevel(base) - 1]!,
                    })}
                  </small>
                  {why && <small className={s.why}>{t(WHY_PLACE[why])}</small>}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Details({ b, x, now, busy, onUpgrade, onCollect, onMove, onClose }: { b: Base; x: Building; now: number; busy: boolean; onUpgrade: () => void; onCollect: () => void; onMove: () => void; onClose: () => void }) {
  const cfg = CONFIG[x.kind];
  const lvl = shownLevel(x, now);
  const why = cantUpgrade(b, x, now);
  const next = lvl < cfg.max ? { cost: cfg.cost[lvl]!, time: cfg.time[lvl]! } : null;
  const effect =
    x.kind === 'mine' && lvl >= 1
      ? t('wbase.eff.mine', {
          rate: cfg.rate![lvl - 1]!,
          store: cfg.store![lvl - 1]!,
        })
      : x.kind === 'barracks' && lvl >= 1
        ? t('wbase.eff.barracks', { n: cfg.soldiers![lvl - 1]! })
        : x.kind === 'hq'
          ? t('wbase.eff.hq', {
              mines: CONFIG.mine.count[lvl - 1]!,
              max: lvl + 1,
            })
          : t('wbase.underConstruction');
  const stored = Math.floor(storedNow(x, now));
  return (
    <div className={s.panel} role="region" aria-label={cfg.name}>
      <div className={s.panelHead}>
        <p className={s.panelTitle}>
          {cfg.name} · {lvl < 1 ? t('wbase.underConstruction') : t('wbase.level', { n: lvl })}
        </p>
        <button type="button" className={s.close} aria-label={t('wbase.close')} onClick={onClose}>
          ×
        </button>
      </div>
      <p className={s.muted}>{effect}</p>
      {isBusy(x, now) && <p className={s.muted}>{t('wbase.readyIn', { t: formatLeft((x.busyUntil ?? now) - now) })}</p>}
      <div className={s.row}>
        {next && !isBusy(x, now) && (
          <Button variant="primary" disabled={busy || !!why} onClick={onUpgrade}>
            {t('wbase.upgrade', {
              n: lvl + 1,
              cost: next.cost.toLocaleString('en-US'),
              t: formatLeft(next.time * 1000),
            })}
          </Button>
        )}
        {x.kind === 'mine' && (
          <Button variant="secondary" disabled={busy || stored < 1} onClick={onCollect}>
            {t('wbase.collect', { n: stored.toLocaleString('en-US') })}
          </Button>
        )}
        <Button variant="ghost" disabled={busy} onClick={onMove}>
          {t('wbase.move')}
        </Button>
      </div>
      {why && why !== 'max' && why !== 'busy' && <p className={s.why}>{t(WHY_UP[why])}</p>}
      {why === 'max' && <p className={s.muted}>{t('wbase.why.max')}</p>}
    </div>
  );
}
