/** Option orders go through the same server call as stock orders (functions/main.py practice_order). */
import { callFunction } from '../../lib/firebase';
import type { Kind } from './model';

export type OptionOrderRequest = { kind: 'option'; u: string; type: Kind; strike: number; exp: string; side: 'buy' | 'sell'; qty: number };

export const placeOptionOrder = (req: Omit<OptionOrderRequest, 'kind'>) => callFunction<OptionOrderRequest, { order: { id: string } }>('practice_order', { kind: 'option', ...req });
