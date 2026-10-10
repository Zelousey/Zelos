/**
 * The stock draft (Draft mode): a snake draft, 45 seconds a pick. Pick on your turn; when a
 * player runs out of time any of us nudges the server, which picks for them. When the last
 * pick is made the match goes live.
 */
import { useState } from 'react';
import { t } from '../../lib/i18n';
import { Badge, Card, useToast } from '../../ui';
import { errorText } from '../invites/invites';
import { allowedSymbols, draftPick, onClock, type Battle } from './battle';
import { clock, RulesBox, useOverdueNudge } from './parts';
import s from './Battles.module.css';
import { UNIVERSE } from '../../data/universe';

export function DraftView({ b, uid, now }: { b: Battle; uid: string; now: number }) {
  const d = b.draft;
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const turn = d ? onClock(d) : null;
  useOverdueNudge(d && turn ? d.deadline : null, now, () => void draftPick(b.id).catch(() => {}));
  if (!d) return null;
  const pool = (b.symbols ? UNIVERSE.filter((i) => b.symbols!.includes(i.sym)) : UNIVERSE).filter((i) => !d.taken.includes(i.sym));
  const mine = turn === uid;
  async function pick(sym: string) {
    setBusy(true);
    try {
      await draftPick(b.id, sym);
    } catch (e) {
      toast.show(errorText(e, t('bt.failed')), 'error');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className={s.cols}>
      <Card title={t('bt.draft.title', { n: Math.min(d.turn + 1, d.total), of: d.total })} pad>
        <p className={mine ? s.yourTurn : s.muted} aria-live="polite">
          {turn ? (mine ? t('bt.draft.yourTurn') : t('bt.draft.waiting', { name: b.names[turn] ?? 'Trader' })) : t('bt.draft.done')}
          {turn && <b className="num"> · {clock(d.deadline - now)}</b>}
        </p>
        <p className={s.muted}>{t('bt.draft.mine', { list: allowedSymbols(b, uid).join(', ') || '—' })}</p>
        <div className={s.pickGrid} role="group" aria-label={t('bt.draft.pool')}>
          {pool.map((i) => (
            <button key={i.sym} type="button" className={s.pick} disabled={!mine || busy} onClick={() => void pick(i.sym)} aria-label={t('bt.draft.pickLabel', { sym: i.sym, name: i.name })}>
              <b>{i.sym}</b>
              <small>{i.name}</small>
            </button>
          ))}
        </div>
      </Card>
      <div className={s.stack}>
        <Card title={t('bt.draft.order')} flush>
          <ol className={s.list}>
            {d.order.map((u) => (
              <li key={u} className={u === uid ? s.mine : undefined}>
                <span>{b.names[u] ?? 'Trader'}</span>
                {u === turn && <Badge tone="accent">{t('bt.draft.onClock')}</Badge>}
                <small className={s.muted}>{(d.picks[u] ?? []).join(', ') || '—'}</small>
              </li>
            ))}
          </ol>
        </Card>
        <RulesBox b={b} />
      </div>
    </div>
  );
}
