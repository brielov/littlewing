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
2 + 3 * 4              // → 14

// Variables and assignment
radius = 5;
area = 3.14159 * radius ^ 2  // → 78.54

// Conditional expressions
score = 85;
grade = score >= 90 ? 100 : (score >= 80 ? 90 : 75)  // → 90

// Date arithmetic
deadline = now() + days(7)   // 7 days from now
hoursLeft = (deadline - now()) / hours(1)

// Financial calculations
principal = 1000;
rate = 0.05;
years = 3;
futureValue = principal * (1 + rate) ^ years  // → 1157.625
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
x = 42           // integer
y = 3.14159      // decimal
z = .5           // shorthand decimal
w = 1.5e6        // scientific notation
v = .5e2         // shorthand + scientific (50)
```

### Variables

Variables store numeric values and can be assigned and reassigned:

```javascript
x = 10           // assign 10 to x
y = x * 2        // use x in expression
x = x + 1        // reassign x

// Chain assignments (right-associative)
a = b = c = 5    // all get value 5
```

Variable names:
- Start with letter or underscore
- Contain letters, numbers, underscores
- Case-sensitive (`myVar` ≠ `myvar`)

### Operators

#### Arithmetic Operators

| Operator | Name | Example | Result |
|----------|------|---------|--------|
| `+` | Addition | `5 + 3` | `8` |
| `-` | Subtraction | `10 - 3` | `7` |
| `*` | Multiplication | `4 * 3` | `12` |
| `/` | Division | `10 / 2` | `5` |
| `%` | Modulo | `10 % 3` | `1` |
| `^` | Exponentiation | `2 ^ 3` | `8` |
| `-` (unary) | Negation | `-5` | `-5` |

#### Comparison Operators

All comparisons return `1` (true) or `0` (false):

| Operator | Name | Example | Result |
|----------|------|---------|--------|
| `==` | Equal | `5 == 5` | `1` |
| `!=` | Not equal | `5 != 3` | `1` |
| `<` | Less than | `3 < 5` | `1` |
| `>` | Greater than | `5 > 3` | `1` |
| `<=` | Less or equal | `3 <= 3` | `1` |
| `>=` | Greater or equal | `5 >= 3` | `1` |

#### Logical Operators

Work with truthiness (0 is false, non-zero is true):

| Operator | Name | Example | Result |
|----------|------|---------|--------|
| `&&` | AND | `1 && 1` | `1` |
| `\|\|` | OR | `0 \|\| 1` | `1` |

```javascript
// Logical operators with comparisons
x = 10;
result = x > 5 && x < 20  // → 1 (true)

// Short-circuit evaluation
y = 0;
safe = y != 0 && 100 / y > 5  // → 0 (avoids division by zero)
```

#### Conditional (Ternary) Operator

Syntax: `condition ? consequent : alternate`

```javascript
// Basic conditional
age = 18;
canVote = age >= 18 ? 1 : 0  // → 1

// Nested conditionals
score = 85;
grade = score >= 90 ? 100 :
        score >= 80 ? 90 :
        score >= 70 ? 80 : 60  // → 90

// With calculations
discount = quantity > 100 ? price * 0.2 : price * 0.1
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
2 + 3 * 4          // → 14 (not 20)
2 ^ 3 ^ 2          // → 512 (right-associative: 2^(3^2))
x = 5 > 3 ? 10 : 5 // → x gets 10
-2 ^ 2             // → -4 (unary minus has higher precedence)
```

### Multiple Statements

Separate statements with semicolons or newlines. The last expression is the return value:

```javascript
// Calculate compound interest
principal = 1000;
rate = 0.05;
years = 3;
principal * (1 + rate) ^ years  // → 1157.625

// The whole program returns 1157.625
```

## Built-in Functions

### Math Functions

| Function | Description | Example |
|----------|-------------|---------|
| `abs(x)` | Absolute value | `abs(-5)` → `5` |
| `ceil(x)` | Round up | `ceil(4.3)` → `5` |
| `floor(x)` | Round down | `floor(4.7)` → `4` |
| `round(x)` | Round to nearest | `round(4.5)` → `5` |
| `sqrt(x)` | Square root | `sqrt(16)` → `4` |
| `sin(x)` | Sine (radians) | `sin(3.14159/2)` → `1` |
| `cos(x)` | Cosine (radians) | `cos(0)` → `1` |
| `tan(x)` | Tangent (radians) | `tan(0)` → `0` |
| `log(x)` | Natural logarithm | `log(2.71828)` → `1` |
| `log10(x)` | Base-10 logarithm | `log10(100)` → `2` |
| `exp(x)` | e^x | `exp(1)` → `2.71828` |
| `min(...)` | Minimum value | `min(3, 1, 5)` → `1` |
| `max(...)` | Maximum value | `max(3, 1, 5)` → `5` |

### Date & Time Functions

#### Current Time

- `now()` - Returns current timestamp (milliseconds since Unix epoch)

#### Create Timestamps

- `timestamp(year, month, day, hour?, minute?, second?)` - Create a timestamp
  - Month is 1-based (1 = January, 12 = December)
  - Hour, minute, second default to 0 if omitted

```javascript
// Christmas 2024
xmas = timestamp(2024, 12, 25)

// New Year 2025 at midnight
newYear = timestamp(2025, 1, 1, 0, 0, 0)
```

#### Time Duration Helpers

Convert human-readable units to milliseconds:

| Function | Description | Example |
|----------|-------------|---------|
| `milliseconds(x)` | Identity | `milliseconds(1000)` → `1000` |
| `seconds(x)` | Seconds to ms | `seconds(60)` → `60000` |
| `minutes(x)` | Minutes to ms | `minutes(5)` → `300000` |
| `hours(x)` | Hours to ms | `hours(2)` → `7200000` |
| `days(x)` | Days to ms | `days(7)` → `604800000` |
| `weeks(x)` | Weeks to ms | `weeks(2)` → `1209600000` |

#### Extract Date Components

Extract components from a timestamp:

| Function | Description | Returns |
|----------|-------------|---------|
| `year(ts)` | Get year | 2024 |
| `month(ts)` | Get month | 1-12 |
| `day(ts)` | Get day of month | 1-31 |
| `hour(ts)` | Get hour | 0-23 |
| `minute(ts)` | Get minute | 0-59 |
| `second(ts)` | Get second | 0-59 |
| `weekday(ts)` | Get day of week | 0-6 (0=Sunday) |

### Date Arithmetic Examples

```javascript
// Add time to current timestamp
tomorrow = now() + days(1)
nextWeek = now() + weeks(1)
in2Hours = now() + hours(2) + minutes(30)

// Calculate time differences
deadline = timestamp(2024, 12, 31);
daysLeft = (deadline - now()) / days(1)
hoursLeft = (deadline - now()) / hours(1)

// Check if date is weekend
ts = timestamp(2024, 11, 9);  // Saturday
isWeekend = weekday(ts) == 0 || weekday(ts) == 6  // → 1 (true)

// Age calculation
birthdate = timestamp(1990, 5, 15);
ageInYears = (now() - birthdate) / days(365.25)
```

## External Variables and Functions

### Providing Variables at Runtime

You can inject variables when executing expressions:

```javascript
// In your JavaScript code
execute('radius * 2 * 3.14159', {
  variables: { radius: 10 }
})  // → 62.8318
```

Variables provided externally override script assignments:

```javascript
// Script: x = 5; x * 2
execute(script)  // → 10 (uses x = 5 from script)
execute(script, { variables: { x: 10 } })  // → 20 (external x overrides)
```

### Custom Functions

Extend littlewing with your own functions:

```javascript
// In your JavaScript code
execute('clamp(x, 0, 100)', {
  variables: { x: 150 },
  functions: {
    clamp: (value, min, max) => Math.min(Math.max(value, min), max)
  }
})  // → 100
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
futureValue = principal * (1 + annualRate) ^ years  // → 1967.15

// Monthly loan payment
loanAmount = 200000;
monthlyRate = 0.04 / 12;
months = 360;
payment = loanAmount * monthlyRate / (1 - (1 + monthlyRate) ^ -months)

// Investment return
initial = 10000;
final = 15000;
years = 3;
annualReturn = ((final / initial) ^ (1 / years) - 1) * 100  // percent
```

### Business Rules

```javascript
// Tiered pricing
quantity = 150;
unitPrice = quantity > 100 ? 0.8 :
            quantity > 50 ? 0.9 :
            1.0;
total = quantity * unitPrice

// Employee bonus calculation
sales = 125000;
bonus = sales > 100000 ? sales * 0.1 :
        sales > 50000 ? sales * 0.05 :
        0

// Shipping cost
weight = 15;  // kg
distance = 500;  // km
baseCost = 10;
weightCost = weight * 0.5;
distanceCost = distance * 0.02;
shippingTotal = baseCost + weightCost + distanceCost
```

### Data Validation

```javascript
// Check value ranges
age = 25;
isValidAge = age >= 0 && age <= 120  // → 1

// Complex validation
score = 85;
isPass = score >= 60  // → 1
isExcellent = score >= 90  // → 0
needsImprovement = score < 70  // → 0

// Date validation
inputDate = timestamp(2024, 2, 30);  // Invalid date becomes valid JS Date
isValid = day(inputDate) == 30  // Will be 0 (JS corrects to March)
```

### Scientific Computing

```javascript
// Distance between points
x1 = 0; y1 = 0;
x2 = 3; y2 = 4;
distance = sqrt((x2 - x1)^2 + (y2 - y1)^2)  // → 5

// Circle calculations
radius = 5;
pi = 3.14159;
area = pi * radius ^ 2
circumference = 2 * pi * radius

// Temperature conversion
celsius = 25;
fahrenheit = celsius * 9/5 + 32  // → 77
kelvin = celsius + 273.15  // → 298.15
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

- Parse once, execute many times with different contexts
- Suitable for high-frequency evaluation (1000s/second)
- Constant memory usage (no memory leaks)
- Predictable execution time based on expression size

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
