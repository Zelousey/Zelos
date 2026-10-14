/**
 * Delete your account (account_delete in functions/main.py), as the Privacy Policy promises.
 * The server wants a sign-in from the last 10 minutes, so you confirm who you are first
 * (Google again, or your password), then type DELETE. Purchase records are kept by the
 * server for legal reasons; everything else about you is removed and you're signed out.
 */
import { EmailAuthProvider, GoogleAuthProvider, reauthenticateWithCredential, reauthenticateWithPopup } from 'firebase/auth';
import { useId, useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../../lib/auth';
import { callFunction } from '../../lib/firebase';
import { t } from '../../lib/i18n';
import { Button, Card, Field } from '../../ui';
import { errorText } from '../invites/invites';
import s from './SettingsPage.module.css';

export function DeleteAccount() {
  const { user, isReal, signOut } = useAuth();
  const navigate = useNavigate();
  const [typed, setTyped] = useState('');
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const id = useId();
  if (!isReal || !user) return null;
  const providers = user.providerData.map((p) => p.providerId);
  const usesPassword = !providers.includes('google.com') && providers.includes('password');

  async function remove() {
    if (!user || typed.trim() !== 'DELETE') return;
    setBusy(true);
    setMsg(t('del.confirming'));
    try {
      if (providers.includes('google.com')) await reauthenticateWithPopup(user, new GoogleAuthProvider());
      else if (usesPassword) await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email ?? '', pw));
      await user.getIdToken(true);
      setMsg(t('del.deleting'));
      await callFunction<{ confirm: string }, { deleted: boolean }>('account_delete', { confirm: 'DELETE' });
      try {
        Object.keys(localStorage)
          .filter((k) => /^zelos/i.test(k) && k !== 'zelosTheme')
          .forEach((k) => localStorage.removeItem(k));
      } catch {
        /* storage blocked: nothing to clear */
      }
      await signOut().catch(() => undefined);
      navigate('/', { replace: true });
    } catch (e) {
      const code = (e as { code?: string }).code;
      setMsg(code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request' ? t('del.cancelled') : code === 'auth/wrong-password' || code === 'auth/invalid-credential' ? t('del.badPassword') : errorText(e, t('del.failed')));
      setBusy(false);
    }
  }

  return (
    <Card title={t('del.title')} subtitle={t('del.body')}>
      <div className={s.danger}>
        <Field label={t('del.type')} value={typed} autoComplete="off" onChange={(e) => setTyped(e.target.value)} />
        {usesPassword && <Field label={t('del.password')} type="password" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} />}
        <Button variant="danger" disabled={busy || typed.trim() !== 'DELETE' || (usesPassword && !pw)} onClick={() => void remove()} aria-describedby={msg ? `${id}-msg` : undefined}>
          {t('del.button')}
        </Button>
        {msg && (
          <p id={`${id}-msg`} className={s.note} role="status">
            {msg}
          </p>
        )}
      </div>
    </Card>
  );
}
