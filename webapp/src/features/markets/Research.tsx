/** "Company research" card for a stock: SEC profile, financials, ratios, insider trades. Context only, not advice. */
import { useEffect, useRef, useState } from 'react';
import { formatCompact, formatMoney, formatPercent } from '../../lib/format';
import { t } from '../../lib/i18n';
import { Card, LoadingState } from '../../ui';
import { fetchResearch, isStale, useResearch } from './research';
import s from './Research.module.css';

const dateLabel = (d: string) => (d ? new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '');

export function ResearchCard({ sym }: { sym: string }) {
  const doc = useResearch(sym);
  const r = doc.status === 'ready' ? doc.data : null;
  const [state, setState] = useState<'idle' | 'asking' | 'failed'>('idle');
  const asked = useRef<string | null>(null);
  const settled = doc.status === 'ready' || doc.status === 'missing';
  useEffect(() => {
    if (!settled || asked.current === sym || !isStale(r)) return;
    asked.current = sym;
    queueMicrotask(() => setState('asking'));
    fetchResearch(sym).then(
      () => setState('idle'),
      () => setState('failed'),
    );
  }, [settled, r, sym]);

  let body;
  if (!r) body = state === 'failed' ? <p className={s.muted}>{t('rs.failed')}</p> : doc.status === 'loading' || state === 'asking' ? <LoadingState rows={3} /> : <p className={s.muted}>{t('rs.none')}</p>;
  else {
    const P = r.profile;
    const F = r.financials;
    const kv: [string, string][] = [];
    if (P?.industry) kv.push([t('rs.industry'), P.industry]);
    if (P?.exchange) kv.push([t('rs.exchange'), P.exchange]);
    if (F?.revenue != null) kv.push([t('rs.revenue', { y: F.year }), `$${formatCompact(F.revenue)}`]);
    if (F?.grossProfit != null) kv.push([t('rs.gross', { y: F.year }), `$${formatCompact(F.grossProfit)}`]);
    if (F?.netIncome != null) kv.push([t('rs.netIncome', { y: F.year }), `$${formatCompact(F.netIncome)}`]);
    if (F?.eps != null) kv.push([t('rs.eps', { y: F.year }), formatMoney(F.eps)]);
    if (r.metrics.pe != null) kv.push([t('rs.pe'), r.metrics.pe.toFixed(1)]);
    if (r.metrics.margin != null) kv.push([t('rs.margin'), formatPercent(r.metrics.margin * 100, { digits: 1, signed: false })]);
    if (P?.fiscalYearEnd) kv.push([t('rs.fye'), `${P.fiscalYearEnd.slice(0, 2)}/${P.fiscalYearEnd.slice(2)}`]);
    if (P?.state) kv.push([t('rs.incorporated'), P.state]);
    body = (
      <>
        {kv.length > 0 && (
          <dl className={s.kv}>
            {kv.map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
        )}
        {r.insiders.length > 0 && (
          <>
            <h3 className={s.sub}>{t('rs.insiders')}</h3>
            <ul className={s.list}>
              {r.insiders.map((x, i) => (
                <li key={`${x.date}-${i}`}>
                  <span>
                    <b>{x.who}</b>
                    {x.role && <small> {x.role}</small>}
                  </span>
                  <small className={x.buy ? s.buy : s.sell}>
                    {t(x.buy ? 'rs.bought' : 'rs.sold', { n: x.shares != null ? Math.round(x.shares).toLocaleString('en-US') : '?' })}
                    {x.price != null ? ` @ ${formatMoney(x.price)}` : ''} · {dateLabel(x.date)}
                  </small>
                </li>
              ))}
            </ul>
            <p className={s.fine}>{t('rs.insidersNote')}</p>
          </>
        )}
        {P?.website && (
          <a className={s.site} href={P.website} target="_blank" rel="noopener noreferrer">
            {P.website.replace(/^https:\/\//, '')}
          </a>
        )}
        <p className={s.fine}>{t('rs.source')}</p>
      </>
    );
  }
  return (
    <Card title={t('rs.title')} subtitle={r && r.name !== sym ? r.name : undefined} pad aria-label={t('rs.title')}>
      {body}
    </Card>
  );
}
