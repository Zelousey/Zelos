/** Strategies, promoted (Trade War hub and Dashboard): the three strategies, one tap away. */
import { Link } from 'react-router';
import { t } from '../../lib/i18n';
import { Card } from '../../ui';
import { STRATEGIES, useAlerts } from './strategies';
import s from './Strategies.module.css';

export function StrategiesPromo({ className }: { className?: string }) {
  const alerts = useAlerts();
  const list = alerts.status === 'ready' ? alerts.data : [];
  return (
    <Card
      className={className}
      title={t('st.promo.title')}
      subtitle={t('st.promo.sub')}
      actions={
        <Link to="/strategies" className={s.more}>
          {t('st.promo.all')} →
        </Link>
      }
    >
      <div className={s.promo}>
        {STRATEGIES.map((x) => {
          const latest = list.find((a) => a.strategy === x.id);
          return (
            <Link key={x.id} to={`/strategies/${x.id}`} className={[s.promoItem, s[x.tone]].join(' ')}>
              <b>{x.name}</b>
              <span className={s.muted}>{x.tagline.split(/[,.(]/)[0]}</span>
              <span className={s.mono}>{latest?.at ? t('st.promo.last', { when: new Date(latest.at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) }) : t('st.noAlerts')}</span>
            </Link>
          );
        })}
      </div>
    </Card>
  );
}
