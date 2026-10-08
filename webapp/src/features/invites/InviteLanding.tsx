/**
 * What an invite link opens (/i/:code): who invited you to what, then Accept. Works signed
 * out (the invite preview is public); accepting needs an account. After accepting, a short
 * celebration and the next step: the battle room, the squad, or the $10,000 account.
 */
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useAuth } from '../../lib/auth';
import { formatMoney } from '../../lib/format';
import { t } from '../../lib/i18n';
import { classicUrl } from '../../lib/platform';
import { useNow } from '../../lib/useNow';
import { Badge, Button, buttonClass, Card, EmptyState, Icon, Skeleton, useToast } from '../../ui';
import { Celebrate } from './Celebrate';
import { acceptInvite, CODE_RE, copyText, errorText, useInvite, type Accepted, type Invite } from './invites';
import s from './Invites.module.css';

export default function InviteLanding() {
  const code = useParams().code ?? '';
  const inv = useInvite(CODE_RE.test(code) ? code : null);
  if (!CODE_RE.test(code) || inv.status === 'missing' || inv.status === 'error')
    return (
      <div className={s.landing}>
        <Card pad>
          <EmptyState
            icon="invite"
            title={t('land.missing')}
            body={t('land.missing.body')}
            actions={
              <Link className={buttonClass({ variant: 'secondary' })} to="/dashboard">
                {t('land.goDashboard')}
              </Link>
            }
          />
        </Card>
      </div>
    );
  if (inv.status === 'loading')
    return (
      <div className={s.landing} aria-busy="true">
        <Card pad>
          <p className="visually-hidden" role="status">
            {t('land.loading')}
          </p>
          <Skeleton height={200} />
        </Card>
      </div>
    );
  return <Landing inv={inv.data} />;
}

function Landing({ inv }: { inv: Invite }) {
  const { user, isReal, ready, signInWithGoogle } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const now = useNow();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<Accepted | null>(null);
  const [error, setError] = useState<string | null>(null);
  const own = !!user && user.uid === inv.from;
  const closed = inv.status !== 'open' ? 'cancelled' : now >= inv.expiresAt ? 'expired' : null;

  async function accept() {
    setBusy(true);
    setError(null);
    try {
      setDone(await acceptInvite(inv.code));
    } catch (e) {
      setError(errorText(e, t('land.failed')));
    } finally {
      setBusy(false);
    }
  }

  if (done) return <Done inv={inv} res={done} />;

  const what = inv.kind === 'battle' ? t('land.battle') : inv.kind === 'squad' ? t('land.squad') : inv.kind === 'coach' ? t('land.coach') : t('land.join');
  return (
    <div className={s.landing}>
      <Card pad className={s.landCard}>
        <div className={s.inviter}>
          {inv.fromPhoto ? <img src={inv.fromPhoto} alt="" width={64} height={64} referrerPolicy="no-referrer" /> : <span aria-hidden>{inv.fromName.slice(0, 1).toUpperCase()}</span>}
        </div>
        <h1 className={s.landTitle}>
          {t('land.invited', { name: inv.fromName })} <span>{what}</span>
        </h1>
        {inv.fromUsername && <p className={s.muted}>@{inv.fromUsername}</p>}
        {inv.kind === 'battle' && (
          <p className={s.detail}>
            <Icon name="war" size={18} />{' '}
            {t('land.battleDetail', { war: inv.warName ?? 'Trade War', buyIn: formatMoney(inv.buyIn ?? 0, { digits: 0 }), days: inv.days === 1 ? t('inv.battle.day1') : t('inv.battle.daysN', { n: inv.days ?? 0 }) })}
          </p>
        )}
        {inv.kind === 'squad' && (
          <p className={s.detail}>
            <Icon name="social" size={18} /> {inv.squadName}
          </p>
        )}
        {inv.kind === 'coach' && <p className={s.detail}>{t('land.coachSees')}</p>}
        <ul className={s.perks}>
          {(['land.perk1', 'land.perk2', 'land.perk3'] as const).map((k) => (
            <li key={k}>
              <Icon name="missions" size={14} /> {t(k)}
            </li>
          ))}
        </ul>
        <Badge tone="accent">{t('practice.virtual')}</Badge>

        {closed ? (
          <div className={s.closed} role="status">
            <b>{closed === 'cancelled' ? t('land.cancelled') : t('land.expired')}</b>
            <span>{t('land.ask', { name: inv.fromName })}</span>
          </div>
        ) : own ? (
          <div className={s.closed} role="status">
            <b>{t('land.own')}</b>
            <span>{t('land.own.body')}</span>
            <Button variant="secondary" onClick={() => void copyText(location.href).then((r) => toast.show(r === 'copied' ? t('inv.copied') : t('inv.copyFailed'), r === 'copied' ? undefined : 'error'))}>
              <Icon name="copy" size={18} /> {t('inv.copy')}
            </Button>
          </div>
        ) : !ready ? (
          <Skeleton height={48} />
        ) : !isReal ? (
          <Button variant="primary" size="lg" block onClick={() => void signInWithGoogle().catch(() => toast.show(t('auth.signInFailed'), 'error'))}>
            {t('land.signIn')}
          </Button>
        ) : (
          <div className={s.actions}>
            <Button variant="primary" size="lg" block disabled={busy} onClick={() => void accept()}>
              {t('land.accept')}
            </Button>
            <Button variant="ghost" onClick={() => navigate('/dashboard')}>
              {t('land.notNow')}
            </Button>
          </div>
        )}
        {error && (
          <p className={s.error} role="alert">
            {error}
          </p>
        )}
      </Card>
    </div>
  );
}

function Done({ inv, res }: { inv: Invite; res: Accepted }) {
  const title = res.kind === 'battle' ? t('land.done.battle') : res.kind === 'squad' ? t('land.done.squad', { squad: inv.squadName ?? 'the squad' }) : res.kind === 'coach' ? t('land.done.coach') : t('land.done.join');
  const next =
    res.kind === 'coach' && res.coachingId ? (
      <Link className={buttonClass({ variant: 'primary', size: 'lg', block: true })} to={`/coach/${encodeURIComponent(res.coachingId)}`}>
        {t('land.goCoach')}
      </Link>
    ) : res.kind === 'battle' && res.warId ? (
      <a className={buttonClass({ variant: 'primary', size: 'lg', block: true })} href={classicUrl(`practice/war.html?w=${encodeURIComponent(res.warId)}`)}>
        {t('land.goBattle')}
      </a>
    ) : res.kind === 'squad' && res.squadId ? (
      <a className={buttonClass({ variant: 'primary', size: 'lg', block: true })} href={classicUrl(`practice/squads.html?s=${encodeURIComponent(res.squadId)}`)}>
        {t('land.goSquad')}
      </a>
    ) : (
      <Link className={buttonClass({ variant: 'primary', size: 'lg', block: true })} to="/practice">
        {t('land.goPractice')}
      </Link>
    );
  return (
    <div className={s.landing}>
      <Card pad className={s.landCard}>
        <Celebrate />
        <h1 className={s.landTitle} role="status">
          {title}
        </h1>
        {res.referral && res.xp > 0 && <p className={s.xpChip}>{t('land.done.xp', { xp: res.xp })}</p>}
        {!res.again && <p className={s.muted}>{t('land.done.friends', { name: inv.fromName })}</p>}
        <div className={s.actions}>
          {next}
          <Link className={buttonClass({ variant: 'ghost' })} to="/dashboard">
            {t('land.goDashboard')}
          </Link>
        </div>
      </Card>
    </div>
  );
}
