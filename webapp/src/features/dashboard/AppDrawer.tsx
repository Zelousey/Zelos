/**
 * The phone Dashboard's pull-down (owner 2026-11-14): a grip and arrow right under the top bar;
 * swipe down (2026-11-15: anywhere in the top part of the page while it's scrolled to the top)
 * or tap the grip, and the Zelos sections open as app icons below it (Trade War, Battles,
 * Strategies, Leaderboard, Training Ground, Hall of Minds, Trading 101…), so you don't need the
 * ☰ menu. Swipe up or tap again to fold it. A swipe only counts when it's mostly downward and
 * the page is already at the top, so scrolling is never affected; the Dashboard turns off the
 * browser's pull-to-refresh while it's open on a phone. Phones only; a computer has the sidebar.
 */
import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import { Link } from 'react-router';
import { t, type MessageKey } from '../../lib/i18n';
import { Icon, type IconName } from '../../ui';
import s from './AppDrawer.module.css';

const B = import.meta.env.BASE_URL;
type App = { to: string; label: MessageKey; art?: string; icon?: IconName; tone: string };
export const APPS: App[] = [
  { to: '/trade-war', label: 'nav.tradeWar', art: `${B}icons/icon-192.png`, tone: 'blue' },
  { to: '/battles', label: 'nav.battles', art: `${B}art/bear.webp`, tone: 'red' },
  { to: '/strategies', label: 'nav.strategies', art: `${B}art/strategy.webp`, tone: 'violet' },
  { to: '/leaderboard', label: 'nav.leaderboard', icon: 'trophy', tone: 'gold' },
  { to: '/training', label: 'nav.training', icon: 'arcade', tone: 'green' },
  { to: '/minds', label: 'nav.minds', art: `${B}minds/livermore.webp`, tone: 'gold' },
  { to: '/learn', label: 'nav.learn', icon: 'learn', tone: 'blue' },
  { to: '/missions', label: 'nav.missions', icon: 'missions', tone: 'gold' },
  { to: '/coach', label: 'nav.coach', art: `${B}art/coach.webp`, tone: 'blue' },
  { to: '/social', label: 'nav.social', art: `${B}art/teamup.webp`, tone: 'violet' },
  { to: '/communities', label: 'nav.communities', icon: 'chat', tone: 'green' },
  { to: '/profile', label: 'nav.profile', icon: 'profile', tone: 'blue' },
];

export function AppDrawer() {
  // progress 0 (folded) .. 1 (open). While a finger is down it follows the finger exactly; on
  // release it settles open or folded with a short ease (owner 2026-11-15: like a native pull-down).
  const [p, setP] = useState(0);
  const [dragging, setDragging] = useState(false);
  const open = p > 0.5;
  const id = useId();
  const inner = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const full = () => inner.current?.scrollHeight || 280;
  const pRef = useRef(0);
  useEffect(() => {
    pRef.current = p;
  }, [p]);
  // the icons' full height, measured once they're rendered (it's what 100% open means)
  const [fullH, setFullH] = useState(280);
  const settle = (from: number, vy: number) => {
    setDragging(false);
    // a quick flick decides on its own; otherwise past a third of the way opens
    setP(vy > 0.35 ? 1 : vy < -0.35 ? 0 : from > 0.35 ? 1 : 0);
  };

  // the handle: drag it (mouse or finger) or tap it
  const drag = useRef<{ y: number; p0: number; moved: boolean; t: number; last: number } | null>(null);
  const down = (e: PointerEvent<HTMLButtonElement>) => {
    drag.current = { y: e.clientY, p0: pRef.current > 0.5 ? 1 : 0, moved: false, t: e.timeStamp, last: e.clientY };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const move = (e: PointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    if (!d) return;
    const dy = e.clientY - d.y;
    if (!d.moved && Math.abs(dy) < 6) return;
    d.moved = true;
    setDragging(true);
    setP(Math.max(0, Math.min(1, d.p0 + dy / full())));
    d.t = e.timeStamp;
    d.last = e.clientY;
  };
  const up = (e: PointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    if (!d.moved) return setP((x) => (x > 0.5 ? 0 : 1)); // a plain tap toggles
    const vy = (e.clientY - d.last) / Math.max(16, e.timeStamp - d.t);
    settle(pRef.current, vy);
  };

  // a pull down from the top part of the page (while it's scrolled to the top) follows the finger;
  // with the icons open, a push up on them folds them the same way. Sideways and normal scrolling
  // are left alone: the direction is decided on the first move.
  useEffect(() => {
    let g: { y: number; x: number; p0: number; mode: 'pull' | 'none' | null; lastY: number; lastT: number; vy: number } | null = null;
    const onStart = (e: TouchEvent) => {
      const t0 = e.touches[0];
      if (!t0 || e.touches.length > 1) return void (g = null);
      const inDrawer = e.target instanceof Node && !!rootRef.current?.contains(e.target);
      const atTop = window.scrollY <= 2 && t0.clientY < window.innerHeight * 0.6;
      g = atTop || (pRef.current > 0.5 && inDrawer) ? { y: t0.clientY, x: t0.clientX, p0: pRef.current > 0.5 ? 1 : 0, mode: null, lastY: t0.clientY, lastT: e.timeStamp, vy: 0 } : null;
    };
    const onMove = (e: TouchEvent) => {
      const t0 = e.touches[0];
      if (!g || !t0) return;
      const dy = t0.clientY - g.y;
      const dx = t0.clientX - g.x;
      if (!g.mode) {
        const vertical = Math.abs(dy) > Math.abs(dx);
        g.mode = vertical && ((g.p0 === 0 && dy > 0 && window.scrollY <= 2) || (g.p0 === 1 && dy < 0)) ? 'pull' : 'none';
        if (g.mode === 'pull') setDragging(true);
      }
      if (g.mode !== 'pull') return;
      e.preventDefault(); // the page (and iPhone's rubber band) stays put while the icons follow
      setP(Math.max(0, Math.min(1, g.p0 + dy / full())));
      g.vy = (t0.clientY - g.lastY) / Math.max(16, e.timeStamp - g.lastT);
      g.lastY = t0.clientY;
      g.lastT = e.timeStamp;
    };
    const end = () => {
      if (g?.mode === 'pull') settle(pRef.current, g.vy);
      g = null;
    };
    window.addEventListener('touchstart', onStart, { passive: true });
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', end, { passive: true });
    window.addEventListener('touchcancel', end, { passive: true });
    // no pull-to-refresh on the Dashboard, so the pull opens the sections instead of reloading
    const html = document.documentElement;
    const before = html.style.overscrollBehaviorY;
    html.style.overscrollBehaviorY = 'contain';
    return () => {
      window.removeEventListener('touchstart', onStart);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', end);
      window.removeEventListener('touchcancel', end);
      html.style.overscrollBehaviorY = before;
    };
  }, []);
  const shown = p > 0 || dragging;
  useLayoutEffect(() => {
    // laid out even while folded (height 0, hidden), so it can be measured before the first pull
    if (inner.current?.scrollHeight) setFullH(inner.current.scrollHeight);
  }, [shown]);
  return (
    <div ref={rootRef} className={s.drawer} data-open={open || undefined} data-dragging={dragging || undefined} style={{ '--p': p } as CSSProperties}>
      <button
        type="button"
        className={s.handle}
        aria-expanded={open}
        aria-controls={id}
        aria-label={t(open ? 'dash.apps.close' : 'dash.apps.open')}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={() => ((drag.current = null), setDragging(false))}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), setP((x) => (x > 0.5 ? 0 : 1)))}
      >
        <span className={s.grip} aria-hidden />
        <Icon name="chevronRight" size={16} className={s.chev} />
      </button>
      <div className={s.panel} id={id} data-closed={!shown || undefined} aria-hidden={!open} inert={!open} style={{ height: dragging ? `${p * fullH}px` : open ? `${fullH}px` : 0 }}>
        <div ref={inner}>
          <nav aria-label={t('dash.apps')}>
            <ul className={s.grid}>
              {APPS.map((a) => (
                <li key={a.to}>
                  <Link to={a.to} className={s.app} tabIndex={open ? undefined : -1}>
                    <span className={s.tile} data-tone={a.tone}>
                      {a.art ? <img src={a.art} alt="" width={56} height={56} loading="lazy" decoding="async" /> : <Icon name={a.icon!} size={26} />}
                    </span>
                    <span className={s.label}>{t(a.label)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </div>
    </div>
  );
}
