import { beforeEach, describe, expect, it } from 'vitest';
import { clearLearnPlace, noteLearnPlace, readLearnPlace, readQuizDraft, writeQuizDraft } from './learnReturn';

describe('back to your lesson', () => {
  beforeEach(() => sessionStorage.clear());

  it('remembers the last lesson step, then forgets it after two hours or when cleared', () => {
    const now = Date.now();
    noteLearnPlace('/learn/basics/prices?step=5', '“Why prices move” · step 6 of 9');
    expect(readLearnPlace(now)).toMatchObject({ path: '/learn/basics/prices?step=5' });
    expect(readLearnPlace(now + 2 * 3600_000 + 1)).toBeNull();
    clearLearnPlace();
    expect(readLearnPlace(now)).toBeNull();
  });

  it('only ever points inside Trading 101', () => {
    sessionStorage.setItem('zelosLearnReturn', JSON.stringify({ path: 'https://evil.example', title: 'x', at: Date.now() }));
    expect(readLearnPlace()).toBeNull();
    sessionStorage.setItem('zelosLearnReturn', '{broken');
    expect(readLearnPlace()).toBeNull();
  });

  it('keeps a quiz draft of the right length only', () => {
    writeQuizDraft('basics', [1, null, 2, null, null]);
    expect(readQuizDraft('basics', 5)).toEqual([1, null, 2, null, null]);
    expect(readQuizDraft('basics', 4)).toBeNull();
    writeQuizDraft('basics', null);
    expect(readQuizDraft('basics', 5)).toBeNull();
  });
});
