/** Strategies, promoted (Trade War hub and Dashboard): the three strategies, one tap away. */
import { Link } from 'react-router';
import { t } from '../../lib/i18n';
import { Card } from '../../ui';
import { STRATEGIES, useAlerts } from './strategies';
import { StrategyArt } from './StrategyArt';
import s from './Strategies.module.css';

/** compact: one line per strategy and no pictures, for a side panel (Trade War hub). */
export function StrategiesPromo({ className, compact }: { className?: string; compact?: boolean }) {
  const alerts = useAlerts();
  const list = alerts.status === 'ready' ? alerts.data : [];
  return (
    <Card
      className={className}
      title={t('st.promo.title')}
      subtitle={compact ? undefined : t('st.promo.sub')}
      flush={compact}
      actions={
        <Link to="/strategies" className={s.more}>
          {t('st.promo.all')} →
        </Link>
      }
    >
      {compact ? (
        <ul className={s.promoList}>
          {STRATEGIES.map((x) => {
            const latest = list.find((a) => a.strategy === x.id);
            return (
              <li key={x.id}>
                <Link to={`/strategies/${x.id}`} className={[s.promoRow, s[x.tone]].join(' ')}>
                  <span className={s.promoRowText}>
                    <b>{x.name}</b>
                    <span className={s.muted}>{x.tagline.split(/[,.(]/)[0]}</span>
                  </span>
                  <span className={s.mono}>{latest?.at ? t('st.promo.last', { when: new Date(latest.at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) }) : t('st.noAlerts')}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
      <div className={s.promo}>
        {STRATEGIES.map((x) => {
          const latest = list.find((a) => a.strategy === x.id);
          return (
            <Link key={x.id} to={`/strategies/${x.id}`} className={[s.promoItem, s[x.tone]].join(' ')}>
              <StrategyArt id={x.id} name={x.name} size="sm" />
              <b>{x.name}</b>
              <span className={s.muted}>{x.tagline.split(/[,.(]/)[0]}</span>
              <span className={s.mono}>{latest?.at ? t('st.promo.last', { when: new Date(latest.at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) }) : t('st.noAlerts')}</span>
            </Link>
          );
        })}
      </div>
      )}
    </Card>
  );
}
