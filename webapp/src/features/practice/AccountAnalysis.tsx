/** "What's moving your account" (owner 2026-11-14): a compact read of today's change and your open P&L. */
import { formatPercent, formatSignedMoney } from '../../lib/format';
import { t } from '../../lib/i18n';
import { Card } from '../../ui';
import type { Valued } from './account';
import { analyze } from './analysis';
import s from './Analysis.module.css';

const tone = (n: number) => (n > 0 ? 'up' : n < 0 ? 'down' : '');

export function AccountAnalysis({ v }: { v: Valued }) {
  const a = analyze(v);
  if (!a) return null;
  const max = Math.max(...a.movers.map((m) => Math.abs(m.amount)), 0.01);
  const summary = !a.movers.length
    ? t('an.quiet')
    : [a.lead && t('an.lead', { sym: a.lead.sym, amt: formatSignedMoney(a.lead.amount) }), a.drag && t('an.drag', { sym: a.drag.sym, amt: formatSignedMoney(a.drag.amount) })].filter(Boolean).join(' ');
  return (
    <Card title={t('an.title')} subtitle={t('an.today', { amt: formatSignedMoney(a.day), pct: a.dayPct == null ? '' : ` (${formatPercent(a.dayPct, { signed: true })})` })}>
      <p className={s.summary}>{summary}</p>
      {a.movers.length > 0 && (
        <ul className={s.bars} aria-label={t('an.byStock')}>
          {a.movers.map((m) => (
            <li key={m.sym}>
              <span className={s.sym}>{m.sym}</span>
              <span className={s.track} aria-hidden>
                <i className={m.amount >= 0 ? s.pos : s.neg} style={{ width: `${(Math.abs(m.amount) / max) * 50}%` }} />
              </span>
              <span className={`num ${tone(m.amount)}`}>{formatSignedMoney(m.amount)}</span>
            </li>
          ))}
        </ul>
      )}
      {(a.bestOpen || a.worstOpen) && (
        <dl className={s.open}>
          {a.bestOpen && (
            <div>
              <dt>{t('an.bestOpen')}</dt>
              <dd>
                {a.bestOpen.name} <span className="num up">{formatSignedMoney(a.bestOpen.amount)} ({formatPercent(a.bestOpen.pct, { signed: true })})</span>
              </dd>
            </div>
          )}
          {a.worstOpen && (
            <div>
              <dt>{t('an.worstOpen')}</dt>
              <dd>
                {a.worstOpen.name} <span className="num down">{formatSignedMoney(a.worstOpen.amount)} ({formatPercent(a.worstOpen.pct, { signed: true })})</span>
              </dd>
            </div>
          )}
        </dl>
      )}
    </Card>
  );
}
