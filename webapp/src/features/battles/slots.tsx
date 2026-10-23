/**
 * Battle slots (owner 2026-10-23): 3 open battles (lobby, draft or live) are free; each one past
 * that costs 15 tokens. The server decides: a create, join or accept past the limit is refused
 * with details.reason 'battle-slot', and this asks before calling again with extraSlot.
 */
import { useCallback, useState } from 'react';
import { t } from '../../lib/i18n';
import { Confirm } from '../../ui/Confirm';

export const SLOT_FREE = 3; // functions/main.py TW_FREE_SLOTS
export const SLOT_COST = 15; // functions/main.py TOKENS["slot"]

export const needsSlot = (e: unknown) => (e as { details?: { reason?: unknown } } | null)?.details?.reason === 'battle-slot';

/** gate(fn) runs fn(false); if a paid slot is needed it asks, then runs fn(true). null = they said no. */
export function useSlotGate() {
  const [answer, setAnswer] = useState<((yes: boolean) => void) | null>(null);
  const gate = useCallback(async <T,>(fn: (extraSlot: boolean) => Promise<T>): Promise<T | null> => {
    try {
      return await fn(false);
    } catch (e) {
      if (!needsSlot(e)) throw e;
      const yes = await new Promise<boolean>((resolve) => setAnswer(() => resolve));
      setAnswer(null);
      return yes ? fn(true) : null;
    }
  }, []);
  const dialog = (
    <Confirm open={!!answer} title={t('slot.title')} action={t('slot.pay', { n: SLOT_COST })} variant="buy" onConfirm={() => answer?.(true)} onClose={() => answer?.(false)}>
      <p>{t('slot.body', { free: SLOT_FREE, n: SLOT_COST })}</p>
    </Confirm>
  );
  return { gate, dialog };
}
