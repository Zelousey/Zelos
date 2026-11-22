/**
 * Which strategy is doing best (owner 2026-11-19: "some kind of chart to show what strategy is
 * performing the best"): one bar per strategy, wins against losses over its finished trades,
 * best win rate first. Only real, graded alerts count; open trades and expired ones don't.
 */
import { Link } from 'react-router';
import { t } from '../../lib/i18n';
import { Badge, Card } from '../../ui';
import type { Strategy } from '../strategies/strategies';
import { trackRecord, type Alert } from './alerts';
import s from './Alerts.module.css';

export function strategyBoard(list: Alert[], strategies: Strategy[]) {
  return strategies
    .map((st) => ({ st, rec: trackRecord(list.filter((a) => a.strategy === st.id)) }))
    .sort((a, b) => (b.rec.winRate ?? -1) - (a.rec.winRate ?? -1) || b.rec.wins + b.rec.losses - (a.rec.wins + a.rec.losses));
}

export function StrategyBoard({ list, strategies }: { list: Alert[]; strategies: Strategy[] }) {
  const rows = strategyBoard(list, strategies);
  const most = Math.max(1, ...rows.map((r) => r.rec.wins + r.rec.losses));
  const leader = rows.find((r) => r.rec.wins + r.rec.losses > 0);
  return (
    <Card title={t('al.board')} subtitle={t('al.board.sub')}>
      <ol className={s.board}>
        {rows.map(({ st, rec }) => {
          const done = rec.wins + rec.losses;
          return (
            <li key={st.id}>
              <Link to={`/strategies/${st.id}`} className={`${s.boardName} hit`}>
                {st.name}
                {leader && leader.st.id === st.id && <Badge tone="up">{t('al.board.best')}</Badge>}
              </Link>
              <div
                className={s.boardBar}
                role="img"
                aria-label={done ? t('al.board.aria', { name: st.name, rate: rec.winRate ?? 0, w: rec.wins, l: rec.losses }) : t('al.board.none', { name: st.name })}
                style={{ width: `${Math.max(12, (done / most) * 100)}%` }}
              >
                {done ? (
                  <>
                    <i className={s.win} style={{ flex: rec.wins || 0.0001 }} />
                    <i className={s.loss} style={{ flex: rec.losses || 0.0001 }} />
                  </>
                ) : (
                  <i className={s.boardEmpty} />
                )}
              </div>
              <span className={s.boardNum}>{done ? `${rec.winRate}% · ${rec.wins}–${rec.losses}` : rec.open ? t('al.board.open', { n: rec.open }) : '—'}</span>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}
