import { describe, expect, it } from 'vitest';
import { t } from './i18n';

describe('t()', () => {
  it('fills placeholders and leaves unknown ones', () => {
    expect(t('dash.hello', { name: 'Sam' })).toBe('Welcome back, Sam');
    expect(t('notifications.unread', {})).toBe('{count} unread');
  });
});
