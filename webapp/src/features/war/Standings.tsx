/**
 * The War Score table (W5c): live during the War (refreshed hourly and after battles) and final
 * once it ends. War Score = 60% trading (your War return, −10% → 0, +10% → 100) + 40% land
 * (your territory points ÷ the most anyone has). Worked out on the server (functions/warscore.py).
 */
import { formatPercent, formatRelative } from '../../lib/format';
import { t } from '../../lib/i18n';
import { Badge, Card } from '../../ui';
import type { PrivateWar, Standing } from './lobby';
import s from './War.module.css';

export function Standings({ w, uid, now }: { w: PrivateWar; uid: string; now: number }) {
  const final = w.status === 'ended' && w.results && w.results.length > 0;
  const rows: Standing[] = final ? w.results! : w.standings;
  if (!rows.length) return null;
  const name = (p: string) => (p === uid ? t('wmap.you') : (w.names[p] ?? 'Trader'));
  const me = rows.find((r) => r.uid === uid);
  return (
    <Card
      title={final ? t('wscore.finalTitle') : t('wscore.title')}
      subtitle={final ? t('wscore.finalSub', { name: name(rows[0]!.uid), rank: me ? me.rank : '–', of: rows.length }) : t('wscore.sub', { when: w.standingsAt ? formatRelative(Math.min(w.standingsAt, now), now) : '' })}
      flush
    >
      {/* it scrolls sideways on a phone, so keyboard users can focus it */}
      <div className={s.tableWrap} tabIndex={0} role="region" aria-label={final ? t('wscore.finalTitle') : t('wscore.title')}>
        <table className={s.scoreTable}>
          <thead>
            <tr>
              <th scope="col">#</th>
              <th scope="col">{t('wscore.player')}</th>
              <th scope="col">{t('wscore.score')}</th>
              <th scope="col">{t('wscore.return')}</th>
              <th scope="col">{t('wscore.points')}</th>
              <th scope="col">{t('wscore.wins')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.uid} className={r.uid === uid ? s.meRow : undefined}>
                <td>{r.rank}</td>
                <th scope="row">
                  {name(r.uid)} {w.ranks[r.uid] && <small className={s.muted}>{w.ranks[r.uid]}</small>}{' '}
                  {r.rank === 1 && rows.length > 1 && !r.forfeit && <Badge tone="gold">{final ? t('wscore.winner') : t('wscore.leader')}</Badge>}
                  {r.forfeit && <Badge tone="neutral">{t('wscore.forfeit')}</Badge>}
                </th>
                <td className="num">{r.score.toFixed(1)}</td>
                <td className="num">{formatPercent(r.ret)}</td>
                <td className="num">{r.points}</td>
                <td className="num">{r.wins}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className={s.note}>{final ? t('wscore.howFinal') : t('wscore.how')}</p>
    </Card>
  );
}
