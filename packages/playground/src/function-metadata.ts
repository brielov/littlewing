/**
 * Function signatures and descriptions for editor intelligence.
 * Used by hover, signature help, and completion providers.
 */

interface ParameterInfo {
	readonly label: string;
	readonly type: string;
	readonly description: string;
}

export interface FunctionSignature {
	readonly description: string;
	readonly parameters: readonly ParameterInfo[];
	readonly returnType: string;
}

export const FUNCTION_SIGNATURES: Record<string, FunctionSignature> = {
	// Core - Type Conversion
	STR: {
		description: "Convert a value to its string representation",
		parameters: [
			{
				label: "value",
				type: "any",
				description: "Value to convert (number, boolean, date, time, or datetime)",
			},
		],
		returnType: "string",
	},
	NUM: {
		description: "Convert a value to a number",
		parameters: [
			{
				label: "value",
				type: "string | boolean",
				description: "Value to convert (string or boolean)",
			},
		],
		returnType: "number",
	},
	TYPE: {
		description: "Get the type name of a value",
		parameters: [{ label: "value", type: "any", description: "Any value" }],
		returnType: "string",
	},

	// Core - Polymorphic
	LEN: {
		description: "Get the length of a string or array",
		parameters: [{ label: "value", type: "string | array", description: "A string or array" }],
		returnType: "number",
	},
	SLICE: {
		description: "Extract a section of a string or array",
		parameters: [
			{ label: "value", type: "string | array", description: "A string or array" },
			{ label: "start", type: "number", description: "Start index (0-based)" },
			{ label: "end", type: "number", description: "End index (exclusive, optional)" },
		],
		returnType: "string | array",
	},
	CONTAINS: {
		description: "Check if a string contains a substring or an array contains an element",
		parameters: [
			{ label: "value", type: "string | array", description: "A string or array" },
			{
				label: "search",
				type: "any",
				description: "Substring (for strings) or element (for arrays, uses deep equality)",
			},
		],
		returnType: "boolean",
	},
	REVERSE: {
		description: "Reverse a string or array",
		parameters: [{ label: "value", type: "string | array", description: "A string or array" }],
		returnType: "string | array",
	},
	INDEX_OF: {
		description: "Find the first index of a substring or element (-1 if not found)",
		parameters: [
			{ label: "value", type: "string | array", description: "A string or array" },
			{
				label: "search",
				type: "any",
				description: "Substring (for strings) or element (for arrays, uses deep equality)",
			},
		],
		returnType: "number",
	},

	// Math
	ABS: {
		description: "Absolute value",
		parameters: [{ label: "x", type: "number", description: "A number" }],
		returnType: "number",
	},
	CEIL: {
		description: "Round up to the nearest integer",
		parameters: [{ label: "x", type: "number", description: "A number" }],
		returnType: "number",
	},
	FLOOR: {
		description: "Round down to the nearest integer",
		parameters: [{ label: "x", type: "number", description: "A number" }],
		returnType: "number",
	},
	ROUND: {
		description: "Round to the nearest integer",
		parameters: [{ label: "x", type: "number", description: "A number" }],
		returnType: "number",
	},
	SQRT: {
		description: "Square root",
		parameters: [{ label: "x", type: "number", description: "A non-negative number" }],
		returnType: "number",
	},
	MIN: {
		description: "Return the smallest of the given numbers",
		parameters: [
			{ label: "a", type: "number", description: "A number" },
			{ label: "b", type: "number", description: "A number" },
			{ label: "...rest", type: "number", description: "Additional numbers" },
		],
		returnType: "number",
	},
	MAX: {
		description: "Return the largest of the given numbers",
		parameters: [
			{ label: "a", type: "number", description: "A number" },
			{ label: "b", type: "number", description: "A number" },
			{ label: "...rest", type: "number", description: "Additional numbers" },
		],
		returnType: "number",
	},
	CLAMP: {
		description: "Constrain a value to a range",
		parameters: [
			{ label: "value", type: "number", description: "The value to clamp" },
			{ label: "min", type: "number", description: "Minimum bound" },
			{ label: "max", type: "number", description: "Maximum bound" },
		],
		returnType: "number",
	},
	SIN: {
		description: "Sine (radians)",
		parameters: [{ label: "x", type: "number", description: "Angle in radians" }],
		returnType: "number",
	},
	COS: {
		description: "Cosine (radians)",
		parameters: [{ label: "x", type: "number", description: "Angle in radians" }],
		returnType: "number",
	},
	TAN: {
		description: "Tangent (radians)",
		parameters: [{ label: "x", type: "number", description: "Angle in radians" }],
		returnType: "number",
	},
	LOG: {
		description: "Natural logarithm (base e)",
		parameters: [{ label: "x", type: "number", description: "A positive number" }],
		returnType: "number",
	},
	LOG10: {
		description: "Base-10 logarithm",
		parameters: [{ label: "x", type: "number", description: "A positive number" }],
		returnType: "number",
	},
	EXP: {
		description: "e raised to a power",
		parameters: [{ label: "x", type: "number", description: "The exponent" }],
		returnType: "number",
	},

	// String
	STR_UPPER: {
		description: "Convert string to uppercase",
		parameters: [{ label: "s", type: "string", description: "A string" }],
		returnType: "string",
	},
	STR_LOWER: {
		description: "Convert string to lowercase",
		parameters: [{ label: "s", type: "string", description: "A string" }],
		returnType: "string",
	},
	STR_TRIM: {
		description: "Trim whitespace from both ends",
		parameters: [{ label: "s", type: "string", description: "A string" }],
		returnType: "string",
	},
	STR_SPLIT: {
		description: "Split a string by separator into an array",
		parameters: [
			{ label: "s", type: "string", description: "The string to split" },
			{ label: "separator", type: "string", description: "The separator string" },
		],
		returnType: "array",
	},
	STR_REPLACE: {
		description: "Replace the first occurrence of a search string",
		parameters: [
			{ label: "s", type: "string", description: "The source string" },
			{ label: "search", type: "string", description: "The string to find" },
			{ label: "replacement", type: "string", description: "The replacement string" },
		],
		returnType: "string",
	},
	STR_STARTS_WITH: {
		description: "Check if a string starts with a prefix",
		parameters: [
			{ label: "s", type: "string", description: "The string to check" },
			{ label: "prefix", type: "string", description: "The prefix to look for" },
		],
		returnType: "boolean",
	},
	STR_ENDS_WITH: {
		description: "Check if a string ends with a suffix",
		parameters: [
			{ label: "s", type: "string", description: "The string to check" },
			{ label: "suffix", type: "string", description: "The suffix to look for" },
		],
		returnType: "boolean",
	},
	STR_REPEAT: {
		description: "Repeat a string n times",
		parameters: [
			{ label: "s", type: "string", description: "The string to repeat" },
			{
				label: "count",
				type: "number",
				description: "Number of repetitions (non-negative integer)",
			},
		],
		returnType: "string",
	},

	// Array
	ARR_SORT: {
		description: "Sort an array in ascending order (returns a new array)",
		parameters: [
			{
				label: "array",
				type: "array",
				description: "An array of numbers, strings, dates, times, or datetimes",
			},
		],
		returnType: "array",
	},
	ARR_UNIQUE: {
		description: "Remove duplicate elements using deep equality",
		parameters: [{ label: "array", type: "array", description: "An array" }],
		returnType: "array",
	},
	ARR_FLAT: {
		description: "Flatten one level of nested arrays",
		parameters: [{ label: "array", type: "array", description: "An array of arrays" }],
		returnType: "array",
	},
	ARR_JOIN: {
		description: "Join a string array with a separator",
		parameters: [
			{ label: "array", type: "array", description: "An array of strings" },
			{ label: "separator", type: "string", description: "The separator string" },
		],
		returnType: "string",
	},
	ARR_SUM: {
		description: "Sum all elements of a numeric array",
		parameters: [{ label: "array", type: "array", description: "An array of numbers" }],
		returnType: "number",
	},
	ARR_MIN: {
		description: "Get the minimum element of an array",
		parameters: [
			{
				label: "array",
				type: "array",
				description: "A non-empty array of numbers, strings, dates, times, or datetimes",
			},
		],
		returnType: "number | string | date | time | datetime",
	},
	ARR_MAX: {
		description: "Get the maximum element of an array",
		parameters: [
			{
				label: "array",
				type: "array",
				description: "A non-empty array of numbers, strings, dates, times, or datetimes",
			},
		],
		returnType: "number | string | date | time | datetime",
	},

	// Date - Core
	TODAY: {
		description: "Get today's date",
		parameters: [],
		returnType: "date",
	},
	DATE: {
		description: "Create a date from year, month, and day",
		parameters: [
			{ label: "year", type: "number", description: "Year (e.g. 2024)" },
			{ label: "month", type: "number", description: "Month (1-12)" },
			{ label: "day", type: "number", description: "Day of month (1-31)" },
		],
		returnType: "date",
	},

	// Date - Extractors
	YEAR: {
		description: "Get the year from a date or datetime",
		parameters: [{ label: "date", type: "date | datetime", description: "A date or datetime" }],
		returnType: "number",
	},
	MONTH: {
		description: "Get the month from a date or datetime (1-12)",
		parameters: [{ label: "date", type: "date | datetime", description: "A date or datetime" }],
		returnType: "number",
	},
	DAY: {
		description: "Get the day of month from a date or datetime (1-31)",
		parameters: [{ label: "date", type: "date | datetime", description: "A date or datetime" }],
		returnType: "number",
	},
	WEEKDAY: {
		description: "Get the day of week (1=Monday, 7=Sunday)",
		parameters: [{ label: "date", type: "date | datetime", description: "A date or datetime" }],
		returnType: "number",
	},
	DAY_OF_YEAR: {
		description: "Get the day of year (1-366)",
		parameters: [{ label: "date", type: "date | datetime", description: "A date or datetime" }],
		returnType: "number",
	},
	QUARTER: {
		description: "Get the quarter (1-4)",
		parameters: [{ label: "date", type: "date | datetime", description: "A date or datetime" }],
		returnType: "number",
	},

	// Date - Arithmetic
	ADD_DAYS: {
		description: "Add days to a date or datetime",
		parameters: [
			{ label: "date", type: "date | datetime", description: "A date or datetime" },
			{ label: "days", type: "number", description: "Number of days (can be negative)" },
		],
		returnType: "date | datetime",
	},
	ADD_MONTHS: {
		description: "Add months to a date or datetime",
		parameters: [
			{ label: "date", type: "date | datetime", description: "A date or datetime" },
			{ label: "months", type: "number", description: "Number of months (can be negative)" },
		],
		returnType: "date | datetime",
	},
	ADD_YEARS: {
		description: "Add years to a date or datetime",
		parameters: [
			{ label: "date", type: "date | datetime", description: "A date or datetime" },
			{ label: "years", type: "number", description: "Number of years (can be negative)" },
		],
		returnType: "date | datetime",
	},

	// Date - Differences
	DIFFERENCE_IN_DAYS: {
		description: "Absolute difference in days between two dates or datetimes",
		parameters: [
			{ label: "d1", type: "date | datetime", description: "First date or datetime" },
			{
				label: "d2",
				type: "date | datetime",
				description: "Second date or datetime (same type as d1)",
			},
		],
		returnType: "number",
	},
	DIFFERENCE_IN_WEEKS: {
		description: "Absolute difference in whole weeks",
		parameters: [
			{ label: "d1", type: "date | datetime", description: "First date or datetime" },
			{
				label: "d2",
				type: "date | datetime",
				description: "Second date or datetime (same type as d1)",
			},
		],
		returnType: "number",
	},
	DIFFERENCE_IN_MONTHS: {
		description: "Absolute difference in whole months",
		parameters: [
			{ label: "d1", type: "date | datetime", description: "First date or datetime" },
			{
				label: "d2",
				type: "date | datetime",
				description: "Second date or datetime (same type as d1)",
			},
		],
		returnType: "number",
	},
	DIFFERENCE_IN_YEARS: {
		description: "Absolute difference in whole years",
		parameters: [
			{ label: "d1", type: "date | datetime", description: "First date or datetime" },
			{
				label: "d2",
				type: "date | datetime",
				description: "Second date or datetime (same type as d1)",
			},
		],
		returnType: "number",
	},

	// Date - Period Boundaries
	START_OF_MONTH: {
		description: "Get the first day of the month",
		parameters: [{ label: "date", type: "date | datetime", description: "A date or datetime" }],
		returnType: "date | datetime",
	},
	END_OF_MONTH: {
		description: "Get the last day of the month",
		parameters: [{ label: "date", type: "date | datetime", description: "A date or datetime" }],
		returnType: "date | datetime",
	},
	START_OF_YEAR: {
		description: "Get the first day of the year",
		parameters: [{ label: "date", type: "date | datetime", description: "A date or datetime" }],
		returnType: "date | datetime",
	},
	END_OF_YEAR: {
		description: "Get the last day of the year",
		parameters: [{ label: "date", type: "date | datetime", description: "A date or datetime" }],
		returnType: "date | datetime",
	},
	START_OF_WEEK: {
		description: "Get Monday of the current week",
		parameters: [{ label: "date", type: "date | datetime", description: "A date or datetime" }],
		returnType: "date | datetime",
	},
	START_OF_QUARTER: {
		description: "Get the first day of the quarter",
		parameters: [{ label: "date", type: "date | datetime", description: "A date or datetime" }],
		returnType: "date | datetime",
	},

	// Date - Comparisons
	IS_SAME_DAY: {
		description: "Check if two dates/datetimes fall on the same calendar day",
		parameters: [
			{ label: "d1", type: "date | datetime", description: "A date or datetime" },
			{ label: "d2", type: "date | datetime", description: "A date or datetime (mixed types OK)" },
		],
		returnType: "boolean",
	},
	IS_WEEKEND: {
		description: "Check if a date falls on Saturday or Sunday",
		parameters: [{ label: "date", type: "date | datetime", description: "A date or datetime" }],
		returnType: "boolean",
	},
	IS_LEAP_YEAR: {
		description: "Check if a date is in a leap year",
		parameters: [{ label: "date", type: "date | datetime", description: "A date or datetime" }],
		returnType: "boolean",
	},
	AGE: {
		description: "Calculate age in complete years from a birth date",
		parameters: [
			{ label: "birthDate", type: "date | datetime", description: "Birth date (date or datetime)" },
			{
				label: "referenceDate",
				type: "date | datetime",
				description: "Reference date (optional, defaults to today)",
			},
		],
		returnType: "number",
	},

	// Time - Core
	TIME: {
		description: "Create a time from hour, minute, and second",
		parameters: [
			{ label: "hour", type: "number", description: "Hour (0-23)" },
			{ label: "minute", type: "number", description: "Minute (0-59)" },
			{ label: "second", type: "number", description: "Second (0-59)" },
		],
		returnType: "time",
	},
	NOW_TIME: {
		description: "Get the current wall-clock time",
		parameters: [],
		returnType: "time",
	},

	// Time - Extractors
	HOUR: {
		description: "Get the hour from a time or datetime (0-23)",
		parameters: [{ label: "time", type: "time | datetime", description: "A time or datetime" }],
		returnType: "number",
	},
	MINUTE: {
		description: "Get the minute from a time or datetime (0-59)",
		parameters: [{ label: "time", type: "time | datetime", description: "A time or datetime" }],
		returnType: "number",
	},
	SECOND: {
		description: "Get the second from a time or datetime (0-59)",
		parameters: [{ label: "time", type: "time | datetime", description: "A time or datetime" }],
		returnType: "number",
	},
	MILLISECOND: {
		description: "Get the millisecond from a time or datetime (0-999)",
		parameters: [{ label: "time", type: "time | datetime", description: "A time or datetime" }],
		returnType: "number",
	},

	// Time - Arithmetic
	ADD_HOURS: {
		description: "Add hours to a time or datetime",
		parameters: [
			{ label: "time", type: "time | datetime", description: "A time or datetime" },
			{ label: "hours", type: "number", description: "Number of hours (can be negative)" },
		],
		returnType: "time | datetime",
	},
	ADD_MINUTES: {
		description: "Add minutes to a time or datetime",
		parameters: [
			{ label: "time", type: "time | datetime", description: "A time or datetime" },
			{ label: "minutes", type: "number", description: "Number of minutes (can be negative)" },
		],
		returnType: "time | datetime",
	},
	ADD_SECONDS: {
		description: "Add seconds to a time or datetime",
		parameters: [
			{ label: "time", type: "time | datetime", description: "A time or datetime" },
			{ label: "seconds", type: "number", description: "Number of seconds (can be negative)" },
		],
		returnType: "time | datetime",
	},

	// Time - Differences
	DIFFERENCE_IN_HOURS: {
		description: "Absolute difference in hours",
		parameters: [
			{ label: "t1", type: "time | datetime", description: "First time or datetime" },
			{
				label: "t2",
				type: "time | datetime",
				description: "Second time or datetime (same type as t1)",
			},
		],
		returnType: "number",
	},
	DIFFERENCE_IN_MINUTES: {
		description: "Absolute difference in minutes",
		parameters: [
			{ label: "t1", type: "time | datetime", description: "First time or datetime" },
			{
				label: "t2",
				type: "time | datetime",
				description: "Second time or datetime (same type as t1)",
			},
		],
		returnType: "number",
	},
	DIFFERENCE_IN_SECONDS: {
		description: "Absolute difference in seconds",
		parameters: [
			{ label: "t1", type: "time | datetime", description: "First time or datetime" },
			{
				label: "t2",
				type: "time | datetime",
				description: "Second time or datetime (same type as t1)",
			},
		],
		returnType: "number",
	},

	// Time - Comparisons
	IS_SAME_TIME: {
		description: "Check if two times/datetimes have the same time-of-day",
		parameters: [
			{ label: "t1", type: "time | datetime", description: "A time or datetime" },
			{ label: "t2", type: "time | datetime", description: "A time or datetime (mixed types OK)" },
		],
		returnType: "boolean",
	},

	// DateTime - Core
	DATETIME: {
		description: "Create a datetime from components",
		parameters: [
			{ label: "year", type: "number", description: "Year" },
			{ label: "month", type: "number", description: "Month (1-12)" },
			{ label: "day", type: "number", description: "Day (1-31)" },
			{ label: "hour", type: "number", description: "Hour (0-23)" },
			{ label: "minute", type: "number", description: "Minute (0-59)" },
			{ label: "second", type: "number", description: "Second (0-59)" },
		],
		returnType: "datetime",
	},
	NOW: {
		description: "Get the current date and time",
		parameters: [],
		returnType: "datetime",
	},

	// DateTime - Conversions
	TO_DATE: {
		description: "Extract the date portion from a datetime",
		parameters: [{ label: "datetime", type: "datetime", description: "A datetime" }],
		returnType: "date",
	},
	TO_TIME: {
		description: "Extract the time portion from a datetime",
		parameters: [{ label: "datetime", type: "datetime", description: "A datetime" }],
		returnType: "time",
	},
	COMBINE: {
		description: "Combine a date and time into a datetime",
		parameters: [
			{ label: "date", type: "date", description: "A date" },
			{ label: "time", type: "time", description: "A time" },
		],
		returnType: "datetime",
	},

	// DateTime - Day Boundaries
	START_OF_DAY: {
		description: "Get midnight (00:00:00) of a datetime's day",
		parameters: [{ label: "datetime", type: "datetime", description: "A datetime" }],
		returnType: "datetime",
	},
	END_OF_DAY: {
		description: "Get the last instant (23:59:59.999...) of a datetime's day",
		parameters: [{ label: "datetime", type: "datetime", description: "A datetime" }],
		returnType: "datetime",
	},
};

/**
 * Format a function signature as a readable string.
 * e.g. "ROUND(x: number) → number"
 */
export function formatSignature(name: string): string {
	const sig = FUNCTION_SIGNATURES[name];
	if (!sig) return name;
	const params = sig.parameters.map((p) => `${p.label}: ${p.type}`).join(", ");
	return `${name}(${params}) → ${sig.returnType}`;
}
