/**
 * The app and the classic site must look like one product: every colour token the app
 * defines for each theme must equal the classic site's value in zelos-theme.css.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const site = readFileSync(resolve(__dirname, '../../../zelos-theme.css'), 'utf8');
const app = readFileSync(resolve(__dirname, './tokens.css'), 'utf8');

const norm = (v: string) => v.replace(/\s+/g, '').toLowerCase();

function block(css: string, selector: RegExp): Record<string, string> {
  const out: Record<string, string> = {};
  const re = new RegExp(selector.source + '\\s*\\{([^}]*)\\}', 'g');
  for (const m of css.matchAll(re)) {
    for (const d of (m[1] ?? '').matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)) out[d[1]!] = norm(d[2]!);
  }
  return out;
}

const COLOR = /^(bg|bg-soft|surface|surface-2|surface-hover|border|border-soft|nav-bg|ink|ink-2|muted|muted-2|chart-.*|accent.*|violet|violet-soft|gold|gold-soft|bull|amber|amber-soft|danger|danger-soft)$/;

describe('design tokens match zelos-theme.css', () => {
  const cases: [string, RegExp][] = [
    ['black (default)', /:root/],
    ['blue', /:root\[data-theme=["']blue["']\]/],
    ['white', /:root\[data-theme=["']white["']\]/],
  ];
  for (const [name, sel] of cases) {
    it(name, () => {
      const exact = new RegExp('(?:^|\\n)\\s*' + sel.source + '(?![\\w\\[])');
      const s = block(site, exact);
      const a = block(app, exact);
      const keys = Object.keys(a).filter((k) => COLOR.test(k));
      expect(keys.length).toBeGreaterThan(name.startsWith('black') ? 25 : 10);
      for (const k of keys) if (k in s) expect([k, a[k]]).toEqual([k, s[k]]);
    });
  }
});
