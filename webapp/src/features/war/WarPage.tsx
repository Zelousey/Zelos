/**
 * The War zone (/war): your War profile ($100,000 War balance and its chart) and the simulated,
 * always-on War zone market (made-up companies under real sector names), with a chart and a
 * buy/sell ticket. Everything says SIMULATED: the War zone never uses real prices and nothing
 * here says "live" (owner D10, §20). Hidden until all of War is built (owner 2026-10-29): it's
 * not in any menu, and anyone the server doesn't let in (not an admin yet) gets "Page not found".
 */
import { useId, useMemo, useState } from 'react';
import { useNow } from '../../lib/useNow';
import { formatMoney, formatPercent } from '../../lib/format';
import { t } from '../../lib/i18n';
import { readString, writeString } from '../../lib/storage';
import { Badge, Button, Card, Change, EmptyState, Field, Icon, LoadingState, PageHeader, Sheet, Sparkline, Tabs, useToast } from '../../ui';
import { ChartView } from '../charts/ChartView';
import { errorText } from '../invites/invites';
import { WarGate } from './Gate';
import { PrivateWars } from './PrivateWars';
import { WarZones } from './WarZones';
import {
  browserTz,
  BY_SYM,
  chaosNow,
  chartBars,
  clock,
  COMPANIES,
  QUIET_MAX_MIN,
  QUIET_TIMES,
  QUOTE_MAX_AGE_MS,
  battleRank,
  quietLength,
  SECTORS,
  setQuiet,
  START_BALANCE,
  useWarBars,
  useWarChaos,
  useWarProfile,
  useWarQuotes,
  warEquity,
  warTrade,
  type Quiet,
  type WarChaos,
  type WarProfile,
  type WarQuotes,
} from './war';
import s from './War.module.css';

const SEEN = 'zelosWarExplained';

export default function WarPage() {
  return <WarGate>{(uid) => <WarZone uid={uid} />}</WarGate>;
}

function WarZone({ uid }: { uid: string }) {
  const profile = useWarProfile(uid);
  const quotes = useWarQuotes();
  const [sym, setSym] = useState(COMPANIES[0]!.sym);
  const [explain, setExplain] = useState(() => readString(SEEN) !== '1');
  const chaosDoc = useWarChaos();
  const now = useNow(30000);
  const chaos = chaosDoc.status === 'ready' ? chaosDoc.data : null;
  const { banner, hot } = chaosNow(chaos, now);
  const q = quotes.status === 'ready' ? quotes.data : null;
  const p = profile.status === 'ready' ? profile.data : null;
  return (
    <>
      <PageHeader
        title={t('war.title')}
        keepOnPhone
        subtitle={
          <span className={s.meta}>
            <span className={s.simBadge}>{t('war.sim')}</span>
            <span>{t('war.subtitle')}</span>
          </span>
        }
      />
      {chaos && banner && <ChaosBanner c={chaos} live={banner === 'live'} />}
      <div className={s.cols}>
        <div className={s.stack}>
          <div className={s.balanceSlot}>{p ? <Balance p={p} q={q} /> : <LoadingState rows={2} />}</div>
          <div className={s.marketSlot}>
            <Market q={q} sym={sym} onPick={setSym} hot={hot} />
          </div>
        </div>
        <div className={s.stack}>
          <div className={s.companySlot}>
            <Company sym={sym} q={q} profile={p} hot={hot.has(sym)} />
          </div>
          {p && (
            <div className={s.holdingsSlot}>
              <Holdings p={p} q={q} onPick={setSym} />
            </div>
          )}
          {p && (
            <div className={s.warsSlot}>
              <WarZones uid={uid} p={p} />
            </div>
          )}
          <div className={s.warsSlot}>
            <PrivateWars uid={uid} />
          </div>
          {p && (
            <div className={s.quietSlot}>
              <QuietHours quiet={p.quiet} />
            </div>
          )}
        </div>
      </div>
      <Sheet
        open={explain}
        onClose={() => {
          writeString(SEEN, '1');
          setExplain(false);
        }}
        title={t('war.explain.title')}
        labelledBy="war-explain"
      >
        <div className={s.explain}>
          <span className={s.simBadge}>{t('war.sim')}</span>
          <p>{t('war.explain.body')}</p>
          <p className={s.muted}>{t('war.explain.real')}</p>
          <Button
            variant="primary"
            block
            onClick={() => {
              writeString(SEEN, '1');
              setExplain(false);
            }}
          >
            {t('war.explain.ok')}
          </Button>
        </div>
      </Sheet>
    </>
  );
}

function Balance({ p, q }: { p: WarProfile; q: WarQuotes | null }) {
  const eq = warEquity(p, q?.prices ?? {});
  const pnl = eq - p.start;
  const points = [...p.chart.map((x) => x.eq), eq];
  return (
    <Card pad>
      <div className={s.balance}>
        <span className={s.kicker}>{t('war.balance')}</span>
        <span className={s.big}>{formatMoney(eq)}</span>
        <Change abs={pnl} pct={(pnl / p.start) * 100} />
        <span className={s.muted}>{t('war.balanceLine', { cash: formatMoney(p.cash), start: formatMoney(START_BALANCE, { digits: 0 }) })}</span>
        {points.length > 1 && <Sparkline values={points} width={280} height={48} label={t('war.balanceChart')} />}
      </div>
      <BattleLevel points={p.battlePoints} />
    </Card>
  );
}

/** Battle Level (W6a): War-only ranks from War results; never goes down. */
function BattleLevel({ points }: { points: number }) {
  const r = battleRank(points);
  const pct = r.next ? Math.round(((points - r.from) / (r.next.at - r.from)) * 100) : 100;
  return (
    <div className={s.level}>
      <div className={s.levelHead}>
        <span className={s.kicker}>{t('wlvl.title')}</span>
        <b>{r.name}</b>
      </div>
      <div className={s.levelBar} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={t('wlvl.progress')}>
        <span style={{ width: `${pct}%` }} />
      </div>
      <span className={s.muted}>{r.next ? t('wlvl.next', { n: points, need: r.next.need, name: r.next.name }) : t('wlvl.top', { n: points })}</span>
    </div>
  );
}

function ChaosBanner({ c, live }: { c: WarChaos; live: boolean }) {
  const at = (ms: number) => new Date(ms).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return (
    <div className={[s.chaos, live && s.chaosLive].filter(Boolean).join(' ')} role="status">
      <Icon name="signal" size={18} />
      <div>
        <b>{live ? t('war.chaos.liveTitle', { scope: c.scopeName }) : t('war.chaos.warnTitle', { scope: c.scopeName, time: at(c.startsAt) })}</b>
        <p>{live ? t('war.chaos.liveBody', { time: c.endsAt ? at(c.endsAt) : '' }) : t('war.chaos.warnBody')}</p>
      </div>
    </div>
  );
}

function Market({ q, sym, onPick, hot }: { q: WarQuotes | null; sym: string; onPick: (s: string) => void; hot: Set<string> }) {
  return (
    <Card title={t('war.market')} subtitle={t('war.marketSub')} flush>
      {!q ? (
        <LoadingState rows={4} />
      ) : (
        SECTORS.map(([id, name]) => (
          <section key={id} className={s.sector} aria-label={name}>
            <h3 className={s.sectorName}>{name}</h3>
            <ul className={s.rows}>
              {COMPANIES.filter((c) => c.sector === id).map((c) => {
                const x = q.prices[c.sym];
                const chg = x && x.ref ? ((x.p - x.ref) / x.ref) * 100 : null;
                return (
                  <li key={c.sym}>
                    <button type="button" className={[s.row, c.sym === sym && s.on].filter(Boolean).join(' ')} aria-pressed={c.sym === sym} onClick={() => onPick(c.sym)}>
                      <span className={s.who}>
                        <b>
                          {c.name}
                          {hot.has(c.sym) && <span className={s.hot}>{t('war.hot')}</span>}
                        </b>
                        <small>{c.sym}</small>
                      </span>
                      <span className="num">{x ? formatMoney(x.p) : '–'}</span>
                      <Change pct={chg} className={s.chg} />
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      )}
    </Card>
  );
}

const TFS = [
  { value: '15', label: '15m', step: 15, range: 96 },
  { value: '60', label: '1H', step: 60, range: 120 },
] as const;

function Company({ sym, q, profile, hot }: { sym: string; q: WarQuotes | null; profile: WarProfile | null; hot: boolean }) {
  const c = BY_SYM[sym]!;
  const bars = useWarBars(sym);
  const [tf, setTf] = useState<(typeof TFS)[number]['value']>('15');
  const def = TFS.find((x) => x.value === tf)!;
  const price = q?.prices[sym]?.p;
  const built = useMemo(() => (bars.status === 'ready' ? chartBars(bars.data, def.step, price) : []), [bars, def.step, price]);
  return (
    <Card pad>
      <div className={s.coHead}>
        <div>
          <h2 className={s.coName}>{c.name}</h2>
          <span className={s.muted}>
            {c.sym} · {SECTORS.find(([id]) => id === c.sector)?.[1]}
            {hot && <span className={s.hot}>{t('war.hot')}</span>}
          </span>
        </div>
        <span className={s.big}>{price ? formatMoney(price) : '–'}</span>
      </div>
      <Tabs label={t('war.timeframe')} items={TFS.map((x) => ({ value: x.value, label: x.label }))} value={tf} onChange={setTf} />
      <div className={s.simChart}>
        <span className={s.chartTag} aria-hidden="true">
          {t('war.sim')}
        </span>
        {bars.status === 'loading' ? (
          <LoadingState rows={4} />
        ) : built.length === 0 ? (
          <EmptyState icon="chart" body={t('war.noBars')} compact />
        ) : (
          <ChartView sym={`WAR:${sym}`} seriesKey={`war:${sym}:${tf}`} bars={built} intraday range={def.range} style="candles" label={t('war.chartLabel', { name: c.name, tf: def.label })} />
        )}
      </div>
      {profile && <Ticket sym={sym} q={q} profile={profile} />}
    </Card>
  );
}

function Ticket({ sym, q, profile }: { sym: string; q: WarQuotes | null; profile: WarProfile }) {
  const toast = useToast();
  const [side, setSide] = useState<'buy' | 'sell'>('buy');
  const [qty, setQty] = useState('1');
  const [busy, setBusy] = useState(false);
  const price = q?.prices[sym]?.p ?? 0;
  const now = useNow(15000);
  const fresh = !!q && now - q.updatedAt <= QUOTE_MAX_AGE_MS;
  const held = profile.positions.find((p) => p.sym === sym)?.qty ?? 0;
  const n = Number.parseInt(qty, 10);
  const valid = Number.isInteger(n) && n > 0 && (side === 'sell' ? n <= held : n * price <= profile.cash);
  async function go(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;
    setBusy(true);
    try {
      const r = await warTrade({ sym, side, qty: n });
      toast.show(t(side === 'buy' ? 'war.bought' : 'war.sold', { qty: n, sym, price: formatMoney(r.fill.price) }), 'success');
    } catch (err) {
      toast.show(errorText(err, t('war.failed')), 'error');
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className={s.ticket} onSubmit={go}>
      <Tabs label={t('war.side')} stretch items={[{ value: 'buy', label: t('war.buy') }, { value: 'sell', label: t('war.sell') }]} value={side} onChange={setSide} />
      <Field label={t('war.shares')} inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))} hint={side === 'sell' ? t('war.youHold', { n: held }) : t('war.cash', { cash: formatMoney(profile.cash) })} />
      <p className={s.muted}>{valid ? t('war.estimate', { value: formatMoney(n * price) }) : side === 'sell' && n > held ? t('war.notHeld', { n: held }) : t('war.tooMuch')}</p>
      {!fresh && <p className={s.warn}>{t('war.stale')}</p>}
      <Button type="submit" variant={side === 'buy' ? 'buy' : 'sell'} size="lg" block disabled={busy || !valid || !fresh}>
        {t(side === 'buy' ? 'war.buyGo' : 'war.sellGo', { qty: Number.isInteger(n) && n > 0 ? n : 0, sym })}
      </Button>
    </form>
  );
}

function Holdings({ p, q, onPick }: { p: WarProfile; q: WarQuotes | null; onPick: (s: string) => void }) {
  return (
    <Card title={t('war.positions')} flush>
      {p.positions.length === 0 ? (
        <EmptyState icon="war" body={t('war.noPositions')} compact />
      ) : (
        <ul className={s.rows}>
          {p.positions.map((x) => {
            const now = q?.prices[x.sym]?.p ?? x.avg;
            const pct = ((now - x.avg) / x.avg) * 100;
            return (
              <li key={x.sym}>
                <button type="button" className={s.row} onClick={() => onPick(x.sym)}>
                  <span className={s.who}>
                    <b>{BY_SYM[x.sym]?.name}</b>
                    <small>{t('war.holding', { qty: x.qty, avg: formatMoney(x.avg) })}</small>
                  </span>
                  <span className="num">{formatMoney(x.qty * now)}</span>
                  <Badge tone={pct >= 0 ? 'up' : 'down'}>{formatPercent(pct)}</Badge>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

/** Your quiet hours (§22): no War notifications then, and one morning summary of what happened. */
function QuietHours({ quiet }: { quiet: Quiet | null }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const cur = quiet ?? { start: 1320, end: 480, tz: browserTz() };
  const [start, setStart] = useState(cur.start);
  const [end, setEnd] = useState(cur.end);
  const [busy, setBusy] = useState(false);
  const off = quietLength(cur) === 0;
  const len = quietLength({ start, end });
  const tooLong = len > QUIET_MAX_MIN;
  const tz = browserTz();
  async function save(next: { start: number; end: number }) {
    setBusy(true);
    try {
      await setQuiet({ ...next, tz });
      toast.show(t('war.quiet.saved'), 'success');
      setOpen(false);
    } catch (err) {
      toast.show(errorText(err, t('war.quiet.failed')), 'error');
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card title={t('war.quiet.title')} subtitle={t('war.quiet.sub')} pad>
      <div className={s.quiet}>
        <p className={s.quietLine}>
          <Icon name="moon" size={16} />
          {off ? t('war.quiet.off') : t('war.quiet.line', { from: clock(cur.start), to: clock(cur.end) })}
        </p>
        {cur.tz !== tz && <p className={s.muted}>{t('war.quiet.tz', { tz: cur.tz })}</p>}
        <Button
          variant="ghost"
          onClick={() => {
            setStart(cur.start);
            setEnd(cur.end);
            setOpen(true);
          }}
        >
          {t('war.quiet.change')}
        </Button>
      </div>
      <Sheet open={open} onClose={() => setOpen(false)} title={t('war.quiet.title')} labelledBy="war-quiet">
        <form
          className={s.explain}
          onSubmit={(e) => {
            e.preventDefault();
            if (!tooLong) void save({ start, end });
          }}
        >
          <p className={s.muted}>{t('war.quiet.help')}</p>
          <div className={s.times}>
            <TimePick label={t('war.quiet.from')} value={start} onChange={setStart} />
            <TimePick label={t('war.quiet.to')} value={end} onChange={setEnd} />
          </div>
          <p className={tooLong ? s.warn : s.muted} role={tooLong ? 'alert' : undefined}>
            {tooLong ? t('war.quiet.tooLong') : len === 0 ? t('war.quiet.offNote') : t('war.quiet.length', { h: Math.floor(len / 60), m: String(len % 60).padStart(2, '0') })}
          </p>
          <Button type="submit" variant="primary" block disabled={busy || tooLong}>
            {t('war.quiet.save')}
          </Button>
        </form>
      </Sheet>
    </Card>
  );
}

function TimePick({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  const id = useId();
  return (
    <div className={s.select}>
      <label htmlFor={id}>{label}</label>
      <select id={id} value={value} onChange={(e) => onChange(Number(e.target.value))}>
        {QUIET_TIMES.map((m) => (
          <option key={m} value={m}>
            {clock(m)}
          </option>
        ))}
      </select>
    </div>
  );
}
