/**
 * Buy or sell whole shares of one War Zone company at the War Zone price (war_trade).
 * Owner 2026-11-01: you buy only companies in territories you hold, from that territory (warId: the
 * server checks you hold it now); without a territory the form only sells, so a position from a
 * territory you lost can always be closed.
 */
import { useState } from 'react';
import { formatMoney } from '../../lib/format';
import { t } from '../../lib/i18n';
import { useNow } from '../../lib/useNow';
import { Button, Field, Tabs, useToast } from '../../ui';
import { errorText } from '../invites/invites';
import { QUOTE_MAX_AGE_MS, warTrade, type WarProfile, type WarQuotes } from './war';
import s from './War.module.css';

export function Ticket({ sym, q, profile, warId }: { sym: string; q: WarQuotes | null; profile: WarProfile; warId?: string }) {
  const toast = useToast();
  const canBuy = !!warId;
  const [pick, setSide] = useState<'buy' | 'sell'>(canBuy ? 'buy' : 'sell');
  const side = canBuy ? pick : 'sell';
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
      const r = await warTrade({ sym, side, qty: n, ...(warId ? { warId } : {}) });
      toast.show(t(side === 'buy' ? 'war.bought' : 'war.sold', { qty: n, sym, price: formatMoney(r.fill.price) }), 'success');
    } catch (err) {
      toast.show(errorText(err, t('war.failed')), 'error');
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className={s.ticket} onSubmit={go}>
      {canBuy ? (
        <Tabs label={t('war.side')} stretch items={[{ value: 'buy', label: t('war.buy') }, { value: 'sell', label: t('war.sell') }]} value={side} onChange={setSide} />
      ) : (
        <p className={s.muted}>{t('war.buyFromLand')}</p>
      )}
      <Field label={t('war.shares')} inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))} hint={side === 'sell' ? t('war.youHold', { n: held }) : t('war.cash', { cash: formatMoney(profile.cash) })} />
      <p className={s.muted}>{valid ? t('war.estimate', { value: formatMoney(n * price) }) : side === 'sell' && n > held ? t('war.notHeld', { n: held }) : t('war.tooMuch')}</p>
      {!fresh && <p className={s.warn}>{t('war.stale')}</p>}
      <Button type="submit" variant={side === 'buy' ? 'buy' : 'sell'} size="lg" block disabled={busy || !valid || !fresh}>
        {t(side === 'buy' ? 'war.buyGo' : 'war.sellGo', { qty: Number.isInteger(n) && n > 0 ? n : 0, sym })}
      </Button>
    </form>
  );
}
