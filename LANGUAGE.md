# Littlewing Language Reference

> A minimal, high-performance multi-type expression language for the browser

## Overview

Littlewing is a **multi-type expression language** with seven value types: numbers, strings, booleans, dates, times, datetimes, and arrays. It's designed for evaluating expressions, financial calculations, temporal arithmetic, and conditional logic with type-safe execution.

### Key Features

- **Seven types** - Numbers, strings, booleans, dates (`Temporal.PlainDate`), times (`Temporal.PlainTime`), datetimes (`Temporal.PlainDateTime`), and homogeneous arrays
- **No implicit coercion** - Explicit type conversion via `STR()`, `NUM()`, etc.
- **Strict boolean logic** - `!`, `&&`, `||`, and `if` conditions require booleans
- **Control flow** - `if/then/else` expressions and `for/in/then` comprehensions with optional `when` guard and `into` accumulator
- **Pipe operator** - `x |> FUN(?) |> OTHER(?, 1)` chains values through function calls
- **Bracket indexing** - `arr[0]`, `str[1]`, with negative indexing and chaining
- **Range expressions** - `1..5` (exclusive), `1..=5` (inclusive)
- **Deep equality** - `[1, 2] == [1, 2]` evaluates to `true`
- **Temporal arithmetic** - Built-in date, time, and datetime functions using Temporal API
- **Zero runtime dependencies** - Requires global `Temporal` API (native or user-provided polyfill)
- **Linear time execution** - O(n) parsing and evaluation
- **Context variables** - Runtime value injection
- **Custom functions** - Extensible with JavaScript functions
- **Comments supported** - Single-line comments with `//`
- **Optional semicolons** - Semicolons between statements are optional

## Quick Examples

```
// Basic arithmetic
2 + 3 * 4 // → 14

// String concatenation
"hello" + " world" // → "hello world"

// Boolean logic
5 > 3 && 10 != 5 // → true

// Variables and assignment
radius = 5
area = 3.14159 * radius ^ 2 // → 78.54

// Conditional expressions
score = 85
grade = if score >= 90 then "A" else if score >= 80 then "B" else "C" // → "B"

// Date arithmetic
today = TODAY()
deadline = ADD_DAYS(today, 7) // 7 days from now
daysLeft = DIFFERENCE_IN_DAYS(today, deadline)

// Arrays with bracket indexing
items = [10, 20, 30]
first = items[0]   // → 10
last = items[-1]   // → 30

// Range expressions
nums = 1..=5 // → [1, 2, 3, 4, 5]

// Pipe operator — chain values through functions
-5 |> ABS(?)                   // → 5
-5 |> ABS(?) |> STR(?)         // → "5"
150 |> CLAMP(?, 0, 100)        // → 100

// For comprehensions
doubled = for x in 1..=5 then x * 2 // → [2, 4, 6, 8, 10]
evens = for x in 1..=10 when x % 2 == 0 then x // → [2, 4, 6, 8, 10]

// Financial calculations
principal = 1000
rate = 0.05
years = 3
futureValue = principal * (1 + rate) ^ years // → 1157.625
```

## Language Fundamentals

### Types

Littlewing has seven value types:

| Type       | Examples                           | Description                                 |
| ---------- | ---------------------------------- | ------------------------------------------- |
| `number`   | `42`, `3.14`, `0.5`                | IEEE 754 double-precision floats            |
| `string`   | `"hello"`, `"line1\nline2"`        | Double-quoted, with escape sequences        |
| `boolean`  | `true`, `false`                    | Logical values                              |
| `date`     | `DATE(2024, 6, 15)`                | `Temporal.PlainDate` (no time, no timezone) |
| `time`     | `TIME(14, 30, 0)`                  | `Temporal.PlainTime` (no date, no timezone) |
| `datetime` | `DATETIME(2024, 6, 15, 14, 30, 0)` | `Temporal.PlainDateTime` (no timezone)      |
| `array`    | `[1, 2, 3]`, `["a", "b"]`          | Homogeneous (all elements same type)        |

There is **no implicit type coercion**. Use explicit conversion functions:

```
// Convert between types explicitly
STR(42) // → "42"
NUM("3.14") // → 3.14
TYPE(true) // → "boolean"
```

### Numbers

- Integers: `42`, `0`, `-17`
- Decimals: `3.14159`, `0.5`, `-0.5`

```
x = 42        // integer
y = 3.14159   // decimal
z = 0.5       // decimal (leading zero required)
```

### Strings

Double-quoted strings with escape sequences:

```
greeting = "hello world"
escaped = "line1\nline2"   // newline
quoted = "say \"hi\""      // escaped quotes
path = "C:\\Users\\file"   // escaped backslash
empty = ""                 // empty string
```

Supported escape sequences: `\"`, `\\`, `\n`, `\t`

String concatenation uses `+`:

```
first = "hello"
last = " world"
full = first + last // → "hello world"
```

Strings support bracket indexing (returns single-character strings):

```
msg = "hello"
msg[0]  // → "h"
msg[-1] // → "o"
```

### Booleans

`true` and `false` are boolean literals:

```
x = true
y = false
result = x && y // → false
```

Booleans cannot be used as numbers. Use explicit conversion:

```
// This is a TypeError:
// true + 1

// Use NUM() to convert:
NUM(true) + 1 // → 2
```

### Dates

Dates are `Temporal.PlainDate` values (date only, no time, no timezone):

```
today = TODAY()                 // current date
christmas = DATE(2024, 12, 25)  // specific date
nextWeek = ADD_DAYS(today, 7)   // date arithmetic
```

Dates can be compared with `<`, `>`, `<=`, `>=`, `==`, `!=`:

```
d1 = DATE(2024, 1, 1)
d2 = DATE(2024, 12, 31)
d1 < d2 // → true
```

### Times

Times are `Temporal.PlainTime` values (time only, no date, no timezone):

```
t = TIME(14, 30, 0)            // 2:30 PM
now = NOW_TIME()                // current time
later = ADD_HOURS(t, 3)        // time arithmetic (wraps at midnight)
```

Times can be compared with `<`, `>`, `<=`, `>=`, `==`, `!=`:

```
t1 = TIME(10, 0, 0)
t2 = TIME(14, 0, 0)
t1 < t2 // → true
```

### DateTimes

DateTimes are `Temporal.PlainDateTime` values (date + time, no timezone):

```
dt = DATETIME(2024, 6, 15, 14, 30, 0) // June 15, 2024 at 2:30 PM
now = NOW()                            // current date and time
d = TO_DATE(dt)                        // extract date portion
t = TO_TIME(dt)                        // extract time portion
combined = COMBINE(d, t)              // combine date + time into datetime
```

DateTimes are fully supported by date functions (extractors, arithmetic, period boundaries) and time functions (extractors, arithmetic). The input type is preserved:

```
// Date functions preserve datetime type
ADD_DAYS(dt, 7)      // → PlainDateTime (7 days later, same time)
START_OF_MONTH(dt)   // → PlainDateTime (first day of month, same time)

// Time functions work on datetime
GET_HOUR(dt)         // → 14
ADD_HOURS(dt, 5)     // → PlainDateTime (date may change)
```

### Arrays

Homogeneous arrays (all elements must be the same type):

```
nums = [1, 2, 3]            // array of numbers
names = ["alice", "bob"]     // array of strings
flags = [true, false, true]  // array of booleans
empty = []                   // empty array (type determined on first operation)
nested = [[1, 2], [3, 4]]   // nested arrays
```

Mixed-type arrays are a TypeError:

```
// TypeError: [1, "two", true]
```

Array concatenation uses `+`:

```
[1, 2] + [3, 4] // → [1, 2, 3, 4]
```

Access elements with bracket indexing:

```
items = [10, 20, 30]
items[0]   // → 10 (first element)
items[-1]  // → 30 (last element)
items[1]   // → 20

// Chaining works
matrix = [[1, 2], [3, 4]]
matrix[0][1] // → 2
```

Out-of-bounds access is a `RangeError`. Non-integer indices are a `TypeError`.

### Range Expressions

Ranges generate arrays of sequential integers:

```
1..5    // → [1, 2, 3, 4] (exclusive end)
1..=5   // → [1, 2, 3, 4, 5] (inclusive end)
0..0    // → [] (empty range)
3..=3   // → [3] (single element)
```

Both bounds must be integers. Start must not exceed end:

```
// TypeError: 1.5..3 (non-integer bounds)
// RangeError: 5..3 (start > end)
```

Ranges combine naturally with indexing and comprehensions:

```
(1..=5)[0]                        // → 1
for x in 1..=10 then x * x       // → [1, 4, 9, 16, 25, 36, 49, 64, 81, 100]
```

### Variables

Variables store values of any type and can be assigned and reassigned:

```
x = 10         // number
name = "alice" // string
active = true  // boolean

// Chain assignments (right-associative)
a = b = c = 5 // all get value 5
```

Variable names:

- Start with letter or underscore
- Contain letters, numbers, underscores
- Case-sensitive (`myVar` ≠ `myvar`)
- `true`, `false`, `if`, `then`, `else`, `for`, `in`, `when`, `into` are reserved

### Comments

Single-line comments are supported using `//`:

```
// This is a comment
x = 10 // Comment after code
// y = 20 // This line is ignored
z = 30
```

### Semicolons

Semicolons between statements are **optional**:

```
// With semicolons
x = 10; y = 20; x + y

// Without semicolons (also valid)
x = 10
y = 20
x + y
```

### Operators

#### Arithmetic Operators

| Operator    | Name                     | Operand Types                             | Example  | Result |
| ----------- | ------------------------ | ----------------------------------------- | -------- | ------ |
| `+`         | Addition / Concatenation | number+number, string+string, array+array | `5 + 3`  | `8`    |
| `-`         | Subtraction              | number                                    | `10 - 3` | `7`    |
| `*`         | Multiplication           | number                                    | `4 * 3`  | `12`   |
| `/`         | Division                 | number                                    | `10 / 2` | `5`    |
| `%`         | Modulo                   | number                                    | `10 % 3` | `1`    |
| `^`         | Exponentiation           | number                                    | `2 ^ 3`  | `8`    |
| `-` (unary) | Negation                 | number                                    | `-5`     | `-5`   |

#### Comparison Operators

All comparisons return `boolean` (`true` or `false`):

| Operator | Name             | Supported Types                      | Example  | Result |
| -------- | ---------------- | ------------------------------------ | -------- | ------ |
| `==`     | Equal            | any (deep equality)                  | `5 == 5` | `true` |
| `!=`     | Not equal        | any (deep equality)                  | `5 != 3` | `true` |
| `<`      | Less than        | number, string, date, time, datetime | `3 < 5`  | `true` |
| `>`      | Greater than     | number, string, date, time, datetime | `5 > 3`  | `true` |
| `<=`     | Less or equal    | number, string, date, time, datetime | `3 <= 3` | `true` |
| `>=`     | Greater or equal | number, string, date, time, datetime | `5 >= 3` | `true` |

Deep equality for arrays: `[1, 2] == [1, 2]` → `true`

Cross-type equality: `1 == "1"` → `false` (no coercion)

#### Logical Operators

Logical operators **require boolean operands** (no truthiness):

| Operator | Name | Example           | Result |
| -------- | ---- | ----------------- | ------ |
| `!`      | NOT  | `!false`          | `true` |
| `&&`     | AND  | `true && true`    | `true` |
| `\|\|`   | OR   | `false \|\| true` | `true` |

```
// Logical NOT
!false // → true
!true  // → false
// !0   // → TypeError (use 0 != 0 or NUM() conversion)

// Logical operators with comparisons
x = 10
result = x > 5 && x < 20 // → true
notResult = !(x > 5) // → false

// Short-circuit evaluation
y = 0
safe = y != 0 && 100 / y > 5 // → false (right side not evaluated)
```

#### Conditional Expressions

Syntax: `if condition then consequent else alternate`

The condition **must be a boolean**. The `else` clause is **required**:

```
// Basic conditional
age = 18
canVote = age >= 18 // → true

// Nested conditionals
score = 85
grade = if score >= 90 then "A" else if score >= 80 then "B" else if score >= 70 then "C" else "F" // → "B"

// With calculations
discount = if quantity > 100 then price * 0.2 else price * 0.1
```

#### For Comprehensions

Syntax: `for variable in iterable [when guard] [into accumulator = initial] then body`

Without `into`, creates a new array by mapping over each element (map semantics). With `into`, reduces to a single value (fold semantics). The optional `when` clause filters elements before processing.

**Map (without `into`):**

```
// Map over an array
nums = [1, 2, 3, 4, 5]
doubled = for x in nums then x * 2 // → [2, 4, 6, 8, 10]

// Filter with when guard
evens = for x in nums when x % 2 == 0 then x // → [2, 4]

// Map + filter
bigDoubled = for x in nums when x > 2 then x * 2 // → [6, 8, 10]

// Iterate over ranges
squares = for i in 1..=5 then i ^ 2 // → [1, 4, 9, 16, 25]

// Iterate over strings (splits into single-character strings)
chars = for c in "hello" then STR_UPPER(c) // → ["H", "E", "L", "L", "O"]
```

The `when` guard must be a boolean expression. The map result must be a homogeneous array.

**Reduce (with `into`):**

```
// Sum
for x in [1, 2, 3, 4] into sum = 0 then sum + x // → 10

// Product
for x in [1, 2, 3, 4] into p = 1 then p * x // → 24

// String concatenation
for x in ["a", "b", "c"] into s = "" then s + x // → "abc"

// With guard (filtered elements skip accumulator update)
for x in [1, -2, 3] when x > 0 into total = 0 then total + x // → 4

// Find maximum
for x in [3, 1, 4, 1, 5] into best = 0 then if x > best then x else best // → 5

// Flatten arrays
for x in [[1, 2], [3, 4]] into flat = [] then flat + x // → [1, 2, 3, 4]

// Empty iterable returns initial value
for x in [] into sum = 0 then sum + x // → 0
```

The accumulator variable is scoped to the loop body and not accessible outside.

#### Pipe Expressions

Syntax: `value |> FUNCTION(args...)` where `?` marks where the piped value is inserted.

The pipe operator chains a value through one or more function calls. Each step must contain at least one `?` placeholder. Multiple `?` in the same step all receive the same piped value.

```
// Basic pipe
-5 |> ABS(?) // → 5 (equivalent to ABS(-5))

// Chained pipes
-3 |> ABS(?) |> STR(?) // → "3" (equivalent to STR(ABS(-3)))

// Placeholder in any argument position
150 |> CLAMP(?, 0, 100) // → 100 (equivalent to CLAMP(150, 0, 100))
10 |> ADD(5, ?)          // → 15 (equivalent to ADD(5, 10))

// Multiple placeholders (same value injected into all)
5 |> ADD(?, ?) // → 10 (equivalent to ADD(5, 5))

// With expressions on the left
2 + 3 |> ABS(?) // → 5 (parsed as (2 + 3) |> ABS(?))

// Store result in a variable
result = -7 |> ABS(?) // result = 7
```

The `?` token is only valid inside pipe step arguments. Using `?` outside a pipe expression is a syntax error. Each pipe step must be a function call with at least one `?`.

### Operator Precedence

From highest to lowest (use parentheses to override):

1. **Parentheses / Bracket indexing:** `(expression)`, `expr[index]`
2. **Unary operators:** `-x`, `!x`
3. **Exponentiation:** `x ^ y` (right-associative)
4. **Multiply/Divide/Modulo:** `x * y`, `x / y`, `x % y`
5. **Add/Subtract:** `x + y`, `x - y`
6. **Range:** `x..y`, `x..=y`
7. **Comparisons:** `<`, `>`, `<=`, `>=`, `==`, `!=`
8. **Logical AND:** `x && y`
9. **Logical OR:** `x || y`
10. **Pipe:** `x |> FUN(?)` (left-associative)
11. **Assignment:** `x = y` (right-associative)

```
// Examples showing precedence
2 + 3 * 4      // → 14 (not 20)
2 ^ 3 ^ 2      // → 512 (right-associative: 2^(3^2))
-2 ^ 2          // → -4 (parsed as -(2^2))
(-2) ^ 2        // → 4 (parentheses change precedence)
1 + 2..3 + 4    // → [3, 4, 5, 6] (parsed as (1+2)..(3+4))
```

### Multiple Statements

Separate statements with semicolons or newlines. The last expression is the return value:

```
// Calculate compound interest
principal = 1000
rate = 0.05
years = 3
principal * (1 + rate) ^ years // → 1157.625

// The whole program returns 1157.625
```

## Built-in Functions

### Type Conversion (3 functions)

| Function  | Description       | Example                 |
| --------- | ----------------- | ----------------------- |
| `STR(v)`  | Convert to string | `STR(42)` → `"42"`      |
| `NUM(v)`  | Convert to number | `NUM("42")` → `42`      |
| `TYPE(v)` | Get type name     | `TYPE(42)` → `"number"` |

### Math Functions (14 functions)

| Function           | Description        | Example                      |
| ------------------ | ------------------ | ---------------------------- |
| `ABS(x)`           | Absolute value     | `ABS(-5)` → `5`              |
| `CEIL(x)`          | Round up           | `CEIL(4.3)` → `5`            |
| `FLOOR(x)`         | Round down         | `FLOOR(4.7)` → `4`           |
| `ROUND(x)`         | Round to nearest   | `ROUND(4.5)` → `5`           |
| `SQRT(x)`          | Square root        | `SQRT(16)` → `4`             |
| `SIN(x)`           | Sine (radians)     | `SIN(0)` → `0`               |
| `COS(x)`           | Cosine (radians)   | `COS(0)` → `1`               |
| `TAN(x)`           | Tangent (radians)  | `TAN(0)` → `0`               |
| `LOG(x)`           | Natural logarithm  | `LOG(1)` → `0`               |
| `LOG10(x)`         | Base-10 logarithm  | `LOG10(100)` → `2`           |
| `EXP(x)`           | e^x                | `EXP(0)` → `1`               |
| `MIN(...)`         | Minimum value      | `MIN(3, 1, 5)` → `1`         |
| `MAX(...)`         | Maximum value      | `MAX(3, 1, 5)` → `5`         |
| `CLAMP(val, a, b)` | Constrain to range | `CLAMP(150, 0, 100)` → `100` |

### String Functions (12 functions)

| Function                       | Description        | Example                                      |
| ------------------------------ | ------------------ | -------------------------------------------- |
| `STR_LEN(s)`                   | String length      | `STR_LEN("hello")` → `5`                     |
| `STR_UPPER(s)`                 | Uppercase          | `STR_UPPER("hello")` → `"HELLO"`             |
| `STR_LOWER(s)`                 | Lowercase          | `STR_LOWER("HELLO")` → `"hello"`             |
| `STR_TRIM(s)`                  | Trim whitespace    | `STR_TRIM("  hi  ")` → `"hi"`                |
| `STR_SLICE(s, start, end?)`    | Substring          | `STR_SLICE("hello", 1, 3)` → `"el"`          |
| `STR_CONTAINS(s, search)`      | Contains check     | `STR_CONTAINS("hello", "ell")` → `true`      |
| `STR_INDEX_OF(s, search)`      | Find index         | `STR_INDEX_OF("hello", "ll")` → `2`          |
| `STR_SPLIT(s, sep)`            | Split by separator | `STR_SPLIT("a,b,c", ",")` → `["a","b","c"]`  |
| `STR_REPLACE(s, search, repl)` | Replace first      | `STR_REPLACE("hello", "l", "r")` → `"herlo"` |
| `STR_STARTS_WITH(s, prefix)`   | Prefix check       | `STR_STARTS_WITH("hello", "he")` → `true`    |
| `STR_ENDS_WITH(s, suffix)`     | Suffix check       | `STR_ENDS_WITH("hello", "lo")` → `true`      |
| `STR_REPEAT(s, n)`             | Repeat n times     | `STR_REPEAT("ab", 3)` → `"ababab"`           |

Note: Use bracket indexing for character access: `"hello"[0]` → `"h"`, `"hello"[-1]` → `"o"`.

### Array Functions (12 functions)

| Function                    | Description       | Example                                  |
| --------------------------- | ----------------- | ---------------------------------------- |
| `ARR_LEN(a)`                | Array length      | `ARR_LEN([1, 2, 3])` → `3`               |
| `ARR_PUSH(a, v)`            | Append element    | `ARR_PUSH([1, 2], 3)` → `[1, 2, 3]`      |
| `ARR_SLICE(a, start, end?)` | Sub-array         | `ARR_SLICE([1, 2, 3], 1)` → `[2, 3]`     |
| `ARR_CONTAINS(a, v)`        | Contains check    | `ARR_CONTAINS([1, 2], 2)` → `true`       |
| `ARR_REVERSE(a)`            | Reverse array     | `ARR_REVERSE([1, 2, 3])` → `[3, 2, 1]`   |
| `ARR_SORT(a)`               | Sort ascending    | `ARR_SORT([3, 1, 2])` → `[1, 2, 3]`      |
| `ARR_UNIQUE(a)`             | Deduplicate       | `ARR_UNIQUE([1, 2, 2, 3])` → `[1, 2, 3]` |
| `ARR_FLAT(a)`               | Flatten one level | `ARR_FLAT([[1, 2], [3]])` → `[1, 2, 3]`  |
| `ARR_JOIN(a, sep)`          | Join to string    | `ARR_JOIN(["a", "b"], "-")` → `"a-b"`    |
| `ARR_SUM(a)`                | Sum numbers       | `ARR_SUM([10, 20, 30])` → `60`           |
| `ARR_MIN(a)`                | Minimum element   | `ARR_MIN([3, 1, 2])` → `1`               |
| `ARR_MAX(a)`                | Maximum element   | `ARR_MAX([3, 1, 2])` → `3`               |

Note: Use bracket indexing for element access: `arr[0]`, `arr[-1]`. `ARR_SORT` supports numbers, strings, dates, times, and datetimes. `ARR_MIN`/`ARR_MAX` support the same types. `ARR_FLAT` requires all elements to be arrays; result is validated for homogeneity. `ARR_JOIN` requires all elements to be strings.

### Date Functions (24 functions)

Date functions operate on `Temporal.PlainDate` values. Most also accept `Temporal.PlainDateTime` (preserving the input type). `TODAY()` and `DATE()` return `PlainDate` only.

#### Core Date Functions

| Function        | Description  | Example                             |
| --------------- | ------------ | ----------------------------------- |
| `TODAY()`       | Current date | `TODAY()` → today's date            |
| `DATE(y, m, d)` | Create date  | `DATE(2024, 6, 15)` → June 15, 2024 |

#### Component Extractors (date or datetime)

| Function             | Description      | Returns                  |
| -------------------- | ---------------- | ------------------------ |
| `GET_YEAR(d)`        | Get year         | 2024                     |
| `GET_MONTH(d)`       | Get month        | 1-12                     |
| `GET_DAY(d)`         | Get day of month | 1-31                     |
| `GET_WEEKDAY(d)`     | Get day of week  | 1-7 (1=Monday, 7=Sunday) |
| `GET_DAY_OF_YEAR(d)` | Get day of year  | 1-366                    |
| `GET_QUARTER(d)`     | Get quarter      | 1-4                      |

#### Date Arithmetic (date or datetime, preserves type)

| Function           | Description | Example                             |
| ------------------ | ----------- | ----------------------------------- |
| `ADD_DAYS(d, n)`   | Add days    | `ADD_DAYS(d, 7)` → 7 days later     |
| `ADD_MONTHS(d, n)` | Add months  | `ADD_MONTHS(d, 2)` → 2 months later |
| `ADD_YEARS(d, n)`  | Add years   | `ADD_YEARS(d, 1)` → 1 year later    |

#### Date Differences (same type required)

| Function                       | Description                         |
| ------------------------------ | ----------------------------------- |
| `DIFFERENCE_IN_DAYS(d1, d2)`   | Absolute difference in days         |
| `DIFFERENCE_IN_WEEKS(d1, d2)`  | Absolute difference in whole weeks  |
| `DIFFERENCE_IN_MONTHS(d1, d2)` | Absolute difference in whole months |
| `DIFFERENCE_IN_YEARS(d1, d2)`  | Absolute difference in whole years  |

#### Start/End of Period (date or datetime, preserves type)

| Function              | Description           |
| --------------------- | --------------------- |
| `START_OF_MONTH(d)`   | First day of month    |
| `END_OF_MONTH(d)`     | Last day of month     |
| `START_OF_YEAR(d)`    | January 1st of year   |
| `END_OF_YEAR(d)`      | December 31st of year |
| `START_OF_WEEK(d)`    | Monday of the week    |
| `START_OF_QUARTER(d)` | First day of quarter  |

#### Date Comparisons (date or datetime)

| Function              | Description                                | Returns   |
| --------------------- | ------------------------------------------ | --------- |
| `IS_SAME_DAY(d1, d2)` | Same calendar day (mixed date+datetime OK) | `boolean` |
| `IS_WEEKEND(d)`       | Saturday or Sunday                         | `boolean` |
| `IS_LEAP_YEAR(d)`     | Leap year check                            | `boolean` |
| `d1 < d2`             | Before (use operators)                     | `boolean` |
| `d1 > d2`             | After (use operators)                      | `boolean` |

### Time Functions (13 functions)

Time functions operate on `Temporal.PlainTime` values. Extractors and arithmetic also accept `Temporal.PlainDateTime`.

#### Core Time Functions

| Function        | Description  | Example                                |
| --------------- | ------------ | -------------------------------------- |
| `TIME(h, m, s)` | Create time  | `TIME(14, 30, 0)` → 2:30 PM            |
| `NOW_TIME()`    | Current time | `NOW_TIME()` → current wall-clock time |

#### Time Extractors (time or datetime)

| Function             | Description     | Returns |
| -------------------- | --------------- | ------- |
| `GET_HOUR(t)`        | Get hour        | 0-23    |
| `GET_MINUTE(t)`      | Get minute      | 0-59    |
| `GET_SECOND(t)`      | Get second      | 0-59    |
| `GET_MILLISECOND(t)` | Get millisecond | 0-999   |

#### Time Arithmetic (time or datetime, preserves type)

| Function            | Description | Notes                       |
| ------------------- | ----------- | --------------------------- |
| `ADD_HOURS(t, n)`   | Add hours   | PlainTime wraps at midnight |
| `ADD_MINUTES(t, n)` | Add minutes | PlainTime wraps at midnight |
| `ADD_SECONDS(t, n)` | Add seconds | PlainTime wraps at midnight |

#### Time Differences (same type required)

| Function                        | Description                    |
| ------------------------------- | ------------------------------ |
| `DIFFERENCE_IN_HOURS(t1, t2)`   | Absolute difference in hours   |
| `DIFFERENCE_IN_MINUTES(t1, t2)` | Absolute difference in minutes |
| `DIFFERENCE_IN_SECONDS(t1, t2)` | Absolute difference in seconds |

#### Time Comparisons

| Function               | Description                               | Returns   |
| ---------------------- | ----------------------------------------- | --------- |
| `IS_SAME_TIME(t1, t2)` | Same time-of-day (mixed time+datetime OK) | `boolean` |

### DateTime Functions (7 functions)

DateTime functions for construction and conversion using `Temporal.PlainDateTime`.

| Function                       | Description                  | Example                            |
| ------------------------------ | ---------------------------- | ---------------------------------- |
| `DATETIME(y, mo, d, h, mi, s)` | Create datetime              | `DATETIME(2024, 6, 15, 14, 30, 0)` |
| `NOW()`                        | Current datetime             | `NOW()` → current date and time    |
| `TO_DATE(dt)`                  | Extract date portion         | `TO_DATE(dt)` → `PlainDate`        |
| `TO_TIME(dt)`                  | Extract time portion         | `TO_TIME(dt)` → `PlainTime`        |
| `COMBINE(d, t)`                | Combine date + time          | `COMBINE(d, t)` → `PlainDateTime`  |
| `START_OF_DAY(dt)`             | Midnight (00:00:00)          | `START_OF_DAY(dt)`                 |
| `END_OF_DAY(dt)`               | End of day (23:59:59.999...) | `END_OF_DAY(dt)`                   |

### Temporal Examples

```
// Create and compare dates
today = TODAY()
christmas = DATE(2024, 12, 25)
daysUntil = DIFFERENCE_IN_DAYS(today, christmas)

// Date arithmetic
nextWeek = ADD_DAYS(today, 7)
nextMonth = ADD_MONTHS(today, 1)

// Check properties
IS_WEEKEND(today) // → true or false
IS_LEAP_YEAR(DATE(2024, 1, 1)) // → true
GET_WEEKDAY(today) // → 1-7

// Period boundaries
monthStart = START_OF_MONTH(today)
monthEnd = END_OF_MONTH(today)

// Time operations
meeting = TIME(14, 30, 0)
endTime = ADD_HOURS(meeting, 1) // → 15:30:00
GET_HOUR(meeting) // → 14

// DateTime operations
event = DATETIME(2024, 6, 15, 14, 30, 0)
eventDate = TO_DATE(event) // → 2024-06-15
eventTime = TO_TIME(event) // → 14:30:00
dayStart = START_OF_DAY(event) // → 2024-06-15T00:00:00

// Combine date + time
appt = COMBINE(DATE(2024, 12, 25), TIME(10, 0, 0))
```

## External Variables and Functions

### Providing Variables at Runtime

You can inject variables when executing expressions:

```typescript
evaluate("radius * 2 * 3.14159", {
	variables: { radius: 10 },
}); // → 62.8318

// Variables can be any type
evaluate("STR_UPPER(name)", {
	functions: { ...defaultContext.functions },
	variables: { name: "alice" },
}); // → "ALICE"
```

Variables provided externally override script assignments:

```typescript
// Script: x = 5; x * 2
evaluate(script); // → 10 (uses x = 5 from script)
evaluate(script, { variables: { x: 10 } }); // → 20 (external x overrides)
```

### Custom Functions

Extend littlewing with your own functions:

```typescript
import { evaluate, assertNumber } from "littlewing";

evaluate("CLAMP(x, 0, 100)", {
	variables: { x: 150 },
	functions: {
		CLAMP: (value, min, max) => {
			assertNumber(value, "CLAMP", "value");
			assertNumber(min, "CLAMP", "min");
			assertNumber(max, "CLAMP", "max");
			return Math.min(Math.max(value, min), max);
		},
	},
}); // → 100
```

All custom functions must:

- Accept zero or more `RuntimeValue` arguments
- Return a `RuntimeValue`
- Be pure (no side effects recommended)
- **Use UPPERCASE naming** to match built-in function convention and avoid collisions with variables

#### Type Assertions

Littlewing exports the same assertion helpers used by the built-in standard library. Use them in custom functions for type-safe argument validation:

| Function                       | Narrows to                                     |
| ------------------------------ | ---------------------------------------------- |
| `assertNumber(v, ctx, side?)`  | `number`                                       |
| `assertString(v, ctx)`         | `string`                                       |
| `assertBoolean(v, ctx, side?)` | `boolean`                                      |
| `assertArray(v, ctx)`          | `readonly RuntimeValue[]`                      |
| `assertDate(v, ctx)`           | `Temporal.PlainDate`                           |
| `assertTime(v, ctx)`           | `Temporal.PlainTime`                           |
| `assertDateTime(v, ctx)`       | `Temporal.PlainDateTime`                       |
| `assertDateOrDateTime(v, ctx)` | `Temporal.PlainDate \| Temporal.PlainDateTime` |
| `assertTimeOrDateTime(v, ctx)` | `Temporal.PlainTime \| Temporal.PlainDateTime` |

Each throws a `TypeError` with a descriptive message on type mismatch. The `ctx` parameter is the function name for error context, and the optional `side` identifies the argument (e.g., `"left"`, `"price"`).

## Common Use Cases

### Financial Calculations

```
// Compound interest
principal = 1000
annualRate = 0.07
years = 10
futureValue = principal * (1 + annualRate) ^ years // → 1967.15

// Monthly loan payment
loanAmount = 200000
monthlyRate = 0.04 / 12
months = 360
payment = loanAmount * monthlyRate / (1 - (1 + monthlyRate) ^ -months)
```

### Business Rules

```
// Tiered pricing
quantity = 150
unitPrice = if quantity > 100 then 0.8 else if quantity > 50 then 0.9 else 1.0
total = quantity * unitPrice

// Shipping cost
weight = 15
distance = 500
baseCost = 10
weightCost = weight * 0.5
distanceCost = distance * 0.02
shippingTotal = baseCost + weightCost + distanceCost
```

### Data Processing

```
// Transform arrays
prices = [10, 25, 50, 75, 100]
discounted = for p in prices then p * 0.9 // → [9, 22.5, 45, 67.5, 90]
expensive = for p in prices when p > 50 then p // → [75, 100]

// Reduce arrays
total = for p in prices into sum = 0 then sum + p // → 260

// Generate sequences
indices = 0..ARR_LEN(prices) // → [0, 1, 2, 3, 4]
```

### Data Validation

```
// Check value ranges
age = 25
isValidAge = age >= 0 && age <= 120 // → true

// Complex validation
score = 85
isPass = score >= 60       // → true
isExcellent = score >= 90  // → false
```

### String Processing

```
// String manipulation
greeting = STR_UPPER("hello") // → "HELLO"
msg = "hello world"
hasWorld = STR_CONTAINS(msg, "world") // → true
first = STR_SLICE(msg, 0, 5) // → "hello"
initial = msg[0] // → "h"

// Type conversion
label = "Score: " + STR(95) // → "Score: 95"
```

## Performance

1. **Small bundle** - Minimal impact on your app size
2. **O(n) performance** - Linear time parsing and evaluation
3. **Parse once, evaluate many** - Reuse ASTs for repeated evaluation
4. **Predictable evaluation time** - O(n) based on expression size

```typescript
import { evaluate, parse } from "littlewing";

// Parse once, evaluate many times
const formula = parse("price * quantity * (1 - discount)");
evaluate(formula, { variables: { price: 10, quantity: 5, discount: 0.1 } }); // → 45
evaluate(formula, { variables: { price: 20, quantity: 3, discount: 0.15 } }); // → 51
```

## Limitations

### What Littlewing Doesn't Support

- **No function definitions** - Provide via context
- **No mutations** - Variables are reassigned, not mutated; arrays are immutable
- **No side effects** - Pure expression evaluation
- **No implicit coercion** - Use explicit conversion functions
- **No general-purpose loops** - `for` comprehensions map or reduce (no imperative looping)

These limitations are features! They ensure:

- Predictable performance
- Safe user input evaluation
- Simple mental model
- Small implementation

## Security

Littlewing is safe for evaluating untrusted user input:

- No access to global scope
- No eval() or code generation
- No infinite loops possible
- No prototype pollution
- No injection attacks
- Bounded execution time (O(n))

The worst a malicious user can do is write an expression that returns an unexpected value or triggers a type error.
