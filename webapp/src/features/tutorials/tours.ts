/**
 * Every guided tour in the app (Phase 8, F20), in one place so Help can list and replay them.
 * Each step points at a [data-tour="..."] element on the tour's screen. Tours only point; they
 * never press anything.
 */
import type { MessageKey } from '../../lib/i18n';
import type { TourStep } from '../../ui';

export type TourDef = { id: string; title: MessageKey; body: MessageKey; replay: string; steps: TourStep[] };

/** F21: the first trade, on the Solo trade ticket. The last step says Place order is still yours. */
export const FIRST_TRADE_TOUR: TourDef = {
  id: 'first-trade',
  title: 'tour.firstTrade',
  body: 'tour.firstTrade.body',
  replay: '/practice/trade/AAPL?tour=first-trade',
  steps: [
    { target: 'side', title: 'tour.ft.side', body: 'tour.ft.side.body' },
    { target: 'type', title: 'tour.ft.type', body: 'tour.ft.type.body' },
    { target: 'qty', title: 'tour.ft.qty', body: 'tour.ft.qty.body' },
    { target: 'review', title: 'tour.ft.review', body: 'tour.ft.review.body' },
  ],
};

export const TOURS: TourDef[] = [FIRST_TRADE_TOUR];
