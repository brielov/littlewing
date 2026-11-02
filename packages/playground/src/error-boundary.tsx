import { Component, type ReactNode } from 'react';

interface ErrorBoundaryProps {
	children: ReactNode;
	/** A new value starts over, so that editing the source clears a failure. */
	resetKey: string;
	/** What to say in place of what failed. */
	message?: string;
}

interface ErrorBoundaryState {
	failed: boolean;
}

/** Keep a failure in one panel out of the rest of the page, which React would unmount. */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
	override state: ErrorBoundaryState = { failed: false };

	static getDerivedStateFromError(): ErrorBoundaryState {
		return { failed: true };
	}

	override componentDidUpdate(props: ErrorBoundaryProps, previous: ErrorBoundaryState): void {
		// `previous.failed` keeps the update that failed from clearing itself
		if (previous.failed && props.resetKey !== this.props.resetKey) {
			this.setState({ failed: false });
		}
	}

	override render(): ReactNode {
		if (!this.state.failed) return this.props.children;
		const message =
			this.props.message ?? 'This panel could not show the program. Edit the source to try again.';
		return <p className="p-4 text-xs text-(--color-error)">{message}</p>;
	}
}
