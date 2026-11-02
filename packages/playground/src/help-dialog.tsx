import { Dialog } from './dialog';

const mono = { fontFamily: '"Maple Mono", monospace' };

const sections: Array<{ title: string; items: Array<[string, string]> }> = [
	{
		title: 'Types',
		items: [
			['number', '42, 3.14, 1e3, an exact decimal of 34 digits'],
			['string', '"hello", "total: #{x}"'],
			['boolean', 'true, false'],
			['array', '[1, 2, 3], all of one type'],
			['record', '{ name: "Ana", total: 12 }'],
			['date', 'DATE(2025, 1, 1)'],
			['time', 'TIME(14, 30, 0)'],
			['datetime', 'DATETIME(2025, 1, 1, 14, 30, 0)'],
		],
	},
	{
		title: 'Operators',
		items: [
			['arithmetic', '+ - * / % ^'],
			['comparison', '== != < > <= >='],
			['logical', '&& || !'],
			['range', '1..5 (exclusive), 1..=5 (inclusive)'],
			['index', 'list[0], text[-1], rates[country]'],
			['field', 'order.customer.tier'],
			['join', '"a" + "b", [1] + [2]'],
			['pipe', 'x |> ABS |> ROUND(?, 2)'],
			['missing', 'order.tier ?? "standard"'],
		],
	},
	{
		title: 'Control Flow',
		items: [
			['if/then/else', 'if x > 0 then "yes" else "no"'],
			['for (map)', 'for x in 1..5 then x * 2'],
			['for (filter)', 'for x in list when x > 0 then x'],
			['for (reduce)', 'for x in [1, 2, 3] into sum = 0 then sum + x'],
		],
	},
	{
		title: 'Names',
		items: [
			['binding', 'price = 100'],
			['input, with a default', 'rate ?= 0.21'],
			['input, required', 'a name read but never bound'],
			['record shorthand', '{ ...item, price, total: 1 }'],
		],
	},
	{
		title: 'Functions',
		items: [
			['conversion', 'STR, NUM'],
			['strings and arrays', 'LEN, SLICE, CONTAINS, INDEX_OF'],
			['strings', 'UPPER, LOWER, TRIM, SPLIT, REPLACE'],
			['arrays', 'SORT, SORT_BY, JOIN'],
			['numbers', 'FLOOR, CEIL, ROUND, FIXED'],
			['littlewing/std', 'ABS, MIN, MAX, SUM, SQRT, UNIQUE and more'],
			['littlewing/temporal', 'YEAR, ADD, DIFF, START_OF and more'],
			['littlewing/clock', 'NOW, TODAY, NOW_TIME'],
		],
	},
	{
		title: 'Tips',
		items: [
			['statements', 'one per line, or separated by ;'],
			['new lines', 'a line starting with - ( [ or ! is a new statement'],
			['budget', 'programs here stop at 2 million steps'],
			['no coercion', "types don't convert by themselves; use STR or NUM"],
			['strict booleans', '&&, ||, if, and ! take booleans'],
			['exact numbers', '0.1 + 0.2 == 0.3 is true'],
			['deep equality', '[1, 2] == [1, 2] is true'],
			['comments', '// to the end of the line'],
			['share', 'the URL updates automatically as you type'],
		],
	},
];

export function HelpDialog() {
	return (
		<Dialog
			trigger={(open) => (
				<button
					type="button"
					onClick={open}
					className="cursor-pointer text-xs"
					style={{ color: 'var(--color-fg-muted)' }}
					title="Language reference"
					aria-label="Open language reference"
				>
					?
				</button>
			)}
			title="littlewing reference"
		>
			{() =>
				sections.map((section) => (
					<div key={section.title} className="mt-4 first:mt-0">
						<h3
							className="mb-2 text-[11px] font-semibold uppercase tracking-wider"
							style={{ color: 'var(--color-fg-muted)' }}
						>
							{section.title}
						</h3>
						<div className="flex flex-col gap-1.5">
							{section.items.map(([label, desc]) => (
								<div key={label} className="flex gap-3 text-xs">
									<span
										className="shrink-0"
										style={{ color: 'var(--color-accent)', ...mono, width: 110 }}
									>
										{label}
									</span>
									<span style={{ color: 'var(--color-fg-muted)', ...mono }}>{desc}</span>
								</div>
							))}
						</div>
					</div>
				))
			}
		</Dialog>
	);
}
