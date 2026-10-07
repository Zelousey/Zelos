import { t } from '../lib/i18n';
import { formatRelative } from '../lib/format';
import { classicUrl } from '../lib/platform';
import { Button, EmptyState, ErrorState, Sheet } from '../ui';
import type { InboxItem } from './useInbox';
import s from './Shell.module.css';

/** Server links are site paths like "/practice/war.html?id=…"; only same-site paths are followed. */
function safeLink(link?: string): string | undefined {
  if (!link || !/^\/[A-Za-z0-9_\-./?=&%#]*$/.test(link) || link.startsWith('//')) return undefined;
  return classicUrl(link);
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
            const href = safeLink(n.link);
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
            return <li key={n.id}>{href ? <a className={s.notifItem} href={href}>{content}</a> : <div className={s.notifItem}>{content}</div>}</li>;
          })}
        </ul>
      )}
    </Sheet>
  );
}
