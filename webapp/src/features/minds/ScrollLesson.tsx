/**
 * A scroll lesson (/minds/:id/learn/:lesson; owner 2026-10-23): each slide pins below the top bar
 * while its picture settles and its lines come in, then ends in a task (hold, a question, a
 * drag). The next slide only appears once that task is done, and each task pays STEP_XP once
 * (the XP bar fills as you go). With reduced motion nothing moves; the slides and tasks are the
 * same. First lesson: Napoleon, "Speed is a weapon".
 */
import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router';
import { useAuth } from '../../lib/auth';
import { gsap, ScrollTrigger, useGSAP } from '../../lib/gsap';
import { t } from '../../lib/i18n';
import { useMediaQuery } from '../../lib/useMediaQuery';
import { Button, buttonClass } from '../../ui';
import { LessonTask } from './LessonTasks';
import { figureById, lessonRef, markMind, mindImageUrl, portraitUrl, scrollTasks, STEP_XP, stepRef, stepXp, type Figure, type MindLesson, type ScrollLesson, type ScrollTask } from './minds';
import s from './ScrollLesson.module.css';

/** a portrait (taller than wide) is shown from the top, so the face isn't cut off */
const markTall = (img: HTMLImageElement) => {
  if (img.naturalHeight > img.naturalWidth * 0.9) img.dataset.tall = '';
};

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
  const [done, setDone] = useState<string[]>([]);
  const [earned, setEarned] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLDivElement>(null);
  const pop = useRef<HTMLSpanElement>(null);

  // the slides up to (and including) the first one whose task isn't done yet
  const open = sc.slides.findIndex((x) => x.task && !done.includes(x.task.id));
  const shown = open === -1 ? sc.slides.length : open + 1;
  const finished = open === -1;

  useGSAP(
    () => {
      if (reduced) return;
      const top = () => (document.querySelector('header')?.getBoundingClientRect().bottom ?? 0) + (bar.current?.offsetHeight ?? 0);
      gsap.utils.toArray<HTMLElement>('[data-slide]').forEach((sec) => {
        // the first line is there when the slide arrives (never an empty red screen); the rest
        // come in as you scroll, then the task, then everything holds still for a moment
        const lines = gsap.utils.toArray<HTMLElement>(sec.querySelectorAll('[data-line]')).slice(1);
        const pic = sec.querySelector('[data-pic]');
        const task = sec.querySelector('[data-task]');
        const reveal = () => Math.round(window.innerHeight * (0.5 + lines.length * 0.3));
        // a slide taller than the screen isn't pinned (its bottom could never be reached); it just scrolls
        const fits = sec.offsetHeight <= window.innerHeight - top() - 8;
        const tl = gsap.timeline({
          scrollTrigger: fits
            ? { trigger: sec, start: () => `top ${top()}px`, end: () => `+=${reveal()}`, pin: true, scrub: 0.5, invalidateOnRefresh: true }
            : { trigger: sec, start: 'top 85%', end: 'top 35%', scrub: 0.5 },
        });
        if (pic) tl.fromTo(pic, { scale: 1.16 }, { scale: 1, duration: 1, ease: 'none' }, 0);
        if (lines.length) tl.from(lines, { opacity: 0, y: 24, stagger: 0.35, duration: 0.35 }, 0.1);
        if (task) tl.from(task, { opacity: 0, y: 16, duration: 0.3 });
        tl.to({}, { duration: 0.6 });
      });
    },
    { scope: root, dependencies: [shown, finished, reduced], revertOnUpdate: true },
  );

  // a task done: glide down to the slide it opened
  const seen = useRef(shown + (finished ? 1 : 0));
  useEffect(() => {
    const now = shown + (finished ? 1 : 0);
    if (now <= seen.current) return; // only when a task just opened something new
    seen.current = now;
    // new triggers are measured lazily: measure now, then glide to where the new slide starts
    const id = requestAnimationFrame(() => {
      const el = root.current?.querySelector<HTMLElement>(finished ? '[data-finish]' : `[data-slide="${shown - 1}"]`);
      if (!el) return;
      ScrollTrigger.refresh();
      const st = ScrollTrigger.getAll().find((x) => x.trigger === el);
      const top = st?.pin ? st.start + 2 : el.getBoundingClientRect().top + window.scrollY - (bar.current?.getBoundingClientRect().bottom ?? 0) - 8;
      window.scrollTo({ top: Math.min(top, ScrollTrigger.maxScroll(window)), behavior: reduced ? 'auto' : 'smooth' });
    });
    return () => cancelAnimationFrame(id);
  }, [shown, finished, reduced]);

  useEffect(() => {
    if (finished && signedIn) void markMind(user.uid, lessonRef(f.id, l.id)).catch(() => {});
  }, [finished, signedIn, user, f.id, l.id]);

  async function complete(task: ScrollTask) {
    if (done.includes(task.id)) return;
    setDone((d) => [...d, task.id]);
    if (!signedIn) return;
    const r = await stepXp(stepRef(f.id, l.id, task.id)).catch(() => null);
    const gained = (r?.xp ?? 0) - (r?.before ?? 0); // double while an XP booster runs
    if (r?.awarded && gained > 0) {
      setEarned((e) => e + gained);
      if (pop.current && !reduced) gsap.fromTo(pop.current, { opacity: 1, y: 0, scale: 1 }, { opacity: 0, y: -26, scale: 1.25, duration: 1.1, ease: 'power2.out' });
    }
  }

  const portrait = portraitUrl(f);
  const pct = Math.round((done.length / tasks.length) * 100);
  return (
    <div ref={root} className={[s.lesson, !finished && !reduced && s.waiting].filter(Boolean).join(' ')}>
      <div ref={bar} className={s.bar}>
        <Link to={`/minds/${f.id}`} className={s.barBack} aria-label={t('sl.back', { name: f.name })}>
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

      <header className={s.cover}>
        <span className={s.kicker}>{f.name}</span>
        <h1 className={s.title}>{l.title}</h1>
        <p className={s.scrollHint} aria-hidden>
          {t('sl.scroll')} ↓
        </p>
      </header>

      {sc.slides.slice(0, shown).map((slide, i) => (
        <section key={i} data-slide={i} className={s.slide} aria-label={t('sl.slideN', { n: i + 1, of: sc.slides.length })}>
          <div className={s.stage}>
            {slide.image && (
              <figure className={[s.picWrap, slide.task && s.picSmall].filter(Boolean).join(' ')}>
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
            {slide.task && (
              <div data-task className={s.taskWrap}>
                <LessonTask task={slide.task} done={done.includes(slide.task.id)} onDone={() => void complete(slide.task!)} portrait={portrait} />
              </div>
            )}
          </div>
        </section>
      ))}

      {finished && (
        <section data-finish className={s.finish}>
          <span className={s.kicker}>{t('sl.complete')}</span>
          <h2 className={s.title}>{l.title}</h2>
          <div className={s.trading}>
            <b>{t('hm.inTrading')}</b>
            <p>{l.trading}</p>
          </div>
          <p className={s.total}>{signedIn ? (earned > 0 ? t('sl.earned', { xp: earned }) : t('sl.already')) : t('sl.signInXp', { xp: STEP_XP })}</p>
          <Link to={`/minds/${f.id}`} className={buttonClass({ variant: 'primary' })}>
            {t('sl.backTo', { name: f.name.split(' ')[0]! })}
          </Link>
        </section>
      )}

    </div>
  );
}
