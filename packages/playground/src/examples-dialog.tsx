import { useCallback, useRef } from "react";

const mono = { fontFamily: '"Maple Mono", monospace' };

interface Example {
	title: string;
	description: string;
	source: string;
}

const examples: Example[] = [
	{
		title: "Loan Amortization",
		description: "Monthly payment and total interest on a fixed-rate loan",
		source: `// Fixed-rate loan amortization
principal = 250000
annual_rate = 0.065
years = 30

// Monthly rate and number of payments
r = annual_rate / 12
n = years * 12

// Standard amortization formula: M = P * r(1+r)^n / ((1+r)^n - 1)
factor = (1 + r) ^ n
monthly_payment = ROUND(principal * r * factor / (factor - 1))
total_paid = monthly_payment * n
total_interest = total_paid - principal

if total_interest > principal then "interest exceeds principal" else "reasonable loan"`,
	},
	{
		title: "Invoice Line Items",
		description: "Compute totals across multiple line items with tax tiers",
		source: `// Invoice with quantity-based pricing
quantities = [5, 12, 3, 20, 8]
unit_prices = [29.99, 9.50, 149.00, 4.75, 32.00]

// Compute each line total using index
line_totals = for i in 0..ARR_LEN(quantities) then quantities[i] * unit_prices[i]

subtotal = ROUND(ARR_SUM(line_totals))
tax_rate = if subtotal > 500 then 0.08 else 0.06
tax = ROUND(subtotal * tax_rate)
total = subtotal + tax

// Summary
ARR_JOIN([
  "Subtotal: $" + STR(subtotal),
  "Tax (" + STR(ROUND(tax_rate * 100)) + "%): $" + STR(tax),
  "Total: $" + STR(total)
], " | ")`,
	},
	{
		title: "Employee Bonus Calculator",
		description: "Tiered bonus based on performance score with team adjustment",
		source: `// Tiered bonus calculation
base_salary = 85000
performance_score = 87
team_hit_target = true

// Tiered bonus percentage
bonus_pct = if performance_score >= 95 then 0.20
  else if performance_score >= 85 then 0.12
  else if performance_score >= 70 then 0.06
  else 0.02

// Team multiplier: 1.5x if the whole team hit target
multiplier = if team_hit_target then 1.5 else 1.0

bonus = ROUND(base_salary * bonus_pct * multiplier)
effective_rate = ROUND(bonus / base_salary * 100)

STR(effective_rate) + "% bonus = $" + STR(bonus)`,
	},
	{
		title: "Date Arithmetic",
		description: "Business days, deadlines, and quarter boundaries",
		source: `// Project timeline calculations
start = DATE(2026, 3, 10)
deadline = DATE(2026, 6, 30)

total_days = DIFFERENCE_IN_DAYS(start, deadline)
total_weeks = DIFFERENCE_IN_WEEKS(start, deadline)
quarter_end = END_OF_YEAR(start)

// How many days into the quarter are we?
quarter_start = START_OF_QUARTER(start)
days_into_quarter = DIFFERENCE_IN_DAYS(quarter_start, start)

// Check if deadline is in same quarter
same_quarter = GET_QUARTER(start) == GET_QUARTER(deadline)

if same_quarter
  then "Deadline is in the same quarter (" + STR(total_days) + " days)"
  else "Deadline spans quarters (" + STR(total_weeks) + " weeks)"`,
	},
	{
		title: "Array Statistics",
		description: "Mean, variance, standard deviation, and outlier detection",
		source: `// Statistical analysis
data = [23, 45, 12, 67, 34, 89, 15, 56, 42, 71]

count = ARR_LEN(data)
total = ARR_SUM(data)
mean = total / count

// Variance = average of squared differences from mean
variance = for x in data into sum = 0 then sum + (x - mean) ^ 2
variance = variance / count
std_dev = ROUND(SQRT(variance))

// Detect outliers: values more than 2 std devs from mean
outliers = for x in data when ABS(x - mean) > 2 * std_dev then x
sorted = ARR_SORT(data)

"mean=" + STR(ROUND(mean)) + " std=" + STR(std_dev) + " outliers=" + STR(ARR_LEN(outliers))`,
	},
	{
		title: "FizzBuzz",
		description: "Classic FizzBuzz from 1 to 20 using ranges",
		source: `// FizzBuzz with ranges and conditionals
for n in 1..=20 then
  if n % 15 == 0 then "FizzBuzz"
  else if n % 3 == 0 then "Fizz"
  else if n % 5 == 0 then "Buzz"
  else STR(n)`,
	},
	{
		title: "Compound Interest",
		description: "Yearly growth of an investment with monthly compounding",
		source: `// Compound interest over time
initial = 10000
annual_rate = 0.07
years = 10

// Monthly compounding: A = P * (1 + r/12)^(12*t)
months = years * 12
monthly_rate = annual_rate / 12

final_value = ROUND(initial * (1 + monthly_rate) ^ months)
total_gain = final_value - initial
growth_pct = ROUND(total_gain / initial * 100)

// Year-by-year balances
balances = for y in 1..=years then
  ROUND(initial * (1 + monthly_rate) ^ (y * 12))

STR(growth_pct) + "% growth over " + STR(years) + " years"`,
	},
	{
		title: "Text Processing",
		description: "Parse and transform CSV-like data using string functions",
		source: `// Parse and process CSV-like data
header = "Name,Department,Salary"
rows = [
  "Alice,Engineering,120000",
  "Bob,Marketing,85000",
  "Carol,Engineering,135000",
  "Dave,Marketing,90000"
]

// Extract department from each row (field at index 1)
departments = for row in rows then STR_SPLIT(row, ",")[1]
unique_depts = ARR_UNIQUE(departments)

// Count engineering team
eng_count = for d in departments when d == "Engineering" into n = 0 then n + 1

// Build a report
ARR_JOIN([
  "Departments: " + ARR_JOIN(unique_depts, ", "),
  "Engineering team size: " + STR(eng_count),
  "Total employees: " + STR(ARR_LEN(rows))
], "\n")`,
	},
	{
		title: "Time Tracking",
		description: "Calculate billable hours and daily totals",
		source: `// Daily time tracking
clock_in = TIME(9, 15, 0)
lunch_start = TIME(12, 0, 0)
lunch_end = TIME(13, 0, 0)
clock_out = TIME(17, 45, 0)

// Calculate hours worked
morning = DIFFERENCE_IN_MINUTES(clock_in, lunch_start)
afternoon = DIFFERENCE_IN_MINUTES(lunch_end, clock_out)
total_minutes = morning + afternoon
hours = FLOOR(total_minutes / 60)
mins = total_minutes % 60

// Billing
hourly_rate = 150
billable = ROUND(total_minutes / 60 * hourly_rate)

STR(hours) + "h " + STR(mins) + "m worked = $" + STR(billable)`,
	},
	{
		title: "Matrix Flatten & Search",
		description: "Work with nested arrays using flat, sort, and filter",
		source: `// Nested data processing
matrix = [[8, 3, 14], [1, 9, 6], [11, 2, 7]]

// Flatten, sort, and analyze
flat = ARR_FLAT(matrix)
sorted = ARR_SORT(flat)
above_avg = for x in flat when x > ARR_SUM(flat) / ARR_LEN(flat) then x

// Find min/max per row
row_mins = for row in matrix then ARR_MIN(row)
row_maxs = for row in matrix then ARR_MAX(row)

global_range = ARR_MAX(flat) - ARR_MIN(flat)

"range=" + STR(global_range) + " above_avg=" + STR(ARR_LEN(above_avg))`,
	},
];

interface ExamplesDialogProps {
	onSelect: (source: string) => void;
}

export function ExamplesDialog({ onSelect }: ExamplesDialogProps) {
	const ref = useRef<HTMLDialogElement>(null);

	const open = useCallback(() => {
		ref.current?.showModal();
	}, []);

	const close = useCallback(() => {
		ref.current?.close();
	}, []);

	const select = useCallback(
		(source: string) => {
			onSelect(source);
			close();
		},
		[onSelect, close],
	);

	return (
		<>
			<button
				type="button"
				onClick={open}
				className="cursor-pointer text-xs"
				style={{ color: "var(--color-fg-muted)" }}
				title="Load an example"
			>
				Examples
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
						examples
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
					<div className="flex flex-col gap-2">
						{examples.map((example) => (
							<button
								key={example.title}
								type="button"
								onClick={() => select(example.source)}
								className="cursor-pointer rounded-md px-4 py-3 text-left transition-colors"
								style={{
									backgroundColor: "var(--color-bg-secondary)",
									border: "1px solid var(--color-border)",
								}}
								onMouseEnter={(e) => {
									e.currentTarget.style.borderColor = "var(--color-accent)";
								}}
								onMouseLeave={(e) => {
									e.currentTarget.style.borderColor = "var(--color-border)";
								}}
							>
								<div className="text-xs font-medium" style={{ color: "var(--color-fg)", ...mono }}>
									{example.title}
								</div>
								<div className="mt-0.5 text-[11px]" style={{ color: "var(--color-fg-muted)" }}>
									{example.description}
								</div>
							</button>
						))}
					</div>
				</div>
			</dialog>
		</>
	);
}
