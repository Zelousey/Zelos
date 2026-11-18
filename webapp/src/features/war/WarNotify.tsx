/**
 * War zone notifications are off until you turn them on here (owner 2026-11-18): the War zone runs
 * on a simulated market while it's being built, so it doesn't buzz anyone who hasn't asked. The
 * switch is users/{uid}.notificationPrefs.types.war (the server only sends "war" kinds when true).
 */
import { doc, setDoc } from 'firebase/firestore';
import { useState } from 'react';
import { useUserDoc } from '../../data/userDoc';
import { db } from '../../lib/firebase';
import { t } from '../../lib/i18n';
import { Button, useToast } from '../../ui';
import { isOn, toggle } from '../alerts/alerts';
import s from './War.module.css';

export function WarNotify({ uid }: { uid: string }) {
  const user = useUserDoc(uid); // the shared users/{uid} parser (liveDoc keeps one per path)
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  if (user.status !== 'ready') return null;
  const prefs = user.data.prefs;
  const on = isOn(prefs, 'war');
  const flip = async () => {
    setBusy(true);
    try {
      await setDoc(doc(db(), 'users', uid), toggle(prefs, 'war', !on), { merge: true });
      toast.show(t(on ? 'war.notify.offDone' : 'war.notify.onDone'), 'success');
    } catch {
      toast.show(t('war.notify.failed'), 'error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className={s.notifyRow}>
      <span>{t(on ? 'war.notify.onNote' : 'war.notify.offNote')}</span>
      <Button size="sm" variant={on ? 'ghost' : 'secondary'} onClick={() => void flip()} disabled={busy}>
        {t(on ? 'war.notify.turnOff' : 'war.notify.turnOn')}
      </Button>
    </div>
  );
}
