/**
 * The War zone (/war): your War profile ($100,000 War balance and its chart) and the simulated,
 * always-on War zone market (made-up companies under real sector names), with a chart and a
 * buy/sell ticket. Everything says SIMULATED: the War zone never uses real prices and nothing
 * here says "live" (owner D10, §20). Hidden until all of War is built (owner 2026-10-29): it's
 * not in any menu, and anyone the server doesn't let in (not an admin yet) gets "Page not found".
 */
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../lib/auth';
import { useNow } from '../../lib/useNow';
import { formatMoney, formatPercent } from '../../lib/format';
import { t } from '../../lib/i18n';
import { readString, writeString } from '../../lib/storage';
import { Badge, Button, Card, Change, EmptyState, Field, LoadingState, PageHeader, Sheet, Sparkline, Tabs, useToast } from '../../ui';
import { ChartView } from '../charts/ChartView';
import { errorText } from '../invites/invites';
import NotFoundPage from '../notfound/NotFoundPage';
import { BY_SYM, chartBars, COMPANIES, openWar, QUOTE_MAX_AGE_MS, SECTORS, START_BALANCE, useWarBars, useWarProfile, useWarQuotes, warEquity, warTrade, type WarProfile, type WarQuotes } from './war';
import s from './War.module.css';

const SEEN = 'zelosWarExplained';

export default function WarPage() {
  const { user, isReal, ready } = useAuth();
  const uid = ready && user && isReal ? user.uid : null;
  const [access, setAccess] = useState<{ uid: string; ok: boolean } | null>(null);
  useEffect(() => {
    if (!uid) return;
    let live = true;
    openWar()
      .then(() => live && setAccess({ uid, ok: true }))
      .catch(() => live && setAccess({ uid, ok: false }));
    return () => {
      live = false;
    };
  }, [uid]);
  if (!ready || (uid && access?.uid !== uid)) return <LoadingState rows={6} />;
  if (!uid || !access?.ok) return <NotFoundPage />;
  return <WarZone uid={uid} />;
}

function WarZone({ uid }: { uid: string }) {
  const profile = useWarProfile(uid);
  const quotes = useWarQuotes();
  const [sym, setSym] = useState(COMPANIES[0]!.sym);
  const [explain, setExplain] = useState(() => readString(SEEN) !== '1');
  const q = quotes.status === 'ready' ? quotes.data : null;
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
      <div className={s.cols}>
        <div className={s.stack}>
          {profile.status === 'ready' ? <Balance p={profile.data} q={q} /> : <LoadingState rows={2} />}
          <Market q={q} sym={sym} onPick={setSym} />
        </div>
        <div className={s.stack}>
          <Company sym={sym} q={q} profile={profile.status === 'ready' ? profile.data : null} />
          {profile.status === 'ready' && <Holdings p={profile.data} q={q} onPick={setSym} />}
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
    </Card>
  );
}

function Market({ q, sym, onPick }: { q: WarQuotes | null; sym: string; onPick: (s: string) => void }) {
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
                        <b>{c.name}</b>
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

function Company({ sym, q, profile }: { sym: string; q: WarQuotes | null; profile: WarProfile | null }) {
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
