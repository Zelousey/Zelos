/**
 * The Hall of Minds opening (owner 2026-10-23/24): a book opens and flips through every great mind,
 * each a page on red with a quote on the back, then fades into the grid. Plays every time you come
 * into the Hall of Minds (not again when you go back to the grid from a figure), skippable, and not
 * shown with reduced motion.
 *
 * Each page's stacking order changes as it flips, so the newest page is always on top: with a fixed
 * order (as before) the first quote stayed on top of the left side and the book looked stuck.
 *
 * It ends on the book's red back cover with a closing quote (owner list D, 2026-10-27: not on a
 * pale page): after the last page turns, the turned pages fade and the back cover slides to the
 * middle, then everything fades into the grid.
 */
import { useEffect, useState } from 'react';
import { t } from '../../lib/i18n';
import { useMediaQuery } from '../../lib/useMediaQuery';
import { ORDERED, portraitUrl } from './minds';
import s from './BookIntro.module.css';

const PAGES = ORDERED;
const OPEN_MS = 550; // the book opening
const PAGE_MS = 300; // between page turns
const HOLD_MS = 500; // the last page stays a moment
const END_MS = 1100; // the back cover, before the fade
export const RUN_MS = OPEN_MS + PAGES.length * PAGE_MS + HOLD_MS + END_MS;
/** The closing quote on the back cover (from the Hall of Minds quotes; Newton, "giants"). */
const CLOSING = (() => {
  const f = ORDERED.find((x) => x.id === 'newton');
  const q = f?.quotes.find((x) => x.id === 'giants') ?? f?.quotes[0];
  return q && f ? { text: q.text, by: f.name } : null;
})();

export function BookIntro() {
  const reduced = useMediaQuery('(prefers-reduced-motion: reduce)');
  const [show, setShow] = useState(true);
  const [leaving, setLeaving] = useState(false);
  const [turned, setTurned] = useState(0); // pages flipped so far
  const [ending, setEnding] = useState(false); // the back cover
  useEffect(() => {
    if (!show || reduced) return;
    const timers = PAGES.map((_, i) => window.setTimeout(() => setTurned(i + 1), OPEN_MS + i * PAGE_MS));
    timers.push(window.setTimeout(() => setEnding(true), OPEN_MS + PAGES.length * PAGE_MS + HOLD_MS));
    timers.push(window.setTimeout(() => setLeaving(true), RUN_MS));
    timers.push(window.setTimeout(() => setShow(false), RUN_MS + 450));
    return () => timers.forEach((x) => window.clearTimeout(x));
  }, [show, reduced]);
  if (!show || reduced) return null;
  const close = () => {
    setLeaving(true);
    window.setTimeout(() => setShow(false), 300);
  };
  return (
    <div className={[s.overlay, leaving && s.leaving].filter(Boolean).join(' ')} onClick={close} data-testid="book-intro">
      <div className={[s.book, ending && s.ending].filter(Boolean).join(' ')} aria-hidden data-ending={ending || undefined}>
        <div className={s.cover}>
          <span className={s.coverTitle}>{t('nav.minds')}</span>
        </div>
        <div className={s.backCover} data-testid="book-back-cover">
          {CLOSING && (
            <figure>
              <blockquote>“{CLOSING.text}”</blockquote>
              <figcaption>— {CLOSING.by}</figcaption>
            </figure>
          )}
          <span className={s.backMark}>{t('nav.minds')}</span>
        </div>
        {PAGES.map((f, i) => {
          const flipped = i < turned;
          // unturned pages: the next one on top; turned pages: the latest one on top
          return (
            <div key={f.id} className={[s.page, flipped && s.flipped].filter(Boolean).join(' ')} style={{ zIndex: flipped ? PAGES.length + i : PAGES.length - i }} data-page={i}>
              <div className={s.front}>
                <img src={portraitUrl(f)} alt="" />
                <b>{f.name}</b>
                <span>{f.role} · {f.years}</span>
              </div>
              <div className={s.back}>
                <p>“{f.quotes[0]?.text}”</p>
              </div>
            </div>
          );
        })}
      </div>
      <button type="button" className={s.skip} onClick={close}>
        {t('hm.skip')}
      </button>
    </div>
  );
}
