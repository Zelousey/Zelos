/**
 * Profile looks in the app (the website's ZelosTokens.shop): name colours, badges (some
 * animated), photo frames, profile banners and chart themes. Bought once with tokens, then
 * yours to switch on and off. The server (COSMETICS in functions/main.py) owns names, prices
 * and who owns what; this only draws them.
 */
import { useEffect, useState, type CSSProperties } from "react";
import { t } from "../../lib/i18n";
import { Confirm, Sheet, useToast } from "../../ui";
import { errorText } from "../invites/invites";
import { useTokens } from "../strategies/Tokens";
import {
  buyLook,
  loadShop,
  LOOK_BADGE_ANIM,
  LOOK_BADGES,
  LOOK_BANNERS,
  LOOK_CHARTS,
  LOOK_COLORS,
  LOOK_FRAMES,
  SHOP_KINDS,
  wearLook,
  type ShopItem,
  type ShopKind,
  type ShopState,
} from "./profile";
import s from "./Profile.module.css";

function Swatch({ kind, id }: { kind: ShopKind; id: string }) {
  if (kind === "color") {
    const c = LOOK_COLORS[id];
    return (
      <span
        className={c === "prism" ? s.prism : s.swName}
        style={c !== "prism" ? { color: c } : undefined}
      >
        Aa
      </span>
    );
  }
  if (kind === "badge")
    return (
      <span
        className={[
          s.swBadge,
          LOOK_BADGE_ANIM[id] && s[`anim_${LOOK_BADGE_ANIM[id]}`],
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {LOOK_BADGES[id]}
      </span>
    );
  const bg =
    kind === "frame"
      ? LOOK_FRAMES[id]
      : kind === "chart"
        ? LOOK_CHARTS[id]
        : LOOK_BANNERS[id];
  return (
    <span
      className={kind === "frame" ? s.swRing : s.swBox}
      style={{ background: bg } as CSSProperties}
    />
  );
}

export function LooksShop({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const toast = useToast();
  const { balance } = useTokens();
  const [state, setState] = useState<ShopState | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [buying, setBuying] = useState<{
    kind: ShopKind;
    item: ShopItem;
  } | null>(null);
  useEffect(() => {
    if (!open) return;
    let live = true;
    loadShop().then(
      (r) => live && setState(r),
      () => live && setFailed(true),
    );
    return () => {
      live = false;
    };
  }, [open]);

  async function wear(kind: ShopKind, id: string | null) {
    setBusy(true);
    try {
      setState(await wearLook(kind, id));
    } catch (e) {
      toast.show(errorText(e, t("lk.failed")), "error");
    } finally {
      setBusy(false);
    }
  }
  async function buy() {
    if (!buying) return;
    setBusy(true);
    try {
      await buyLook(buying.kind, buying.item.id);
      setState(await loadShop());
      toast.show(t("lk.bought", { name: buying.item.name }), "success");
      setBuying(null);
    } catch (e) {
      toast.show(errorText(e, t("lk.failed")), "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t("lk.title")}
      labelledBy="lk-title"
    >
      <div className={s.lkBody}>
        <p className={s.hint}>{t("lk.sub")}</p>
        {balance != null && (
          <p className={s.lkBalance}>{t("lk.balance", { n: balance })}</p>
        )}
        {!state ? (
          <p className={s.hint}>{failed ? t("lk.failed") : t("lk.loading")}</p>
        ) : (
          SHOP_KINDS.filter((k) => state.shop[k]?.length).map((kind) => (
            <section
              key={kind}
              className={s.lkGroup}
              aria-labelledby={`lk-${kind}`}
            >
              <h3 id={`lk-${kind}`}>{t(`lk.kind.${kind}`)}</h3>
              {kind === "chart" && (
                <p className={s.hint}>{t("lk.chartNote")}</p>
              )}
              <div className={s.lkItems}>
                {state.shop[kind]!.map((it) => {
                  const have = state.owned.includes(`${kind}:${it.id}`);
                  const on = state.look[kind] === it.id;
                  return (
                    <button
                      key={it.id}
                      type="button"
                      className={[s.lkItem, on && s.lkOn]
                        .filter(Boolean)
                        .join(" ")}
                      disabled={busy}
                      aria-pressed={on}
                      onClick={() =>
                        have
                          ? void wear(kind, on ? null : it.id)
                          : setBuying({ kind, item: it })
                      }
                    >
                      <Swatch kind={kind} id={it.id} />
                      <b>{it.name}</b>
                      <small>
                        {on
                          ? t("lk.wearing")
                          : have
                            ? t("lk.owned")
                            : t("lk.price", { n: it.price })}
                      </small>
                    </button>
                  );
                })}
              </div>
            </section>
          ))
        )}
      </div>
      <Confirm
        open={!!buying}
        onClose={() => setBuying(null)}
        title={t("lk.buyTitle")}
        action={buying ? t("lk.buy", { n: buying.item.price }) : ""}
        busy={busy}
        onConfirm={() => void buy()}
      >
        <p>
          {buying
            ? t("lk.buyBody", { name: buying.item.name, n: buying.item.price })
            : ""}
        </p>
      </Confirm>
    </Sheet>
  );
}
