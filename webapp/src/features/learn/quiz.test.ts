import { describe, expect, it } from 'vitest';
import { ALL_LESSONS, CHAPTERS, chapterState, lessonOpen, OLD_LESSON } from './chapters';
import { CHECKS, levelFromExperience, parseSkill, QUESTIONS, score, type Answers } from './quiz';

const a = (experience: Answers['experience'], checks: (number | null)[]): Answers => ({ experience, goal: 'learn', checks });
const right = CHECKS.map((q) => q.correct!);

describe('quiz', () => {
  it('has five questions, three knowledge checks with a right answer and an explanation', () => {
    expect(QUESTIONS).toHaveLength(5);
    for (const q of CHECKS) {
      expect(q.choices[q.correct!]).toBeDefined();
      expect(q.explain).toBeTruthy();
      expect(q.choices.at(-1)!.label).toBe('Not sure yet');
    }
  });
  it('places people by what they know, not only what they say', () => {
    expect(score(a('pro', [3, 3, 3]))).toEqual({ right: 0, level: 'beginner' }); // says pro, knows none
    expect(score(a('new', right))).toEqual({ right: 3, level: 'learning' }); // new but knows it all
    expect(score(a('new', [right[0]!, right[1]!, 3])).level).toBe('beginner');
    expect(score(a('some', [right[0]!, right[1]!, 3])).level).toBe('learning');
    expect(score(a('some', right)).level).toBe('experienced');
    expect(score(a('pro', right)).level).toBe('experienced');
    expect(score(a(null, right)).level).toBe('experienced');
  });
  it('falls back to the welcome answer when the quiz was skipped', () => {
    expect(levelFromExperience('new')).toBe('beginner');
    expect(levelFromExperience('some')).toBe('learning');
    expect(levelFromExperience('pro')).toBe('experienced');
    expect(levelFromExperience(null)).toBeNull();
  });
  it('parses the saved result defensively', () => {
    expect(parseSkill({ level: 'learning', right: 2, goal: 'friends', at: 5 })).toEqual({ level: 'learning', right: 2, goal: 'friends', at: 5 });
    expect(parseSkill({ level: 'guru' })).toBeNull();
    expect(parseSkill('x')).toBeNull();
    expect(parseSkill({ level: 'beginner', goal: 'money' })?.goal).toBeNull();
  });
});

describe('Trading 101 chapters', () => {
  const basics = CHAPTERS[0]!;
  it('ten chapters (owner 2026-11-14), lessons with unique ids, scenes, a quick check and in-app Try it links', () => {
    expect(CHAPTERS.map((c) => c.id)).toEqual(['basics', 'risk', 'charts', 'signals', 'patterns', 'options', 'options-manage', 'adv-stocks', 'adv-options', 'mind']);
    expect(CHAPTERS.map((c) => c.n)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(CHAPTERS.filter((c) => c.advanced).map((c) => c.id)).toEqual(['adv-stocks', 'adv-options']);
    expect(basics.id).toBe('basics');
    expect(basics.lessons).toHaveLength(11);
    // runner contracts are kept for Advanced options
    for (const c of CHAPTERS.filter((x) => x.id !== 'adv-options')) expect(c.lessons.some((l) => /runner/i.test(l.title))).toBe(false);
    for (const c of CHAPTERS) {
      expect(c.quiz).toHaveLength(5);
      expect(c.lessons.length).toBeGreaterThanOrEqual(6);
    }
    expect(new Set(ALL_LESSONS.map((l) => l.id)).size).toBe(ALL_LESSONS.length);
    for (const l of ALL_LESSONS) {
      expect(l.id).toMatch(/^[a-z-]{2,20}$/); // the shape users/{uid}.learnDone keeps
      expect(l.steps.length).toBeGreaterThanOrEqual(3);
      expect(l.check.right).toBeLessThan(l.check.opts.length);
      expect(l.check.why).toHaveLength(l.check.opts.length);
      expect(l.tryIt.to).toMatch(/^\/[a-z]/);
    }
  });
  it('the chapter quiz has questions without answers, and a pass mark', () => {
    expect(basics.quiz).toHaveLength(5);
    expect(basics.pass).toBe(4);
    for (const q of basics.quiz) expect(Object.keys(q).sort()).toEqual(['opts', 'q', 'why']);
  });
  it('lessons open one after another; passing the quiz opens them all', () => {
    expect(lessonOpen(basics, 0, [], false)).toBe(true);
    expect(lessonOpen(basics, 1, [], false)).toBe(false);
    expect(lessonOpen(basics, 1, ['stocks'], false)).toBe(true);
    expect(lessonOpen(basics, 5, [], true)).toBe(true);
    const st = chapterState(basics, ['stocks', 'market-works'], {});
    expect(st).toMatchObject({ unlocked: true, passed: false, done: 2, total: 11, complete: false });
    expect(st.next?.id).toBe('prices');
    expect(chapterState(basics, basics.lessons.map((l) => l.id), { basics: 1 })).toMatchObject({ passed: true, complete: true, next: null });
  });
  it('chapter 2 opens once chapter 1 is passed (or by passing its own quiz); The mental game is always open', () => {
    const risk = CHAPTERS[1]!;
    expect(risk).toMatchObject({ id: 'risk', n: 2, pass: 4 });
    expect(chapterState(risk, [], {}).unlocked).toBe(false);
    expect(chapterState(risk, [], { basics: 1 })).toMatchObject({ unlocked: true, passed: false, done: 0 });
    expect(chapterState(risk, [], { risk: 1 }).unlocked).toBe(true);
    expect(chapterState(risk, [], { basics: 1 }).next?.id).toBe('position');
    // an earlier pass of the old Charts & volume chapter still counts for chapter 3
    expect(chapterState(CHAPTERS[2]!, [], { charts: 1 })).toMatchObject({ unlocked: true, passed: true });
    expect(chapterState(CHAPTERS[9]!, [], {})).toMatchObject({ unlocked: true });
  });
  it('old one-page lessons point at their new place', () => {
    for (const to of Object.values(OLD_LESSON)) {
      const [c, l] = to.split('/');
      expect(CHAPTERS.find((x) => x.id === c)?.lessons.some((x) => x.id === l)).toBe(true);
    }
  });
});

describe('chapter quiz retakes', () => {
  it('waits 12 hours after a fail, never for a passed chapter (mirrors functions/learn.py)', async () => {
    const { retakeAt, RETAKE_WAIT_MS } = await import('./chapters');
    const H = 3600_000;
    expect(retakeAt('basics', {}, {}, 5)).toBeNull();
    expect(retakeAt('basics', { basics: 1000 }, {}, 1000 + H)).toBe(1000 + RETAKE_WAIT_MS);
    expect(retakeAt('basics', { basics: 1000 }, {}, 1000 + 12 * H)).toBeNull();
    expect(retakeAt('basics', { basics: 1000 }, { basics: 2000 }, 1000 + H)).toBeNull();
    expect(retakeAt('charts', { basics: 1000 }, {}, 1000 + H)).toBeNull();
  });
});
