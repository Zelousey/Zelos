/**
 * Catches a crash inside one screen so the rest of the app (navigation, other screens)
 * keeps working. Shows the standard error state with a retry.
 */
import { Component, type ReactNode } from 'react';
import { ErrorState } from './States';

type Props = { children: ReactNode; resetKey?: unknown };
type State = { error: Error | null };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidUpdate(prev: Props) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null });
  }

  componentDidCatch(error: Error) {
    // No third-party error reporting yet (see docs/APP_ARCHITECTURE.md). Log locally only.
    console.error('[zelos] screen crashed:', error.name);
  }

  render() {
    const e = this.state.error;
    if (e)
      return (
        <>
          <ErrorState onRetry={() => this.setState({ error: null })} />
          {/* the error itself, small, so a screenshot tells us what broke (owner 2026-11-13) */}
          <p style={{ margin: '0 auto', maxWidth: 520, padding: '0 16px', fontSize: 12, color: 'var(--muted)', overflowWrap: 'anywhere', textAlign: 'center' }}>
            {`${e.name}: ${e.message}`.slice(0, 300)}
            {e.stack ? ` · ${e.stack.split('\n').slice(0, 2).join(' · ').slice(0, 200)}` : ''}
          </p>
        </>
      );
    return this.props.children;
  }
}
