/**
 * Attacks on owned territory (W5a): start one from the map (a stock from that territory and a side,
 * a $5,000 War stake), answer one aimed at you (accept, with Counter-pick, or decline), follow the
 * hour-long battle, and see the last results. The server checks everything (functions/warattack.py).
 */
import { useState } from 'react';
import { formatMoney, formatRelative } from '../../lib/format';
import { t, type MessageKey } from '../../lib/i18n';
import { platform } from '../../lib/platform';
import { Badge, Button, Card, Sheet, useToast } from '../../ui';
import { errorText } from '../invites/invites';
import { useWarAttackLog, warLobby, type Attack, type PrivateWar, type Side } from './lobby';
import { companiesOf, SECTOR_NAME } from './map';
import { BY_SYM, type WarQuotes } from './war';
import s from './War.module.css';

const sideName = (x: Side) => (x === 'bull' ? t('wbat.bull') : t('wbat.bear'));
type Details = { reason?: string; pass?: boolean; cost?: number; territory?: string };
const details = (err: unknown): Details => ((err as { details?: Details })?.details ?? {}) as Details;

/** The sheet for a new attack on one territory. */
export function AttackSheet({ w, territory, onClose }: { w: PrivateWar; territory: string | null; onClose: () => void }) {
  const toast = useToast();
  const stocks = territory ? companiesOf(territory) : [];
  const [sym, setSym] = useState<string>(stocks[0]?.sym ?? '');
  const [side, setSide] = useState<Side>('bull');
  const [busy, setBusy] = useState(false);
  const [offer, setOffer] = useState<Details | null>(null);
  if (!territory) return null;
  const owner = w.names[w.map[territory]?.owner ?? ''] ?? 'Trader';
  async function go(usePass = false) {
    setBusy(true);
    try {
      await warLobby({ action: 'attack', warId: w.id, territory: territory!, sym: sym || stocks[0]!.sym, side, ...(usePass && { usePass: true }) });
      toast.show(t('watk.sent', { name: owner }), 'success');
      onClose();
    } catch (err) {
      const d = details(err);
      if (d.reason === 'war-eligibility' && d.pass) setOffer(d);
      else if (d.reason === 'war-wait' && platform() !== 'ios') setOffer(d);
      toast.show(errorText(err, t('warl.failed')), 'error');
    } finally {
      setBusy(false);
    }
  }
  async function skip() {
    setBusy(true);
    try {
      await warLobby({ action: 'skipWait', warId: w.id, territory: territory! });
      setOffer(null);
      toast.show(t('watk.skipped'), 'success');
    } catch (err) {
      toast.show(errorText(err, t('warl.failed')), 'error');
    } finally {
      setBusy(false);
    }
  }
  return (
    <Sheet open onClose={onClose} title={t('watk.title', { t: SECTOR_NAME[territory] ?? territory })} labelledBy="war-attack">
      <div className={s.explain}>
        <p className={s.muted}>{t('watk.help', { name: owner })}</p>
        <div className={s.chipsRow} role="radiogroup" aria-label={t('wbat.stock')}>
          {stocks.map((c) => (
            <Button key={c.sym} size="sm" variant={sym === c.sym ? 'secondary' : 'ghost'} role="radio" aria-checked={sym === c.sym} onClick={() => setSym(c.sym)}>
              {c.name}
            </Button>
          ))}
        </div>
        <div className={s.chipsRow} role="radiogroup" aria-label={t('watk.side')}>
          {(['bull', 'bear'] as const).map((x) => (
            <Button key={x} size="sm" variant={side === x ? 'secondary' : 'ghost'} role="radio" aria-checked={side === x} onClick={() => setSide(x)}>
              {x === 'bull' ? t('wbat.pickBull') : t('wbat.pickBear')}
            </Button>
          ))}
        </div>
        {offer?.reason === 'war-eligibility' && (
          <Button variant="secondary" block disabled={busy} onClick={() => void go(true)}>
            {t('watk.usePass')}
          </Button>
        )}
        {offer?.reason === 'war-wait' && (
          <Button variant="secondary" block disabled={busy} onClick={() => void skip()}>
            {t('watk.skip', { n: offer.cost ?? 100 })}
          </Button>
        )}
        <Button variant="primary" block disabled={busy} onClick={() => void go()}>
          {t('watk.go', { side: sideName(side), name: BY_SYM[sym]?.name ?? sym })}
        </Button>
      </div>
    </Sheet>
  );
}

/** Open attacks you're in, and the last results. */
export function Attacks({ w, uid, q, now }: { w: PrivateWar; uid: string; q: WarQuotes | null; now: number }) {
  const log = useWarAttackLog(w.id);
  const open = Object.values(w.attacks).filter((a) => a.attacker === uid || a.defender === uid || a.stage === 'running');
  const done = log.status === 'ready' ? log.data.slice(0, 6) : [];
  if (!open.length && !done.length) return null;
  return (
    <Card title={t('watk.listTitle')} subtitle={t('watk.listSub')} flush>
      <ul className={s.battleList}>
        {open.map((a) => (
          <li key={a.id}>
            <AttackRow a={a} w={w} uid={uid} q={q} now={now} />
          </li>
        ))}
        {done.map((a) => (
          <li key={a.id}>
            <AttackRow a={a} w={w} uid={uid} q={q} now={now} />
          </li>
        ))}
      </ul>
    </Card>
  );
}

function AttackRow({ a, w, uid, q, now }: { a: Attack; w: PrivateWar; uid: string; q: WarQuotes | null; now: number }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [counter, setCounter] = useState(false);
  const name = (p: string) => (p === uid ? t('wmap.you') : (w.names[p] ?? 'Trader'));
  const terr = SECTOR_NAME[a.territory] ?? a.territory;
  const defSide: Side = a.side === 'bull' ? 'bear' : 'bull';
  async function answer(accept: boolean, sym?: string) {
    setBusy(true);
    try {
      await warLobby({ action: 'answer', warId: w.id, attackId: a.id, accept, ...(sym && { counter: sym }) });
      toast.show(accept ? t('watk.accepted') : t('watk.declinedToast'), 'success');
    } catch (err) {
      toast.show(errorText(err, t('warl.failed')), 'error');
    } finally {
      setBusy(false);
    }
  }
  const stage = { answering: t('watk.st.answering'), running: t('wbat.st.running'), done: t('wbat.st.done') }[a.stage];
  const price = a.stage === 'done' ? a.end : (q?.prices[a.sym]?.p ?? a.start);
  return (
    <div className={s.battle}>
      <div className={s.battleHead}>
        <b>{t('watk.rowTitle', { who: name(a.attacker), t: terr, them: name(a.defender) })}</b>
        <Badge tone={a.stage === 'done' ? 'neutral' : a.stage === 'running' ? 'gold' : 'accent'}>{stage}</Badge>
      </div>
      <p className={s.muted}>
        {t('watk.sides', { a: name(a.attacker), as: sideName(a.side), d: name(a.defender), ds: sideName(defSide), stock: BY_SYM[a.sym]?.name ?? a.sym })}
        {a.counterPicked && ` · ${t('watk.counterPicked')}`}
      </p>
      {a.stage === 'answering' && a.defender === uid && (
        <div className={s.pick}>
          <p className={s.muted}>{t('watk.answerBy', { when: formatRelative(a.answerBy, now) })}</p>
          {counter && (
            <div className={s.chipsRow} role="group" aria-label={t('watk.counterLabel')}>
              {companiesOf(a.territory)
                .filter((c) => c.sym !== a.sym)
                .map((c) => (
                  <Button key={c.sym} size="sm" variant="secondary" disabled={busy} onClick={() => void answer(true, c.sym)}>
                    {t('watk.counterGo', { name: c.name })}
                  </Button>
                ))}
            </div>
          )}
          <div className={s.actionsRow}>
            <Button variant="primary" disabled={busy} onClick={() => void answer(true)}>
              {t('watk.accept')}
            </Button>
            <Button variant="ghost" disabled={busy} aria-pressed={counter} onClick={() => setCounter((c) => !c)}>
              {t('watk.counter')}
            </Button>
            <Button variant="ghost" disabled={busy} onClick={() => void answer(false)}>
              {t('watk.decline')}
            </Button>
          </div>
        </div>
      )}
      {a.stage === 'answering' && a.defender !== uid && <p className={s.muted}>{t('watk.waiting', { name: name(a.defender), when: formatRelative(a.answerBy, now) })}</p>}
      {a.stage === 'running' && (
        <p className={s.muted}>
          {t('watk.running', { from: formatMoney(a.start ?? 0), now: formatMoney(price ?? 0), when: formatRelative(a.endsAt ?? now, now) })}
        </p>
      )}
      {a.stage === 'done' && <p className={s.muted}>{t(RESULT[resultKey(a)], { who: name(a.attacker), them: name(a.defender), t: terr })}</p>}
    </div>
  );
}

const RESULT: Record<ReturnType<typeof resultKey>, MessageKey> = {
  declined: 'watk.r.declined',
  conceded: 'watk.r.conceded',
  draw: 'watk.r.draw',
  cancelled: 'watk.r.cancelled',
  took: 'watk.r.took',
  won: 'watk.r.won',
  held: 'watk.r.held',
};

function resultKey(a: Attack): 'declined' | 'conceded' | 'draw' | 'cancelled' | 'took' | 'won' | 'held' {
  if (a.result === 'declined' || a.result === 'conceded' || a.result === 'draw' || a.result === 'cancelled') return a.result;
  if (a.result === 'attacker') return a.captured ? 'took' : 'won';
  return 'held';
}
