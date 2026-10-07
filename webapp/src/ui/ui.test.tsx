import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ErrorBoundary, ErrorState, Tabs } from '.';

describe('Tabs', () => {
  function Demo() {
    const [v, setV] = useState<'1D' | '1W' | '1M'>('1D');
    return <Tabs label="Range" value={v} onChange={setV} items={[{ value: '1D', label: '1D' }, { value: '1W', label: '1W' }, { value: '1M', label: '1M' }]} />;
  }
  it('click and arrow keys change the selection', () => {
    render(<Demo />);
    fireEvent.click(screen.getByRole('tab', { name: '1W' }));
    expect(screen.getByRole('tab', { name: '1W' })).toHaveAttribute('aria-selected', 'true');
    fireEvent.keyDown(screen.getByRole('tablist'), { key: 'ArrowRight' });
    expect(screen.getByRole('tab', { name: '1M' })).toHaveAttribute('aria-selected', 'true');
    fireEvent.keyDown(screen.getByRole('tablist'), { key: 'ArrowRight' });
    expect(screen.getByRole('tab', { name: '1D' })).toHaveAttribute('aria-selected', 'true');
  });
});

describe('ErrorBoundary', () => {
  it('contains a crash and offers retry', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    function Boom(): never {
      throw new Error('x');
    }
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong');
    spy.mockRestore();
  });
  it('ErrorState retry calls back', () => {
    const fn = vi.fn();
    render(<ErrorState onRetry={fn} />);
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(fn).toHaveBeenCalled();
  });
});
