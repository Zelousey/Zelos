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
 *   └──────────┴───────────────────┘      │ tab bar (5 tabs)  │
 *                                          └───────────────────┘
 * Phone top bar: logo + screen name, then Profile · Notifications · ☰ (the menu holds
 * everything that isn't a tab).
 * The shell stays mounted while screens change, so navigation never reloads the page,
 * re-initialises Firebase or loses scroll/state in the bars. Navigation entries come from
 * app/modules.ts. Each screen renders inside an ErrorBoundary so one crash can't take
 * down the bars.
 */
import { Suspense, useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router';
import { GROUP_LABEL, GROUP_ORDER, moduleForPath, navModules, navOwner, tabModules } from '../app/modules';
import { useNewsUnseen } from '../features/news/news';
import { useAuth } from '../lib/auth';
import { t } from '../lib/i18n';
import { readString, writeString } from '../lib/storage';
import { Badge, Button, ErrorBoundary, Icon, LoadingState, useToast } from '../ui';
import { Avatar } from './Avatar';
import { MenuSheet } from './MenuSheet';
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
  const [sheet, setSheet] = useState<null | 'notifications' | 'profile' | 'menu'>(null);
  const mainRef = useRef<HTMLElement>(null);
  const current = moduleForPath(location.pathname);
  const owner = navOwner(current);
  const title = current ? t(current.label) : t('app.name');
  const newsUnseen = useNewsUnseen(location.pathname);

  useEffect(() => {
    document.title = `${title} · ${t('app.name')}`;
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
  const isOn = (id: string, isActive: boolean) => isActive || owner === id;

  return (
    <div className={[s.shell, collapsed && s.collapsed].filter(Boolean).join(' ')}>
      <a className={s.skip} href="#main">
        Skip to content
      </a>

      {/* ---------- desktop sidebar ---------- */}
      <aside className={s.sidebar}>
        <div className={s.brandRow}>
          <Link to="/dashboard" className={s.brand} aria-label={t('app.name')}>
            <img src={BRAND_ICON} alt="" width={28} height={28} />
            <span className={s.brandText}>{t('app.name')}</span>
          </Link>
          <Button variant="ghost" iconOnly size="sm" onClick={toggleCollapsed} aria-label={collapsed ? t('nav.expand') : t('nav.collapse')} aria-pressed={collapsed} className={s.collapseBtn}>
            <Icon name="sidebar" size={18} />
          </Button>
        </div>
        <nav className={s.sideNav} aria-label={t('nav.main')}>
          {GROUP_ORDER.map((g) => {
            const list = navModules().filter((m) => m.group === g);
            return (
              <div key={g} className={s.navGroup}>
                {g !== 'main' && <div className={s.groupLabel}>{t(GROUP_LABEL[g])}</div>}
                {list.map((m) => (
                  <NavLink key={m.id} to={`/${m.path}`} title={collapsed ? t(m.label) : undefined} className={({ isActive }) => [s.navItem, isActive && s.active].filter(Boolean).join(' ')}>
                    <Icon name={m.icon} />
                    <span className={s.navText}>{t(m.label)}</span>
                    {m.id === 'news' && newsUnseen && <NewMark className={s.newDot} />}
                  </NavLink>
                ))}
              </div>
            );
          })}
        </nav>
      </aside>

      {/* ---------- top bar ---------- */}
      <header className={s.topbar}>
        <Link to="/dashboard" className={s.topBrand} aria-label={t('app.name')}>
          <img src={BRAND_ICON} alt="" width={26} height={26} />
        </Link>
        <div className={s.topTitle}>{title}</div>
        <div className={s.topActions}>
          {!isReal && (
            <Button variant="primary" size="sm" onClick={signIn} className={s.signInBtn}>
              {t('auth.signIn')}
            </Button>
          )}
          <button type="button" className={s.avatarBtn} aria-label={t('nav.profile')} onClick={() => setSheet('profile')}>
            <Avatar user={user} />
          </button>
          <Button variant="ghost" iconOnly size="lg" aria-label={inbox.unread ? `${t('notifications.open')} (${t('notifications.unread', { count: inbox.unread })})` : t('notifications.open')} onClick={() => setSheet('notifications')} className={s.bellBtn}>
            <Icon name="bell" />
            {inbox.unread > 0 && (
              <Badge tone="count" className={s.bellCount}>
                {inbox.unread > 9 ? '9+' : inbox.unread}
              </Badge>
            )}
          </Button>
          <Button variant="ghost" iconOnly size="lg" aria-label={t('nav.openMenu')} aria-haspopup="dialog" onClick={() => setSheet('menu')} className={s.menuBtn}>
            <Icon name="menu" />
          </Button>
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
          <NavLink key={m.id} to={`/${m.path}`} className={({ isActive }) => [s.tab, isOn(m.id, isActive) && s.active].filter(Boolean).join(' ')}>
            <span className={s.tabIcon}>
              <Icon name={m.icon} size={22} />
            </span>
            <span className={s.tabLabel}>{t(m.label)}</span>
            {m.id === 'news' && newsUnseen && <NewMark className={s.tabDot} />}
          </NavLink>
        ))}
      </nav>

      <NotificationsSheet open={sheet === 'notifications'} onClose={() => setSheet(null)} signedIn={isReal} items={inbox.items} error={inbox.error} onSignIn={signIn} />
      <ProfileSheet open={sheet === 'profile'} onClose={() => setSheet(null)} />
      <MenuSheet open={sheet === 'menu'} onClose={() => setSheet(null)} />
    </div>
  );
}

/** The "new posts" dot: a visual dot, read out as ", new posts" after the link's name. */
function NewMark({ className }: { className?: string }) {
  return (
    <>
      <span className={className} aria-hidden="true" data-new-dot="" />
      <span className="visually-hidden">, {t('news.unseen')}</span>
    </>
  );
}
