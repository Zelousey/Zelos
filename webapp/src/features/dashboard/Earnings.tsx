/**
 * Upcoming earnings (owner 2026-11-14): the next reports for stocks you hold, have options on or
 * watch, soonest first; if none of yours report in the next 45 days, the Zelos list's next ones.
 * From markets/earnings (FMP's earnings calendar, refreshed daily by the server).
 */
import type { DocumentData } from 'firebase/firestore';
import { Link } from 'react-router';
import { useLiveDoc } from '../../data/liveDoc';
import { instrument, UNIVERSE } from '../../data/universe';
import { t } from '../../lib/i18n';
import { Card, Skeleton } from '../../ui';
import s from './Earnings.module.css';

export type Report = { sym: string; date: string; eps: number | null };

const parse = (d: DocumentData): Report[] =>
  Object.entries((d.bySymbol as Record<string, { date?: unknown; eps?: unknown }>) ?? {})
    .filter(([, r]) => typeof r?.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.date))
    .map(([sym, r]) => ({ sym, date: r.date as string, eps: typeof r.eps === 'number' ? r.eps : null }));

const nyToday = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
const daysUntil = (d: string, today: string) => Math.round((Date.parse(d + 'T12:00:00Z') - Date.parse(today + 'T12:00:00Z')) / 864e5);

/** The reports to show: yours first, soonest first (pure, for tests). */
export function pickReports(all: Report[], mine: string[], today: string, max = 5): { list: Report[]; yours: boolean } {
  const upcoming = all.filter((r) => r.date >= today).sort((a, b) => a.date.localeCompare(b.date) || a.sym.localeCompare(b.sym));
  const set = new Set(mine);
  const yours = upcoming.filter((r) => set.has(r.sym));
  if (yours.length) return { list: yours.slice(0, max), yours: true };
  const listed = new Set(UNIVERSE.map((u) => u.sym));
  return { list: upcoming.filter((r) => listed.has(r.sym)).slice(0, max), yours: false };
}

export function EarningsCard({ mine }: { mine: string[] }) {
  const doc = useLiveDoc('markets/earnings', parse);
  const today = nyToday();
  if (doc.status === 'error' || doc.status === 'missing') return null;
  const pick = doc.status === 'ready' ? pickReports(doc.data, mine, today) : null;
  if (pick && !pick.list.length) return null;
  return (
    <Card title={t('earn.title')} subtitle={pick ? t(pick.yours ? 'earn.yours' : 'earn.listed') : undefined} flush>
      {!pick ? (
        <Skeleton height={120} />
      ) : (
        <ul className={s.list}>
          {pick.list.map((r) => {
            const n = daysUntil(r.date, today);
            return (
              <li key={r.sym}>
                <Link to={`/markets/${r.sym}`} className={s.row}>
                  <span className={s.when}>
                    <b>{new Date(r.date + 'T12:00:00Z').toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' })}</b>
                    <small>{n === 0 ? t('earn.today') : n === 1 ? t('earn.tomorrow') : t('earn.inDays', { n })}</small>
                  </span>
                  <span className={s.who}>
                    <b>{r.sym}</b>
                    <small>{instrument(r.sym)?.name ?? ''}</small>
                  </span>
                  {r.eps != null && <span className={s.eps}>{t('earn.eps', { eps: r.eps.toFixed(2) })}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

/** The next earnings report for one stock, if it's within the calendar (45 days). */
export function useNextEarnings(sym: string | null): Report | null {
  const doc = useLiveDoc(sym ? 'markets/earnings' : null, parse);
  if (!sym || doc.status !== 'ready') return null;
  return doc.data.filter((r) => r.sym === sym && r.date >= nyToday()).sort((a, b) => a.date.localeCompare(b.date))[0] ?? null;
}
