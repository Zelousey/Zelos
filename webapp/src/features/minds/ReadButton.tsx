/** "Done reading": ticks a lesson or pair on your account and asks the server for its XP (once). */
import { useState } from 'react';
import { useAuth } from '../../lib/auth';
import { t } from '../../lib/i18n';
import { Badge, Button, useToast } from '../../ui';
import { markMind, MIND_XP, mindXp } from './minds';
import s from './Minds.module.css';

export function ReadButton({ refId, done }: { refId: string; done: boolean }) {
  const { user, isReal, openSignIn } = useAuth();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  if (done) return <Badge tone="up">{t('hm.done')}</Badge>;
  if (!isReal || !user) {
    return (
      <Button variant="ghost" size="sm" onClick={() => void openSignIn()}>
        {t('hm.signInXp', { xp: MIND_XP })}
      </Button>
    );
  }
  return (
    <Button
      size="sm"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await markMind(user.uid, refId);
          const r = await mindXp(refId).catch(() => ({ awarded: false }));
          toast.show(r.awarded ? t('hm.xp', { xp: MIND_XP }) : t('hm.saved'), 'success');
        } catch {
          toast.show(t('qz.failed'), 'error');
        } finally {
          setBusy(false);
        }
      }}
    >
      <span className={s.readBtn}>{t('hm.markRead', { xp: MIND_XP })}</span>
    </Button>
  );
}
