/**
 * Your tokens in the top bar, next to your picture and the bell (owner 2026-10-09), like the
 * website's nav chip: the Z coin and your balance. When tokens arrive (daily check-in, Trade War
 * reward, purchase) coins burst and fly into it while it counts up. Tap it for your wallet.
 * Also does the website's once-a-day check-in reward (rewards_checkin), sharing its
 * "done today" mark so you're never asked twice.
 */
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../lib/auth';
import { callFunction } from '../../lib/firebase';
import { t } from '../../lib/i18n';
import { useToast } from '../../ui';
import { openWallet, useWalletDoc, type WalletInfo } from '../strategies/strategies';
import { TokensSheet } from '../strategies/Tokens';
import { lsGet, lsSet } from '../welcome/welcome';
import { playCoinReward } from './coin';
import { Coin } from './Coin';
import s from './Tokens.module.css';

type Checkin = { earned: number; streak?: number; every?: number; bonus?: number; needsVerify?: boolean };
const nyDay = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });

export function TokenChip() {
  const { user, isReal } = useAuth();
  const uid = isReal && user ? user.uid : null;
  return uid ? <Chip key={uid} uid={uid} /> : null;
}

function Chip({ uid }: { uid: string }) {
  const toast = useToast();
  const doc = useWalletDoc(uid);
  const balance = doc.status === 'ready' ? doc.data.balance : null;
  const [shown, setShown] = useState<number | null>(null);
  const [sheet, setSheet] = useState(false);
  const [info, setInfo] = useState<WalletInfo | null>(null);
  const ref = useRef<HTMLButtonElement>(null);
  const prev = useRef<number | null>(null);
  const made = useRef(false);

  // no wallet yet: the server makes it (and gives the welcome tokens), like the website
  useEffect(() => {
    if (doc.status !== 'missing' || made.current) return;
    made.current = true;
    openWallet()
      .then((w) => {
        setInfo(w);
        if (w.welcomed) toast.show(t('tk.welcome', { n: w.prices.welcome }));
      })
      .catch(() => {});
  }, [doc.status, toast]);

  // tokens arrived: play the coins into the chip
  useEffect(() => {
    if (balance == null) return;
    const before = prev.current;
    prev.current = balance;
    if (before != null && balance > before && ref.current) playCoinReward(balance - before, before, ref.current, setShown);
  }, [balance]);

  // once a day: the check-in reward (the server decides; this only avoids extra calls)
  useEffect(() => {
    const key = `ztCheckin:${uid}`;
    const today = nyDay();
    if (lsGet(key) === today) return;
    const id = setTimeout(() => {
      callFunction<Record<string, never>, Checkin>('rewards_checkin', {})
        .then((r) => {
          lsSet(key, today);
          if (r.earned > 0) {
            const every = r.every ?? 7;
            const streak = r.streak ?? 1;
            const left = every - (streak % every);
            toast.show(t('tk.checkin', { n: r.earned }) + (streak > 1 ? ` ${t('tk.streak', { n: streak })}` : '') + ' ' + (streak % every === 0 ? t('tk.bonusIn') : t('tk.bonusLeft', { n: left, bonus: r.bonus ?? 0 })));
          }
        })
        .catch(() => {});
    }, 1500);
    return () => clearTimeout(id);
  }, [uid, toast]);

  function open() {
    setSheet(true);
    if (!info) openWallet().then(setInfo).catch(() => {});
  }
  const n = shown ?? balance;
  return (
    <>
      <button ref={ref} type="button" className={s.chip} onClick={open} aria-label={t('tk.chip', { n: balance ?? 0 })}>
        <Coin size={16} />
        <span className={s.num}>{n == null ? '…' : n.toLocaleString('en-US')}</span>
      </button>
      <TokensSheet open={sheet} onClose={() => setSheet(false)} info={info} balance={balance} />
    </>
  );
}
