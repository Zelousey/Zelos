/** One strategy (/strategies/:id): what it looks for and avoids, its recent alerts, the pass. */
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { classicUrl } from '../../lib/platform';
import { t } from '../../lib/i18n';
import { Card, EmptyState, Icon, LoadingState, PageHeader } from '../../ui';
import { AlertLine, PassButton } from './StrategiesPage';
import { strategy, useAlerts } from './strategies';
import { StrategyArt } from './StrategyArt';
import { TokensSheet, useTokens } from './Tokens';
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
      <PageHeader title={st.name} subtitle={st.tagline} keepOnPhone />
      <div className={s.detail}>
        <Card className={[s.card, s[st.tone]].join(' ')} title={t('st.howItWorks')}>
          <StrategyArt id={st.id} name={st.name} size="lg" />
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
                  <Link to={`/alerts/${a.id}`} className={s.alertRow}>
                    <AlertLine a={a} />
                    <Icon name="chevronRight" size={16} />
                  </Link>
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
