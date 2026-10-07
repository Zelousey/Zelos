/** Calls into the server practice account (functions/main.py practice_*). Errors carry a player-readable message. */
import { callFunction } from '../../lib/firebase';

export type OrderRequest = { sym: string; side: 'buy' | 'sell'; type: 'market' | 'limit' | 'stop'; qty: number; limit?: number; stop?: number; tif: 'day' | 'gtc'; bracket?: { sl?: number; tp?: number } };

export function errorMessage(e: unknown): string {
  const m = (e as { message?: string })?.message;
  return m && !/^internal$/i.test(m) ? m : 'Something went wrong. Nothing was changed. Try again.';
}

export const openAccount = () => callFunction<Record<string, never>, { created: boolean }>('practice_account', {});
export const placeOrder = (req: OrderRequest) => callFunction<OrderRequest, { order: { id: string } }>('practice_order', req);
export const cancelOrder = (orderId: string) => callFunction<{ orderId: string }, { cancelled: boolean }>('practice_cancel', { orderId });
export const resetAccount = () => callFunction<Record<string, never>, { resets: number }>('practice_reset', {});
export const setPublic = (publicProfile: boolean) => callFunction<{ publicProfile: boolean }, { publicProfile: boolean }>('practice_settings', { publicProfile });
