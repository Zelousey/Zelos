/**
 * The sign-in sheet every "Sign in" button opens: Continue with Apple or Continue with Google,
 * with the Terms and Privacy Policy. App Store guideline 4.8: an app with Google sign-in must
 * also offer Sign in with Apple, shown just as prominently (Apple's button style: black or
 * white with the Apple logo).
 */
import { useId, useState } from 'react';
import { useAuth, type SignInProvider } from '../lib/auth';
import { t } from '../lib/i18n';
import { PRIVACY_URL, TERMS_URL } from '../lib/platform';
import { Sheet, useToast } from '../ui';
import s from './Shell.module.css';

const APPLE = 'M16.37 12.6c-.02-2.3 1.88-3.4 1.96-3.46-1.07-1.56-2.73-1.78-3.32-1.8-1.41-.14-2.76.83-3.47.83-.72 0-1.82-.81-2.99-.79-1.54.02-2.96.9-3.75 2.27-1.6 2.78-.41 6.89 1.15 9.14.76 1.1 1.67 2.34 2.86 2.3 1.15-.05 1.58-.74 2.97-.74 1.38 0 1.77.74 2.98.72 1.23-.02 2.01-1.12 2.76-2.23.87-1.28 1.23-2.52 1.25-2.58-.03-.01-2.39-.92-2.41-3.66zM14.1 5.86c.63-.77 1.06-1.83.94-2.9-.91.04-2.02.61-2.67 1.37-.58.67-1.1 1.76-.96 2.8 1.02.08 2.06-.52 2.69-1.27z';

export function SignInSheet() {
  const { isReal, signInOpen, closeSignIn, signInWith } = useAuth();
  const toast = useToast();
  const [busy, setBusy] = useState<SignInProvider | null>(null);
  const id = useId();
  async function go(p: SignInProvider) {
    setBusy(p);
    try {
      await signInWith(p);
    } catch {
      toast.show(t('auth.signInFailed'), 'error');
    } finally {
      setBusy(null);
    }
  }
  return (
    <Sheet open={signInOpen && !isReal} onClose={closeSignIn} title={t('auth.title')} labelledBy={`${id}-signin`} placement="center">
      <div className={s.signIn}>
        <p className={s.signInLead}>{t('auth.lead')}</p>
        <button type="button" className={[s.provider, s.apple].join(' ')} disabled={!!busy} onClick={() => void go('apple')}>
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
            <path d={APPLE} fill="currentColor" />
          </svg>
          {t('auth.signInWithApple')}
        </button>
        <button type="button" className={[s.provider, s.google].join(' ')} disabled={!!busy} onClick={() => void go('google')}>
          <svg viewBox="0 0 48 48" width="20" height="20" aria-hidden="true">
            <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.3-.4-3.5z" />
            <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
            <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
            <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 38.2 44 33 44 24c0-1.3-.1-2.3-.4-3.5z" />
          </svg>
          {t('auth.signInWithGoogle')}
        </button>
        <p className={s.signInFine}>
          {t('auth.agree1')}{' '}
          <a href={TERMS_URL} target="_blank" rel="noopener noreferrer">
            {t('settings.terms')}
          </a>{' '}
          {t('auth.agree2')}{' '}
          <a href={PRIVACY_URL} target="_blank" rel="noopener noreferrer">
            {t('settings.privacy')}
          </a>
          .
        </p>
      </div>
    </Sheet>
  );
}
