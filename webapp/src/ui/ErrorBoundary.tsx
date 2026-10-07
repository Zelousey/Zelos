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
    if (this.state.error) return <ErrorState onRetry={() => this.setState({ error: null })} />;
    return this.props.children;
  }
}
