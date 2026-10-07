import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { firebaseConfig, useEmulators } from './firebaseConfig';

describe('firebase config', () => {
  it('normal builds use the real project', () => {
    expect(useEmulators).toBe(false);
    expect(firebaseConfig.projectId).toBe('leaderboard-agentictrading');
  });
  it('matches the classic site (firebase-config.js) so sign-in is shared', () => {
    const src = readFileSync(resolve(__dirname, '../../../firebase-config.js'), 'utf8');
    for (const [k, v] of Object.entries(firebaseConfig)) expect(src).toContain(`${k}: "${v}"`);
  });
});
