/**
 * Tokens in the app: the balance chip and the "Get tokens" sheet. On the web, buying opens Square
 * Checkout (functions/main.py tokens_checkout), the same as on the website. Inside the iPhone app
 * digital goods may only be sold with Apple in-app purchase (App Store guideline 3.1.1), so there
 * the sheet only shows how to earn tokens until that is added. Balances only change on the server.
 */
import { useEffect, useState } from 'react';
import { useAuth } from '../../lib/auth';
import { isNative } from '../../lib/platform';
import { t } from '../../lib/i18n';
import { Button, Sheet, useToast } from '../../ui';
import { errorText } from '../invites/invites';
import { nyDay } from '../charts/series';
import { formatLocalTime } from '../../lib/format';
import { useNow } from '../../lib/useNow';
import { boostPrice, buyBoost, checkout, openWallet, passPrice, safeCheckout, useWalletDoc, type BoostId, type WalletInfo } from './strategies';
import { Coin } from '../tokens/Coin';
import { TokenHistory } from './TokenHistory';
import s from './Strategies.module.css';

/** The live wallet plus prices/packs (tokens_wallet also makes the wallet and gives welcome tokens once). */
export function useTokens() {
  const { user, isReal } = useAuth();
  const uid = isReal && user ? user.uid : null;
  const doc = useWalletDoc(uid);
  const [info, setInfo] = useState<{ uid: string; info: WalletInfo } | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  useEffect(() => {
    if (!uid) return;
    let live = true;
    openWallet()
      .then((i) => live && setInfo({ uid, info: i }))
      .catch(() => live && setFailed(uid));
    return () => {
      live = false;
    };
  }, [uid]);
  const mine = info?.uid === uid ? info.info : null;
  const wallet = doc.status === 'ready' ? doc.data : null;
  return { uid, wallet, info: mine, balance: wallet?.balance ?? mine?.balance ?? null, failed: failed === uid };
}

export function TokensSheet({ open, onClose, info, balance }: { open: boolean; onClose: () => void; info: WalletInfo | null; balance: number | null }) {
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  async function buy(pack: string) {
    setBusy(pack);
    try {
      const r = await checkout(pack);
      if (!safeCheckout(r.url)) throw new Error(t('st.buy.failed'));
      window.location.assign(r.url);
    } catch (e) {
      toast.show(errorText(e, t('st.buy.failed')), 'error');
      setBusy(null);
    }
  }
  return (
    <Sheet open={open} onClose={onClose} title={t('st.getTokens')} labelledBy="tokens-sheet-title">
      <div className={s.sheet}>
        <p className={s.balance}>
          <Coin size={20} /> <b>{balance ?? 0}</b> {t('st.tokens')}
        </p>
        <p className={s.muted}>{t('st.tokens.what', { pass: passPrice(info, 'swing-trader'), day: passPrice(info, 'swing-trader', 1), threeLeg: passPrice(info, 'three-leg'), days: info?.prices.passDays ?? 7, unlock: info?.prices.unlock ?? 25 })}</p>
        {!info ? (
          <p className={s.muted}>{t('st.loading')}</p>
        ) : !info.canBuy || isNative() ? (
          <p className={s.note}>{t('st.buy.soon')}</p>
        ) : (
          <ul className={s.packs}>
            {info.packs.map((p) => (
              <li key={p.id}>
                <span>
                  <b>{p.tokens.toLocaleString('en-US')}</b> {t('st.tokens')}
                </span>
                <Button variant="primary" size="sm" disabled={!!busy} onClick={() => void buy(p.id)}>
                  {busy === p.id ? t('st.buy.opening') : `$${(p.cents / 100).toFixed(p.cents % 100 ? 2 : 0)}`}
                </Button>
              </li>
            ))}
          </ul>
        )}
        <Boosts info={info} balance={balance} />
        <p className={s.fine}>{t('st.tokens.fine')}</p>
        <TokenHistory />
      </div>
    </Sheet>
  );
}

/** Small things to spend tokens on (owner 2026-10-22): an XP booster and extra battle entries. */
function Boosts({ info, balance }: { info: WalletInfo | null; balance: number | null }) {
  const { user, isReal } = useAuth();
  const doc = useWalletDoc(isReal && user ? user.uid : null);
  const wallet = doc.status === 'ready' ? doc.data : null;
  const now = useNow();
  const toast = useToast();
  const [busy, setBusy] = useState<BoostId | null>(null);
  if (!isReal || !user) return null;
  const today = nyDay(now);
  const boostOn = (wallet?.xpBoostUntil ?? 0) > now;
  const extraToday = wallet?.twExtra?.day === today ? wallet.twExtra.n : 0;
  const maxExtra = info?.battleEntryMax ?? 2;
  async function buy(id: BoostId) {
    setBusy(id);
    try {
      await buyBoost(id);
      toast.show(id === 'xp-boost' ? t('bst.xp.bought') : t('bst.battle.bought'));
    } catch (e) {
      toast.show(errorText(e, t('st.buy.failed')), 'error');
    } finally {
      setBusy(null);
    }
  }
  const row = (id: BoostId, title: string, sub: string, disabled: boolean) => (
    <li key={id}>
      <span>
        <b>{title}</b>
        <span className={s.muted}>{sub}</span>
      </span>
      <Button variant="secondary" size="sm" disabled={disabled || !!busy || (balance ?? 0) < boostPrice(info, id)} onClick={() => void buy(id)}>
        {t('bst.price', { n: boostPrice(info, id) })}
      </Button>
    </li>
  );
  return (
    <section aria-labelledby="boosts-title">
      <h3 id="boosts-title" className={s.boostsTitle}>
        {t('bst.title')}
      </h3>
      <ul className={[s.packs, s.boosts].join(' ')}>
        {row('xp-boost', t('bst.xp'), boostOn ? t('bst.xp.on', { time: formatLocalTime(wallet!.xpBoostUntil) }) : t('bst.xp.sub'), false)}
        {row('battle-entry', t('bst.battle'), t('bst.battle.sub', { n: extraToday, max: maxExtra }), extraToday >= maxExtra)}
      </ul>
    </section>
  );
}
