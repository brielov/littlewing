import { useCallback, useRef } from "react";

const mono = { fontFamily: '"Maple Mono", monospace' };

const sections: Array<{ title: string; items: Array<[string, string]> }> = [
	{
		title: "Types",
		items: [
			["number", "42, 3.14, -1"],
			["string", '"hello"'],
			["boolean", "true, false"],
			["date", "DATE(2025, 1, 1)"],
			["time", "TIME(14, 30, 0)"],
			["datetime", "DATETIME(2025, 1, 1, 14, 30, 0)"],
			["array", "[1, 2, 3]"],
		],
	},
	{
		title: "Operators",
		items: [
			["arithmetic", "+ - * / % ^"],
			["comparison", "== != < > <= >="],
			["logical", "&& || !"],
			["range", "1..5 (exclusive), 1..=5 (inclusive)"],
			["index", 'arr[0], str[-1], "abc"[1]'],
			["concat", '"a" + "b", [1] + [2]'],
		],
	},
	{
		title: "Control Flow",
		items: [
			["if/then/else", 'if x > 0 then "yes" else "no"'],
			["for/in/then", "for x in 1..5 then x * 2"],
			["for with guard", "for x in arr when x > 0 then x"],
		],
	},
	{
		title: "Variables",
		items: [
			["assignment", "price = 100"],
			["expressions", "total = price * (1 + tax)"],
		],
	},
	{
		title: "Built-in Functions",
		items: [
			["type", 'STR(42), NUM("3"), TYPE(x)'],
			["math", "ABS, CEIL, FLOOR, ROUND, SQRT, MIN, MAX, CLAMP"],
			["string", "STR_LEN, STR_UPPER, STR_LOWER, STR_TRIM, STR_SLICE"],
			["array", "ARR_LEN, ARR_PUSH, ARR_SLICE, ARR_REVERSE, ARR_FIRST"],
			["date", "TODAY(), GET_YEAR, ADD_DAYS, DIFFERENCE_IN_DAYS"],
			["time", "NOW_TIME(), GET_HOUR, ADD_HOURS"],
		],
	},
	{
		title: "Tips",
		items: [
			["no coercion", "types don't auto-convert; use STR() or NUM()"],
			["strict booleans", "&&, ||, if, and ! require boolean operands"],
			["deep equality", "[1, 2] == [1, 2] is true"],
			["comments", "// single-line comments"],
			["share", "the URL updates automatically as you type"],
		],
	},
];

export function HelpDialog() {
	const ref = useRef<HTMLDialogElement>(null);

	const open = useCallback(() => {
		ref.current?.showModal();
	}, []);

	const close = useCallback(() => {
		ref.current?.close();
	}, []);

	return (
		<>
			<button
				type="button"
				onClick={open}
				className="cursor-pointer text-xs"
				style={{ color: "var(--color-fg-muted)" }}
				title="Language reference"
			>
				?
			</button>
			<dialog
				ref={ref}
				onClick={(e) => {
					if (e.target === e.currentTarget) close();
				}}
				className="m-auto max-h-[80vh] w-full max-w-lg rounded-lg p-0 backdrop:bg-black/50"
				style={{
					backgroundColor: "var(--color-bg)",
					color: "var(--color-fg)",
					border: "1px solid var(--color-border)",
				}}
			>
				<div className="flex items-center justify-between px-5 pt-4 pb-2">
					<h2 className="text-sm font-semibold" style={mono}>
						littlewing reference
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
					{sections.map((section) => (
						<div key={section.title} className="mt-4 first:mt-0">
							<h3
								className="mb-2 text-[11px] font-semibold uppercase tracking-wider"
								style={{ color: "var(--color-fg-muted)" }}
							>
								{section.title}
							</h3>
							<div className="flex flex-col gap-1.5">
								{section.items.map(([label, desc]) => (
									<div key={label} className="flex gap-3 text-xs">
										<span
											className="shrink-0"
											style={{ color: "var(--color-accent)", ...mono, width: 110 }}
										>
											{label}
										</span>
										<span style={{ color: "var(--color-fg-muted)", ...mono }}>{desc}</span>
									</div>
								))}
							</div>
						</div>
					))}
				</div>
			</dialog>
		</>
	);
}
