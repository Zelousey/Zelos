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
  it('chapter 1 has 8 lessons with unique ids, scenes, a quick check and in-app Try it links', () => {
    expect(basics.id).toBe('basics');
    expect(basics.lessons).toHaveLength(8);
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
    const st = chapterState(basics, ['stocks', 'prices'], {});
    expect(st).toMatchObject({ unlocked: true, passed: false, done: 2, total: 8, complete: false });
    expect(st.next?.id).toBe('practice-money');
    expect(chapterState(basics, basics.lessons.map((l) => l.id), { basics: 1 })).toMatchObject({ passed: true, complete: true, next: null });
  });
  it('chapter 2 opens once chapter 1 is passed (or by passing its own quiz)', () => {
    const charts = CHAPTERS[1]!;
    expect(charts).toMatchObject({ id: 'charts', n: 2, pass: 4 });
    expect(charts.lessons).toHaveLength(8);
    expect(charts.quiz).toHaveLength(5);
    expect(chapterState(charts, [], {}).unlocked).toBe(false);
    expect(chapterState(charts, [], { basics: 1 })).toMatchObject({ unlocked: true, passed: false, done: 0 });
    expect(chapterState(charts, [], { charts: 1 }).unlocked).toBe(true);
    expect(chapterState(charts, [], { basics: 1 }).next?.id).toBe('timeframes');
  });
  it('old one-page lessons point at their new place', () => {
    for (const to of Object.values(OLD_LESSON)) {
      const [c, l] = to.split('/');
      expect(CHAPTERS.find((x) => x.id === c)?.lessons.some((x) => x.id === l)).toBe(true);
    }
  });
});
