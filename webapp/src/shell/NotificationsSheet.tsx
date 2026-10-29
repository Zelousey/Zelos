import { Link } from 'react-router';
import { t } from '../lib/i18n';
import { formatRelative } from '../lib/format';
import { Button, EmptyState, ErrorState, Sheet } from '../ui';
import { InviteCard } from './InviteCard';
import type { InboxItem } from './useInbox';
import s from './Shell.module.css';

/**
 * Server links are site paths like "practice/war.html?w=…" (with or without a leading
 * slash). Each kind maps to its screen in the app; anything else isn't a link (the app never
 * hands off to the website).
 */
export function safeLink(link?: string): { app?: string } {
  if (!link || link.startsWith('//') || !/^\/?[A-Za-z0-9_\-./?=&%#]*$/.test(link)) return {};
  const path = link.replace(/^\//, '');
  if (path.startsWith('app/')) return { app: '/' + path.slice(4) };
  const prof = /^practice\/profile\.html\?u=([A-Za-z0-9]{10,40})$/.exec(path); // friend notifications
  if (prof) return { app: `/profile/${prof[1]}` };
  const war = /^practice\/war\.html\?w=([A-Za-z0-9]{12})$/.exec(path); // battle notifications
  if (war) return { app: `/battles/${war[1]}` };
  const comm = /^practice\/communities\.html(?:\?c=([a-z0-9-]{3,80}))?$/.exec(path); // community notifications
  if (comm) return { app: comm[1] ? `/communities/${comm[1]}` : '/communities' };
  const squad = /^practice\/squads\.html\?s=([A-Za-z0-9_-]{6,40})$/.exec(path); // someone joined your squad
  if (squad) return { app: `/social/${squad[1]}` };
  const alert = /^alert\.html\?id=([a-z-]+-\d{4}-\d{2}-\d{2})$/.exec(path); // a strategy alert
  if (alert) return { app: `/alerts/${alert[1]}` };
  if (path === 'practice/index.html') return { app: '/battles' }; // challenges and cancelled battles
  if (path === 'dashboard.html') return { app: '/dashboard' };
  return {};
}

export function NotificationsSheet({ open, onClose, signedIn, items, error, onSignIn }: { open: boolean; onClose: () => void; signedIn: boolean; items: InboxItem[]; error: boolean; onSignIn: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title={t('notifications.title')} labelledBy="notif-title">
      {!signedIn ? (
        <EmptyState icon="bell" body={t('notifications.signedOut')} actions={<Button variant="primary" onClick={onSignIn}>{t('auth.signIn')}</Button>} compact />
      ) : error ? (
        <ErrorState compact />
      ) : items.length === 0 ? (
        <EmptyState icon="bell" title={t('notifications.empty')} compact />
      ) : (
        <ul className={s.notifList}>
          {items.map((n) => {
            const to = safeLink(n.link);
            const content = (
              <>
                <span className={s.notifTitle}>
                  {!n.read && <span className={s.dot} aria-hidden />}
                  {n.title}
                </span>
                {n.body && <span className={s.notifBody}>{n.body}</span>}
                <span className={s.notifTime}>{formatRelative(n.at)}</span>
              </>
            );
            return (
              <li key={n.id}>
                {to.app ? (
                  <Link className={s.notifItem} to={to.app} onClick={onClose}>
                    {content}
                  </Link>
                ) : (
                  <div className={s.notifItem}>{content}</div>
                )}
                {n.action && <InviteCard action={n.action} onClose={onClose} />}
              </li>
            );
          })}
        </ul>
      )}
    </Sheet>
  );
}
