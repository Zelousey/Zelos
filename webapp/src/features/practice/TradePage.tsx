/**
 * Trade a stock with the practice account: chart (with stop-loss / take-profit boxes you can
 * drag) and the order ticket. Buy or Sell; Market, Limit or Stop; Today or Until cancelled;
 * optional bracket (stop-loss + take-profit) on buys. The ticket checks your input like the
 * server does, a confirm step shows exactly what will be sent, and the server decides.
 */
import { useCallback, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { SYMBOL_RE } from "../../data/markets";
import { instrument } from "../../data/universe";
import { useAuth } from "../../lib/auth";
import { formatMoney, formatPrice } from "../../lib/format";
import { t } from "../../lib/i18n";
import { readString, writeString } from "../../lib/storage";
import {
  Badge,
  Button,
  buttonClass,
  Card,
  Change,
  Confirm,
  EmptyState,
  ErrorState,
  Field,
  LoadingState,
  Tabs,
  useToast,
} from "../../ui";
import { ChartView } from "../charts/ChartView";
import type { Forecast } from "../charts/engine";
import { nyDay, TIMEFRAMES, type Timeframe } from "../charts/series";
import { useSymbolBars } from "../charts/useSymbolBars";
import { StatusLine } from "../markets/StatusLine";
import { useVolMap } from "../options/model";
import { OptionTicket } from "../options/OptionTicket";
import { sellableShares, usePracticeAccount, valueAccount } from "./account";
import { errorMessage, placeOrder } from "./actions";
import { checkTicket, maxShares, type TicketInput } from "./ticket";
import s from "./TradePage.module.css";

const TF_KEY = "zelosAppTradeTf";
const msg = (k: string, vars?: Record<string, string | number>) =>
  t(k as never, vars);
const CHART_TFS: Timeframe[] = ["15m", "1h", "D"];

export default function TradePage() {
  const raw = (useParams().sym ?? "").toUpperCase();
  const inst = SYMBOL_RE.test(raw) ? instrument(raw) : undefined;
  const { user, isReal, ready } = useAuth();
  const uid = isReal && user ? user.uid : null;
  const acct = usePracticeAccount(uid);
  if (!inst) {
    return (
      <Card>
        <EmptyState
          icon="search"
          title={t("markets.unknown.title", {
            sym: SYMBOL_RE.test(raw) ? raw : "?",
          })}
          body={t("markets.unknown.body", {
            sym: SYMBOL_RE.test(raw) ? raw : "That symbol",
          })}
          actions={
            <Link
              className={buttonClass({ variant: "secondary" })}
              to="/markets"
            >
              {t("markets.backToMarkets")}
            </Link>
          }
        />
      </Card>
    );
  }
  if (!ready || (uid && acct.status === "loading"))
    return <LoadingState rows={6} />;
  if (!uid || acct.status === "missing") {
    return (
      <Card>
        <EmptyState
          icon="practice"
          body={uid ? t("trade.needAccount") : t("practice.signIn")}
          actions={
            <Link
              className={buttonClass({ variant: "primary" })}
              to="/practice"
            >
              {t("trade.openAccount")}
            </Link>
          }
        />
      </Card>
    );
  }
  if (acct.status === "error") return <ErrorState />;
  return <Ticket key={inst.sym} sym={inst.sym} name={inst.name} uid={uid} />;
}

function Ticket({
  sym,
  name,
  uid,
}: {
  sym: string;
  name: string;
  uid: string;
}) {
  const acctState = usePracticeAccount(uid);
  const acct = acctState.status === "ready" ? acctState.data : null;
  const [tf, setTfState] = useState<Timeframe>(() => {
    const v = readString(TF_KEY);
    return v === "15m" || v === "1h" || v === "D" ? v : "D";
  });
  const tfDef = TIMEFRAMES.find((x) => x.id === tf)!;
  const { quotes, quote, built, loading } = useSymbolBars(sym, tf);
  const last = quote?.c ?? built.bars[built.bars.length - 1]?.[4] ?? null;
  const qs = useMemo(
    () => (quotes.status === "ready" ? quotes.data.quotes : {}),
    [quotes],
  );
  const vols = useVolMap();
  const [today] = useState(() => nyDay(Date.now()));
  const v = useMemo(
    () => (acct ? valueAccount(acct, qs, today, vols) : null),
    [acct, qs, today, vols],
  );
  const sellable = acct ? sellableShares(acct, sym) : 0;
  const held = acct?.positions.find((p) => p.sym === sym)?.qty ?? 0;

  // /practice/trade/AAPL?side=sell&mode=options: the chart's Buy / Sell buttons pick the side
  const [params, setParams] = useSearchParams();
  const mode = params.get("mode") === "options" ? "options" : "stock";
  const setMode = (m: "stock" | "options") =>
    setParams(
      (p) => {
        if (m === "options") p.set("mode", "options");
        else p.delete("mode");
        return p;
      },
      { replace: true },
    );
  const [input, setInput] = useState<TicketInput>({
    side: params.get("side") === "sell" ? "sell" : "buy",
    type: "market",
    qty: "1",
    limit: "",
    stop: "",
    tif: "day",
    bracketOn: false,
    sl: "",
    tp: "",
  });
  const set = (patch: Partial<TicketInput>) =>
    setInput((x) => ({ ...x, ...patch }));
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const navigate = useNavigate();

  const bp = v?.buyingPower ?? 0;
  const check = useMemo(
    () => checkTicket(sym, input, last, bp, sellable, msg),
    [sym, input, last, bp, sellable],
  );
  const showErrors = input.qty !== "";

  // chart boxes: green = take-profit, red = stop-loss, both draggable
  const entry = check.entry;
  const forecast: Forecast | null = useMemo(() => {
    if (input.side !== "buy" || !input.bracketOn || entry == null) return null;
    const sl = Number(input.sl) || null;
    const tp = Number(input.tp) || null;
    return { entry, sl, tp, side: "buy", editable: true, label: `${sym} plan` };
  }, [input.side, input.bracketOn, input.sl, input.tp, entry, sym]);
  const onForecastEdit = useCallback((f: Forecast) => {
    setInput((x) => ({
      ...x,
      sl: f.sl != null ? f.sl.toFixed(2) : x.sl,
      tp: f.tp != null ? f.tp.toFixed(2) : x.tp,
    }));
  }, []);

  function toggleBracket(on: boolean) {
    const e = check.entry ?? last;
    set({
      bracketOn: on,
      ...(on && e && !input.sl && !input.tp
        ? { sl: (e * 0.95).toFixed(2), tp: (e * 1.1).toFixed(2) }
        : {}),
    });
  }

  async function submit() {
    if (!check.request) return;
    setBusy(true);
    try {
      await placeOrder(check.request);
      toast.show(
        t("trade.placed", {
          side: input.side === "buy" ? t("trade.buy") : t("trade.sell"),
          qty: check.request.qty,
          sym,
        }),
        "success",
      );
      setConfirming(false);
      navigate("/practice");
    } catch (e) {
      toast.show(errorMessage(e), "error");
    } finally {
      setBusy(false);
    }
  }

  const sideLabel = input.side === "buy" ? t("trade.buy") : t("trade.sell");
  return (
    <>
      <div className={s.head}>
        <div>
          <h1 className={s.sym}>
            {sym} <Badge tone="accent">{t("practice.virtual")}</Badge>
          </h1>
          <span className={s.name}>
            {name} ·{" "}
            <Link to={`/options/${sym}`}>{t("trade.options", { sym })}</Link>
          </span>
        </div>
        <div className={s.px}>
          <span className={s.last}>{formatPrice(last)}</span>
          <Change pct={quote?.chPct} />
        </div>
      </div>
      <StatusLine quotes={quotes} />
      <div className={s.layout}>
        <Card>
          <div className={s.chartControls}>
            <Tabs
              label={t("chart.timeframe")}
              value={tf}
              onChange={(x) => {
                setTfState(x);
                writeString(TF_KEY, x);
              }}
              items={CHART_TFS.map((id) => ({
                value: id,
                label: TIMEFRAMES.find((z) => z.id === id)!.label,
              }))}
            />
          </div>
          <div className={s.chartBody}>
            {built.bars.length === 0 && !loading ? (
              <EmptyState
                icon="chart"
                body={
                  built.intraday
                    ? t("chart.noIntraday")
                    : t("chart.noData", { sym })
                }
                compact
              />
            ) : (
              <ChartView
                sym={sym}
                seriesKey={`${sym}:${tf}:trade`}
                bars={built.bars}
                live={built.live}
                intraday={built.intraday}
                range={tfDef.def}
                style="candles"
                forecast={forecast}
                onForecastEdit={onForecastEdit}
                loading={loading}
                label={t("chart.label", { sym, tf: tfDef.label })}
              />
            )}
          </div>
        </Card>

        <Card
          title={t("trade.ticket")}
          subtitle={`${t("practice.buyingPower")}: ${formatMoney(v?.buyingPower)}${held ? ` · ${held} ${sym}` : ""}`}
        >
          <div className={s.ticketTop}>
            <Tabs
              stretch
              label={t("trade.side")}
              value={input.side}
              onChange={(side) => set({ side })}
              items={[
                { value: "buy", label: t("trade.buy") },
                { value: "sell", label: t("trade.sell") },
              ]}
            />
            <Tabs
              stretch
              label={t("trade.mode")}
              value={mode}
              onChange={setMode}
              items={[
                { value: "stock", label: t("trade.mode.stock") },
                { value: "options", label: t("trade.mode.options") },
              ]}
            />
          </div>
          {mode === "options" ? (
            <OptionTicket
              sym={sym}
              side={input.side}
              S={last}
              today={today}
              acct={acct}
              valued={v}
            />
          ) : (
            <form
              className={s.ticket}
              onSubmit={(e) => {
                e.preventDefault();
                if (check.ok) setConfirming(true);
              }}
              noValidate
            >
              <Tabs
                stretch
                label={t("trade.type")}
                value={input.type}
                onChange={(type) =>
                  set({
                    type,
                    limit:
                      type === "limit" && !input.limit && last
                        ? last.toFixed(2)
                        : input.limit,
                    stop:
                      type === "stop" && !input.stop && last
                        ? last.toFixed(2)
                        : input.stop,
                  })
                }
                items={[
                  { value: "market", label: t("trade.market") },
                  { value: "limit", label: t("trade.limit") },
                  { value: "stop", label: t("trade.stop") },
                ]}
              />
              <div className={s.qtyRow}>
                <Field
                  label={t("trade.qty")}
                  inputMode="numeric"
                  value={input.qty}
                  onChange={(e) =>
                    set({ qty: e.target.value.replace(/[^\d]/g, "") })
                  }
                  error={showErrors ? check.errors.qty : undefined}
                  hint={
                    input.side === "sell"
                      ? t("trade.sellable", { qty: sellable })
                      : undefined
                  }
                />
                <Button
                  variant="secondary"
                  onClick={() =>
                    set({
                      qty: String(
                        input.side === "buy"
                          ? maxShares(v?.buyingPower ?? 0, check.entry ?? last)
                          : sellable,
                      ),
                    })
                  }
                >
                  {t("trade.max")}
                </Button>
              </div>
              {input.type === "limit" && (
                <Field
                  label={t("trade.limitPrice")}
                  prefix="$"
                  inputMode="decimal"
                  value={input.limit}
                  onChange={(e) => set({ limit: e.target.value })}
                  error={check.errors.limit}
                />
              )}
              {input.type === "stop" && (
                <Field
                  label={t("trade.stopPrice")}
                  prefix="$"
                  inputMode="decimal"
                  value={input.stop}
                  onChange={(e) => set({ stop: e.target.value })}
                  error={check.errors.stop}
                />
              )}
              {input.type !== "market" && (
                <Tabs
                  stretch
                  label={t("trade.tif")}
                  value={input.tif}
                  onChange={(tif) => set({ tif })}
                  items={[
                    { value: "day", label: t("trade.day") },
                    { value: "gtc", label: t("trade.gtc") },
                  ]}
                />
              )}
              {input.side === "buy" && (
                <div className={s.bracket}>
                  <label className={s.toggle}>
                    <input
                      type="checkbox"
                      checked={input.bracketOn}
                      onChange={(e) => toggleBracket(e.target.checked)}
                    />
                    {t("trade.stopLoss")} + {t("trade.takeProfit")}
                  </label>
                  {input.bracketOn && (
                    <>
                      <div className={s.row2}>
                        <Field
                          label={t("trade.stopLoss")}
                          prefix="$"
                          inputMode="decimal"
                          value={input.sl}
                          onChange={(e) => set({ sl: e.target.value })}
                          error={check.errors.sl}
                        />
                        <Field
                          label={t("trade.takeProfit")}
                          prefix="$"
                          inputMode="decimal"
                          value={input.tp}
                          onChange={(e) => set({ tp: e.target.value })}
                          error={check.errors.tp}
                        />
                      </div>
                      <span className={s.hint}>{t("trade.bracketHint")}</span>
                    </>
                  )}
                </div>
              )}
              {check.cost != null && (
                <div className={s.summary} aria-live="polite">
                  <span>
                    {t("trade.estimate", { side: sideLabel.toLowerCase() })}
                  </span>
                  <span className="num">
                    {t("trade.estimateValue", {
                      qty: input.qty || 0,
                      price: formatPrice(check.entry),
                      total: formatMoney(check.cost),
                    })}
                  </span>
                  {check.risk != null &&
                    check.reward != null &&
                    check.risk > 0 && (
                      <span>
                        {t("trade.risk", {
                          risk: formatMoney(check.risk),
                          reward: formatMoney(check.reward),
                          ratio: (check.reward / check.risk).toFixed(1),
                        })}
                      </span>
                    )}
                </div>
              )}
              <Button
                type="submit"
                variant={input.side === "buy" ? "buy" : "sell"}
                size="lg"
                block
                disabled={!check.ok}
              >
                {t("trade.review")}
              </Button>
              <p className={s.note}>{t("practice.fillNote")}</p>
            </form>
          )}
        </Card>
      </div>

      <Confirm
        open={confirming}
        title={t("trade.confirmTitle")}
        action={
          busy
            ? t("trade.placing")
            : `${t("trade.place")}: ${sideLabel} ${check.request?.qty ?? ""} ${sym}`
        }
        variant={input.side === "buy" ? "buy" : "sell"}
        busy={busy}
        onClose={() => setConfirming(false)}
        onConfirm={() => void submit()}
      >
        {check.request && (
          <dl className={s.confirm}>
            <dt>{t("trade.side")}</dt>
            <dd>
              {sideLabel} {check.request.qty} {sym}
            </dd>
            <dt>{t("trade.type")}</dt>
            <dd>
              {check.request.type === "market"
                ? t("trade.market")
                : check.request.type === "limit"
                  ? `${t("trade.limit")} ${formatPrice(check.request.limit)}`
                  : `${t("trade.stop")} ${formatPrice(check.request.stop)}`}{" "}
              · {check.request.tif === "gtc" ? t("trade.gtc") : t("trade.day")}
            </dd>
            {check.request.bracket && (
              <>
                <dt>
                  {t("trade.stopLoss")} / {t("trade.takeProfit")}
                </dt>
                <dd>
                  {formatPrice(check.request.bracket.sl)} /{" "}
                  {formatPrice(check.request.bracket.tp)}
                </dd>
              </>
            )}
            <dt>{t("trade.estimate", { side: sideLabel.toLowerCase() })}</dt>
            <dd>{formatMoney(check.cost)}</dd>
            <dd style={{ fontFamily: "var(--sans)", color: "var(--muted)" }}>
              {t("practice.fillNote")}
            </dd>
          </dl>
        )}
      </Confirm>
    </>
  );
}
