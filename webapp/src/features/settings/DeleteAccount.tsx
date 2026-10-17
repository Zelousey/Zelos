/**
 * Delete your account (account_delete in functions/main.py), as the Privacy Policy promises.
 * The server wants a sign-in from the last 10 minutes, so you confirm who you are first
 * (Apple or Google again, or your password), then type DELETE. For Sign in with Apple the
 * app also revokes Apple's token, as Apple requires when an account is deleted. Purchase records are kept by the
 * server for legal reasons; everything else about you is removed and you're signed out.
 */
import { EmailAuthProvider, OAuthProvider, reauthenticateWithCredential, reauthenticateWithPopup, revokeAccessToken } from 'firebase/auth';
import { useId, useState } from 'react';
import { useNavigate } from 'react-router';
import { providerFor, useAuth } from '../../lib/auth';
import { auth } from '../../lib/firebase';
import { isNative } from '../../lib/platform';
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
  const social = providers.includes('apple.com') ? 'apple' : providers.includes('google.com') ? 'google' : null;
  const usesPassword = !social && providers.includes('password');

  async function remove() {
    if (!user || typed.trim() !== 'DELETE') return;
    setBusy(true);
    setMsg(t('del.confirming'));
    try {
      if (social && isNative()) {
        // the iPhone app: the native Apple / Google sheet, then revoke Sign in with Apple with Apple's code
        const { nativeReauth } = await import('../../lib/nativeAuth');
        const r = await nativeReauth(user, social);
        if (!r) throw Object.assign(new Error('cancelled'), { code: 'auth/popup-closed-by-user' });
        if (r.appleCode) await revokeAccessToken(auth(), r.appleCode).catch(() => undefined);
      } else if (social === 'apple') {
        const cred = OAuthProvider.credentialFromResult(await reauthenticateWithPopup(user, providerFor('apple')));
        if (cred?.accessToken) await revokeAccessToken(auth(), cred.accessToken).catch(() => undefined);
      } else if (social === 'google') await reauthenticateWithPopup(user, providerFor('google'));
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
