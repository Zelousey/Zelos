/**
 * Small helpers for writing Trading 101 lessons (owner 2026-11-14 curriculum): a lesson is a few
 * illustrated steps, one quick check and a "Try it" link, the same shape as the original chapters.
 */
import type { Check, LevelCheck, Lesson, OrderCheck, Step } from './chapters';
import type { Art, ChartLine, ChartMark } from './Scene';

/** One explanation for every choice: "Right. …" on the right one, "Not quite. …" on the others. */
export function check(q: string, opts: string[], right: number, explain: string, art?: Art): Check {
  return { q, opts, right, why: opts.map((_, i) => (i === right ? 'Right. ' : 'Not quite. ') + explain), art };
}

export function lesson(id: string, title: string, sub: string, steps: Step[], chk: Check, tryIt: { label: string; to: string }, more?: Check): Lesson {
  return { id, title, sub, minutes: Math.max(2, Math.ceil(steps.length * 0.75)), steps, check: chk, ...(more ? { more } : {}), tryIt };
}

/** Tap the level on a chart (pts and each level's y on the chart's 0-100 scale). */
export function level(q: string, pts: number[], levels: { y: number; label: string }[], right: number, explain: string, title?: string): LevelCheck {
  return { kind: 'level', q, pts, levels, right, why: levels.map((_, i) => (i === right ? 'Right. ' : 'Not quite. ') + explain), ...(title ? { title } : {}) };
}

/** Put the steps in order: write them in the right order; they're shown shuffled. */
export function order(q: string, steps: string[], explain: string): OrderCheck {
  return { kind: 'order', q, steps, why: explain };
}

/** A chart-style drawing (see Scene's ChartArt). */
export function chart(pts: number[], opts: { lines?: ChartLine[]; marks?: ChartMark[]; title?: string; tone?: 'acc' | 'up' | 'dn'; zone?: [number, number, 'up' | 'dn'] } = {}): Art {
  return { k: 'chart', pts, ...opts };
}

export const big = (top: string, bottom?: string, tone?: 'up' | 'down'): Art => ({ k: 'big', top, bottom, tone });
