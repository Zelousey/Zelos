import { describe, expect, it } from 'vitest';
import { ALL_LESSONS } from './chapters';
import { dueIds, loopView, parseGoal, parseLoop, parseReview, reviewQuestion, weekId } from './loop';

describe('learning loop', () => {
  it('ISO weeks match the server (learnloop.week_key)', () => {
    expect(weekId('2026-11-22')).toBe('2026-W47'); // Sunday
    expect(weekId('2026-11-23')).toBe('2026-W48'); // Monday
    expect(weekId('2026-01-01')).toBe('2026-W01'); // Thursday
    expect(weekId('2027-01-01')).toBe('2026-W53'); // Friday, still last year's week 53
    expect(weekId('2024-12-30')).toBe('2025-W01'); // Monday, already next year's week 1
  });
  it('the streak lasts until a whole day is missed', () => {
    const loop = parseLoop({ streak: { days: 4, best: 6, last: '2026-11-22' }, day: { date: '2026-11-22', xp: 30 }, week: { key: '2026-W47', xp: 80 } });
    expect(loopView(loop, '2026-11-22')).toEqual({ streak: 4, best: 6, today: 30, week: 80 });
    expect(loopView(loop, '2026-11-23')).toEqual({ streak: 4, best: 6, today: 0, week: 0 });
    expect(loopView(loop, '2026-11-24').streak).toBe(0);
    expect(loopView(null, '2026-11-24')).toEqual({ streak: 0, best: 0, today: 0, week: 0 });
  });
  it('reads the review queue and lists what is due, oldest first', () => {
    const r = parseReview({ 'c:stocks': { box: 0, due: '2026-11-20' }, 'q:risk:2': { box: 2, due: '2026-11-18' }, 'c:rsi': { box: 1, due: '2026-12-01' }, junk: { due: 'x' }, 'c:bad': 4 });
    expect(Object.keys(r).sort()).toEqual(['c:rsi', 'c:stocks', 'q:risk:2']);
    expect(dueIds(r, '2026-11-22')).toEqual(['q:risk:2', 'c:stocks']);
  });
  it('every review id points at a real question', () => {
    const l = ALL_LESSONS[0]!;
    expect(reviewQuestion(`c:${l.id}`)?.check).toBe(l.check);
    const quiz = reviewQuestion('q:basics:0')?.check;
    expect(quiz && quiz.kind !== 'order' && quiz.kind !== 'level' ? quiz.opts.length : 0).toBeGreaterThan(1);
    const two = ALL_LESSONS.find((x) => x.more)!;
    expect(reviewQuestion(`c:${two.id}:2`)?.check).toBe(two.more);
    expect(reviewQuestion('q:basics:9')).toBeNull();
    expect(reviewQuestion('c:nope')).toBeNull();
  });
  it('the goal is one of the choices', () => {
    expect(parseGoal(30)).toBe(30);
    expect(parseGoal(999)).toBe(20);
  });
});
