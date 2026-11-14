/**
 * Page tours and the help button (owner 2026-11-12, reworked 2026-11-13).
 *
 * A small "?" help button sits in the top bar on every page. Tapping it opens that page's tour
 * (or Help & feedback where a page has no tour). Now and then a short message comes out of the
 * button: "I'm here to help! Need information about this page? Tap here to learn more." It goes
 * away by itself after a few seconds (no X to press) and never blocks the page; tapping it opens
 * the tour. No tour opens by itself any more (2026-11-13: a tour card covered Sign in).
 *
 *   - a new player (account under 14 days old) gets the message the first time they open a page
 *     whose tour they haven't seen; afterwards at most every 3 days
 *   - anyone else: every 7 days on a page whose tour they haven't seen, every 30 days once they have
 *   - nothing for someone who isn't signed in (the button is still there)
 *   - never more than one message every 10 minutes, and never on top of another dialog
 *   - ?tour=<id> (Help → Tutorials) opens that page's tour at once
 * Remembered on this device. The e2e setup turns the message off (zelosPageToursOff) except in its own test.
 */
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router';
import { useAuth } from '../../lib/auth';
import { t } from '../../lib/i18n';
import { readJSON, readString, writeString } from '../../lib/storage';
import { Icon, stepOnScreen, Tour, tourSeen, type TourStep } from '../../ui';
import { PAGE_TOURS, type TourDef } from './tours';
import s from './PageTours.module.css';

const OFF = 'zelosPageToursOff';
const NUDGES = 'zelosPageHelp'; // { [tourId]: last time the note showed }
const NUDGE_ANY = 'zelosPageHelpAt'; // last note on any page
const DAY = 864e5;
const NEW_FOR = 14 * DAY;
const SHOW_MS = 7000; // the message fades out by itself after this

function stamp(id: string) {
  const t0 = Date.now();
  writeString(NUDGES, JSON.stringify({ ...readJSON<Record<string, number>>(NUDGES, {}), [id]: t0 }));
  writeString(NUDGE_ANY, String(t0));
}

export function tourFor(pathname: string): TourDef | null {
  return PAGE_TOURS.find((x) => x.match?.test(pathname)) ?? null;
}

/** Waits until the page has drawn and no other dialog is up, then calls back (or gives up). */
function whenSettled(cb: () => void, signal: { off: boolean }) {
  let tries = 0;
  const tick = () => {
    if (signal.off) return;
    const busy = document.querySelector('[role=dialog][aria-modal=true], dialog[open], [data-testid=book-intro]');
    if (!busy && document.querySelector('main h1, main h2')) return cb();
    if (++tries < 40) window.setTimeout(tick, 500);
  };
  window.setTimeout(tick, 900);
}

/** `slot`: the top bar's place for the button (the tour itself stays outside the bar, so it isn't trapped under its layer). */
export function PageTours({ slot }: { slot: HTMLElement | null }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isReal } = useAuth();
  const tour = useMemo(() => tourFor(location.pathname), [location.pathname]);
  const [open, setOpen] = useState<{ id: string; steps: TourStep[] } | null>(null);
  const [nudge, setNudge] = useState<TourDef | null>(null);
  const created = user?.metadata?.creationTime ? Date.parse(user.metadata.creationTime) : null;

  useEffect(() => {
    if (!tour || readString(OFF) === '1') return;
    const sig = { off: false };
    const asked = new URLSearchParams(location.search).get('tour') === tour.id;
    const start = () => {
      const steps = tour.steps.filter(stepOnScreen);
      if (steps.length) setOpen({ id: tour.id, steps });
      stamp(tour.id); // no "Need help?" note right after the tour itself
    };
    if (asked) {
      whenSettled(start, sig);
      return () => {
        sig.off = true;
      };
    }
    if (!isReal) return; // sign in first; tours are for players
    const now = Date.now();
    const isNew = created != null && now - created < NEW_FOR;
    const seen = tourSeen(tour.id);
    const last = readJSON<Record<string, number>>(NUDGES, {})[tour.id] ?? 0;
    const every = isNew ? (seen ? 3 * DAY : 0) : seen ? 30 * DAY : 7 * DAY;
    const anyLast = Number(readString(NUDGE_ANY) ?? 0);
    const due = last === 0 || now - last >= every;
    if (due && now - anyLast >= 10 * 60e3)
      whenSettled(() => {
        setNudge(tour);
        stamp(tour.id);
      }, sig);
    return () => {
      sig.off = true;
      setNudge(null);
    };
    // once per page visit
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tour, location.key, isReal]);

  // the note goes away by itself after a while
  useEffect(() => {
    if (!nudge) return;
    const id = window.setTimeout(() => setNudge(null), SHOW_MS);
    return () => window.clearTimeout(id);
  }, [nudge]);


  const close = () => {
    setOpen(null);
    if (new URLSearchParams(location.search).has('tour')) navigate({ pathname: location.pathname }, { replace: true });
  };
  const help = () => {
    setNudge(null);
    const steps = tour?.steps.filter(stepOnScreen) ?? [];
    if (tour && steps.length) setOpen({ id: tour.id, steps });
    else navigate('/help');
  };

  return (
    <>
      {open && <Tour id={open.id} steps={open.steps} open onClose={close} />}
      {slot &&
        createPortal(
          <span className={s.wrap}>
            <button type="button" className={s.btn} onClick={help} aria-label={tour ? t('help.button', { page: t(tour.title) }) : t('nav.help')} aria-haspopup="dialog">
              <Icon name="help" size={22} />
            </button>
            {nudge && !open && (
              <button type="button" className={s.bubble} onClick={help} role="status">
                <b>{t('help.bubble.title')}</b>
                <span>{t('help.bubble.body')}</span>
              </button>
            )}
          </span>,
          slot,
        )}
    </>
  );
}
