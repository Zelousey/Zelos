/**
 * Declined alerts (/alerts/declined, owner 2026-11-19): the strategy alerts you passed on. While a
 * trade is still live you can take it back for REACTIVATE_COST tokens (then take the trade on the
 * alert); once it finishes it's free for everyone to read.
 */
import { Link } from 'react-router';
import { useAuth } from '../../lib/auth';
import { formatDate } from '../../lib/format';
import { t } from '../../lib/i18n';
import { EmptyState, ErrorState, Icon, LoadingState, PageHeader } from '../../ui';
import { strategy } from '../strategies/strategies';
import { parseAlert, useAlertDoc } from './alerts';
import { ResultBadge, StatusBadge } from './Badges';
import { REACTIVATE_COST, useDecisions, type Decision } from './decisions';
import s from './Alerts.module.css';

export default function DeclinedPage() {
  const { user, isReal, openSignIn } = useAuth();
  const uid = isReal && user ? user.uid : null;
  const list = useDecisions(uid);
  const mine = list.status === 'ready' ? list.data.filter((d) => d.status === 'declined' || d.status === 'reactivated') : [];
  return (
    <>
      <Link to="/alerts" className={s.back}>
        ← {t('nav.alerts')}
      </Link>
      <PageHeader title={t('al.declined.title')} subtitle={t('al.declined.sub', { n: REACTIVATE_COST })} />
      {!uid ? (
        <EmptyState icon="signal" body={t('al.take.signIn')} actions={<button className={s.more} onClick={() => openSignIn()}>{t('auth.signIn')}</button>} />
      ) : list.status === 'loading' ? (
        <LoadingState rows={4} />
      ) : list.status === 'error' ? (
        <ErrorState compact />
      ) : !mine.length ? (
        <EmptyState icon="signal" body={t('al.declined.none')} />
      ) : (
        <ul className={s.rows}>
          {mine.map((d) => (
            <li key={d.id}>
              <DeclinedRow d={d} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function DeclinedRow({ d }: { d: Decision }) {
  const teaser = useAlertDoc(d.id);
  const a = teaser.status === 'ready' && teaser.data ? teaser.data : parseAlert(d.id, { strategy: d.id.replace(/-\d{4}-\d{2}-\d{2}$/, '') });
  const st = a ? strategy(a.strategy) : null;
  return (
    <Link to={`/alerts/${d.id}`} className={s.row}>
      <span className={s.ticker}>{a?.ticker ?? '🔒'}</span>
      <span className={s.meta}>
        <b>{st?.name ?? d.id}</b>
        <span>{formatDate(d.at)}</span>
      </span>
      <span className={s.badges}>
        {d.status === 'reactivated' ? <span className={s.muted}>{t('al.declined.back')}</span> : null}
        {a && <StatusBadge a={a} />}
        {a && <ResultBadge a={a} />}
      </span>
      <Icon name="chevronRight" size={16} />
    </Link>
  );
}
