/**
 * "Back to your lesson" (owner list D, 2026-10-27: return to the exact lesson or test after opening
 * a chart). The lesson player and the chapter quiz note where you are (this tab only); when you
 * leave for a chart or any other screen, a small button takes you straight back to that step.
 */
export type LearnPlace = { path: string; title: string; at: number };

const KEY = 'zelosLearnReturn';
const MAX_AGE = 2 * 3600_000; // after two hours away it isn't "where I just was" any more

export function noteLearnPlace(path: string, title: string) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ path, title, at: Date.now() } satisfies LearnPlace));
  } catch {
    /* storage blocked: there's just no button */
  }
}

export function readLearnPlace(now = Date.now()): LearnPlace | null {
  try {
    const p = JSON.parse(sessionStorage.getItem(KEY) || 'null') as LearnPlace | null;
    if (!p || typeof p.path !== 'string' || !p.path.startsWith('/learn/') || typeof p.title !== 'string') return null;
    return now - (Number(p.at) || 0) > MAX_AGE ? null : p;
  } catch {
    return null;
  }
}

export function clearLearnPlace() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* nothing to clear */
  }
}

/** The chapter quiz's answers so far, kept while you look at something else (this tab only). */
export function readQuizDraft(chapter: string, n: number): (number | null)[] | null {
  try {
    const a = JSON.parse(sessionStorage.getItem(`zelosQuizDraft:${chapter}`) || 'null') as unknown;
    return Array.isArray(a) && a.length === n && a.every((x) => x === null || Number.isInteger(x)) ? (a as (number | null)[]) : null;
  } catch {
    return null;
  }
}

export function writeQuizDraft(chapter: string, answers: (number | null)[] | null) {
  try {
    if (answers) sessionStorage.setItem(`zelosQuizDraft:${chapter}`, JSON.stringify(answers));
    else sessionStorage.removeItem(`zelosQuizDraft:${chapter}`);
  } catch {
    /* storage blocked: answers just aren't kept */
  }
}
