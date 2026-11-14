/**
 * The phone Dashboard's pull-down (owner 2026-11-14): a grip and arrow right under the top bar;
 * swipe down (2026-11-15: anywhere in the top part of the page while it's scrolled to the top)
 * or tap the grip, and the Zelos sections open as app icons below it (Trade War, Battles,
 * Strategies, Leaderboard, Training Ground, Hall of Minds, Trading 101…), so you don't need the
 * ☰ menu. Swipe up or tap again to fold it. A swipe only counts when it's mostly downward and
 * the page is already at the top, so scrolling is never affected; the Dashboard turns off the
 * browser's pull-to-refresh while it's open on a phone. Phones only; a computer has the sidebar.
 */
import { useEffect, useId, useRef, useState, type PointerEvent } from 'react';
import { Link } from 'react-router';
import { t, type MessageKey } from '../../lib/i18n';
import { Icon, type IconName } from '../../ui';
import s from './AppDrawer.module.css';

const B = import.meta.env.BASE_URL;
type App = { to: string; label: MessageKey; art?: string; icon?: IconName; tone: string };
export const APPS: App[] = [
  { to: '/trade-war', label: 'nav.tradeWar', art: `${B}icons/icon-192.png`, tone: 'blue' },
  { to: '/battles', label: 'nav.battles', art: `${B}art/bear.webp`, tone: 'red' },
  { to: '/strategies', label: 'nav.strategies', icon: 'radar', tone: 'violet' },
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
  const [open, setOpen] = useState(false);
  const id = useId();
  const drag = useRef<{ y: number; moved: boolean } | null>(null);
  const down = (e: PointerEvent<HTMLButtonElement>) => {
    drag.current = { y: e.clientY, moved: false };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const move = (e: PointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    if (!d) return;
    const dy = e.clientY - d.y;
    if (Math.abs(dy) < 24) return;
    d.moved = true;
    setOpen(dy > 0); // pull down opens, push up folds
  };
  const up = () => {
    const d = drag.current;
    drag.current = null;
    if (d && !d.moved) setOpen((o) => !o); // a plain tap toggles
  };
  // a swipe down from the top part of the page, while it's scrolled to the top, opens it;
  // a swipe up anywhere in the open panel folds it
  useEffect(() => {
    let start: { x: number; y: number; top: boolean } | null = null;
    const onStart = (e: TouchEvent) => {
      const t = e.touches[0];
      if (!t || e.touches.length > 1) return void (start = null);
      start = { x: t.clientX, y: t.clientY, top: window.scrollY <= 2 && t.clientY < window.innerHeight * 0.6 };
    };
    const onMove = (e: TouchEvent) => {
      const t = e.touches[0];
      if (!start || !t) return;
      const dx = t.clientX - start.x;
      const dy = t.clientY - start.y;
      if (Math.abs(dy) < 50 || Math.abs(dy) < 2 * Math.abs(dx)) return;
      if (dy > 0 && start.top && window.scrollY <= 2) setOpen(true);
      start = null;
    };
    const end = () => (start = null);
    window.addEventListener('touchstart', onStart, { passive: true });
    window.addEventListener('touchmove', onMove, { passive: true });
    window.addEventListener('touchend', end, { passive: true });
    window.addEventListener('touchcancel', end, { passive: true });
    // no pull-to-refresh on the Dashboard, so the swipe opens the sections instead of reloading
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
  return (
    <div className={s.drawer} data-open={open || undefined}>
      <button
        type="button"
        className={s.handle}
        aria-expanded={open}
        aria-controls={id}
        aria-label={t(open ? 'dash.apps.close' : 'dash.apps.open')}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={() => (drag.current = null)}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), setOpen((o) => !o))}
      >
        <span className={s.grip} aria-hidden />
        <Icon name="chevronRight" size={16} className={s.chev} />
      </button>
      <div className={s.panel} id={id} hidden={!open}>
        <nav aria-label={t('dash.apps')}>
          <ul className={s.grid}>
            {APPS.map((a) => (
              <li key={a.to}>
                <Link to={a.to} className={s.app}>
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
  );
}
