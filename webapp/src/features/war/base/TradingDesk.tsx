/**
 * The trading desk (owner 2026-11-02: "make the trading post features available when you upgrade
 * the trading headquarters to a certain level"). Headquarters level 3 opens it: 1 trader at level 3,
 * 2 at level 4, 3 at level 5. A trader works one territory you hold in one War, with a strategy and
 * a budget per trade you pick, and the server (functions/wartraders.py, every 5 minutes) buys and
 * sells that territory's companies with your War balance. Its trades count in that War's score like
 * yours. The screen only shows what the server decided.
 */
import { useState } from 'react';
import { formatMoney } from '../../../lib/format';
import { t, type MessageKey } from '../../../lib/i18n';
import { Button, Confirm } from '../../../ui';
import { useMyWars } from '../lobby';
import { SECTOR_NAME } from '../map';
import { DESK, deskSlots, hqLevel, STRATEGY_IDS, type Base, type StrategyId, type Trader } from './base';
import s from './Base.module.css';

type Act = (req: { action: 'baseHire'; strategy: StrategyId; warId: string; terr: string; budget: number } | { action: 'baseTrader'; id: string; on?: boolean; strategy?: StrategyId; budget?: number; fire?: boolean }, done?: () => void) => void;

const WHY: Record<'signal' | 'take' | 'stop', MessageKey> = { signal: 'wdesk.why.signal', take: 'wdesk.why.take', stop: 'wdesk.why.stop' };
const money0 = (n: number) => `$${n.toLocaleString('en-US')}`;

export function TradingDesk({ uid, base, busy, act }: { uid: string; base: Base; busy: boolean; act: Act }) {
  const hq = hqLevel(base);
  const wars = useMyWars(uid);
  const list = wars.status === 'ready' ? wars.data : [];
  const warName = (id: string) => list.find((w) => w.id === id)?.name ?? t('wdesk.aWar');
  // territories you hold now in a running War (the server checks again when you hire)
  const held = list.flatMap((w) => (w.status === 'active' && w.phase === 'holding' ? Object.entries(w.map).filter(([, c]) => c.state === 'owned' && c.owner === uid).map(([terr]) => ({ warId: w.id, war: w.name, terr })) : []));
  const slots = deskSlots(hq);

  if (hq < DESK.unlockHq)
    return (
      <section className={s.panel} aria-labelledby="desk-title">
        <p id="desk-title" className={s.panelTitle}>
          {t('wdesk.title')}
        </p>
        <p className={s.muted}>{t('wdesk.locked', { n: DESK.unlockHq, m: DESK.everyMin })}</p>
      </section>
    );
  return (
    <section className={s.panel} aria-labelledby="desk-title">
      <div className={s.panelHead}>
        <p id="desk-title" className={s.panelTitle}>
          {t('wdesk.title')}
        </p>
        <small className={s.muted}>{t('wdesk.seats', { n: base.traders.length, max: slots })}</small>
      </div>
      <p className={s.muted}>{t('wdesk.help', { m: DESK.everyMin })}</p>
      {base.traders.length > 0 && (
        <ul className={s.desk}>
          {base.traders.map((x) => (
            <TraderRow key={x.id} x={x} war={warName(x.warId)} holds={held.some((h) => h.warId === x.warId && h.terr === x.terr)} busy={busy} act={act} />
          ))}
        </ul>
      )}
      {base.traders.length < slots ? <Hire held={held} gold={base.gold} busy={busy} act={act} /> : <p className={s.muted}>{slots < DESK.count[DESK.count.length - 1]! ? t('wdesk.full', { n: hq + 1 }) : t('wdesk.fullMax')}</p>}
      <p className={s.fine}>{t('wdesk.fine')}</p>
    </section>
  );
}

function Choice<T extends string | number>({ label, value, options, show, onPick }: { label: string; value: T; options: readonly T[]; show: (v: T) => string; onPick: (v: T) => void }) {
  return (
    <div className={s.choice} role="group" aria-label={label}>
      <small className={s.muted}>{label}</small>
      <div className={s.row}>
        {options.map((o) => (
          <button key={o} type="button" className={`${s.pill} ${o === value ? s.pillOn : ''}`} aria-pressed={o === value} onClick={() => onPick(o)}>
            {show(o)}
          </button>
        ))}
      </div>
    </div>
  );
}

const strategyName = (id: StrategyId) => t(`wdesk.s.${id}`);

function Hire({ held, gold, busy, act }: { held: { warId: string; war: string; terr: string }[]; gold: number; busy: boolean; act: Act }) {
  const [where, setWhere] = useState(0);
  const [strategy, setStrategy] = useState<StrategyId>('dip');
  const [budget, setBudget] = useState<number>(DESK.budgets[1]);
  if (!held.length) return <p className={s.muted}>{t('wdesk.noLand')}</p>;
  const pick = held[Math.min(where, held.length - 1)]!;
  return (
    <div className={s.hire}>
      <p className={s.panelTitle}>{t('wdesk.hireTitle')}</p>
      <label className={s.choice}>
        <small className={s.muted}>{t('wdesk.where')}</small>
        <select className={s.select} value={where} onChange={(e) => setWhere(Number(e.target.value))}>
          {held.map((h, i) => (
            <option key={`${h.warId}-${h.terr}`} value={i}>
              {SECTOR_NAME[h.terr] ?? h.terr} · {h.war}
            </option>
          ))}
        </select>
      </label>
      <Choice label={t('wdesk.strategy')} value={strategy} options={STRATEGY_IDS} show={strategyName} onPick={setStrategy} />
      <p className={s.muted}>{t(`wdesk.s.${strategy}.about`)}</p>
      <Choice label={t('wdesk.budget')} value={budget} options={DESK.budgets} show={money0} onPick={setBudget} />
      <div className={s.row}>
        <Button variant="primary" disabled={busy || gold < DESK.hireGold} onClick={() => act({ action: 'baseHire', strategy, warId: pick.warId, terr: pick.terr, budget })}>
          {t('wdesk.hire', { g: DESK.hireGold.toLocaleString('en-US') })}
        </Button>
      </div>
      {gold < DESK.hireGold && <p className={s.why}>{t('wbase.why.gold')}</p>}
    </div>
  );
}

function TraderRow({ x, war, holds, busy, act }: { x: Trader; war: string; holds: boolean; busy: boolean; act: Act }) {
  const [editing, setEditing] = useState(false);
  const [firing, setFiring] = useState(false);
  const [strategy, setStrategy] = useState<StrategyId>(x.strategy);
  const [budget, setBudget] = useState<number>(x.budget);
  const terr = SECTOR_NAME[x.terr] ?? x.terr;
  const holding = Object.entries(x.pos);
  return (
    <li className={s.trader}>
      <div className={s.panelHead}>
        <span>
          <b>{t('wdesk.traderTitle', { s: strategyName(x.strategy), t: terr })}</b>
          <small className={s.muted}>
            {' '}
            · {war} · {t('wdesk.perTrade', { b: money0(x.budget) })}
          </small>
        </span>
        <small className={x.on ? s.up : s.muted}>{x.on ? t('wdesk.working') : t('wdesk.paused')}</small>
      </div>
      {!holds && <p className={s.why}>{t('wdesk.lost', { t: terr })}</p>}
      {holding.length > 0 && <p className={s.muted}>{t('wdesk.holding', { list: holding.map(([sym, p]) => `${p.qty} ${sym}`).join(', ') })}</p>}
      {x.log.length ? (
        <ul className={s.log} aria-label={t('wdesk.logLabel')}>
          {x.log.map((l) => (
            <li key={`${l.at}-${l.sym}-${l.side}`}>
              <span className={l.side === 'buy' ? s.up : s.down}>{t(l.side === 'buy' ? 'wdesk.bought' : 'wdesk.sold', { n: l.qty, sym: l.sym, p: formatMoney(l.price) })}</span> · {t(WHY[l.why])} · {new Date(l.at).toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' })}
            </li>
          ))}
        </ul>
      ) : (
        <p className={s.muted}>{t('wdesk.noTrades')}</p>
      )}
      {editing ? (
        <>
          <Choice label={t('wdesk.strategy')} value={strategy} options={STRATEGY_IDS} show={strategyName} onPick={setStrategy} />
          <Choice label={t('wdesk.budget')} value={budget} options={DESK.budgets} show={money0} onPick={setBudget} />
          <div className={s.row}>
            <Button variant="primary" disabled={busy} onClick={() => act({ action: 'baseTrader', id: x.id, strategy, budget }, () => setEditing(false))}>
              {t('wdesk.save')}
            </Button>
            <Button variant="ghost" onClick={() => setEditing(false)}>
              {t('wbase.cancel')}
            </Button>
          </div>
        </>
      ) : (
        <div className={s.row}>
          <Button variant="secondary" disabled={busy} onClick={() => act({ action: 'baseTrader', id: x.id, on: !x.on })}>
            {x.on ? t('wdesk.pause') : t('wdesk.resume')}
          </Button>
          <Button variant="ghost" disabled={busy} onClick={() => setEditing(true)}>
            {t('wdesk.change')}
          </Button>
          <Button variant="ghost" disabled={busy} onClick={() => setFiring(true)}>
            {t('wdesk.fire')}
          </Button>
        </div>
      )}
      <Confirm open={firing} title={t('wdesk.fireTitle')} action={t('wdesk.fire')} variant="danger" busy={busy} onClose={() => setFiring(false)} onConfirm={() => act({ action: 'baseTrader', id: x.id, fire: true }, () => setFiring(false))}>
        {t('wdesk.fireBody', { g: DESK.hireGold.toLocaleString('en-US') })}
      </Confirm>
    </li>
  );
}
