# Littlewing Language Reference

> A minimal, high-performance arithmetic expression language for the browser

## Overview

Littlewing is a **pure arithmetic expression language** where every value is a number. It's designed for evaluating mathematical expressions, financial calculations, date arithmetic, and conditional logic with zero dependencies and blazing fast performance.

### Key Features

- **Numbers-only type system** - Simple, predictable, fast
- **Timestamp arithmetic** - Built-in date/time calculations
- **Zero dependencies** - Perfect for browser environments
- **Linear time execution** - O(n) parsing and evaluation
- **Context variables** - Runtime value injection
- **Custom functions** - Extensible with JavaScript functions

## Quick Examples

```javascript
// Basic arithmetic
2 + 3 * 4; // → 14

// Variables and assignment
radius = 5;
area = (3.14159 * radius) ^ 2; // → 78.54

// Conditional expressions
score = 85;
grade = score >= 90 ? 100 : score >= 80 ? 90 : 75; // → 90

// Date arithmetic
deadline = NOW() + FROM_DAYS(7); // 7 days from now
hoursLeft = DIFFERENCE_IN_HOURS(deadline, NOW());

// Financial calculations
principal = 1000;
rate = 0.05;
years = 3;
futureValue = (principal * (1 + rate)) ^ years; // → 1157.625
```

## Language Fundamentals

### Numbers

All values in littlewing are numbers. This includes:

- Integers: `42`, `0`, `-17`
- Decimals: `3.14159`, `-0.5`
- Decimal shorthand: `.5` (same as `0.5`)
- Scientific notation: `1.5e6` (1,500,000), `2e-3` (0.002)

```javascript
// All valid number formats
x = 42; // integer
y = 3.14159; // decimal
z = 0.5; // shorthand decimal
w = 1.5e6; // scientific notation
v = 0.5e2; // shorthand + scientific (50)
```

### Variables

Variables store numeric values and can be assigned and reassigned:

```javascript
x = 10; // assign 10 to x
y = x * 2; // use x in expression
x = x + 1; // reassign x

// Chain assignments (right-associative)
a = b = c = 5; // all get value 5
```

Variable names:

- Start with letter or underscore
- Contain letters, numbers, underscores
- Case-sensitive (`myVar` ≠ `myvar`)

### Operators

#### Arithmetic Operators

| Operator    | Name           | Example  | Result |
| ----------- | -------------- | -------- | ------ |
| `+`         | Addition       | `5 + 3`  | `8`    |
| `-`         | Subtraction    | `10 - 3` | `7`    |
| `*`         | Multiplication | `4 * 3`  | `12`   |
| `/`         | Division       | `10 / 2` | `5`    |
| `%`         | Modulo         | `10 % 3` | `1`    |
| `^`         | Exponentiation | `2 ^ 3`  | `8`    |
| `-` (unary) | Negation       | `-5`     | `-5`   |

#### Comparison Operators

All comparisons return `1` (true) or `0` (false):

| Operator | Name             | Example  | Result |
| -------- | ---------------- | -------- | ------ |
| `==`     | Equal            | `5 == 5` | `1`    |
| `!=`     | Not equal        | `5 != 3` | `1`    |
| `<`      | Less than        | `3 < 5`  | `1`    |
| `>`      | Greater than     | `5 > 3`  | `1`    |
| `<=`     | Less or equal    | `3 <= 3` | `1`    |
| `>=`     | Greater or equal | `5 >= 3` | `1`    |

#### Logical Operators

Work with truthiness (0 is false, non-zero is true):

| Operator | Name | Example    | Result |
| -------- | ---- | ---------- | ------ |
| `&&`     | AND  | `1 && 1`   | `1`    |
| `\|\|`   | OR   | `0 \|\| 1` | `1`    |

```javascript
// Logical operators with comparisons
x = 10;
result = x > 5 && x < 20; // → 1 (true)

// Short-circuit evaluation
y = 0;
safe = y != 0 && 100 / y > 5; // → 0 (avoids division by zero)
```

#### Conditional (Ternary) Operator

Syntax: `condition ? consequent : alternate`

```javascript
// Basic conditional
age = 18;
canVote = age >= 18 ? 1 : 0; // → 1

// Nested conditionals
score = 85;
grade = score >= 90 ? 100 : score >= 80 ? 90 : score >= 70 ? 80 : 60; // → 90

// With calculations
discount = quantity > 100 ? price * 0.2 : price * 0.1;
```

### Operator Precedence

From highest to lowest (use parentheses to override):

1. Parentheses: `(expression)`
2. Unary minus: `-x`
3. Exponentiation: `x ^ y` (right-associative)
4. Multiply/Divide/Modulo: `x * y`, `x / y`, `x % y`
5. Add/Subtract: `x + y`, `x - y`
6. Comparisons: `<`, `>`, `<=`, `>=`, `==`, `!=`
7. Logical AND: `x && y`
8. Logical OR: `x || y`
9. Conditional: `x ? y : z`
10. Assignment: `x = y` (right-associative)

```javascript
// Examples showing precedence
2 + 3 * 4; // → 14 (not 20)
2 ^ 3 ^ 2; // → 512 (right-associative: 2^(3^2))
x =
	5 > 3
		? 10
		: (5 - // → x gets 10
				2) ^
			2; // → -4 (unary minus has higher precedence)
```

### Multiple Statements

Separate statements with semicolons or newlines. The last expression is the return value:

```javascript
// Calculate compound interest
principal = 1000;
rate = 0.05;
years = 3;
(principal * (1 + rate)) ^ years; // → 1157.625

// The whole program returns 1157.625
```

## Built-in Functions

### Math Functions

All math functions use UPPERCASE names to avoid collisions with user variables:

| Function           | Description        | Example                      |
| ------------------ | ------------------ | ---------------------------- |
| `ABS(x)`           | Absolute value     | `ABS(-5)` → `5`              |
| `CEIL(x)`          | Round up           | `CEIL(4.3)` → `5`            |
| `FLOOR(x)`         | Round down         | `FLOOR(4.7)` → `4`           |
| `ROUND(x)`         | Round to nearest   | `ROUND(4.5)` → `5`           |
| `SQRT(x)`          | Square root        | `SQRT(16)` → `4`             |
| `SIN(x)`           | Sine (radians)     | `SIN(3.14159/2)` → `1`       |
| `COS(x)`           | Cosine (radians)   | `COS(0)` → `1`               |
| `TAN(x)`           | Tangent (radians)  | `TAN(0)` → `0`               |
| `LOG(x)`           | Natural logarithm  | `LOG(2.71828)` → `1`         |
| `LOG10(x)`         | Base-10 logarithm  | `LOG10(100)` → `2`           |
| `EXP(x)`           | e^x                | `EXP(1)` → `2.71828`         |
| `MIN(...)`         | Minimum value      | `MIN(3, 1, 5)` → `1`         |
| `MAX(...)`         | Maximum value      | `MAX(3, 1, 5)` → `5`         |
| `CLAMP(val, a, b)` | Constrain to range | `CLAMP(150, 0, 100)` → `100` |

### Date & Time Functions

All date/time functions use UPPERCASE names and work with timestamps (milliseconds since Unix epoch).

#### Current Time

- `NOW()` - Returns current timestamp

#### Create Timestamps

- `DATE(year, month?, day?, hour?, minute?, second?)` - Create a timestamp
  - Only `year` is required
  - `month` defaults to 1 (January), `day` defaults to 1
  - Month is 1-based (1 = January, 12 = December)
  - Hour, minute, second default to 0 if omitted

```javascript
// Just the year (January 1st at midnight)
y2024 = DATE(2024);

// Christmas 2024
xmas = DATE(2024, 12, 25);

// New Year 2025 at midnight
newYear = DATE(2025, 1, 1, 0, 0, 0);
```

#### Time Converters

Convert human-readable units to milliseconds:

| Function         | Description  | Example                         |
| ---------------- | ------------ | ------------------------------- |
| `FROM_DAYS(x)`   | Days to ms   | `FROM_DAYS(7)` → `604800000`    |
| `FROM_WEEKS(x)`  | Weeks to ms  | `FROM_WEEKS(2)` → `1209600000`  |
| `FROM_MONTHS(x)` | Months to ms | `FROM_MONTHS(1)` → `2592000000` |
| `FROM_YEARS(x)`  | Years to ms  | `FROM_YEARS(1)` → `31536000000` |

**Note:** `FROM_MONTHS` and `FROM_YEARS` use approximate durations (30 days/month, 365 days/year). For exact calendar calculations, use `ADD_MONTHS`, `ADD_YEARS`, `DIFFERENCE_IN_MONTHS`, or `DIFFERENCE_IN_YEARS`.

#### Component Extractors

Extract components from a timestamp:

| Function              | Description      | Returns        |
| --------------------- | ---------------- | -------------- |
| `GET_YEAR(ts)`        | Get year         | 2024           |
| `GET_MONTH(ts)`       | Get month        | 1-12           |
| `GET_DAY(ts)`         | Get day of month | 1-31           |
| `GET_HOUR(ts)`        | Get hour         | 0-23           |
| `GET_MINUTE(ts)`      | Get minute       | 0-59           |
| `GET_SECOND(ts)`      | Get second       | 0-59           |
| `GET_MILLISECOND(ts)` | Get millisecond  | 0-999          |
| `GET_WEEKDAY(ts)`     | Get day of week  | 0-6 (0=Sunday) |
| `GET_DAY_OF_YEAR(ts)` | Get day of year  | 1-366          |
| `GET_QUARTER(ts)`     | Get quarter      | 1-4            |

#### Time Differences

Calculate absolute differences between timestamps:

| Function                          | Description             | Example                                  |
| --------------------------------- | ----------------------- | ---------------------------------------- |
| `DIFFERENCE_IN_SECONDS(ts1, ts2)` | Difference in seconds   | `DIFFERENCE_IN_SECONDS(ts1, ts2)` → `30` |
| `DIFFERENCE_IN_MINUTES(ts1, ts2)` | Difference in minutes   | `DIFFERENCE_IN_MINUTES(ts1, ts2)` → `15` |
| `DIFFERENCE_IN_HOURS(ts1, ts2)`   | Difference in hours     | `DIFFERENCE_IN_HOURS(ts1, ts2)` → `4`    |
| `DIFFERENCE_IN_DAYS(ts1, ts2)`    | Difference in days      | `DIFFERENCE_IN_DAYS(ts1, ts2)` → `7`     |
| `DIFFERENCE_IN_WEEKS(ts1, ts2)`   | Difference in weeks     | `DIFFERENCE_IN_WEEKS(ts1, ts2)` → `2`    |
| `DIFFERENCE_IN_MONTHS(ts1, ts2)`  | Calendar months between | `DIFFERENCE_IN_MONTHS(ts1, ts2)` → `3`   |
| `DIFFERENCE_IN_YEARS(ts1, ts2)`   | Calendar years between  | `DIFFERENCE_IN_YEARS(ts1, ts2)` → `5`    |

#### Start/End of Period

Get the start or end of a time period:

| Function               | Description                     |
| ---------------------- | ------------------------------- |
| `START_OF_DAY(ts)`     | Start of day (00:00:00.000)     |
| `END_OF_DAY(ts)`       | End of day (23:59:59.999)       |
| `START_OF_WEEK(ts)`    | Start of week (Sunday 00:00)    |
| `START_OF_MONTH(ts)`   | Start of month (1st at 00:00)   |
| `END_OF_MONTH(ts)`     | End of month (last day 23:59)   |
| `START_OF_YEAR(ts)`    | Start of year (Jan 1 at 00:00)  |
| `END_OF_YEAR(ts)`      | End of year (Dec 31 at 23:59)   |
| `START_OF_QUARTER(ts)` | Start of quarter (1st at 00:00) |

#### Date Arithmetic

Add time to dates:

| Function            | Description | Example                              |
| ------------------- | ----------- | ------------------------------------ |
| `ADD_DAYS(ts, n)`   | Add days    | `ADD_DAYS(ts, 7)` → 7 days later     |
| `ADD_MONTHS(ts, n)` | Add months  | `ADD_MONTHS(ts, 2)` → 2 months later |
| `ADD_YEARS(ts, n)`  | Add years   | `ADD_YEARS(ts, 1)` → 1 year later    |

#### Date Comparisons

Compare dates (return 1 for true, 0 for false):

| Function                | Description                                 |
| ----------------------- | ------------------------------------------- |
| `IS_SAME_DAY(ts1, ts2)` | Check if same calendar day                  |
| `IS_WEEKEND(ts)`        | Check if Saturday or Sunday                 |
| `IS_LEAP_YEAR(ts)`      | Check if leap year                          |
| `ts1 < ts2`             | Check if ts1 is before ts2 (use < operator) |
| `ts1 > ts2`             | Check if ts1 is after ts2 (use > operator)  |

### Date Arithmetic Examples

```javascript
// Add time to current timestamp
tomorrow = NOW() + FROM_DAYS(1);
nextWeek = NOW() + FROM_WEEKS(1);
in2Hours = NOW() + 2 * 3600000 + 30 * 60000; // 2 hours + 30 minutes

// Calculate time differences using DIFFERENCE functions
deadline = DATE(2024, 12, 31);
daysLeft = DIFFERENCE_IN_DAYS(NOW(), deadline);
hoursLeft = DIFFERENCE_IN_HOURS(NOW(), deadline);

// Check if date is weekend
ts = DATE(2024, 11, 9); // Saturday
isWeekend = IS_WEEKEND(ts); // → 1 (true)

// Age calculation
birthdate = DATE(1990, 5, 15);
today = DATE(2024, 6, 15);
ageInYears = DIFFERENCE_IN_YEARS(birthdate, today); // Calendar-accurate

// Business days calculation
deadline = ADD_DAYS(START_OF_WEEK(NOW()), 12); // Friday of next week

// Check if in working hours
ts = NOW();
inWorkingHours = GET_HOUR(ts) >= 9 && GET_HOUR(ts) < 17 && IS_WEEKEND(ts) == 0;

// Quarter end date
quarterEnd = END_OF_MONTH(ADD_MONTHS(START_OF_QUARTER(NOW()), 2));
```

## External Variables and Functions

### Providing Variables at Runtime

You can inject variables when executing expressions:

```javascript
// In your JavaScript code
execute("radius * 2 * 3.14159", {
	variables: { radius: 10 },
}); // → 62.8318
```

Variables provided externally override script assignments:

```javascript
// Script: x = 5; x * 2
execute(script); // → 10 (uses x = 5 from script)
execute(script, { variables: { x: 10 } }); // → 20 (external x overrides)
```

### Custom Functions

Extend littlewing with your own functions:

```javascript
// In your JavaScript code
execute("clamp(x, 0, 100)", {
	variables: { x: 150 },
	functions: {
		clamp: (value, min, max) => Math.min(Math.max(value, min), max),
	},
}); // → 100
```

All custom functions must:

- Accept zero or more number arguments
- Return a number
- Be pure (no side effects)

## Common Use Cases

### Financial Calculations

```javascript
// Compound interest
principal = 1000;
annualRate = 0.07;
years = 10;
futureValue = (principal * (1 + annualRate)) ^ years; // → 1967.15

// Monthly loan payment
loanAmount = 200000;
monthlyRate = 0.04 / 12;
months = 360;
payment = (loanAmount * monthlyRate) / ((1 - (1 + monthlyRate)) ^ -months);

// Investment return
initial = 10000;
final = 15000;
years = 3;
annualReturn = ((final / initial) ^ (1 / years - 1)) * 100; // percent
```

### Business Rules

```javascript
// Tiered pricing
quantity = 150;
unitPrice = quantity > 100 ? 0.8 : quantity > 50 ? 0.9 : 1.0;
total = quantity * unitPrice;

// Employee bonus calculation
sales = 125000;
bonus = sales > 100000 ? sales * 0.1 : sales > 50000 ? sales * 0.05 : 0;

// Shipping cost
weight = 15; // kg
distance = 500; // km
baseCost = 10;
weightCost = weight * 0.5;
distanceCost = distance * 0.02;
shippingTotal = baseCost + weightCost + distanceCost;
```

### Data Validation

```javascript
// Check value ranges
age = 25;
isValidAge = age >= 0 && age <= 120; // → 1

// Complex validation
score = 85;
isPass = score >= 60; // → 1
isExcellent = score >= 90; // → 0
needsImprovement = score < 70; // → 0

// Date validation
inputDate = DATE(2024, 2, 30); // Invalid date becomes valid JS Date
isValid = GET_DAY(inputDate) == 30; // Will be 0 (JS corrects to March)
```

### Scientific Computing

```javascript
// Distance between points
x1 = 0;
y1 = 0;
x2 = 3;
y2 = 4;
distance = SQRT((x2 - x1) ^ (2 + (y2 - y1)) ^ 2); // → 5

// Circle calculations
radius = 5;
pi = 3.14159;
area = (pi * radius) ^ 2;
circumference = 2 * pi * radius;

// Temperature conversion
celsius = 25;
fahrenheit = (celsius * 9) / 5 + 32; // → 77
kelvin = celsius + 273.15; // → 298.15
```

## Performance Benefits

### Why Choose Littlewing?

1. **Zero Dependencies** - No external libraries needed
2. **Small Bundle** - Minimal impact on your app size
3. **O(n) Performance** - Linear time parsing and execution
4. **Type Safety** - Numbers-only means no runtime type checks
5. **Browser Optimized** - Pure ESM, no Node.js dependencies

### Ideal For:

- **User-defined formulas** - Let users write safe arithmetic expressions
- **Configuration expressions** - Dynamic config without eval()
- **Business rules** - Express complex logic simply
- **Financial calculators** - Accurate arithmetic with custom functions
- **Date arithmetic** - Built-in timestamp support
- **Data transformations** - Process numeric data streams
- **Game mechanics** - Damage formulas, score calculations
- **IoT data processing** - Sensor value transformations

### Performance Characteristics

- **Parse once, execute many** - The `execute()` function accepts both strings and pre-parsed AST nodes, allowing you to parse once and execute many times with different contexts
- **High-frequency evaluation** - Suitable for 1000s of evaluations per second
- **Constant memory** - No memory leaks or unbounded growth
- **Predictable execution time** - O(n) based on expression size

#### Optimization Example

```javascript
import { execute, parseSource } from "littlewing";

// For expressions executed multiple times, parse once and reuse the AST
const formula = parseSource("price * quantity * (1 - discount)");

// Execute many times with different values (no re-parsing overhead)
execute(formula, { variables: { price: 10, quantity: 5, discount: 0.1 } }); // → 45
execute(formula, { variables: { price: 20, quantity: 3, discount: 0.15 } }); // → 51
execute(formula, { variables: { price: 15, quantity: 10, discount: 0.2 } }); // → 120

// This pattern is ideal for:
// - Applying formulas to datasets
// - Real-time calculations with user input
// - Batch processing with different contexts
```

## Limitations

### What Littlewing Doesn't Support

- **No strings** - Pure arithmetic only
- **No loops** - Use host language for iteration
- **No if statements** - Use ternary operator instead
- **No function definitions** - Provide via context
- **No arrays/objects** - Single number values only
- **No mutations** - Variables are reassigned, not mutated
- **No side effects** - Pure expression evaluation

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

The worst a malicious user can do is write an expression that returns the wrong number or triggers a division by zero error.

## Summary

Littlewing provides a powerful yet simple expression language for numeric calculations. Its numbers-only design, built-in date arithmetic, and extensibility through context make it perfect for applications that need safe, fast expression evaluation without the complexity of a full programming language.

Whether you're building financial calculators, game mechanics, business rule engines, or data processing pipelines, littlewing offers the right balance of simplicity, safety, and performance.
