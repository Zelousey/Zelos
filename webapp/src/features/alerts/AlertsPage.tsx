/**
 * Alerts (/alerts): every strategy alert, newest first, with the track record (win rate over
 * closed trades) and a Notifications tab for which alerts reach you. Same data and rules as the
 * website's alert-history.html; each alert opens in the app (/alerts/:id).
 */
import { doc, setDoc } from 'firebase/firestore';
import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useUserDoc } from '../../data/userDoc';
import { useAuth } from '../../lib/auth';
import { db } from '../../lib/firebase';
import { formatDate } from '../../lib/format';
import { t } from '../../lib/i18n';
import { classicUrl } from '../../lib/platform';
import { Badge, Button, Card, EmptyState, ErrorState, Icon, LoadingState, PageHeader, Tabs, useToast } from '../../ui';
import { STRATEGIES, strategy } from '../strategies/strategies';
import { hasTrade, isOn, NOTIFY_GROUPS, toggle, trackRecord, useAlertList, type Alert } from './alerts';
import { ResultBadge, StatusBadge } from './Badges';
import s from './Alerts.module.css';

type Tab = 'alerts' | 'notify';

export default function AlertsPage() {
  const [params, setParams] = useSearchParams();
  const tab: Tab = params.get('tab') === 'notify' ? 'notify' : 'alerts';
  return (
    <>
      <PageHeader title={t('nav.alerts')} subtitle={t('al.subtitle')} />
      <div className={s.tabs}>
        <Tabs
          label={t('nav.alerts')}
          value={tab}
          onChange={(v) => setParams(v === 'notify' ? { tab: 'notify' } : {}, { replace: true })}
          items={[
            { value: 'alerts', label: t('al.tab.alerts') },
            { value: 'notify', label: t('al.tab.notify') },
          ]}
        />
      </div>
      {tab === 'alerts' ? <AlertList /> : <NotifySettings />}
    </>
  );
}

function AlertList() {
  const alerts = useAlertList();
  const [filter, setFilter] = useState<string>('all');
  const list = useMemo(() => (alerts.status === 'ready' ? alerts.data.filter((a) => filter === 'all' || a.strategy === filter) : []), [alerts, filter]);
  const rec = trackRecord(list);
  return (
    <div className={s.stack}>
      <div className={s.filters}>
        <Tabs label={t('al.filter')} value={filter} onChange={setFilter} items={[{ value: 'all', label: t('markets.all') }, ...STRATEGIES.map((x) => ({ value: x.id, label: x.name }))]} />
      </div>
      <Card title={t('al.record')} subtitle={t('al.record.sub')}>
        {alerts.status === 'loading' ? (
          <LoadingState rows={2} />
        ) : rec.wins + rec.losses === 0 ? (
          <p className={s.muted}>{t('al.record.none')}</p>
        ) : (
          <div className={s.record}>
            <div className={s.rate}>
              <b>{rec.winRate}%</b>
              <span>{t('al.record.rate')}</span>
            </div>
            <div className={s.recordBar} role="img" aria-label={t('al.record.bar', { wins: rec.wins, losses: rec.losses })}>
              <i className={s.win} style={{ flex: rec.wins }} />
              <i className={s.loss} style={{ flex: rec.losses }} />
            </div>
            <ul className={s.counts}>
              <li>
                <b className="up">{rec.wins}</b> {t('al.wins')}
              </li>
              <li>
                <b className="down">{rec.losses}</b> {t('al.losses')}
              </li>
              <li>
                <b>{rec.open}</b> {t('al.open')}
              </li>
            </ul>
            {rec.expired + rec.noTrade > 0 && <p className={s.muted}>{t('al.record.excl', { expired: rec.expired, noTrade: rec.noTrade })}</p>}
          </div>
        )}
      </Card>
      <Card title={t('al.list')} flush>
        {alerts.status === 'loading' ? (
          <LoadingState rows={5} />
        ) : alerts.status === 'error' ? (
          <ErrorState compact />
        ) : !list.length ? (
          <EmptyState icon="signal" body={t('al.empty')} compact />
        ) : (
          <ul className={s.rows}>
            {list.map((a) => (
              <li key={a.id}>
                <AlertRow a={a} />
              </li>
            ))}
          </ul>
        )}
      </Card>
      <p className={s.fine}>{t('st.disclaimer')}</p>
    </div>
  );
}

export function AlertRow({ a }: { a: Alert }) {
  const st = strategy(a.strategy);
  return (
    <Link to={`/alerts/${a.id}`} className={s.row}>
      <span className={s.ticker}>{a.ticker ?? (a.locked ? `🔒 ${a.afterClose ? t('al.locked.closed') : t('al.locked.live')}` : hasTrade(a) ? '—' : t('al.noSetup.short'))}</span>
      <span className={s.meta}>
        <b>{st?.name}</b>
        <span>
          {a.label ?? ''}
          {a.label ? ' · ' : ''}
          {formatDate(a.at)}
        </span>
      </span>
      <span className={s.badges}>
        <StatusBadge a={a} />
        <ResultBadge a={a} />
      </span>
      <Icon name="chevronRight" size={16} />
    </Link>
  );
}

function NotifySettings() {
  const { user, isReal, signInWithGoogle } = useAuth();
  const toast = useToast();
  const uid = isReal && user ? user.uid : null;
  const me = useUserDoc(uid);
  const [busy, setBusy] = useState<string | null>(null);
  if (!uid)
    return (
      <EmptyState
        icon="bell"
        body={t('al.notify.signIn')}
        actions={
          <Button variant="primary" onClick={() => void signInWithGoogle().catch(() => toast.show(t('auth.signInFailed'), 'error'))}>
            {t('auth.signInWithGoogle')}
          </Button>
        }
      />
    );
  if (me.status === 'loading') return <LoadingState rows={6} />;
  const prefs = me.status === 'ready' ? me.data.prefs : { strategies: null, types: {} };
  async function flip(key: string, on: boolean) {
    setBusy(key);
    try {
      await setDoc(doc(db(), 'users', uid!), toggle(prefs, key, on), { merge: true });
    } catch {
      toast.show(t('al.notify.failed'), 'error');
    } finally {
      setBusy(null);
    }
  }
  return (
    <div className={s.stack}>
      {NOTIFY_GROUPS.map((g) => (
        <Card key={g.title} title={g.title} flush>
          <ul className={s.switches}>
            {g.items.map((it) => {
              const on = isOn(prefs, it.key);
              return (
                <li key={it.key}>
                  <span>
                    <b>{it.label}</b>
                    <small>{it.hint}</small>
                  </span>
                  <button type="button" role="switch" aria-checked={on} aria-label={it.label} className={s.switch} disabled={busy === it.key} onClick={() => void flip(it.key, !on)}>
                    <i />
                  </button>
                </li>
              );
            })}
          </ul>
        </Card>
      ))}
      <p className={s.muted}>
        {t('al.notify.device')}{' '}
        <a href={classicUrl('alert-history.html#notifications')}>
          {t('al.notify.deviceLink')} <Icon name="external" size={12} />
        </a>
      </p>
      <Badge tone="neutral">{t('al.notify.inbox')}</Badge>
    </div>
  );
}
