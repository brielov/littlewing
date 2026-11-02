# The littlewing language

A guide for people writing formulas. [SPEC.md](./SPEC.md) is the definition, and settles anything this guide leaves out.

A program is a list of statements, and its value is the value of the last one.

```littlewing
price = 100
tax = price * 0.21
price + tax
// => 121
```

## Values

| Type    | Examples                     |
| ------- | ---------------------------- |
| number  | `42`, `3.14`, `1_000`, `1e3` |
| string  | `"hello"`, `"total: #{x}"`   |
| boolean | `true`, `false`              |
| array   | `[1, 2, 3]`                  |
| record  | `{ name: "Ana", total: 12 }` |

Your host can add other types, such as dates.

Nothing converts by itself: `1 + "2"` is an error. Use `STR` and `NUM`.

### Numbers

There is one number type, an exact decimal of 34 significant digits. Decimal fractions behave the way they do on paper.

```littlewing
0.1 + 0.2
// => 0.3
```

Division rounds, as no finite decimal can hold a third.

```littlewing
1 / 3 * 3
// => 0.9999999999999999999999999999999999
```

A number too large to hold is an error, and so is dividing by zero. There is no `NaN` or infinity.

### Strings

A string is a sequence of Unicode code points, and `LEN` and indexes count those. So `"😀"` has length 1, and an emoji made of several code points, such as a flag, counts as several. `#{ }` puts a value in a string.

```littlewing
name = "Ana"
"Hello, #{name}! #{1 + 1} is two."
// => "Hello, Ana! 2 is two."
```

The escapes are `\"`, `\\`, `\#`, `\n`, `\r`, `\t` and `\u{1F600}`.

### Arrays

The elements of an array have one type. `+` joins arrays, a negative index counts from the end, and a range builds one.

```littlewing
list = [10, 20, 30]
[list[0], list[-1]] + (1..=3)
// => [10, 30, 1, 2, 3]
```

`a..b` stops before `b`, and `a..=b` includes it.

### Records

A record is a set of named fields. A name alone is shorthand, and `...` adds the fields of another record.

```littlewing
item = { price: 10, quantity: 3 }
total = item.price * item.quantity
{ ...item, total }
// => { price: 10, quantity: 3, total: 30 }
```

A record whose values have one type can be looked up by a key computed at run time.

```littlewing
rates = { AR: 0.21, UY: 0.22 }
country = "UY"
rates[country]
// => 0.22
```

## Names and inputs

`name = value` binds a name, once. A name read but bound nowhere is an input, which your host supplies. `name ?= value` is an input with a default.

```littlewing
rate ?= 0.21
100 * (1 + rate)
// => 121
```

`=` always means the program's own value, even if the host passes the same name.

## Operators

From tightest to loosest:

| Operators                   | Meaning                            |
| --------------------------- | ---------------------------------- |
| `()` `[]` `.`               | Grouping, indexing, a field        |
| `^`                         | Power, right to left               |
| `-` `!`                     | Negative, not                      |
| `*` `/` `%`                 | Times, divide, remainder           |
| `+` `-`                     | Add or join, subtract              |
| `..` `..=`                  | Range                              |
| `??`                        | The fallback for something missing |
| `==` `!=` `<` `>` `<=` `>=` | Comparison                         |
| `&&`                        | And                                |
| `\|\|`                      | Or                                 |
| `\|>`                       | Pipe                               |

`==` compares arrays and records by what they hold, and both sides have one type, so `1 == "1"` is an error. `<` takes numbers, strings, or two values of a host type with an order, such as dates. `&&`, `||`, `!` and `if` take booleans, and only evaluate what they need to.

## Missing values

A value can be missing: an input nobody supplied, a field that may be absent from an input, an index past the end, or a computed key not in a record. `??` gives what to use instead. A field that a record written in the program plainly lacks is an error, even under `??`.

```littlewing
rates = { AR: 0.21 }
country = "CL"
list = [1, 2]
[rates[country] ?? 0, list[5] ?? 9]
// => [0, 9]
```

The left of `??` is a name followed by `.field` and `[index]` steps, and any step can be missing. There is no `null`. Reading something missing anywhere else is an error.

## Choosing and looping

`if` is an expression, and always has an `else`.

```littlewing
score = 87
if score >= 90 then "A" else if score >= 80 then "B" else "C"
// => "B"
```

`for` builds an array, and `when` keeps only some of the elements.

```littlewing
for x in 1..=6 when x % 2 == 0 then x * x
// => [4, 16, 36]
```

With `into`, it folds them into one value. This is how to sum, and it is all the state there is: a name never changes, and a formula cannot loop forever.

```littlewing
for x in [1, 2, 3, 4] into sum = 0 then sum + x
// => 10
```

A string loops over its code points.

## Pipes

`|>` sends a value through a function, which reads well for a chain of steps. `?` marks where the value goes, and a function of one argument needs no parentheses.

```littlewing
"  ana,bob  " |> TRIM |> SPLIT(?, ",") |> LEN
// => 2
```

## Functions

These are always available. Your host can add more.

| Function                             | Result                                                           |
| ------------------------------------ | ---------------------------------------------------------------- |
| `STR(value)`                         | The text of a value                                              |
| `NUM(value)`                         | The number a string or boolean stands for                        |
| `LEN(value)`                         | How many code points or elements                                 |
| `SLICE(value, start, [end])`         | Part of a string or array. Negative positions count from the end |
| `CONTAINS(value, item)`              | Whether a substring or element is present                        |
| `INDEX_OF(value, item)`              | Its first position, or `-1`                                      |
| `UPPER(text)`, `LOWER(text)`         | The text in another case                                         |
| `TRIM(text)`                         | The text without white space at either end                       |
| `SPLIT(text, separator)`             | The parts between separators                                     |
| `REPLACE(text, search, replacement)` | The text with every occurrence replaced                          |
| `SORT(list)`                         | Numbers, strings or other ordered values, in ascending order     |
| `SORT_BY(items, keys)`               | Items in the order of their keys                                 |
| `JOIN(parts, separator)`             | Strings with a separator between them                            |
| `FLOOR(value)`, `CEIL(value)`        | Round down, or up, to an integer                                 |
| `ROUND(value, [digits], [mode])`     | Round to some places. Half goes away from zero                   |
| `FIXED(value, digits, [mode])`       | The text of a number, with exactly that many places              |

```littlewing
items = [{ name: "b", price: 2 }, { name: "a", price: 1 }]
sorted = SORT_BY(items, for item in items then item.price)
[sorted[0].name, FIXED(1.5, 2), STR(ROUND(2.567, 1))]
// => ["a", "1.50", "2.6"]
```

The modes of `ROUND` and `FIXED` are `"half_away"`, `"half_even"`, `"floor"`, `"ceil"` and `"trunc"`.

Depending on your host, you may also have these:

| Module                | Functions                                                                                                                                                                                                                                                    |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `littlewing/std`      | `ABS`, `MIN`, `MAX`, `CLAMP`, `SUM`, `SQRT`, `SIN`, `COS`, `TAN`, `LOG`, `LOG10`, `EXP`, `STARTS_WITH`, `ENDS_WITH`, `REPEAT`, `REVERSE`, `UNIQUE`, `FLAT`                                                                                                   |
| `littlewing/temporal` | `DATE`, `TIME`, `DATETIME`, `YEAR`, `MONTH`, `DAY`, `HOUR`, `MINUTE`, `SECOND`, `MILLISECOND`, `WEEKDAY`, `DAY_OF_YEAR`, `QUARTER`, `ADD`, `DIFF`, `START_OF`, `END_OF`, `TO_DATE`, `TO_TIME`, `COMBINE`, `IS_SAME_DAY`, `IS_WEEKEND`, `IS_LEAP_YEAR`, `AGE` |
| `littlewing/clock`    | `NOW`, `TODAY`, `NOW_TIME`                                                                                                                                                                                                                                   |

```littlewing
start = DATE(2026, 1, 31)
next = ADD(start, 1, "months")
{ next: STR(next), days: DIFF(start, next, "days"), quarter: QUARTER(next) }
// => { next: "2026-02-28", days: 28, quarter: 1 }
```

## Statements and lines

Statements are separated by a line break or `;`. Inside `()`, `[]`, `{}` and `#{ }`, between `if` and `else`, and between `for` and `then`, a statement continues across lines. Elsewhere a line that starts with `-`, `(`, `[` or `!` starts a new statement, so end the line before with the operator, or use parentheses. Any other operator can start a continuation line.

```littlewing
total = 100
  + 20
net = total -
  1
net
// => 119
```

Comments run from `//` to the end of the line.

## Errors

Mistakes are found before anything runs, with their location: a type that does not fit, a name used before it is bound, a function that does not exist. A few things can only fail while running, such as dividing by an input that turns out to be zero, or reading an index past the end without `??`. A program that does too much work is stopped.
