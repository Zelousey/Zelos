import { useState } from 'react';
import { Link } from 'react-router';
import { acceptInvite, errorText, respondChallenge } from '../features/invites/invites';
import { t } from '../lib/i18n';
import { formatRelative } from '../lib/format';
import { classicUrl } from '../lib/platform';
import { Button, EmptyState, ErrorState, Sheet, useToast } from '../ui';
import type { InboxItem } from './useInbox';
import s from './Shell.module.css';

/**
 * Server links are site paths like "practice/war.html?w=…" (with or without a leading
 * slash); only same-site paths are followed. App paths ("app/i/CODE") and profile links stay in the app.
 */
export function safeLink(link?: string): { app?: string; href?: string } {
  if (!link || link.startsWith('//') || !/^\/?[A-Za-z0-9_\-./?=&%#]*$/.test(link)) return {};
  const path = link.replace(/^\//, '');
  if (path.startsWith('app/')) return { app: '/' + path.slice(4) };
  const prof = /^practice\/profile\.html\?u=([A-Za-z0-9]{10,40})$/.exec(path); // friend notifications open the in-app profile
  if (prof) return { app: `/profile/${prof[1]}` };
  return { href: classicUrl(path) };
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
                ) : to.href ? (
                  <a className={s.notifItem} href={to.href}>
                    {content}
                  </a>
                ) : (
                  <div className={s.notifItem}>{content}</div>
                )}
                {n.action && <Actions item={n} onClose={onClose} />}
              </li>
            );
          })}
        </ul>
      )}
    </Sheet>
  );
}

/** Accept (and for Trade War challenges, Decline) right from the bell. */
function Actions({ item, onClose }: { item: InboxItem; onClose: () => void }) {
  const toast = useToast();
  const [state, setState] = useState<'idle' | 'busy' | 'accepted' | 'declined'>('idle');
  const a = item.action!;
  async function run(accept: boolean) {
    setState('busy');
    try {
      if (a.type === 'invite') {
        await acceptInvite(a.code);
        setState('accepted');
      } else {
        const r = await respondChallenge(a.id, accept);
        setState(r.status === 'accepted' ? 'accepted' : 'declined');
        if (r.status === 'expired') toast.show(t('land.expired'));
      }
    } catch (e) {
      setState('idle');
      toast.show(errorText(e, t('land.failed')), 'error');
    }
  }
  if (state === 'accepted' || state === 'declined')
    return (
      <p className={s.notifDone} role="status">
        {state === 'accepted' ? t('bell.accepted') : t('bell.declined')}
        {state === 'accepted' && a.type === 'invite' && (
          <>
            {' · '}
            <Link to={`/i/${a.code}`} onClick={onClose}>
              {t('bell.open')} →
            </Link>
          </>
        )}
      </p>
    );
  return (
    <div className={s.notifActions}>
      <Button size="sm" variant="primary" disabled={state === 'busy'} onClick={() => void run(true)}>
        {t('bell.accept')}
      </Button>
      {a.type === 'tw' && (
        <Button size="sm" variant="ghost" disabled={state === 'busy'} onClick={() => void run(false)}>
          {t('bell.decline')}
        </Button>
      )}
    </div>
  );
}
