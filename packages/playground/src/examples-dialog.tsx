import { Dialog } from './dialog';
import { examples } from './examples.ts';

const mono = { fontFamily: '"Maple Mono", monospace' };

interface ExamplesDialogProps {
	onSelect: (source: string) => void;
}

export function ExamplesDialog({ onSelect }: ExamplesDialogProps) {
	return (
		<Dialog
			trigger={(open) => (
				<button
					type="button"
					onClick={open}
					className="cursor-pointer text-xs"
					style={{ color: 'var(--color-fg-muted)' }}
					title="Load an example"
				>
					Examples
				</button>
			)}
			title="examples"
		>
			{(close) => {
				const select = (source: string) => {
					onSelect(source);
					close();
				};

				return (
					<div className="flex flex-col gap-2">
						{examples.map((example) => (
							<button
								key={example.title}
								type="button"
								onClick={() => select(example.source)}
								className="cursor-pointer rounded-md px-4 py-3 text-left transition-colors"
								style={{
									backgroundColor: 'var(--color-bg-secondary)',
									border: '1px solid var(--color-border)',
								}}
								onMouseEnter={(e) => {
									e.currentTarget.style.borderColor = 'var(--color-accent)';
								}}
								onMouseLeave={(e) => {
									e.currentTarget.style.borderColor = 'var(--color-border)';
								}}
							>
								<div className="text-xs font-medium" style={{ color: 'var(--color-fg)', ...mono }}>
									{example.title}
								</div>
								<div className="mt-0.5 text-[11px]" style={{ color: 'var(--color-fg-muted)' }}>
									{example.description}
								</div>
							</button>
						))}
					</div>
				);
			}}
		</Dialog>
	);
}
