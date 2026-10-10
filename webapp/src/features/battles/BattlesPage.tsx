/** My battles (/battles): the Trade War matches you're in (running first), and starting a new one. */
import { Link } from 'react-router';
import { useAuth } from '../../lib/auth';
import { formatRelative } from '../../lib/format';
import { t } from '../../lib/i18n';
import { useNow } from '../../lib/useNow';
import { Badge, Button, buttonClass, Card, EmptyState, LoadingState, PageHeader, useToast } from '../../ui';
import { sortWars, useMyWars } from '../dashboard/social';
import { clock } from './parts';
import s from './Battles.module.css';

export default function BattlesPage() {
  const { user, isReal, ready, signInWithGoogle } = useAuth();
  const toast = useToast();
  const uid = isReal && user ? user.uid : null;
  const wars = useMyWars(uid);
  const now = useNow(30_000);
  const start = (
    <Link className={buttonClass({ variant: 'primary' })} to="/invite?kind=battle">
      {t('bt.new')}
    </Link>
  );
  return (
    <>
      <PageHeader title={t('nav.battles')} subtitle={t('bt.listSub')} actions={uid ? start : undefined} />
      {!ready ? (
        <LoadingState rows={4} />
      ) : !uid ? (
        <EmptyState icon="war" body={t('bt.signIn')} actions={<Button variant="primary" onClick={() => void signInWithGoogle().catch(() => toast.show(t('auth.signInFailed'), 'error'))}>{t('auth.signInWithGoogle')}</Button>} />
      ) : wars.status === 'loading' ? (
        <LoadingState rows={4} />
      ) : wars.status !== 'ready' || !wars.data.length ? (
        <EmptyState icon="war" title={t('bt.none')} body={t('bt.noneBody')} actions={start} />
      ) : (
        <Card flush>
          <ul className={s.battleList}>
            {sortWars(wars.data).map((w) => (
              <li key={w.id}>
                <Link to={`/battles/${w.id}`} className={s.battleRow}>
                  <b>{w.name}</b>
                  <span className={s.muted}>
                    {w.status === 'active'
                      ? t('bt.endsIn', { t: clock(w.endAt - now) })
                      : w.status === 'ended'
                        ? w.myRank
                          ? t('bt.finished', { rank: w.myRank, of: w.of })
                          : t('bt.status.ended')
                        : t('bt.playersShort', { n: w.players, max: w.maxPlayers })}
                    {' · '}
                    {formatRelative(w.createdAt)}
                  </span>
                  <Badge tone={w.status === 'active' ? 'up' : w.status === 'ended' ? 'neutral' : 'accent'}>{t(`bt.status.${w.status}`)}</Badge>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
