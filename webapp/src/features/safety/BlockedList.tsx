/** Settings → Blocked traders: everyone you blocked, with Unblock. */
import { useState } from 'react';
import { useAuth } from '../../lib/auth';
import { t } from '../../lib/i18n';
import { useIdentity } from '../dashboard/social';
import { Button, Card, useToast } from '../../ui';
import { useBlocked } from './SafetyMenu';
import { unblock } from './safety';
import s from './Safety.module.css';

export function BlockedList() {
  const { user, isReal } = useAuth();
  const blocked = useBlocked();
  if (!isReal || !user) return null;
  return (
    <Card title={t('sf.blockedTitle')} subtitle={t('sf.blockedSub')} flush aria-label={t('sf.blockedTitle')}>
      {blocked.length ? (
        <ul className={s.list}>
          {blocked.map((u) => (
            <Row key={u} me={user.uid} who={u} />
          ))}
        </ul>
      ) : (
        <p className={s.empty}>{t('sf.blockedNone')}</p>
      )}
    </Card>
  );
}

function Row({ me, who }: { me: string; who: string }) {
  const id = useIdentity(who);
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const name = (id.status === 'ready' && id.data.name) || t('sf.someone');
  return (
    <li>
      <span>
        <b>{name}</b>
        {id.status === 'ready' && id.data.username && <small className={s.muted}> @{id.data.username}</small>}
      </span>
      <Button
        variant="secondary"
        size="sm"
        disabled={busy}
        onClick={() => {
          setBusy(true);
          unblock(me, who)
            .then(() => toast.show(t('sf.unblocked', { name })))
            .catch(() => toast.show(t('sf.failed'), 'error'))
            .finally(() => setBusy(false));
        }}
      >
        {t('sf.unblock', { name })}
      </Button>
    </li>
  );
}
