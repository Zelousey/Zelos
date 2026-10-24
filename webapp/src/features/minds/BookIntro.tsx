/**
 * The Hall of Minds opening (owner 2026-10-23/24): a book opens and flips through every great mind,
 * each a page on red with a quote on the back, then fades into the grid. Plays every time you come
 * into the Hall of Minds (not again when you go back to the grid from a figure), skippable, and not
 * shown with reduced motion.
 *
 * Each page's stacking order changes as it flips, so the newest page is always on top: with a fixed
 * order (as before) the first quote stayed on top of the left side and the book looked stuck.
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
export const RUN_MS = OPEN_MS + PAGES.length * PAGE_MS + HOLD_MS;

export function BookIntro() {
  const reduced = useMediaQuery('(prefers-reduced-motion: reduce)');
  const [show, setShow] = useState(true);
  const [leaving, setLeaving] = useState(false);
  const [turned, setTurned] = useState(0); // pages flipped so far
  useEffect(() => {
    if (!show || reduced) return;
    const timers = PAGES.map((_, i) => window.setTimeout(() => setTurned(i + 1), OPEN_MS + i * PAGE_MS));
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
      <div className={s.book} aria-hidden>
        <div className={s.cover}>
          <span className={s.coverTitle}>{t('nav.minds')}</span>
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
