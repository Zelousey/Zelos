/** Small pieces shared by the battle screens: the clock text, the rules box, and the overdue nudge. */
import { useEffect, useRef } from 'react';
import { formatMoney } from '../../lib/format';
import { t } from '../../lib/i18n';
import { Card } from '../../ui';
import type { Battle } from './battle';
import s from './Battles.module.css';

/** 3d 4h · 4h 05m · 12:09 */
export function clock(ms: number): string {
  const sec = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const ss = sec % 60;
  if (d) return `${d}d ${h}h`;
  if (h) return `${h}h ${String(m).padStart(2, '0')}m`;
  return `${m}:${String(ss).padStart(2, '0')}`;
}

/** Fire once when a deadline is 1.5 s overdue (the server checks whether it really is). */
export function useOverdueNudge(due: number | null, now: number, fire: () => void) {
  const fired = useRef<number | null>(null);
  const cb = useRef(fire);
  useEffect(() => {
    cb.current = fire;
  });
  useEffect(() => {
    if (due && now > due + 1500 && fired.current !== due) {
      fired.current = due;
      cb.current();
    }
  }, [due, now]);
}

/** What this battle's rules are, in plain words. */
export function RulesBox({ b }: { b: Battle }) {
  const rows: string[] = [
    t('bt.rule.cash', { buyIn: formatMoney(b.buyIn, { digits: 0 }), days: b.days }),
    t('bt.rule.hours'),
    t('bt.rule.long'),
    b.lms ? t('bt.rule.winLms') : t('bt.rule.win'),
  ];
  if (b.lms?.floorPct) rows.push(t('bt.rule.floor', { n: b.lms.floorPct }));
  if (b.lms?.maxLossPct) rows.push(t('bt.rule.bigLoss', { n: b.lms.maxLossPct }));
  if (b.lms?.maxLosses) rows.push(t('bt.rule.losses', { n: b.lms.maxLosses }));
  if (b.lms?.cutHours) rows.push(t('bt.rule.cut', { n: b.lms.cutHours }));
  if (b.modes.draft) rows.push(t('bt.rule.draft', { n: b.modes.draft.picks }));
  if (b.modes.whale) rows.push(t('bt.rule.whale', { cap: b.modes.whale.capPct, n: b.modes.whale.shields }));
  if (b.modes.storms) rows.push(t(b.modes.storms === 'often' ? 'bt.rule.stormsOften' : 'bt.rule.storms'));
  if (b.modes.bounties) rows.push(t('bt.rule.bounties'));
  if (b.modes.stops) rows.push(t('bt.rule.stops'));
  if (b.symbols) rows.push(t('bt.rule.symbols', { n: b.symbols.length }));
  if (b.viewTrades) rows.push(t('bt.rule.viewTrades'));
  rows.push(t('bt.rule.rewards'));
  return (
    <Card title={t('bt.rules')} pad>
      <ul className={s.rules}>
        {rows.map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ul>
    </Card>
  );
}
