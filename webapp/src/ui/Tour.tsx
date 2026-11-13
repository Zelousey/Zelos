/**
 * Short guided tours (Phase 8, F20): one framework for every tutorial in the app.
 * A tour highlights one part of the screen at a time ([data-tour="..."] targets) with a small
 * card: Back, Next / Done, Skip. Esc skips. It only points: it never clicks, types or trades.
 * Finished or skipped tours are remembered on this device (tourSeen / markTour); Help can replay
 * them. Reduced motion: no scrolling animation (and base.css stops the transitions).
 */
import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { t, type MessageKey } from '../lib/i18n';
import { readJSON, writeString } from '../lib/storage';
import { Button } from './Button';
import s from './Tour.module.css';

/**
 * A step points at [data-tour=target], or at the first visible element matching `sel` (whose text
 * starts with `text`, if given), widened to its closest `up` ancestor; with neither it's a card in
 * the middle of the screen (an intro or a note).
 */
export type TourStep = { target?: string; sel?: string; text?: string; up?: string; title: MessageKey; body: MessageKey };

/** The element a step points at, or null (not on screen right now). */
export function findTarget(step: TourStep): HTMLElement | null {
  if (step.target) return document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`);
  if (!step.sel) return null;
  const all = [...document.querySelectorAll<HTMLElement>(step.sel)].filter((e) => e.getClientRects().length > 0);
  const el = step.text ? all.find((e) => (e.textContent ?? '').trim().startsWith(step.text!)) : all[0];
  if (!el) return null;
  return (step.up ? el.closest<HTMLElement>(step.up) : null) ?? el;
}
/** A step with no target is a centred card; it always shows. */
export const stepOnScreen = (step: TourStep) => (!step.target && !step.sel) || !!findTarget(step);
type Seen = Record<string, 'done' | 'skipped'>;
const KEY = 'zelosTours';

export const tourSeen = (id: string): boolean => !!readJSON<Seen>(KEY, {})[id];
export function markTour(id: string, how: 'done' | 'skipped') {
  writeString(KEY, JSON.stringify({ ...readJSON<Seen>(KEY, {}), [id]: how }));
}

const GAP = 12;
const CARD_W = 320;

export function Tour({ id, steps, open, onClose }: { id: string; steps: TourStep[]; open: boolean; onClose: (how: 'done' | 'skipped') => void }) {
  const [at, setAt] = useState(0);
  const [box, setBox] = useState<DOMRect | null>(null);
  const [cardH, setCardH] = useState(200);
  const card = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const step = steps[at];

  // follow the target while the page scrolls or resizes
  useLayoutEffect(() => {
    if (!open || !step) return;
    const el = findTarget(step);
    if (!el) {
      const id = requestAnimationFrame(() => setBox(null)); // a centred card
      return () => cancelAnimationFrame(id);
    }
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollIntoView({ block: 'center', behavior: reduced ? 'auto' : 'smooth' });
    let raf = 0;
    const measure = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setBox(el.getBoundingClientRect()));
    };
    measure();
    window.addEventListener('scroll', measure, true);
    window.addEventListener('resize', measure);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', measure, true);
      window.removeEventListener('resize', measure);
    };
  }, [open, step]);

  useEffect(() => {
    if (open) card.current?.focus();
  }, [open, at]);
  // a tap anywhere outside the card ends the tour, and the tap still reaches what was tapped
  // (2026-11-13: the card sat over the Sign in button and blocked it)
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!card.current || card.current.contains(e.target as Node)) return;
      markTour(id, 'skipped');
      setAt(0);
      closeRef.current('skipped');
    };
    document.addEventListener('pointerdown', onDown, true);
    return () => document.removeEventListener('pointerdown', onDown, true);
  }, [open, id]);
  // the card's real height decides whether it fits above or below the highlighted control
  useLayoutEffect(() => {
    if (open && card.current) setCardH(card.current.offsetHeight);
  }, [open, at, box]);

  if (!open || !step) return null;
  const finish = (how: 'done' | 'skipped') => {
    markTour(id, how);
    setAt(0);
    onClose(how);
  };
  const last = at === steps.length - 1;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  // below the control if it fits there, else above, else on the roomier side (kept on screen)
  const roomBelow = box ? vh - box.bottom - 2 * GAP : vh;
  const roomAbove = box ? box.top - 2 * GAP : 0;
  // a card with nothing to point at sits low (above a phone's tab bar), not over the page's middle
  const top = !box
    ? Math.max(GAP, vh - cardH - (vw <= 760 ? 96 : 32))
    : roomBelow >= cardH
      ? box.bottom + GAP
      : roomAbove >= cardH
        ? box.top - GAP - cardH
        : roomBelow >= roomAbove
          ? Math.max(GAP, vh - cardH - GAP)
          : GAP;
  const cardStyle: CSSProperties = {
    left: box ? Math.max(GAP, Math.min(box.left, vw - Math.min(CARD_W, vw - 2 * GAP) - GAP)) : Math.max(GAP, (vw - Math.min(CARD_W, vw - 2 * GAP)) / 2),
    top,
  };
  return (
    <div className={s.layer}>
      {box && <div className={s.spot} style={{ left: box.left - 6, top: box.top - 6, width: box.width + 12, height: box.height + 12 }} aria-hidden="true" />}
      <div
        ref={card}
        className={s.card}
        style={cardStyle}
        role="dialog"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={(e) => {
          if (e.key === 'Escape') finish('skipped');
        }}
      >
        <span className={s.count}>{t('tour.count', { n: at + 1, of: steps.length })}</span>
        <h2 id={titleId} className={s.title}>
          {t(step.title)}
        </h2>
        <p className={s.body}>{t(step.body)}</p>
        <div className={s.actions}>
          <Button variant="ghost" size="sm" onClick={() => finish('skipped')}>
            {t('tour.skip')}
          </Button>
          <span className={s.nav}>
            {at > 0 && (
              <Button variant="secondary" size="sm" onClick={() => setAt(at - 1)}>
                {t('tour.back')}
              </Button>
            )}
            <Button variant="primary" size="sm" onClick={() => (last ? finish('done') : setAt(at + 1))}>
              {last ? t('tour.done') : t('tour.next')}
            </Button>
          </span>
        </div>
      </div>
    </div>
  );
}
