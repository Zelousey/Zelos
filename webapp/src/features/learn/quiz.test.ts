import { describe, expect, it } from 'vitest';
import { LESSONS, nextLesson } from './lessons';
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

describe('Trading 101', () => {
  it('six lessons with unique ids and in-app Try it links', () => {
    expect(LESSONS).toHaveLength(6);
    expect(new Set(LESSONS.map((l) => l.id)).size).toBe(6);
    for (const l of LESSONS) expect(l.tryIt.to).toMatch(/^\/[a-z]/);
  });
  it('next lesson is the first not done', () => {
    expect(nextLesson([])?.id).toBe('stocks');
    expect(nextLesson(['stocks', 'buy-sell'])?.id).toBe('orders');
    expect(nextLesson(LESSONS.map((l) => l.id))).toBeNull();
  });
});
