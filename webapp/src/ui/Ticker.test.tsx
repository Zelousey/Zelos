import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Ticker } from './Ticker';

describe('Ticker', () => {
  it('flashes up or down only when the value changes', () => {
    const { rerender } = render(<Ticker value={10}>10.00</Ticker>);
    const cls = () => screen.getByText(/\d/).className;
    expect(cls()).not.toMatch(/up|down/);
    rerender(<Ticker value={11}>11.00</Ticker>);
    expect(cls()).toMatch(/up/);
    rerender(<Ticker value={9}>9.00</Ticker>);
    expect(cls()).toMatch(/down/);
    rerender(<Ticker value={9}>9.00</Ticker>);
    expect(cls()).toMatch(/down/); // same value: no new flash, the last one just fades
  });
});
