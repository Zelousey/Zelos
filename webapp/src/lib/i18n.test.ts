import { describe, expect, it } from 'vitest';
import { t } from './i18n';

describe('t()', () => {
  it('fills placeholders and leaves unknown ones', () => {
    expect(t('module.classic.open', { name: 'Arcade' })).toBe('Open Arcade');
    expect(t('notifications.unread', {})).toBe('{count} unread');
  });
});
