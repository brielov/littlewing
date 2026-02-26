import { type ReactNode, useCallback, useRef } from "react";

interface DialogProps {
	trigger: (open: () => void) => ReactNode;
	title: string;
	children: (close: () => void) => ReactNode;
}

export function Dialog({ trigger, title, children }: DialogProps) {
	const ref = useRef<HTMLDialogElement>(null);

	const open = useCallback(() => {
		ref.current?.showModal();
	}, []);

	const close = useCallback(() => {
		ref.current?.close();
	}, []);

	return (
		<>
			{trigger(open)}
			<dialog
				ref={ref}
				onClick={(e) => {
					if (e.target === e.currentTarget) close();
				}}
				className="m-auto max-h-[80vh] w-full max-w-[min(32rem,calc(100vw-2rem))] rounded-lg p-0 backdrop:bg-black/50"
				style={{
					backgroundColor: "var(--color-bg)",
					color: "var(--color-fg)",
					border: "1px solid var(--color-border)",
				}}
			>
				<div className="flex items-center justify-between px-5 pt-4 pb-2">
					<h2 className="text-sm font-semibold" style={{ fontFamily: '"Maple Mono", monospace' }}>
						{title}
					</h2>
					<button
						type="button"
						onClick={close}
						className="cursor-pointer text-lg leading-none"
						style={{ color: "var(--color-fg-muted)" }}
					>
						&times;
					</button>
				</div>
				<div className="overflow-y-auto px-5 pt-0 pb-5" style={{ maxHeight: "calc(80vh - 52px)" }}>
					{children(close)}
				</div>
			</dialog>
		</>
	);
}
