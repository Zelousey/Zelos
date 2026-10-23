/**
 * The Hall of Minds opening (owner 2026-10-23): a book opens and flips quickly through a few pages,
 * each a great mind on red with a line about them, then fades into the grid. Once per visit
 * (sessionStorage), skippable, and not shown at all with reduced motion.
 */
import { useEffect, useState } from 'react';
import { t } from '../../lib/i18n';
import { useMediaQuery } from '../../lib/useMediaQuery';
import { ORDERED, portraitUrl } from './minds';
import s from './BookIntro.module.css';

const SEEN_KEY = 'zelosMindsIntro';
const PAGES = ORDERED.slice(0, 5);
const RUN_MS = 3400;

function seen(): boolean {
  try {
    return sessionStorage.getItem(SEEN_KEY) === '1';
  } catch {
    return true;
  }
}

export function BookIntro() {
  const reduced = useMediaQuery('(prefers-reduced-motion: reduce)');
  const [show, setShow] = useState(() => !seen());
  const [leaving, setLeaving] = useState(false);
  useEffect(() => {
    if (!show) return;
    try {
      sessionStorage.setItem(SEEN_KEY, '1');
    } catch {
      /* private mode: it just plays again next time */
    }
    const a = window.setTimeout(() => setLeaving(true), RUN_MS);
    const b = window.setTimeout(() => setShow(false), RUN_MS + 450);
    return () => {
      window.clearTimeout(a);
      window.clearTimeout(b);
    };
  }, [show]);
  if (!show || reduced) return null;
  const close = () => {
    setLeaving(true);
    window.setTimeout(() => setShow(false), 300);
  };
  return (
    <div className={[s.overlay, leaving && s.leaving].filter(Boolean).join(' ')} onClick={close}>
      <div className={s.book} aria-hidden>
        <div className={s.cover}>
          <span className={s.coverTitle}>{t('nav.minds')}</span>
        </div>
        {PAGES.map((f, i) => (
          <div key={f.id} className={s.page} style={{ animationDelay: `${0.55 + i * 0.42}s`, zIndex: PAGES.length - i }}>
            <div className={s.front}>
              <img src={portraitUrl(f)} alt="" />
              <b>{f.name}</b>
              <span>{f.role} · {f.years}</span>
            </div>
            <div className={s.back}>
              <p>“{f.quotes[0]?.text}”</p>
            </div>
          </div>
        ))}
      </div>
      <button type="button" className={s.skip} onClick={close}>
        {t('hm.skip')}
      </button>
    </div>
  );
}
