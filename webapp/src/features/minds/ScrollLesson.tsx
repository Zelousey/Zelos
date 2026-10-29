/**
 * A Hall of Minds lesson (/minds/:id/learn/:lesson), played as swipe pages (owner 2026-10-24: one swipe
 * loads a whole page, no long scrolling). Each slide becomes a story page (its painting and lines),
 * which slides in sideways, and a task page (hold, a question, a drag), which comes up from below.
 * You can't move past a task until it's done; each task pays STEP_XP once and the XP bar fills as you
 * go. Swipe, scroll once, use the arrow keys or the Next button; a hint shows which way to swipe if
 * you sit on a page for a while. With reduced motion pages switch without moving.
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router';
import { useAuth } from '../../lib/auth';
import { gsap } from '../../lib/gsap';
import { t } from '../../lib/i18n';
import { useMediaQuery } from '../../lib/useMediaQuery';
import { Button, buttonClass } from '../../ui';
import { LessonTask } from './LessonTasks';
import { figureById, lessonRef, markMind, mindImageUrl, portraitUrl, scrollTasks, sectionPath, STEP_XP, stepRef, stepXp, type Figure, type MindLesson, type ScrollLesson, type ScrollSlide, type ScrollTask } from './minds';
import s from './ScrollLesson.module.css';

/** a portrait (taller than wide) is shown from the top, so the face isn't cut off */
const markTall = (img: HTMLImageElement) => {
  if (img.naturalHeight > img.naturalWidth * 0.9) img.dataset.tall = '';
};

/** one swipe page: the cover, a slide's story, a slide's task, or the finish */
type Page = { kind: 'cover' } | { kind: 'story'; slide: ScrollSlide; n: number } | { kind: 'task'; slide: ScrollSlide; task: ScrollTask; n: number } | { kind: 'finish' };
/** story pages slide in sideways, task pages come up from below (owner: mix the two) */
const axis = (p: Page): 'x' | 'y' => (p.kind === 'task' || p.kind === 'finish' ? 'y' : 'x');
const SWIPE = 50; // px of finger travel that counts as a swipe
const HINT_MS = 4000; // sitting on an open page this long shows which way to swipe

function pagesOf(sc: ScrollLesson): Page[] {
  const out: Page[] = [{ kind: 'cover' }];
  sc.slides.forEach((slide, n) => {
    out.push({ kind: 'story', slide, n });
    if (slide.task) out.push({ kind: 'task', slide, task: slide.task, n });
  });
  out.push({ kind: 'finish' });
  return out;
}

export function ScrollLessonPage() {
  const { id = '', lesson = '' } = useParams();
  const f = figureById(id);
  const l = f?.lessons.find((x) => x.id === lesson);
  if (!f || !l?.scroll) return <Navigate to={f ? `/minds/${f.id}` : '/minds'} replace />;
  return <Lesson key={`${f.id}:${l.id}`} f={f} l={l} sc={l.scroll} />;
}

function Lesson({ f, l, sc }: { f: Figure; l: MindLesson; sc: ScrollLesson }) {
  const { user, isReal, openSignIn } = useAuth();
  const signedIn = isReal && !!user;
  const reduced = useMediaQuery('(prefers-reduced-motion: reduce)');
  const tasks = scrollTasks(l);
  const [pages] = useState(() => pagesOf(sc));
  const [done, setDone] = useState<string[]>([]);
  const [earned, setEarned] = useState(0);
  const [at, setAt] = useState(0);
  const [from, setFrom] = useState<number | null>(null); // the page sliding away
  const [hint, setHint] = useState(false);
  const deck = useRef<HTMLDivElement>(null);
  const pop = useRef<HTMLSpanElement>(null);
  const busy = useRef(false);

  const page = pages[at]!;
  const finished = done.length === tasks.length;
  // a task page is open once its task is done; every other page is always open
  const open = page.kind !== 'task' || done.includes(page.task.id);
  const canNext = open && at < pages.length - 1;
  const next = pages[at + 1];

  function go(to: number) {
    if (busy.current || to < 0 || to >= pages.length || to === at) return;
    if (to > at && !canNext) return;
    setHint(false);
    if (reduced) return setAt(to);
    busy.current = true;
    setFrom(at);
    setAt(to);
  }

  // slide the new page in: sideways for a story, up from below for a task (backwards when going back)
  useLayoutEffect(() => {
    if (from === null) return;
    const el = deck.current;
    const inEl = el?.querySelector<HTMLElement>(`[data-page="${at}"]`);
    const outEl = el?.querySelector<HTMLElement>(`[data-page="${from}"]`);
    const fwd = at > from;
    const ax = axis(pages[fwd ? at : from]!);
    const prop = ax === 'x' ? 'xPercent' : 'yPercent';
    const tl = gsap.timeline({
      defaults: { duration: 0.45, ease: 'power3.out' },
      onComplete: () => {
        busy.current = false;
        setFrom(null);
      },
    });
    if (inEl) tl.fromTo(inEl, { [prop]: fwd ? 100 : -100 }, { [prop]: 0 }, 0);
    if (outEl) tl.fromTo(outEl, { [prop]: 0, opacity: 1 }, { [prop]: fwd ? -100 : 100, opacity: 0.4 }, 0);
    return () => {
      tl.kill();
      busy.current = false;
    };
  }, [at, from, pages]);

  // stuck on an open page for a few seconds: show which way to swipe
  useEffect(() => {
    if (!canNext) return;
    const id = window.setTimeout(() => setHint(true), HINT_MS);
    return () => window.clearTimeout(id);
  }, [at, canNext]);

  // one wheel gesture or arrow key moves one page; a page taller than the screen scrolls first
  useEffect(() => {
    const el = deck.current;
    if (!el) return;
    let lock = 0;
    const scroller = () => el.querySelector<HTMLElement>(`[data-page="${at}"]`);
    const atEdge = (down: boolean) => {
      const p = scroller();
      if (!p) return true;
      return down ? p.scrollTop + p.clientHeight >= p.scrollHeight - 2 : p.scrollTop <= 1;
    };
    const onWheel = (e: WheelEvent) => {
      const d = Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
      if (Math.abs(d) < 12 || !atEdge(d > 0)) return;
      e.preventDefault();
      const now = Date.now();
      if (now < lock) return;
      lock = now + 650; // a trackpad sends many small events for one swipe
      go(d > 0 ? at + 1 : at - 1);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === 'PageDown') go(at + 1);
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp' || e.key === 'PageUp') go(at - 1);
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // a finger swipe anywhere in the lesson: left or up goes on, right or down goes back
  const touch = useRef<{ x: number; y: number; ok: boolean } | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    const t0 = e.touches[0];
    if (!t0) return;
    // until its task is done, a swipe that starts on the task is the task's own drag
    const inTask = !open && !!(e.target as HTMLElement).closest('[data-task]');
    touch.current = { x: t0.clientX, y: t0.clientY, ok: !inTask };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const st = touch.current;
    touch.current = null;
    const t1 = e.changedTouches[0];
    if (!st?.ok || !t1) return;
    const dx = t1.clientX - st.x;
    const dy = t1.clientY - st.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE) return;
    const vertical = Math.abs(dy) > Math.abs(dx);
    const p = deck.current?.querySelector<HTMLElement>(`[data-page="${at}"]`);
    if (vertical && p && p.scrollHeight > p.clientHeight + 2) {
      // a long page scrolls under the finger; only its very end turns the page
      if (dy < 0 && p.scrollTop + p.clientHeight < p.scrollHeight - 2) return;
      if (dy > 0 && p.scrollTop > 1) return;
    }
    go((vertical ? dy : dx) < 0 ? at + 1 : at - 1);
  };

  useEffect(() => {
    if (finished && signedIn) void markMind(user.uid, lessonRef(f.id, l.id)).catch(() => {});
  }, [finished, signedIn, user, f.id, l.id]);

  // Step XP goes to the server one request at a time: two quick tasks used to send two awards at
  // once for the same account, and the loser of that race could fail and lose its 2 XP (2026-10-28).
  // A failed award is tried once more; the server never pays a step twice.
  const queue = useRef<Promise<void>>(Promise.resolve());
  function complete(task: ScrollTask) {
    if (done.includes(task.id)) return;
    setDone((d) => [...d, task.id]);
    if (!signedIn) return;
    const ref = stepRef(f.id, l.id, task.id);
    queue.current = queue.current.then(async () => {
      const r = await stepXp(ref).catch(() => stepXp(ref)).catch(() => null);
      const gained = (r?.xp ?? 0) - (r?.before ?? 0); // double while an XP booster runs
      if (r?.awarded && gained > 0) {
        setEarned((e) => e + gained);
        if (pop.current && !reduced) gsap.fromTo(pop.current, { opacity: 1, y: 0, scale: 1 }, { opacity: 0, y: -26, scale: 1.25, duration: 1.1, ease: 'power2.out' });
      }
    });
  }

  const portrait = portraitUrl(f);
  const pct = Math.round((done.length / tasks.length) * 100);
  const nextWay = next && axis(next) === 'x' ? 'side' : 'up';

  function render(p: Page) {
    if (p.kind === 'cover')
      return (
        <div className={s.cover}>
          <span className={s.kicker}>{f.name}</span>
          <h1 className={s.title}>{l.title}</h1>
          <p className={s.scrollHint} aria-hidden>
            {t('sl.swipeStart')}
          </p>
        </div>
      );
    if (p.kind === 'finish')
      return (
        <div className={s.finish}>
          <span className={s.kicker}>{t('sl.complete')}</span>
          <h2 className={s.title}>{l.title}</h2>
          <div className={s.trading}>
            <b>{t('hm.inTrading')}</b>
            <p>{l.trading}</p>
          </div>
          <p className={s.total}>{signedIn ? (earned > 0 ? t('sl.earned', { xp: earned }) : t('sl.already')) : t('sl.signInXp', { xp: STEP_XP })}</p>
          <Link to={sectionPath(f.id, 'lessons')} className={buttonClass({ variant: 'primary' })}>
            {t('sl.backTo', { name: f.name.split(' ')[0]! })}
          </Link>
        </div>
      );
    const slide = p.slide;
    if (p.kind === 'story')
      return (
        <div className={s.stage}>
          {slide.image && (
            <figure className={s.picWrap}>
              <img data-pic src={mindImageUrl(typeof slide.image === 'string' ? slide.image : sc.image)} alt={t('sl.alt', { credit: (slide.credit ?? sc.credit).split(',')[0]! })} className={s.pic} onLoad={(e) => markTall(e.currentTarget)} />
              <figcaption className={s.credit}>{slide.credit ?? sc.credit}</figcaption>
            </figure>
          )}
          <div className={s.words}>
            {slide.lines.map((line) => (
              <p key={line} data-line className={s.line}>
                {line}
              </p>
            ))}
            {slide.source && (
              <p data-line className={s.source}>
                — {slide.source}
              </p>
            )}
          </div>
        </div>
      );
    return (
      <div className={s.stage}>
        <div data-task className={s.taskWrap}>
          <LessonTask task={p.task} done={done.includes(p.task.id)} onDone={() => void complete(p.task)} portrait={portrait} />
        </div>
      </div>
    );
  }

  const label = (i: number) => {
    const p = pages[i]!;
    if (p.kind === 'cover') return l.title;
    if (p.kind === 'finish') return t('sl.complete');
    return t('sl.slideN', { n: p.n + 1, of: sc.slides.length });
  };

  return (
    <div className={s.lesson} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <div className={s.bar}>
        <Link to={sectionPath(f.id, 'lessons')} className={s.barBack} aria-label={t('sl.back', { name: f.name })}>
          ←
        </Link>
        <div className={s.barText}>
          <b>{l.title}</b>
          <span>{signedIn ? t('sl.xpSoFar', { xp: earned, steps: done.length, of: tasks.length }) : t('sl.signInXp', { xp: STEP_XP })}</span>
        </div>
        <div className={s.meter} role="progressbar" aria-label={t('sl.progress')} aria-valuemin={0} aria-valuemax={tasks.length} aria-valuenow={done.length}>
          <span style={{ width: `${pct}%` }} />
        </div>
        <span ref={pop} className={s.pop} aria-hidden>
          +{STEP_XP} XP
        </span>
        {!signedIn && (
          <Button size="sm" variant="secondary" onClick={() => void openSignIn()}>
            {t('hm.signIn')}
          </Button>
        )}
      </div>

      <div ref={deck} className={s.deck}>
        {[from, at]
          .filter((i): i is number => i !== null)
          .map((i) => (
            <section key={i} data-page={i} className={s.page} aria-label={label(i)} aria-hidden={i !== at || undefined}>
              {render(pages[i]!)}
            </section>
          ))}
      </div>

      <div className={s.nav}>
        <button type="button" className={s.navBack} onClick={() => go(at - 1)} disabled={at === 0} aria-label={t('sl.prev')}>
          ‹
        </button>
        <span className={s.dots} aria-hidden>
          {at + 1} / {pages.length}
        </span>
        <button type="button" className={s.navNext} onClick={() => go(at + 1)} disabled={!canNext}>
          {page.kind === 'task' && !open ? t('sl.doTask') : t('sl.next')} {nextWay === 'side' ? '→' : '↓'}
        </button>
      </div>
      {hint && canNext && (
        <p className={s.swipeHint} role="status">
          {nextWay === 'side' ? t('sl.swipeSide') : t('sl.swipeUp')}
        </p>
      )}
    </div>
  );
}
