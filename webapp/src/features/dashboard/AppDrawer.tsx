/**
 * The phone Dashboard's pull-down (owner 2026-11-14): a small handle under the greeting; tap it
 * or pull it down and the Zelos sections open as app icons (Trade War, Battles, Strategies,
 * Leaderboard, Training Ground, Hall of Minds, Trading 101…), so you don't need the ☰ menu.
 * Pull up or tap again to fold it. Only the handle takes the drag, so the page still scrolls
 * and the browser's own pull-to-refresh is never in the way. Phones only; a computer has the sidebar.
 */
import { useId, useRef, useState, type PointerEvent } from 'react';
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
  return (
    <div className={s.drawer} data-open={open || undefined}>
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
    </div>
  );
}
