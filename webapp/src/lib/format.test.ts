import { describe, expect, it } from 'vitest';
import { direction, formatCompact, formatDate, formatMoney, formatPercent, formatPrice, formatSignedMoney } from './format';

describe('format', () => {
  it('money and prices', () => {
    expect(formatMoney(10000)).toBe('$10,000.00');
    expect(formatMoney(1234.5, { locale: 'de-DE', currency: 'EUR' }).replace(/\s/g, ' ')).toBe('1.234,50 €');
    expect(formatPrice(187.456)).toBe('187.46');
    expect(formatPrice(0.12345)).toBe('0.1235');
    expect(formatSignedMoney(12.3)).toBe('+$12.30');
    expect(formatSignedMoney(-4)).toBe('-$4.00');
  });
  it('percent takes percent numbers and signs them', () => {
    expect(formatPercent(1.234)).toBe('+1.23%');
    expect(formatPercent(-0.5)).toBe('-0.50%');
    expect(formatPercent(0)).toBe('0.00%');
  });
  it('missing values render as a dash, never NaN', () => {
    for (const f of [formatMoney, formatPercent, formatSignedMoney]) expect(f(undefined)).toBe('—');
    expect(formatPrice(NaN)).toBe('—');
    expect(formatCompact(null)).toBe('—');
    expect(formatDate('not a date')).toBe('—');
  });
  it('direction', () => {
    expect(direction(2)).toBe('up');
    expect(direction(-1)).toBe('down');
    expect(direction(0)).toBe('flat');
    expect(direction(undefined)).toBe('flat');
  });
});
