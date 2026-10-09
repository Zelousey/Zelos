/** One strategy (/strategies/:id): what it looks for and avoids, its recent alerts, the pass. */
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { classicUrl } from '../../lib/platform';
import { t } from '../../lib/i18n';
import { Card, EmptyState, Icon, LoadingState, PageHeader } from '../../ui';
import { AlertLine, PassButton } from './StrategiesPage';
import { alertUrl, strategy, useAlerts } from './strategies';
import { TokensSheet, useTokens, WalletChip } from './Tokens';
import s from './Strategies.module.css';

export default function StrategyPage() {
  const st = strategy(useParams().id ?? '');
  const tk = useTokens();
  const [sheet, setSheet] = useState(false);
  const alerts = useAlerts();
  if (!st)
    return (
      <EmptyState
        icon="signal"
        title={t('st.missing')}
        actions={
          <Link to="/strategies" className={s.more}>
            ← {t('nav.strategies')}
          </Link>
        }
      />
    );
  const mine = alerts.status === 'ready' ? alerts.data.filter((a) => a.strategy === st.id) : [];
  return (
    <>
      <Link to="/strategies" className={s.back}>
        ← {t('nav.strategies')}
      </Link>
      <PageHeader title={st.name} subtitle={st.tagline} keepOnPhone actions={tk.uid ? <WalletChip balance={tk.balance} onClick={() => setSheet(true)} /> : undefined} />
      <div className={s.detail}>
        <Card className={[s.card, s[st.tone]].join(' ')} title={t('st.howItWorks')}>
          <h3 className={s.kicker}>{t('st.looksFor')}</h3>
          <ul className={s.checks}>
            {st.looksFor.map((x) => (
              <li key={x}>
                <span aria-hidden="true">✓</span> {x}
              </li>
            ))}
          </ul>
          <h3 className={s.kicker}>{t('st.avoids')}</h3>
          <ul className={[s.checks, s.no].join(' ')}>
            {st.avoids.map((x) => (
              <li key={x}>
                <span aria-hidden="true">✕</span> {x}
              </li>
            ))}
          </ul>
          <div className={s.actions}>
            <PassButton st={st} wallet={tk.wallet} info={tk.info} balance={tk.balance} onTokens={() => setSheet(true)} />
            <a className={s.more} href={classicUrl(st.page)}>
              {t('st.fullPage')} <Icon name="external" size={12} />
            </a>
          </div>
        </Card>
        <Card title={t('st.recent')} subtitle={t('st.recent.sub')} flush>
          {alerts.status === 'loading' ? (
            <LoadingState rows={3} />
          ) : !mine.length ? (
            <p className={s.pad}>{t('st.noAlerts.long')}</p>
          ) : (
            <ul className={s.alerts}>
              {mine.map((a) => (
                <li key={a.id}>
                  <a href={classicUrl(alertUrl(a.id))} className={s.alertRow}>
                    <AlertLine a={a} />
                    <Icon name="chevronRight" size={16} />
                  </a>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
      <p className={s.fine}>{t('st.disclaimer')}</p>
      <TokensSheet open={sheet} onClose={() => setSheet(false)} info={tk.info} balance={tk.balance} />
    </>
  );
}
