# Upgrading

## To the next major version

This release fixes programs that evaluated to the wrong value, and bounds what untrusted programs can do. Some of what it fixes changes results, so read the first section even if nothing fails to compile.

### Programs that now mean something else

- **Unary minus no longer swallows `*`, `/` and `%`.** `8 / -2 * 4` was `-1` and is now `-16`. `2 ^ -1 * 3` was `0.125` and is now `1.5`. `-2 ^ 2` is still `-4`.
- **Semicolons end statements.** `a = 5; -1` was one statement, `a = 4`. It is now two, and evaluates to `-1`.
- **A line break ends a statement before `-`, `(` and `[`.** These three tokens can start an expression as well as continue one, and now they start one. `total = 10` followed by `-5 + total` on the next line is two statements. To continue an expression onto the next line, end the line with the operator, or wrap the expression in parentheses:

  ```
  sum = a -
    b

  sum = (a
    - b)
  ```

  Other operators (`+`, `*`, `==`, `&&`, `|>` and so on) can still start a continuation line, because they cannot start an expression. Line breaks mean nothing inside `()`, `[]`, or between `if`/`then`/`else` and `for`/`then`.

- **A `for` guard sees the accumulator.** In `for x in xs when acc < 3 into acc = 0 then acc + x`, the guard reads the current `acc` instead of an outer variable or a stale value.
- **Assigning to an accumulator or loop variable works** even if the host injected a variable of that name.
- **`STR_REPLACE` takes its replacement literally.** `$&` and friends are ordinary text.
- **`STR_SPLIT(s, "")` splits by code point**, so characters outside the BMP stay whole and the result has `LEN(s)` elements.
- **`CONTAINS` matches whole code points**, so half a surrogate pair no longer matches.
- **`ARR_SORT` puts `NaN` last. `ARR_MIN` and `ARR_MAX` return `NaN` if any element is `NaN`**, wherever it is.

### Programs that are now errors

- **Statements on one line need a `;`.** `1 2` and `x = 1 y = 2` used to run. Neither does now.
- **Numbers cannot run into identifiers.** `3x` used to be two statements. `1e5` is now a number, and `1e` is an error.
- **Literals that overflow are errors**, such as `1e999`.
- **Arrays are homogeneous at every depth.** `[[1], ["a"]]` used to pass. Empty arrays still fit any array type: `[[], [1]]` is fine.
- **`true` and `false` are keywords**, so they cannot name a loop variable, accumulator or function.
- **A loop variable and its accumulator need different names.**
- **`(x) = 5`** is not an assignment.
- **`NUM`** rejects empty strings, hexadecimal, binary, octal, `Infinity`, and values that overflow.
- **`SLICE`** takes integers only. The `ADD_*` functions fail on fractions with a `TypeError` instead of a `RangeError`.
- **`ARR_SORT`, `ARR_MIN` and `ARR_MAX`** reject one-element arrays of unordered types, as they always did for longer ones.
- **`STR`, `TYPE`, `CONTAINS` and `INDEX_OF`** fail on a missing argument.
- **Nesting** is limited to 256 levels, expressions to an AST height of 1024, and identifiers to 1024 characters.

### Programs that now run out of budget

Every evaluation has a budget of `DEFAULT_MAX_STEPS` steps, 20 million by default, and fails with a `LimitExceededError` cause past it. So does a result larger than that many elements and characters. Most programs never come close, but sorting about a million elements, or appending to an array in a loop more than a few thousand times, will. Raise the budget, or disable it for trusted programs:

```typescript
evaluate(source, { ...defaultContext, limits: { maxSteps: Infinity } });
```

### API changes

- **Failures in `evaluate` are `EvaluationError`s.** The original `TypeError`, `RangeError` or host error is its `cause`, and `start` and `end` locate the failing expression. Replace `err instanceof TypeError` with `err.cause instanceof TypeError`. Parse failures stay `ParseError`s, and errors from an invalid `variables` entry stay plain `TypeError`s, since they are mistakes in the host.
- **`optimize(node, set)` is now `optimize(node, { externalVariables: set })`.** In plain JavaScript a bare `Set` is silently ignored, which turns propagation off, so update every call.
- **`optimize` behaves exactly like the original program**, which means it removes less. Assignments and expressions that might fail stay in, and so do reads of variables a host could replace. Pass `externalVariables` to let it know more. Use `preserveScope: true` if you call `evaluateScope` on optimized programs.
- **Functions must be own properties** of `context.functions`, so class instances and prototype chains no longer work. List them in a plain object, such as `{ F: instance.F.bind(instance) }`.
- **An AST must not change once evaluated**, as it compiles to code on its first evaluation. To evaluate something once, pass the source rather than `parse(source)`, which is more than twice as fast.
- **`evaluateScope` returns variables in no particular order.**
- **A call site looks a function up once per evaluation**, so do not rely on changing `context.functions` during one.
- **Function results and context variables are validated.** A host function returning `undefined`, `null` or an object now fails. So do non-ISO calendars.
- **`RangeExpression` children are `from` and `to`**, as `start` and `end` are now the source offsets every parsed node has.
- **`NodeKind` is a regular enum**, so its numeric values are no longer inlined into your bundle.
- **`RuntimeValue` no longer needs a global `Temporal` type.** It uses `PlainDate`, `PlainTime` and `PlainDateTime`, now exported, which follow your project's global types if it has any, and otherwise those of `temporal-spec`, a new dependency with no runtime code.
- **`extractInputVariables`** decides by a variable's first assignment only.
- **`toLineColumn`** treats a lone `\r` as a line break, as the lexer now does.
- **`typescript` is no longer a peer dependency.**

### Additions

`forEachChild` and `mapChildren` traverse the AST, `generate` handles every number including `NaN` and infinities, and `ExecutionContext.limits`, `DEFAULT_MAX_STEPS`, `EvaluationError`, `LimitExceededError`, `assertInteger` and `assertRuntimeValue` are exported.
