/**
 * The Hall of Minds quote card (owner 2026-10-24: "if people don't see the Hall of Minds, maybe
 * they'll get a random pop-up of, like, a Napoleon quote … that links them to the Hall of Minds").
 * When you open Zelos and haven't been in the Hall of Minds for MINDS_AWAY_DAYS, a small card with a
 * random real quote slides up, with "Open Hall of Minds"; at most once a day, closable, never inside
 * the Hall of Minds. This device remembers your last visit (MindsModule marks it); someone who has
 * never been in gets their first card MINDS_AWAY_DAYS after first opening the app, so it doesn't
 * crowd the welcome. The quotes load only when a card is due.
 */
import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router';
import { t } from '../../lib/i18n';
import { readString, writeString } from '../../lib/storage';
import { Icon } from '../../ui';
import type { Figure, MindQuote } from './minds';
import s from './QuoteCard.module.css';

export const SEEN_KEY = 'zelosMindsSeen'; // ms of your last Hall of Minds visit (or first app open)
export const DAY_KEY = 'zelosMindsCardDay'; // the local day a card was last shown
export const MINDS_AWAY_DAYS = 3;
const DELAY_MS = 2500; // let the screen settle first
const SHORT = 140; // characters
const DAY = 86_400_000;

export const localDay = (ms: number) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** Whether a card is due now; a device with no visit recorded starts counting from now. */
export function cardDue(now: number, seenRaw: string | null, shownDay: string | null): boolean {
  const seen = Number(seenRaw);
  if (!seenRaw || !Number.isFinite(seen)) return false;
  return now - seen >= MINDS_AWAY_DAYS * DAY && shownDay !== localDay(now);
}

/** Called when the Hall of Minds opens. */
export function markMindsSeen(now = Date.now()) {
  writeString(SEEN_KEY, String(now));
}

type Pick = { f: Figure; q: MindQuote };

export function MindsQuoteCard() {
  const { pathname } = useLocation();
  const inMinds = /^\/minds(\/|$)/.test(pathname);
  const [pick, setPick] = useState<Pick | null>(null);
  const [open, setOpen] = useState(true);
  const checked = useRef(false);
  useEffect(() => {
    // once per app open, and not when it opens straight into the Hall of Minds
    if (checked.current || inMinds) return;
    const now = Date.now();
    const seen = readString(SEEN_KEY);
    if (!seen) markMindsSeen(now);
    if (!cardDue(now, seen, readString(DAY_KEY))) {
      checked.current = true;
      return;
    }
    let live = true;
    const timer = window.setTimeout(() => {
      checked.current = true;
      void import('./minds').then(({ ORDERED }) => {
        // a short quote, so the card stays small on a phone
        const all = ORDERED.flatMap((f) => f.quotes.filter((q) => q.text.length <= SHORT).map((q) => ({ f, q })));
        const { f, q } = all[Math.floor(Math.random() * all.length)] ?? {};
        if (!live || !f || !q) return;
        writeString(DAY_KEY, localDay(Date.now()));
        setPick({ f, q });
      });
    }, DELAY_MS);
    return () => {
      live = false;
      window.clearTimeout(timer);
    };
  }, [inMinds]);
  if (!pick || !open || inMinds) return null;
  const { f, q } = pick;
  return (
    <aside className={s.card} aria-label={t('hm.cardLabel')} data-testid="minds-quote-card">
      <button type="button" className={s.close} onClick={() => setOpen(false)} aria-label={t('hm.cardClose')}>
        <Icon name="close" size={16} />
      </button>
      <span className={s.kicker}>{t('hm.cardKicker')}</span>
      <blockquote className={s.quote}>“{q.text}”</blockquote>
      <Link className={s.who} to={`/minds/${f.id}/quotes?q=${encodeURIComponent(q.id)}`} onClick={() => setOpen(false)}>
        — {f.name}
      </Link>
      <Link className={s.go} to="/minds" onClick={() => setOpen(false)}>
        {t('hm.cardGo')} →
      </Link>
    </aside>
  );
}
