/**
 * Once per account: agree to the Terms of Use and the community rules before using Zelos
 * signed in (App Store guideline 1.2: no tolerance for objectionable content or abusive users).
 * Mounted in the app shell; it shows nothing for guests or once you've agreed.
 */
import { useId, useState } from 'react';
import { useAuth } from '../../lib/auth';
import { t } from '../../lib/i18n';
import { PRIVACY_URL, TERMS_URL } from '../../lib/platform';
import { useUserDoc } from '../../data/userDoc';
import { Button, Sheet, useToast } from '../../ui';
import { acceptTerms, termsAcceptedHere } from './safety';
import s from './Safety.module.css';

export function TermsGate() {
  const { user, isReal, signOut } = useAuth();
  const uid = isReal && user ? user.uid : null;
  const me = useUserDoc(uid);
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const id = useId();
  const loaded = me.status === 'ready' || me.status === 'missing';
  const agreed = (me.status === 'ready' && me.data.termsAt != null) || (uid != null && (done === uid || termsAcceptedHere(uid)));
  const open = !!uid && loaded && !agreed;
  async function agree() {
    if (!uid) return;
    setBusy(true);
    try {
      await acceptTerms(uid);
      setDone(uid);
    } catch {
      toast.show(t('sf.failed'), 'error');
    } finally {
      setBusy(false);
    }
  }
  return (
    <Sheet open={open} onClose={() => {}} placement="center" labelledBy={`${id}-terms`}>
      <div className={s.gate}>
        <h2 id={`${id}-terms`}>{t('sf.terms.title')}</h2>
        <p className={s.muted}>{t('sf.terms.body')}</p>
        <ul>
          <li>{t('sf.terms.r1')}</li>
          <li>{t('sf.terms.r2')}</li>
          <li>{t('sf.terms.r3')}</li>
          <li>{t('sf.terms.r4')}</li>
        </ul>
        <p className={s.muted}>
          {t('sf.terms.agree1')}{' '}
          <a href={TERMS_URL} target="_blank" rel="noopener noreferrer">
            {t('settings.terms')}
          </a>{' '}
          {t('sf.terms.agree2')}{' '}
          <a href={PRIVACY_URL} target="_blank" rel="noopener noreferrer">
            {t('settings.privacy')}
          </a>
          .
        </p>
        <Button variant="primary" block autoFocus disabled={busy} onClick={() => void agree()}>
          {t('sf.terms.accept')}
        </Button>
        <Button variant="ghost" block disabled={busy} onClick={() => void signOut()}>
          {t('auth.signOut')}
        </Button>
      </div>
    </Sheet>
  );
}
