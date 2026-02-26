import { Dialog } from "./dialog";

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
			["pipe", "x |> ABS(?) |> STR(?)"],
		],
	},
	{
		title: "Control Flow",
		items: [
			["if/then/else", 'if x > 0 then "yes" else "no"'],
			["for (map)", "for x in 1..5 then x * 2"],
			["for (filter)", "for x in arr when x > 0 then x"],
			["for (reduce)", "for x in [1,2,3] into sum = 0 then sum + x"],
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
			["polymorphic", "LEN, SLICE, CONTAINS, REVERSE, INDEX_OF"],
			["string", "STR_UPPER, STR_LOWER, STR_TRIM, STR_SPLIT"],
			["array", "ARR_SORT, ARR_SUM, ARR_JOIN, ARR_UNIQUE"],
			["date", "TODAY(), YEAR, ADD_DAYS, DIFFERENCE_IN_DAYS"],
			["time", "NOW_TIME(), HOUR, ADD_HOURS"],
		],
	},
	{
		title: "Tips",
		items: [
			["no coercion", "types don't auto-convert; use STR() or NUM()"],
			["strict booleans", "&&, ||, if, and ! require boolean operands"],
			["pipe operator", "? marks where the piped value goes; at least one required"],
			["deep equality", "[1, 2] == [1, 2] is true"],
			["comments", "// single-line comments"],
			["share", "the URL updates automatically as you type"],
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
					style={{ color: "var(--color-fg-muted)" }}
					title="Language reference"
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
				))
			}
		</Dialog>
	);
}
