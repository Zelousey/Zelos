/**
 * Page tours (owner 2026-11-12): "for each section of the website ... some kind of tutorial on the
 * basics of all the different buttons", "a tiny little pop-up every so often ... specific for that
 * section, that brings you to the right tutorial", "new users: it should pop up automatically ...
 * if they click a new page", and players who've been around see it less.
 *
 *   - a new player (account under 14 days old) gets a page's tour by itself the first time they
 *     open that page; afterwards a small "Need help?" note at most every 3 days
 *   - nothing opens by itself for someone who isn't signed in (2026-11-13: a tour card covered the
 *     Dashboard's Sign in button on a phone, so a friend couldn't sign in); ?tour= still works
 *   - anyone else gets the note instead: every 7 days on a page whose tour they haven't seen,
 *     every 30 days once they have
 *   - never more than one note every 10 minutes, and never on top of another dialog
 *   - ?tour=<id> (Help → Tutorials) opens that page's tour at once
 * Remembered on this device. The e2e setup turns it off (zelosPageToursOff) except in its own test.
 */
import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { useAuth } from '../../lib/auth';
import { t } from '../../lib/i18n';
import { readJSON, readString, writeString } from '../../lib/storage';
import { Button, stepOnScreen, Tour, tourSeen, type TourStep } from '../../ui';
import { PAGE_TOURS, type TourDef } from './tours';
import s from './PageTours.module.css';

const OFF = 'zelosPageToursOff';
const NUDGES = 'zelosPageHelp'; // { [tourId]: last time the note showed }
const NUDGE_ANY = 'zelosPageHelpAt'; // last note on any page
const DAY = 864e5;
const NEW_FOR = 14 * DAY;

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

export function PageTours() {
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
    if (isNew && !seen) {
      whenSettled(start, sig);
    } else {
      const last = readJSON<Record<string, number>>(NUDGES, {})[tour.id] ?? 0;
      const every = isNew ? 3 * DAY : seen ? 30 * DAY : 7 * DAY;
      const anyLast = Number(readString(NUDGE_ANY) ?? 0);
      if (now - last >= every && now - anyLast >= 10 * 60e3)
        whenSettled(() => {
          setNudge(tour);
          stamp(tour.id);
        }, sig);
    }
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
    const id = window.setTimeout(() => setNudge(null), 15000);
    return () => window.clearTimeout(id);
  }, [nudge]);

  const close = () => {
    setOpen(null);
    if (new URLSearchParams(location.search).has('tour')) navigate({ pathname: location.pathname }, { replace: true });
  };

  return (
    <>
      {open && <Tour id={open.id} steps={open.steps} open onClose={close} />}
      {nudge && !open && (
        <div className={s.nudge} role="status">
          <span className={s.text}>{t(tourSeen(nudge.id) ? 'help.nudgeAgain' : 'help.nudge', { page: t(nudge.title) })}</span>
          <span className={s.actions}>
            <Button
              size="sm"
              variant="primary"
              onClick={() => {
                const steps = nudge.steps.filter(stepOnScreen);
                setNudge(null);
                if (steps.length) setOpen({ id: nudge.id, steps });
              }}
            >
              {t('help.nudge.show')}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setNudge(null)}>
              {t('help.nudge.close')}
            </Button>
          </span>
        </div>
      )}
    </>
  );
}
