/** Sector moves today (markets/movers.sectors), as diverging bars around zero. */
import { useMovers } from '../../data/markets';
import { t } from '../../lib/i18n';
import { Change, LoadingState } from '../../ui';
import s from './Sectors.module.css';

export function SectorBars() {
  const movers = useMovers();
  const sectors = movers.status === 'ready' ? movers.data.sectors : [];
  const maxAbs = Math.max(1, ...sectors.map((x) => Math.abs(x.chPct)));
  if (movers.status === 'loading') return <LoadingState rows={4} />;
  if (!sectors.length) return <p className={s.muted}>{t('dash.sectors.empty')}</p>;
  return (
    <ul className={s.list} aria-label={t('dash.sectors')}>
      {sectors.map((x) => (
        <li key={x.sector} className={s.row}>
          <span className={s.name} title={x.sector}>
            {x.sector}
          </span>
          <span className={s.track} aria-hidden>
            <span className={[s.bar, x.chPct >= 0 ? s.up : s.down].join(' ')} style={{ width: `${(Math.abs(x.chPct) / maxAbs) * 50}%` }} />
          </span>
          <Change pct={x.chPct} className={s.pct} />
        </li>
      ))}
    </ul>
  );
}
