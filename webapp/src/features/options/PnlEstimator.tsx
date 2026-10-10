/**
 * Estimated P&L (owner 2026-10-10: "an estimated P&L like Robinhood on the options"): pick a
 * stock price and a date with the sliders and see what the trade would make or lose, with the
 * curve for that date and the curve at expiration. Hover/drag on the chart to read any price.
 * Same price model as the server, so it's an estimate of the modeled price, not a promise.
 */
import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  formatDate,
  formatMoney,
  formatPrice,
  formatSignedMoney,
} from "../../lib/format";
import { t } from "../../lib/i18n";
import {
  breakeven,
  curve,
  dayChoices,
  pnlOn,
  priceRange,
  type Leg,
  type Point,
} from "./pnl";
import s from "./Pnl.module.css";

type Props = {
  sym: string;
  leg: Leg;
  paid: number;
  qty: number;
  S: number;
  vol: number;
  today: string;
  title?: string;
};

const H = 200;
const PAD = { l: 8, r: 8, t: 12, b: 22 };

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(320);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver !== "function") return;
    const ro = new ResizeObserver(([e]) =>
      setW(Math.max(220, Math.round(e!.contentRect.width))),
    );
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

export function PnlEstimator({
  sym,
  leg,
  paid,
  qty,
  S,
  vol,
  today,
  title,
}: Props) {
  const days = useMemo(() => dayChoices(today, leg.exp), [today, leg.exp]);
  const range = useMemo(() => priceRange(S, leg, paid), [S, leg, paid]);
  const [target, setTarget] = useState(() => {
    const st = S < 25 ? 0.05 : S < 200 ? 0.25 : 1;
    return +(Math.round((S * 1.05) / st) * st).toFixed(2);
  });
  const [dayIdx, setDayIdx] = useState(days.length - 1); // expiration first, like Robinhood
  const day = days[Math.min(dayIdx, days.length - 1)]!;
  const atExp = day >= leg.exp;
  const onDay = useMemo(
    () => curve(leg, paid, qty, day, vol, range),
    [leg, paid, qty, day, vol, range],
  );
  const atExpiry = useMemo(
    () => curve(leg, paid, qty, leg.exp, vol, range),
    [leg, paid, qty, vol, range],
  );
  const pnl = pnlOn(leg, paid, qty, target, day, vol);
  const cost = paid * 100 * qty;
  const priceId = useId();
  const dateId = useId();
  const tableId = useId();
  const step = S < 25 ? 0.05 : S < 200 ? 0.25 : 1;
  // slider ends on whole steps, so any price on the grid (like $300.00) is a valid value
  const sMin = Math.max(step, Math.floor(range[0] / step) * step);
  const sMax = Math.ceil(range[1] / step) * step;
  const be = breakeven(leg, paid);

  return (
    <section className={s.box} aria-label={title ?? t("pnl.title")}>
      <h3 className={s.title}>{title ?? t("pnl.title")}</h3>
      <p className={s.headline} aria-live="polite">
        {t(atExp ? "pnl.ifAtExp" : "pnl.ifOn", {
          sym,
          price: formatMoney(target),
          date: formatDate(day + "T12:00:00Z"),
        })}
        <b className={pnl >= 0 ? s.up : s.down}>
          {formatSignedMoney(pnl)}{" "}
          <small>
            (
            {cost
              ? `${pnl >= 0 ? "+" : ""}${((pnl / cost) * 100).toFixed(0)}%`
              : "—"}
            )
          </small>
        </b>
      </p>
      <Chart
        onDay={onDay}
        atExpiry={atExpiry}
        showBoth={!atExp}
        range={range}
        S={S}
        target={target}
        be={be}
        onPick={setTarget}
      />
      <ul className={s.legend}>
        {!atExp && (
          <li>
            <i className={s.keyDay} aria-hidden="true" />
            {t("pnl.onDate", { date: formatDate(day + "T12:00:00Z") })}
          </li>
        )}
        <li>
          <i className={atExp ? s.keyDay : s.keyExp} aria-hidden="true" />
          {t("pnl.atExp")}
        </li>
        <li>
          <i className={s.keyNow} aria-hidden="true" />
          {t("pnl.now", { price: formatMoney(S) })}
        </li>
      </ul>
      <label className={s.slider} htmlFor={priceId}>
        <span>
          {t("pnl.price")} <b className="num">{formatMoney(target)}</b>
        </span>
        <input
          id={priceId}
          type="range"
          min={sMin}
          max={sMax}
          step={step}
          value={target}
          onChange={(e) => setTarget(+e.target.value)}
        />
      </label>
      <label className={s.slider} htmlFor={dateId}>
        <span>
          {t("pnl.date")}{" "}
          <b>
            {atExp
              ? t("pnl.expDay", { date: formatDate(day + "T12:00:00Z") })
              : formatDate(day + "T12:00:00Z")}
          </b>
        </span>
        <input
          id={dateId}
          type="range"
          min={0}
          max={days.length - 1}
          step={1}
          value={Math.min(dayIdx, days.length - 1)}
          onChange={(e) => setDayIdx(+e.target.value)}
        />
      </label>
      <p className={s.facts}>
        {t("pnl.facts", { be: formatMoney(be), loss: formatMoney(cost) })}
      </p>
      <details className={s.table}>
        <summary>{t("pnl.table")}</summary>
        <table aria-describedby={tableId}>
          <caption id={tableId}>
            {t("pnl.tableCaption", { date: formatDate(day + "T12:00:00Z") })}
          </caption>
          <thead>
            <tr>
              <th scope="col">{t("pnl.col.price")}</th>
              <th scope="col">{t("pnl.col.pnl")}</th>
            </tr>
          </thead>
          <tbody className="num">
            {[-0.2, -0.1, -0.05, 0, 0.05, 0.1, 0.2].map((m) => {
              const p = +(S * (1 + m)).toFixed(2);
              return (
                <tr key={m}>
                  <td>
                    {formatPrice(p)}{" "}
                    <small>
                      (
                      {m === 0
                        ? t("pnl.today")
                        : `${m > 0 ? "+" : ""}${Math.round(m * 100)}%`}
                      )
                    </small>
                  </td>
                  <td>
                    {formatSignedMoney(pnlOn(leg, paid, qty, p, day, vol))}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </details>
      <p className={s.note}>{t("pnl.note")}</p>
    </section>
  );
}

function Chart({
  onDay,
  atExpiry,
  showBoth,
  range,
  S,
  target,
  be,
  onPick,
}: {
  onDay: Point[];
  atExpiry: Point[];
  showBoth: boolean;
  range: [number, number];
  S: number;
  target: number;
  be: number;
  onPick: (S: number) => void;
}) {
  const [ref, W] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const all = showBoth ? [...onDay, ...atExpiry] : onDay;
  let lo = Math.min(0, ...all.map((p) => p.pnl));
  let hi = Math.max(0, ...all.map((p) => p.pnl));
  const padY = (hi - lo) * 0.08 || 1;
  lo -= padY;
  hi += padY;
  const x = (v: number) =>
    PAD.l + ((v - range[0]) / (range[1] - range[0])) * (W - PAD.l - PAD.r);
  const y = (v: number) => PAD.t + ((hi - v) / (hi - lo)) * (H - PAD.t - PAD.b);
  const path = (pts: Point[]) =>
    pts
      .map(
        (p, i) => `${i ? "L" : "M"}${x(p.S).toFixed(1)},${y(p.pnl).toFixed(1)}`,
      )
      .join("");
  const zero = y(0);
  const area = `${path(onDay)}L${x(range[1]).toFixed(1)},${zero.toFixed(1)}L${x(range[0]).toFixed(1)},${zero.toFixed(1)}Z`;
  const priceAt = (px: number) =>
    range[0] + ((px - PAD.l) / (W - PAD.l - PAD.r)) * (range[1] - range[0]);
  const hv =
    hover != null
      ? onDay.reduce(
          (b, p) => (Math.abs(p.S - hover) < Math.abs(b.S - hover) ? p : b),
          onDay[0]!,
        )
      : null;
  const clipUp = useId();
  const clipDown = useId();
  const pick = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return Math.min(
      range[1],
      Math.max(range[0], priceAt(((e.clientX - r.left) / r.width) * W)),
    );
  };
  return (
    <div ref={ref} className={s.chart}>
      <svg
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={t("pnl.chartLabel")}
        onPointerMove={(e) => {
          const p = pick(e);
          setHover(p);
          if (e.buttons) onPick(+p.toFixed(2));
        }}
        onPointerLeave={() => setHover(null)}
        onPointerDown={(e) => onPick(+pick(e).toFixed(2))}
      >
        <defs>
          <clipPath id={clipUp}>
            <rect x={0} y={0} width={W} height={Math.max(0, zero)} />
          </clipPath>
          <clipPath id={clipDown}>
            <rect x={0} y={zero} width={W} height={Math.max(0, H - zero)} />
          </clipPath>
        </defs>
        <path d={area} className={s.areaUp} clipPath={`url(#${clipUp})`} />
        <path d={area} className={s.areaDown} clipPath={`url(#${clipDown})`} />
        <line
          x1={PAD.l}
          x2={W - PAD.r}
          y1={zero}
          y2={zero}
          className={s.zero}
        />
        <line x1={x(S)} x2={x(S)} y1={PAD.t} y2={H - PAD.b} className={s.now} />
        {be > range[0] && be < range[1] && (
          <line
            x1={x(be)}
            x2={x(be)}
            y1={zero - 5}
            y2={zero + 5}
            className={s.be}
          />
        )}
        {showBoth && <path d={path(atExpiry)} className={s.lineExp} />}
        <path d={path(onDay)} className={s.line} />
        <circle
          cx={x(target)}
          cy={y(
            onDay.reduce(
              (b, p) =>
                Math.abs(p.S - target) < Math.abs(b.S - target) ? p : b,
              onDay[0]!,
            ).pnl,
          )}
          r={5}
          className={s.dot}
        />
        {hv && (
          <g className={s.hover}>
            <line x1={x(hv.S)} x2={x(hv.S)} y1={PAD.t} y2={H - PAD.b} />
          </g>
        )}
        <text x={PAD.l} y={H - 6} className={s.axis}>
          {formatPrice(range[0])}
        </text>
        <text x={W - PAD.r} y={H - 6} textAnchor="end" className={s.axis}>
          {formatPrice(range[1])}
        </text>
      </svg>
      {hv && (
        <div
          className={s.tip}
          style={{ left: Math.min(W - 130, Math.max(0, x(hv.S) - 65)) }}
          role="status"
        >
          <span className="num">{formatPrice(hv.S)}</span>{" "}
          <b className={hv.pnl >= 0 ? s.up : s.down}>
            {formatSignedMoney(hv.pnl)}
          </b>
        </div>
      )}
    </div>
  );
}
