import { useState } from 'react';
import { Link } from 'react-router';
import { acceptInvite, errorText, respondChallenge } from '../features/invites/invites';
import { parseBattle } from '../features/battles/battle';
import { useSlotGate } from '../features/battles/slots';
import { modeLines } from '../features/battles/parts';
import { useLiveDoc } from '../data/liveDoc';
import type { DocumentData } from 'firebase/firestore';
import { t } from '../lib/i18n';
import { formatRelative } from '../lib/format';
import { Button, EmptyState, ErrorState, Sheet, useToast } from '../ui';
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
  const slot = useSlotGate();
  const a = item.action!;
  async function run(accept: boolean) {
    setState('busy');
    try {
      if (a.type === 'invite') {
        setState((await slot.gate((x) => acceptInvite(a.code, x))) ? 'accepted' : 'idle');
      } else {
        const r = await slot.gate((x) => respondChallenge(a.id, accept, x));
        if (!r) return setState('idle'); // they said no to a paid battle slot
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
      {slot.dialog}
      {a.type === 'tw' && <ChallengeModes id={a.id} />}
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

// a challenge stores its modes like a battle (lms, modes) and squad battles' allowed stocks as `symbols`
const parseChallenge = (d: DocumentData) => parseBattle('', { ...d, rules: { symbols: d.symbols } });

/** What a Trade War challenge's game modes are, before you accept it (nothing for a classic battle). */
function ChallengeModes({ id }: { id: string }) {
  const inv = useLiveDoc(`twInvites/${id}`, parseChallenge);
  const lines = inv.status === 'ready' ? modeLines(inv.data) : [];
  if (!lines.length) return null;
  return (
    <ul className={s.notifModes} aria-label={t('bell.modes')}>
      {lines.map((l) => (
        <li key={l}>{l}</li>
      ))}
    </ul>
  );
}

