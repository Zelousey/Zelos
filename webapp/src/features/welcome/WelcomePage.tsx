/**
 * Welcome (/welcome): the first sign-in, in three short screens (owner decision 2026-10-08).
 *   1. Name, @username (checked live, saved by the server) and, optionally, experience.
 *   2. The $10,000 practice account (virtual money).
 *   3. The first trade: pick a stock to open its chart.
 * "Skip for now" remembers the choice on this device; the First steps checklist on the
 * Dashboard keeps the same steps.
 */
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useUserDoc, type Experience } from '../../data/userDoc';
import { useAuth } from '../../lib/auth';
import { t, type MessageKey } from '../../lib/i18n';
import { Button, buttonClass, EmptyState, Field, LoadingState, useToast } from '../../ui';
import { useIdentity } from '../dashboard/social';
import { errorText } from '../invites/invites';
import { openAccount } from '../practice/actions';
import { usePracticeAccount } from '../practice/account';
import { checkUsername, lsSet, profileSetup, SKIP_KEY, suggestUsername, USERNAME_RE, type Availability } from './welcome';
import s from './Welcome.module.css';

const ICON = `${import.meta.env.BASE_URL}icons/icon-192.png`;
const STARTERS = ['AAPL', 'MSFT', 'NVDA', 'TSLA', 'AMZN'];
const EXPERIENCE: Experience[] = ['new', 'some', 'pro'];

export default function WelcomePage() {
  const { user, isReal, ready, signInWithGoogle } = useAuth();
  const toast = useToast();
  if (!ready) return <LoadingState rows={4} />;
  if (!isReal || !user)
    return (
      <EmptyState
        icon="profile"
        body={t('wel.signIn')}
        actions={
          <Button variant="primary" onClick={() => void signInWithGoogle().catch(() => toast.show(t('auth.signInFailed'), 'error'))}>
            {t('auth.signInWithGoogle')}
          </Button>
        }
      />
    );
  return <Flow uid={user.uid} googleName={user.displayName ?? ''} />;
}

function Flow({ uid, googleName }: { uid: string; googleName: string }) {
  const navigate = useNavigate();
  const identity = useIdentity(uid);
  const me = useUserDoc(uid);
  const [step, setStep] = useState(0);
  const skip = () => {
    lsSet(SKIP_KEY, '1');
    navigate('/dashboard');
  };
  const experience = me.status === 'ready' ? me.data.experience : null;

  return (
    <div className={s.wrap}>
      <div className={s.top}>
        <img src={ICON} alt="" width={36} height={36} className={s.logo} />
        <ol className={s.dots} aria-label={t('wel.step', { n: step + 1, of: 3 })}>
          {[0, 1, 2].map((i) => (
            <li key={i} className={i === step ? s.dotOn : i < step ? s.dotDone : s.dot} aria-current={i === step ? 'step' : undefined} />
          ))}
        </ol>
        <button type="button" className={s.skip} onClick={skip}>
          {t('wel.skip')}
        </button>
      </div>
      <div className={s.panel} key={step}>
        {step === 0 &&
          (identity.status === 'loading' || me.status === 'loading' ? (
            <LoadingState rows={4} />
          ) : (
            <ProfileStep
              uid={uid}
              initialName={(identity.status === 'ready' && identity.data.name) || googleName.split(' ')[0] || ''}
              initialUsername={identity.status === 'ready' ? identity.data.username : null}
              initialExperience={experience}
              onDone={() => setStep(1)}
            />
          ))}
        {step === 1 && <AccountStep uid={uid} onDone={() => setStep(2)} />}
        {step === 2 && <TradeStep experience={experience} />}
      </div>
    </div>
  );
}

function ProfileStep({ uid, initialName, initialUsername, initialExperience, onDone }: { uid: string; initialName: string; initialUsername: string | null; initialExperience: Experience | null; onDone: () => void }) {
  const toast = useToast();
  const [name, setName] = useState(initialName);
  const [username, setUsername] = useState(() => initialUsername ?? (initialName ? suggestUsername(initialName) : ''));
  const [exp, setExp] = useState<Experience | null>(initialExperience);
  const [checked, setChecked] = useState<{ u: string; a: Availability } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const u = username.trim().replace(/^@/, '').toLowerCase();

  // availability, a moment after typing stops
  useEffect(() => {
    if (!USERNAME_RE.test(u)) return;
    let live = true;
    const id = setTimeout(() => {
      checkUsername(u, uid)
        .then((a) => live && setChecked({ u, a }))
        .catch(() => live && setChecked({ u, a: 'free' })); // the server checks again when saving
    }, 350);
    return () => {
      live = false;
      clearTimeout(id);
    };
  }, [u, uid]);
  const avail: Availability = !USERNAME_RE.test(u) ? 'invalid' : checked?.u === u ? checked.a : 'checking';
  const userMsg = avail === 'invalid' ? (u ? t('wel.username.hint') : undefined) : avail === 'taken' ? t('wel.username.taken', { u }) : undefined;
  const userHint = avail === 'free' ? t('wel.username.free', { u }) : avail === 'mine' ? t('wel.username.mine', { u }) : avail === 'checking' ? t('wel.username.checking') : t('wel.username.hint');
  const canSave = !busy && name.trim().length > 0 && (avail === 'free' || avail === 'mine');

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!canSave) return;
    setBusy(true);
    setErr(null);
    try {
      const r = await profileSetup({ name: name.trim(), username: u, ...(exp ? { experience: exp } : {}) });
      toast.show(r.awarded ? `${t('wel.saved')} · +25 XP` : t('wel.saved'));
      onDone();
    } catch (e2) {
      setErr(errorText(e2, t('wel.failed')));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className={s.form}>
      <h1 className={s.title}>{t('wel.1.title')}</h1>
      <p className={s.body}>{t('wel.1.body')}</p>
      <Field label={t('wel.name')} value={name} maxLength={24} autoComplete="nickname" onChange={(e) => setName(e.target.value)} />
      <Field label={t('wel.username')} prefix="@" value={username} maxLength={21} autoCapitalize="none" autoCorrect="off" spellCheck={false} onChange={(e) => setUsername(e.target.value.toLowerCase())} error={userMsg} hint={userMsg ? undefined : userHint} />
      <fieldset className={s.exp}>
        <legend>{t('wel.exp')}</legend>
        <div className={s.chips}>
          {EXPERIENCE.map((x) => (
            <label key={x} className={[s.chip, exp === x && s.chipOn].filter(Boolean).join(' ')}>
              <input type="radio" name="experience" value={x} checked={exp === x} onChange={() => setExp(x)} />
              {t(`wel.exp.${x}` as MessageKey)}
            </label>
          ))}
        </div>
        <span className={s.muted}>{t('wel.exp.optional')}</span>
      </fieldset>
      {err && (
        <p className={s.error} role="alert">
          {err}
        </p>
      )}
      <Button type="submit" variant="primary" size="lg" block disabled={!canSave}>
        {t('wel.continue')}
      </Button>
    </form>
  );
}

function AccountStep({ uid, onDone }: { uid: string; onDone: () => void }) {
  const toast = useToast();
  const acct = usePracticeAccount(uid);
  const [busy, setBusy] = useState(false);
  const has = acct.status === 'ready' && !!acct.data;
  async function open() {
    setBusy(true);
    try {
      await openAccount();
      onDone();
    } catch (e) {
      toast.show(errorText(e, t('wel.failed')), 'error');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className={s.form}>
      <div className={s.money} aria-hidden="true">
        $10,000
      </div>
      <h1 className={s.title}>{t('wel.2.title')}</h1>
      <p className={s.body}>{t('wel.2.body')}</p>
      {acct.status === 'loading' ? (
        <LoadingState rows={1} />
      ) : has ? (
        <>
          <p className={s.ready} role="status">
            <span aria-hidden="true">✓</span> {t('wel.2.ready')}
          </p>
          <Button variant="primary" size="lg" block onClick={onDone}>
            {t('wel.continue')}
          </Button>
        </>
      ) : (
        <Button variant="primary" size="lg" block disabled={busy} onClick={() => void open()}>
          {busy ? t('wel.2.opening') : t('wel.2.open')}
        </Button>
      )}
    </div>
  );
}

function TradeStep({ experience }: { experience: Experience | null }) {
  return (
    <div className={s.form}>
      <h1 className={s.title}>{t('wel.3.title')}</h1>
      <p className={s.body}>{experience === 'new' ? t('wel.3.body.new') : t('wel.3.body')}</p>
      <ul className={s.stocks}>
        {STARTERS.map((sym) => (
          <li key={sym}>
            <Link to={`/markets/${sym}`} className={s.stock}>
              {sym}
            </Link>
          </li>
        ))}
      </ul>
      {experience === 'new' && (
        <p className={s.coach}>
          {t('wel.3.coach')} <Link to="/coach">{t('wel.3.findCoach')}</Link>
        </p>
      )}
      <Link to="/dashboard" className={buttonClass({ variant: 'ghost', block: true })}>
        {t('wel.3.later')}
      </Link>
    </div>
  );
}
