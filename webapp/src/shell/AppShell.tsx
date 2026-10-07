/**
 * The application shell: the frame every screen lives inside.
 *
 *   Desktop / tablet (> 760px)            Phone (≤ 760px)
 *   ┌──────────┬───────────────────┐      ┌───────────────────┐
 *   │ sidebar  │ top bar           │      │ top bar           │
 *   │ (groups, │───────────────────│      │───────────────────│
 *   │ collaps- │ screen            │      │ screen            │
 *   │ ible)    │                   │      │                   │
 *   │          │                   │      │───────────────────│
 *   └──────────┴───────────────────┘      │ tab bar (4 + More)│
 *                                          └───────────────────┘
 * The shell stays mounted while screens change, so navigation never reloads the page,
 * re-initialises Firebase or loses scroll/state in the bars. Navigation entries come from
 * app/modules.ts. Each screen renders inside an ErrorBoundary so one crash can't take
 * down the bars.
 */
import { Suspense, useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router';
import { GROUP_LABEL, GROUP_ORDER, MODULES, moduleForPath, tabModules } from '../app/modules';
import { useAuth } from '../lib/auth';
import { t } from '../lib/i18n';
import { readString, writeString } from '../lib/storage';
import { Badge, Button, ErrorBoundary, Icon, LoadingState, useToast } from '../ui';
import { Avatar } from './Avatar';
import { MoreSheet } from './MoreSheet';
import { NotificationsSheet } from './NotificationsSheet';
import { ProfileSheet } from './ProfileSheet';
import { useInbox } from './useInbox';
import { useOnline } from './useOnline';
import s from './Shell.module.css';

const COLLAPSE_KEY = 'zelosAppSidebarCollapsed';
const BRAND_ICON = `${import.meta.env.BASE_URL}icons/icon-192.png`;

export function AppShell() {
  const location = useLocation();
  const { user, isReal, signInWithGoogle } = useAuth();
  const toast = useToast();
  const inbox = useInbox(isReal && user ? user.uid : null);
  const online = useOnline();
  const [collapsed, setCollapsed] = useState(() => readString(COLLAPSE_KEY) === '1');
  const [sheet, setSheet] = useState<null | 'notifications' | 'profile' | 'more'>(null);
  const mainRef = useRef<HTMLElement>(null);
  const current = moduleForPath(location.pathname);
  const title = current ? t(current.label) : t('app.name');

  useEffect(() => {
    document.title = `${title} · Zelos`;
  }, [title]);

  // New screen: start at the top and move focus to it for keyboard/screen-reader users.
  useEffect(() => {
    mainRef.current?.scrollTo?.({ top: 0 });
    window.scrollTo?.({ top: 0 });
  }, [location.pathname]);

  useEffect(() => {
    if (sheet === 'notifications') void inbox.markAllRead();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheet]);

  function toggleCollapsed() {
    setCollapsed((c) => {
      writeString(COLLAPSE_KEY, c ? '0' : '1');
      return !c;
    });
  }

  const signIn = () => signInWithGoogle().catch(() => toast.show(t('auth.signInFailed'), 'error'));
  const moreActive = !!current && current.tab == null;

  return (
    <div className={[s.shell, collapsed && s.collapsed].filter(Boolean).join(' ')}>
      <a className={s.skip} href="#main">
        Skip to content
      </a>

      {/* ---------- desktop sidebar ---------- */}
      <aside className={s.sidebar}>
        <div className={s.brandRow}>
          <Link to="/dashboard" className={s.brand} aria-label="Zelos">
            <img src={BRAND_ICON} alt="" width={28} height={28} />
            <span className={s.brandText}>Zelos</span>
          </Link>
          <Button variant="ghost" iconOnly size="sm" onClick={toggleCollapsed} aria-label={collapsed ? t('nav.expand') : t('nav.collapse')} aria-pressed={collapsed} className={s.collapseBtn}>
            <Icon name="sidebar" size={18} />
          </Button>
        </div>
        <nav className={s.sideNav} aria-label={t('nav.main')}>
          {GROUP_ORDER.map((g) => {
            const list = MODULES.filter((m) => m.group === g);
            return (
              <div key={g} className={s.navGroup}>
                {g !== 'main' && <div className={s.groupLabel}>{t(GROUP_LABEL[g])}</div>}
                {list.map((m) => (
                  <NavLink key={m.id} to={`/${m.path}`} title={collapsed ? t(m.label) : undefined} className={({ isActive }) => [s.navItem, isActive && s.active].filter(Boolean).join(' ')}>
                    <Icon name={m.icon} />
                    <span className={s.navText}>{t(m.label)}</span>
                  </NavLink>
                ))}
              </div>
            );
          })}
        </nav>
      </aside>

      {/* ---------- top bar ---------- */}
      <header className={s.topbar}>
        <Link to="/dashboard" className={s.topBrand} aria-label="Zelos">
          <img src={BRAND_ICON} alt="" width={26} height={26} />
        </Link>
        <div className={s.topTitle}>{title}</div>
        <div className={s.topActions}>
          <Button variant="ghost" iconOnly size="lg" aria-label={inbox.unread ? `${t('notifications.open')} (${t('notifications.unread', { count: inbox.unread })})` : t('notifications.open')} onClick={() => setSheet('notifications')} className={s.bellBtn}>
            <Icon name="bell" />
            {inbox.unread > 0 && (
              <Badge tone="count" className={s.bellCount}>
                {inbox.unread > 9 ? '9+' : inbox.unread}
              </Badge>
            )}
          </Button>
          {!isReal && (
            <Button variant="primary" size="sm" onClick={signIn} className={s.signInBtn}>
              {t('auth.signIn')}
            </Button>
          )}
          <button type="button" className={s.avatarBtn} aria-label={t('nav.profile')} onClick={() => setSheet('profile')}>
            <Avatar user={user} />
          </button>
        </div>
      </header>

      {!online && (
        <div className={s.offline} role="status">
          <Icon name="wifiOff" size={16} /> {t('state.offline')}
        </div>
      )}

      {/* ---------- screen ---------- */}
      <main id="main" ref={mainRef} className={s.main} tabIndex={-1}>
        <div key={location.pathname} className={s.screen}>
          <ErrorBoundary resetKey={location.pathname}>
            <Suspense fallback={<LoadingState />}>
              <Outlet />
            </Suspense>
          </ErrorBoundary>
        </div>
      </main>

      {/* ---------- phone tab bar ---------- */}
      <nav className={s.tabbar} aria-label={t('nav.main')}>
        {tabModules().map((m) => (
          <NavLink key={m.id} to={`/${m.path}`} className={({ isActive }) => [s.tab, isActive && s.active].filter(Boolean).join(' ')}>
            <Icon name={m.icon} size={22} />
            <span>{t(m.label)}</span>
          </NavLink>
        ))}
        <button type="button" className={[s.tab, moreActive && s.active].filter(Boolean).join(' ')} onClick={() => setSheet('more')} aria-haspopup="dialog">
          <Icon name="more" size={22} />
          <span>{t('nav.more')}</span>
        </button>
      </nav>

      <NotificationsSheet open={sheet === 'notifications'} onClose={() => setSheet(null)} signedIn={isReal} items={inbox.items} error={inbox.error} onSignIn={signIn} />
      <ProfileSheet open={sheet === 'profile'} onClose={() => setSheet(null)} />
      <MoreSheet open={sheet === 'more'} onClose={() => setSheet(null)} />
    </div>
  );
}
