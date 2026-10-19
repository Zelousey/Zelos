/**
 * Tap-to-explain trading words (owner 2026-10-15: a beginner should be able to figure it out).
 * <TermHelp term="limit" /> is a small "?" that opens the meaning, with the other words below.
 */
import { useId, useState } from 'react';
import { t } from '../../lib/i18n';
import { Sheet } from '../../ui';
import s from './Learn.module.css';

export type Term = 'market' | 'limit' | 'stop' | 'tif' | 'stopLoss' | 'takeProfit' | 'buyingPower' | 'pnl';
export const GLOSSARY: Record<Term, { word: string; means: string }> = {
  market: { word: 'Market order', means: 'Buy or sell right away at the current price. The simplest order: use it for your first trades.' },
  limit: { word: 'Limit order', means: 'Only buy at your price or lower (or sell at your price or higher). It waits for that price and may not fill.' },
  stop: { word: 'Stop order', means: 'Waits until the price reaches your level, then buys or sells at the market. Used to get in on a breakout or out on a drop.' },
  tif: { word: 'Good for', means: 'How long a waiting order lives: Today (cancelled at the 4 pm close) or Until cancelled.' },
  stopLoss: { word: 'Stop-loss', means: 'Sells for you if the price falls to the level you pick, so a bad trade can’t cost too much.' },
  takeProfit: { word: 'Take-profit', means: 'Sells for you when the price rises to your target, so you keep the gain.' },
  buyingPower: { word: 'Buying power', means: 'The virtual cash you can spend on new trades right now.' },
  pnl: { word: 'P&L', means: 'Profit and loss: how much you’re up (green) or down (red). Unrealized until you sell.' },
};

export function TermHelp({ term }: { term: Term }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const others = (Object.keys(GLOSSARY) as Term[]).filter((k) => k !== term);
  return (
    <>
      <button type="button" className={s.helpBtn} aria-label={t('gl.what', { word: GLOSSARY[term].word })} onClick={() => setOpen(true)}>
        ?
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title={GLOSSARY[term].word} labelledBy={`${id}-t`}>
        <div className={s.glossary}>
          <p className={s.muted}>{GLOSSARY[term].means}</p>
          <h3 className={s.kicker}>{t('gl.more')}</h3>
          <dl>
            {others.map((k) => (
              <div key={k}>
                <dt>{GLOSSARY[k].word}</dt>
                <dd>{GLOSSARY[k].means}</dd>
              </div>
            ))}
          </dl>
        </div>
      </Sheet>
    </>
  );
}

/** One plain sentence about the order type picked on the ticket. */
export const ORDER_EXPLAIN: Record<'market' | 'limit' | 'stop', string> = {
  market: 'Fills right away at the current price.',
  limit: 'Waits until the price reaches your limit (or better).',
  stop: 'Waits for your stop price, then fills at the market.',
};
