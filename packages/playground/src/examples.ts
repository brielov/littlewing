export interface Example {
	title: string;
	description: string;
	source: string;
}

export const examples: Example[] = [
	{
		title: 'Pricing Rules',
		description: 'Tax by country and a discount by tier, from three inputs',
		source: `// Inputs with defaults, which the Inputs panel can change
total ?= 1200
country ?= "UY"
tier ?= "gold"

// ?? gives what to use when a key is missing
rates = { AR: 0.21, UY: 0.22, CL: 0.19 }
tax_rate = rates[country] ?? 0

discounts = { gold: 0.15, silver: 0.1 }
discount = total * (discounts[tier] ?? 0)

subtotal = total - discount
tax = subtotal * tax_rate

{ subtotal, tax, to_pay: FIXED(subtotal + tax, 2) }`,
	},
	{
		title: 'Loan Amortization',
		description: 'Monthly payment and total interest on a fixed-rate loan',
		source: `// Fixed-rate loan amortization. Try changing the inputs beside the editor
principal ?= 250000
annual_rate ?= 0.065
years ?= 30

// Monthly rate and number of payments
r = annual_rate / 12
n = years * 12

// Standard amortization formula: M = P * r(1+r)^n / ((1+r)^n - 1)
factor = (1 + r) ^ n
payment = ROUND(principal * r * factor / (factor - 1), 2)
interest = payment * n - principal

"Pay #{FIXED(payment, 2)} a month, and #{FIXED(interest, 2)} in interest"`,
	},
	{
		title: 'Invoice Line Items',
		description: 'Totals across line items with a tax tier',
		source: `// An invoice, as a list of records
items = [
  { name: "Keyboard", quantity: 5, price: 29.99 },
  { name: "Cable", quantity: 12, price: 9.5 },
  { name: "Monitor", quantity: 3, price: 149 }
]

// The decimals are exact, so this adds up to the cent
lines = for item in items then { ...item, total: item.quantity * item.price }
subtotal = for line in lines into sum = 0 then sum + line.total

tax_rate = if subtotal > 500 then 0.08 else 0.06
tax = ROUND(subtotal * tax_rate, 2)

{ subtotal, tax, total: subtotal + tax }`,
	},
	{
		title: 'Employee Bonus Calculator',
		description: 'Tiered bonus based on performance score with team adjustment',
		source: `// Tiered bonus calculation
base_salary ?= 85000
performance_score ?= 87
team_hit_target ?= true

// Tiered bonus percentage
bonus_pct = if performance_score >= 95 then 0.20
  else if performance_score >= 85 then 0.12
  else if performance_score >= 70 then 0.06
  else 0.02

// Team multiplier: 1.5x if the whole team hit target
multiplier = if team_hit_target then 1.5 else 1

bonus = ROUND(base_salary * bonus_pct * multiplier)
effective_rate = ROUND(bonus / base_salary * 100)

"#{effective_rate}% bonus = $#{bonus}"`,
	},
	{
		title: 'Date Arithmetic',
		description: 'Durations, deadlines, and quarter boundaries',
		source: `// Project timeline calculations
start ?= DATE(2026, 3, 10)
deadline ?= DATE(2026, 6, 30)

total_days = DIFF(start, deadline, "days")
total_weeks = DIFF(start, deadline, "weeks")

// How many days into the quarter are we?
quarter_start = START_OF(start, "quarter")
days_in = DIFF(quarter_start, start, "days")

same_quarter = QUARTER(start) == QUARTER(deadline)

if same_quarter
  then "Same quarter, #{total_days} days away"
  else "#{total_weeks} weeks away, and #{days_in} days into the quarter"`,
	},
	{
		title: 'Array Statistics',
		description: 'Mean, variance, standard deviation, and outlier detection',
		source: `// Statistical analysis
data ?= [23, 45, 12, 67, 34, 89, 15, 56, 42, 71]

count = LEN(data)
mean = SUM(data) / count

// Variance: the average of squared differences from the mean
squares = for x in data into sum = 0 then sum + (x - mean) ^ 2
variance = squares / count
deviation = ROUND(SQRT(variance))

// Outliers: values more than 2 deviations from the mean
outliers = for x in data when ABS(x - mean) > 2 * deviation then x

"mean=#{ROUND(mean)} deviation=#{deviation} outliers=#{LEN(outliers)}"`,
	},
	{
		title: 'FizzBuzz',
		description: 'Classic FizzBuzz from 1 to 20 using ranges',
		source: `// FizzBuzz with ranges and conditionals
for n in 1..=20 then
  if n % 15 == 0 then "FizzBuzz"
  else if n % 3 == 0 then "Fizz"
  else if n % 5 == 0 then "Buzz"
  else STR(n)`,
	},
	{
		title: 'Compound Interest',
		description: 'Yearly growth of an investment with monthly compounding',
		source: `// Compound interest over time
initial ?= 10000
annual_rate ?= 0.07
years ?= 10

// Monthly compounding: A = P * (1 + r/12)^(12*t)
monthly_rate = annual_rate / 12
balance_at = initial * (1 + monthly_rate) ^ (years * 12)

gain = balance_at - initial

// A program gives back one value, so a record can hold several
{
  final_value: FIXED(balance_at, 2),
  growth: "#{ROUND(gain / initial * 100)}%",
  balances: for y in 1..=years then ROUND(initial * (1 + monthly_rate) ^ (y * 12))
}`,
	},
	{
		title: 'Text Processing',
		description: 'Parse and transform CSV-like data using string functions',
		source: `// Parse and process CSV-like data
rows = [
  "Alice,Engineering,120000",
  "Bob,Marketing,85000",
  "Carol,Engineering,135000",
  "Dave,Marketing,90000"
]

people = for row in rows then SPLIT(row, ",")
departments = UNIQUE(for person in people then person[1])

// Count the engineering team
engineers = for p in people when p[1] == "Engineering" into n = 0 then n + 1

JOIN([
  "Departments: #{JOIN(departments, ", ")}",
  "Engineering team size: #{engineers}",
  "Total employees: #{LEN(rows)}"
], "\\n")`,
	},
	{
		title: 'Time Tracking',
		description: 'Calculate billable hours and daily totals',
		source: `// Daily time tracking
clock_in = TIME(9, 15, 0)
lunch_start = TIME(12, 0, 0)
lunch_end = TIME(13, 0, 0)
clock_out = TIME(17, 45, 0)

// Calculate hours worked
morning = DIFF(clock_in, lunch_start, "minutes")
afternoon = DIFF(lunch_end, clock_out, "minutes")
total_minutes = morning + afternoon

hours = FLOOR(total_minutes / 60)
minutes = total_minutes % 60

// Billing
hourly_rate ?= 150
billable = ROUND(total_minutes / 60 * hourly_rate, 2)

"#{hours}h #{minutes}m worked = $#{FIXED(billable, 2)}"`,
	},
	{
		title: 'Data Pipeline',
		description: 'Chain transformations with the pipe operator',
		source: `// A pipe sends a value through functions. ? marks where it goes
raw_score ?= -73
score = raw_score |> ABS |> CLAMP(?, 0, 100)

rating = if score >= 90 then "A"
  else if score >= 80 then "B"
  else if score >= 70 then "C"
  else "D"

// Text goes through the same way
name ?= "  ana maría  "
tag = name |> TRIM |> REPLACE(?, " ", "-") |> UPPER

"#{tag}: #{score}, grade #{rating}"`,
	},
	{
		title: 'Matrix Statistics',
		description: 'Work with nested arrays using flat, sort, and min and max',
		source: `// Nested data processing
matrix = [[8, 3, 14], [1, 9, 6], [11, 2, 7]]

// Flatten, sort, and analyze
flat = FLAT(matrix)
sorted = SORT(flat)
average = SUM(flat) / LEN(flat)
above_average = for x in flat when x > average then x

// Find min and max per row
row_mins = for row in matrix then MIN(row)
row_maxs = for row in matrix then MAX(row)

{ range: MAX(flat) - MIN(flat), median: sorted[LEN(sorted) / 2 |> FLOOR], above_average, row_mins, row_maxs }`,
	},
];

/** The program the playground opens with. */
export const INITIAL_SOURCE = `// littlewing playground
// ?= declares an input, with a default: try changing them under Inputs
price ?= 100
tax_rate ?= 0.08
discount ?= 15

subtotal = price - discount
tax = ROUND(subtotal * tax_rate)
total = subtotal + tax

// Pipe operator chains values through functions
label = total |> ROUND(?) |> STR(?)

if total > 100 then "Total: $" + label + " (expensive)" else "Total: $" + label + " (affordable)"`;
