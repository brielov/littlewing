# Upgrading

## From 2.x to 3.0

3.0 replaces the pipeline. Every program is now compiled and type checked before it runs, numbers are exact decimals, and the API is new. This guide covers what has to change.

A stored formula may need changes too. Compiling it with 3.0 finds what no longer parses or type checks, and its warnings need reading as well. It cannot find a formula that now means something else, such as one whose host overrode an `=`, or one that only fails on some inputs. See [Programs that now mean something else](#programs-that-now-mean-something-else).

### The API

| 2.x                                      | 3.0                                                                                                                                                                             |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `evaluate(source, context)`              | `run(source, options)`, or `compile` and then `evaluate`                                                                                                                        |
| `evaluate(ast, context)`                 | `compile(source)`. No syntax tree can be evaluated                                                                                                                              |
| `defaultContext`                         | Nothing for core functions, which are always there. The rest are in `littlewing/std`, `littlewing/temporal` and `littlewing/clock`                                              |
| `{ functions: { F: (a) => ... } }`       | `{ functions: { F: define({ args, returns, run }) } }`, on `compile` or `run`, not `evaluate`                                                                                   |
| `{ variables }`                          | `{ variables }`, on `evaluate` or `run`                                                                                                                                         |
| `evaluateScope`, `evaluateWithScope`     | Return a record: `{ total, tax }`                                                                                                                                               |
| `optimize`                               | Part of `compile`                                                                                                                                                               |
| `extractInputVariables`                  | `program.inputs`, with their types. It lists what a host must or may supply, so an assignment to a constant has to become `?=` to appear, and a name that is only read now does |
| `extractAssignedVariables`               | Gone                                                                                                                                                                            |
| `visit`, `ast`, the `is*` guards         | Gone. `parse` gives a tree of plain objects with string `kind`                                                                                                                  |
| `NodeKind`                               | `node.kind`, such as `'binary'`. Its types are in `syntax`                                                                                                                      |
| `core`, `math`, `string`, `array`, ...   | `coreFunctions`, and `littlewing/std`                                                                                                                                           |
| `datetime`, `time`, `datetimefull`       | `littlewing/temporal` and `littlewing/clock`                                                                                                                                    |
| `assertNumber` and the other `assert*`   | Gone: `define` checks the types of a call                                                                                                                                       |
| `RuntimeValue`, `typeOf`                 | Gone                                                                                                                                                                            |
| `ExecutionContext`                       | `CompileOptions` and `EvaluateOptions`                                                                                                                                          |
| `ExecutionResult`                        | Return a record                                                                                                                                                                 |
| `ASTNode`, `Operator` and the node types | The namespace `syntax`                                                                                                                                                          |
| `ParseError` from `evaluate`             | `result.diagnostics` from `compile`, `CompileError` from `run`                                                                                                                  |

```ts
// 2.x
import { defaultContext, evaluate } from 'littlewing';
evaluate('ROUND(price * rate)', { ...defaultContext, variables: { price: 10, rate: 1.5 } });

// 3.0
import { compile, CompileError, evaluate } from 'littlewing';
const result = compile('ROUND(price * rate)');
if (!result.ok) throw new CompileError(result.diagnostics);
evaluate(result.program, { variables: { price: 10, rate: 1.5 } });
```

A host function declares its types. Numbers in its arguments arrive as `Decimal`s, and arrays and records as frozen copies.

```ts
// 2.x
const DOUBLE = (x) => x * 2;

// 3.0
const DOUBLE = define({
	args: [t.number()],
	returns: t.number(),
	pure: true,
	run: (x) => x.times(2),
});
```

`define` needs to be told `pure: true` before a function can run at compile time. Nothing is assumed to be.

Records now exist, so a host can pass objects: `{ variables: { order: { total: 12 } } }` and read `order.total`.

### The language

- **Inputs.** A variable from the host used to win over an assignment. Now `=` is always the program's value, and `?=` declares an input with a default. Change `rate = 0.21` to `rate ?= 0.21` wherever a host overrides it.
- **A name is bound once.** `x = 1` then `x = 2` is an error, as there is no reassignment. Use a new name, or `for ... into`.
- **The last statement is an expression.** A program can no longer end in a binding, so add the name on a last line.
- **Assignment is not an expression.** `a = b = 1` and `(a = 1)` are errors.
- **`null`, `let`, `fn` and `match` are reserved.**
- **Types are checked.** Anything that could not run correctly fails at compile time, such as `1 + "a"`, or `[1, "a"]`, or `1 == "1"`, which used to be `false`.
- **Interpolation.** `"Total: #{x}"` is new, so a `#{` in a string must be written `\#{`.
- **Missing values.** `a ?? b`, for an input, field, index or key that is missing. An index past the end is still an error, unless `??` catches it.

### Functions

| 2.x                                                                           | 3.0                                                              |
| ----------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `STR_UPPER`, `STR_LOWER`, `STR_TRIM`, `STR_SPLIT`, `STR_REPLACE`              | `UPPER`, `LOWER`, `TRIM`, `SPLIT`, `REPLACE`                     |
| `STR_STARTS_WITH`, `STR_ENDS_WITH`, `STR_REPEAT`                              | `STARTS_WITH`, `ENDS_WITH`, `REPEAT`, in std                     |
| `ARR_SORT`, `ARR_JOIN`                                                        | `SORT`, `JOIN`                                                   |
| `ARR_SUM`, `ARR_UNIQUE`, `ARR_FLAT`, `ARR_MIN`, `ARR_MAX`                     | `SUM`, `UNIQUE`, `FLAT`, `MIN`, `MAX`, in std                    |
| `MIN(a, b)`, `MAX(a, b)`                                                      | `MIN([a, b])`, `MAX([a, b])`, in std                             |
| `ABS`, `CLAMP`, `SQRT`, `SIN`, `COS`, `TAN`, `LOG`, `LOG10`, `EXP`, `REVERSE` | The same, in std                                                 |
| `ADD_DAYS(d, 7)`, and months, years, hours, minutes, seconds                  | `ADD(d, 7, "days")`, in temporal                                 |
| `DIFFERENCE_IN_DAYS(a, b)`, and the other units                               | `DIFF(a, b, "days")`, in temporal                                |
| `START_OF_MONTH(d)`, year, week, quarter, day                                 | `START_OF(d, "month")`, in temporal                              |
| `END_OF_MONTH(d)`, year, day                                                  | `END_OF(d, "month")`, in temporal                                |
| `AGE(birth)`                                                                  | `AGE(birth, TODAY())`, with the clock                            |
| `IS_SAME_TIME(a, b)`                                                          | `a == b` for times, and `TO_TIME(a) == TO_TIME(b)` for datetimes |
| `TYPE(x)`                                                                     | Gone, as every type is known                                     |
| `NOW`, `TODAY`, `NOW_TIME`                                                    | In `littlewing/clock`                                            |

Anything that came from std, temporal or clock has to be passed in:

```ts
import * as std from 'littlewing/std';
import { temporalFunctions } from 'littlewing/temporal';
import * as clock from 'littlewing/clock';

const functions = { ...std, ...temporalFunctions, ...clock };
```

A namespace of `littlewing/temporal` cannot be spread itself, as the module also holds the types `date`, `time` and `datetime`.

### Programs that now mean something else

- **Numbers are decimals.** `0.1 + 0.2` is `0.3`, not `0.30000000000000004`. `evaluate` still returns a JS number by default, so a result with more than about 15 digits is rounded on its way out. Ask for `{ numbers: 'decimal' }` to keep them.
- **Division rounds to 34 digits.** `1 / 3 * 3 == 1` was `true` and is `false`, and `FLOOR(1 / 3 * 3)` was `1` and is `0`.
- **There is no `NaN` or infinity.** `SQRT(-1)`, `LOG(0)`, `(-8) ^ 0.5` and `0 ^ -1` are errors, and so is `NUM("Infinity")`. `10 ^ 400` is a number, which fails with `overflow` only if it leaves as a JS number.
- **An input used only in a way numbers allow is a number.** `a + b`, `a < b` and `SORT(x)` infer numbers, and `x[0]` and `for c in x` an array, so passing strings or dates fails with `invalid-input` when the program runs. Declare them: `compile(source, { inputs: { a: t.string() } })`. A value of a host type at a generic position also needs its type in `types`, in `inputs`, or in the signature of a function.
- **An `=` no longer gives way to a host variable,** which compiles without a word. Change it to `?=`.
- **Programs have a budget,** of 20 million steps by default, which 2.x did not. `for x in 0..25000000 into s = 0 then s + 1` now fails with `limit-exceeded`. Raise `limits.maxSteps` where you trust the program.
- **Escapes.** 2.x kept an unknown escape as text. `\r`, `\#` and `\u{...}` now mean something, so `"C:\rates"` holds a carriage return, and any other unknown escape is an error.
- **Stricter functions.** `NUM("")` was `0`, `NUM("0x10")` was `16`, and `SLICE("hello", 1.5)` was `"ello"`. All are `invalid-argument` now, which for an input means when the program runs.
- **`ROUND` rounds half away from zero.** `ROUND(-2.5)` was `-2` and is `-3`. It also takes digits and a mode: `ROUND(x, 2, "half_even")`.
- **`REPLACE` replaces every occurrence**, and not only the first.
- **`START_OF` and `END_OF` on a datetime** give the first and last moment of the period. `START_OF_MONTH` used to keep the time of day.
- **Unary minus no longer swallows `*`, `/` and `%`.** `8 / -2 * 4` was `-1` and is `-16`. `2 ^ -1 * 3` was `0.125` and is `1.5`. `-2 ^ 2` is still `-4`.
- **Semicolons end statements.** `a = 5; -1` was one statement, `a = 4`. It is now two.
- **A line break ends a statement before `-`, `(` and `[`,** outside brackets, between `if` and `else`, and between `for` and `then`. To continue an expression, end the line with the operator, or use parentheses. Other operators can still start a continuation line.
- **A `for` guard sees the accumulator.** In `for x in xs when acc < 3 into acc = 0 then acc + x`, the guard reads the current `acc`.
- **Strings order by code point.** `"ﬀ" < "😀"` was `false` and is `true`, and `SORT` follows.
- **`SPLIT(s, "")` splits by code point**, and `REPLACE` takes its replacement literally, so `$&` is ordinary text.
- **`STR` writes numbers in the text form of the language,** so `STR(10 ^ 21)` was `"1e+21"` and is `"1000000000000000000000"`, and `STR(1 / 3)` has 34 digits.
