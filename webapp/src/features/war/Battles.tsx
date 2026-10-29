/**
 * Contested battles on the War map (W4b): a 2-player battle where Command picks Bull or Bear, or
 * a best-pick battle where each player picks a stock and a side in secret; then an hour on the
 * simulated War zone prices. The server runs and settles them (functions/warbattle.py).
 */
import { useState } from 'react';
import { formatMoney, formatPercent, formatRelative } from '../../lib/format';
import { t } from '../../lib/i18n';
import { Badge, Button, Card, useToast } from '../../ui';
import { errorText } from '../invites/invites';
import { warLobby, type Battle, type PrivateWar, type Side } from './lobby';
import { companiesOf, SECTOR_NAME, type Placement } from './map';
import { BY_SYM, type WarQuotes } from './war';
import s from './War.module.css';

const sideName = (x: Side) => (x === 'bull' ? t('wbat.bull') : t('wbat.bear'));

export function Battles({ w, uid, placement, q, now }: { w: PrivateWar; uid: string; placement: Placement | null; q: WarQuotes | null; now: number }) {
  const list = w.territories.map((x) => w.battles[x]).filter((b): b is Battle => !!b);
  if (!list.length) return null;
  return (
    <Card title={t('wbat.title')} subtitle={t('wbat.sub')} flush>
      <ul className={s.battleList}>
        {list.map((b) => (
          <li key={b.territory}>
            <BattleRow b={b} w={w} uid={uid} mine={placement?.picks[b.territory] ?? null} q={q} now={now} />
          </li>
        ))}
      </ul>
    </Card>
  );
}

function BattleRow({ b, w, uid, mine, q, now }: { b: Battle; w: PrivateWar; uid: string; mine: { side: Side; sym: string } | null; q: WarQuotes | null; now: number }) {
  const name = (p: string) => (p === uid ? t('wmap.you') : (w.names[p] ?? 'Trader'));
  const terr = SECTOR_NAME[b.territory] ?? b.territory;
  const stageBadge = { waiting: t('wbat.st.waiting'), picking: t('wbat.st.picking'), running: t('wbat.st.running'), done: t('wbat.st.done') }[b.stage];
  return (
    <div className={s.battle}>
      <div className={s.battleHead}>
        <b>{t('wbat.for', { t: terr })}</b>
        <Badge tone={b.stage === 'done' ? 'neutral' : b.stage === 'running' ? 'gold' : 'accent'}>{stageBadge}</Badge>
      </div>
      <p className={s.muted}>
        {b.players.map(name).join(' vs ')} · {b.kind === 'duel' ? (b.command === uid ? t('wbat.youCommand') : t('wbat.command', { name: name(b.command) })) : t('wbat.bestRule')}
      </p>
      {b.stage === 'waiting' && <p className={s.muted}>{t('wbat.waiting', { when: formatRelative(b.wakeAt ?? now, now) })}</p>}
      {b.stage === 'picking' && <Picking b={b} w={w} uid={uid} mine={mine} now={now} />}
      {(b.stage === 'running' || b.stage === 'done') && <Fight b={b} name={name} q={q} now={now} />}
    </div>
  );
}

function Picking({ b, w, uid, mine, now }: { b: Battle; w: PrivateWar; uid: string; mine: { side: Side; sym: string } | null; now: number }) {
  const toast = useToast();
  const stocks = companiesOf(b.territory);
  const [sym, setSym] = useState(mine?.sym ?? stocks[0]?.sym ?? '');
  const [busy, setBusy] = useState(false);
  const left = formatRelative(b.pickBy ?? now, now);
  async function pick(side: Side) {
    setBusy(true);
    try {
      await warLobby({ action: 'pick', warId: w.id, territory: b.territory, side, ...(b.kind === 'best' && { sym }) });
      toast.show(t('wbat.picked'), 'success');
    } catch (err) {
      toast.show(errorText(err, t('warl.failed')), 'error');
    } finally {
      setBusy(false);
    }
  }
  if (b.kind === 'duel' && b.command !== uid) return <p className={s.muted}>{t('wbat.theyPick', { name: w.names[b.command] ?? 'Trader', when: left })}</p>;
  if (!b.players.includes(uid)) return <p className={s.muted}>{t('wbat.picksOpen', { when: left })}</p>;
  return (
    <div className={s.pick}>
      <p className={s.muted}>{b.kind === 'duel' ? t('wbat.youPick', { when: left }) : mine ? t('wbat.yourPick', { side: sideName(mine.side), name: BY_SYM[mine.sym]?.name ?? mine.sym, when: left }) : t('wbat.bestPick', { when: left })}</p>
      {b.kind === 'best' && (
        <div className={s.chipsRow} role="radiogroup" aria-label={t('wbat.stock')}>
          {stocks.map((c) => (
            <Button key={c.sym} size="sm" variant={sym === c.sym ? 'secondary' : 'ghost'} role="radio" aria-checked={sym === c.sym} onClick={() => setSym(c.sym)}>
              {c.name}
            </Button>
          ))}
        </div>
      )}
      <div className={s.actionsRow}>
        <Button variant="buy" disabled={busy} onClick={() => void pick('bull')}>
          {t('wbat.pickBull')}
        </Button>
        <Button variant="sell" disabled={busy} onClick={() => void pick('bear')}>
          {t('wbat.pickBear')}
        </Button>
      </div>
    </div>
  );
}

function Fight({ b, name, q, now }: { b: Battle; name: (p: string) => string; q: WarQuotes | null; now: number }) {
  const done = b.stage === 'done';
  const price = (sym: string) => (done ? b.end[sym] : q?.prices[sym]?.p) ?? b.start[sym] ?? 0;
  const rows = b.players.map((p) => {
    const sym = b.kind === 'duel' ? (b.sym ?? '') : (b.picks[p]?.sym ?? '');
    const side = b.kind === 'duel' ? b.sides[p] : b.picks[p]?.side;
    const ch = b.start[sym] ? (price(sym) / b.start[sym]! - 1) * 100 : 0;
    return { p, sym, side, ch, yourWay: side === 'bear' ? -ch : ch };
  });
  return (
    <div className={s.pick}>
      {b.kind === 'duel' && b.sym && (
        <p className={s.muted}>
          {t('wbat.duelStock', { name: BY_SYM[b.sym]?.name ?? b.sym, from: formatMoney(b.start[b.sym] ?? 0), now: formatMoney(price(b.sym)) })}
        </p>
      )}
      <ul className={s.fight}>
        {rows.map((r) => (
          <li key={r.p} className={done && b.winner === r.p ? s.winner : undefined}>
            <span>
              <b>{name(r.p)}</b> · {r.side ? sideName(r.side) : '–'}
              {b.kind === 'best' && r.sym && ` · ${BY_SYM[r.sym]?.name ?? r.sym}`}
            </span>
            {b.kind === 'best' && <span className="num">{formatPercent(r.yourWay)}</span>}
            {done && b.winner === r.p && <Badge tone="up">{t('wbat.won')}</Badge>}
          </li>
        ))}
      </ul>
      <p className={s.muted}>{done ? t('wbat.doneNote') : t('wbat.endsIn', { when: formatRelative(b.endsAt ?? now, now) })}</p>
    </div>
  );
}
