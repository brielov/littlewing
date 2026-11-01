# The Littlewing Language

Version 3.0, draft.

Littlewing is a small, statically typed expression language for formulas embedded in other applications. A program is checked completely before it runs, and it runs in a bounded amount of time and memory, so it can come from an untrusted author.

This document defines the language, independently of any implementation. The API that a host uses to compile and run programs is specified separately.

The key words MUST, MUST NOT, SHOULD and MAY are used as in RFC 2119. Sections marked _Informative_ are not part of the specification. Everything else is.

## 1. Overview

```
tax ?= 0.21
discount ?= 0

lines = for item in order.items then { ...item, total: item.price * item.quantity }
subtotal = for line in lines into sum = 0 then sum + line.total
total = subtotal * (1 - discount) * (1 + tax)

{ lines, total, label: "Total for #{order.customer.name}: #{FIXED(total, 2)}" }
```

A program is a sequence of statements. Each one binds a name or computes a value, and the last one is the result. Names are bound once. Values never change. There is no `null`, no user-defined function, and no implicit conversion. Numbers are decimal, so `0.1 + 0.2 == 0.3`.

Every program goes through the same stages: lex, parse, desugar, check, optimize, evaluate. The first five happen once, at compile time, and report every problem they find. Evaluation can fail only for reasons no check can rule out.

## 2. Conformance

An implementation conforms if, for every program and set of inputs:

- it reports a program as invalid exactly when this document makes it invalid, and reports at least one of its errors, with the codes of [Appendix B](#appendix-b-error-codes), unless it exceeds a budget of [section 11](#11-limits), and
- it gives a valid program the value this document defines, or fails with the error code this document defines, unless it exceeds a budget of [section 11](#11-limits).

Warnings are not part of conformance, and an implementation MAY report more or fewer of them. The conformance suite is the test of these requirements. It is plain data, so it runs against any implementation, and its invalid programs contain one error each.

### Stability

A valid program MUST keep its meaning in every release of language version 3. The only exception is a fix that brings an implementation in line with this document. Stored formulas depend on this.

The one input to meaning that this document does not pin is the version of Unicode, which [identifiers](#34-identifiers) and the functions `UPPER`, `LOWER` and `TRIM` depend on. Newly assigned characters can change those results.

## 3. Lexical structure

### 3.1 Source text

A program is a sequence of Unicode scalar values. An unpaired surrogate is an `invalid-character` error. One U+FEFF at the very start is ignored.

Tokens are matched left to right, and each token is the longest one possible.

- **White space** is U+0020 and U+0009. It separates tokens and has no other meaning.
- **A line break** is U+000A, U+000D, or U+000D followed by U+000A. See [Statements](#51-programs-and-statements).
- **A comment** starts with `//` and runs to the next line break.

Any other character outside a string or comment that begins no token is an `invalid-character` error.

### 3.2 Keywords

```
if  then  else  for  in  when  into  true  false
```

These are reserved too, and have no meaning in this version:

```
null  let  fn  match
```

Keywords and reserved words cannot be identifiers. They can be [field names](#54-records).

### 3.3 Punctuators

```
+  -  *  /  %  ^  !  =  ?=  ==  !=  <  >  <=  >=
&&  ||  ??  |>  ..  ..=  ...  .  ,  ;  :  ?
(  )  [  ]  {  }
```

### 3.4 Identifiers

```
identifier = ( XID_Start | "_" ) { XID_Continue } ;
```

`XID_Start` and `XID_Continue` are the Unicode properties. Identifiers are compared after normalization to NFC, and are case-sensitive. A name written as an identifier, whether of an input or a field, is its NFC form, and a host's keys must match that exactly. An identifier has at most 1024 code points, counted as written in the source.

### 3.5 Numbers

```
number   = integer [ "." digits ] [ exponent ] ;
integer  = "0" | nonzero { [ "_" ] digit } ;
digits   = digit { [ "_" ] digit } ;
exponent = ( "e" | "E" ) [ "+" | "-" ] digits ;
digit    = "0" | nonzero ;
nonzero  = "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" ;
```

A `.` belongs to a number only if a digit follows it, so `1..5` is a range.

These are `invalid-number` errors:

- a malformed number, such as `007`, `1__0` or `1_`
- a number directly followed by an identifier character, such as `3x` or `1e`
- a number directly followed by a `.` that does not begin `..`, such as `5.`, `1.e5` or `5.x`
- a `.` directly followed by a digit that does not belong to a number, such as `.5`, `x.5` or `1 .5`

A literal denotes its exact value, which MUST be a [number](#41-numbers). A literal with more than 34 significant digits is an `invalid-number` error, as is one out of range. Leading zeros and trailing zeros are not significant: `1.50` has two significant digits.

### 3.6 Strings

A string is written between double quotes, and can span lines. A line break in a string is part of its value, as written.

| Escape     | Meaning                                                    |
| ---------- | ---------------------------------------------------------- |
| `\"`       | `"`                                                        |
| `\\`       | `\`                                                        |
| `\#`       | `#`                                                        |
| `\n`       | U+000A                                                     |
| `\r`       | U+000D                                                     |
| `\t`       | U+0009                                                     |
| `\u{H...}` | The scalar value with that hexadecimal code, 1 to 6 digits |

Any other escape is an `invalid-escape` error, and so is a `\u{...}` that is not a scalar value. A string that does not end is an `unterminated-string` error, and so is the end of the source inside an interpolation.

`#{` starts an interpolation, which runs to its matching `}` and contains an expression. A `#` not followed by `{` is an ordinary character. Strings can nest inside an interpolation:

```
"Total: #{FIXED(total, 2)}"
"#{if paid then "paid" else "due"}"
```

## 4. Values and types

Every value has one of these types. All values are immutable.

### 4.1 Numbers

`number` is the only numeric type. A number is a decimal value `c × 10^q`, where `c` is an integer with `|c| < 10^34` and `-6176 ≤ q ≤ 6111`. That is the value set of IEEE 754 decimal128, without its negative zero, infinities and `NaN`.

A number is its value. `1.5`, `1.50` and `15e-1` are the same number, and have the same [text form](#47-text-form-of-a-number).

An **integer** is a number with no fractional part.

#### Rounding

Every arithmetic result is the exact mathematical result, rounded once to a number:

1. Round it to 34 significant digits, half to even. If the magnitude of that is at least `1e-6143`, that is the candidate.
2. Otherwise the candidate is the exact result rounded to a multiple of `1e-6176`, half to even, which can be zero.
3. If the magnitude of the candidate exceeds `9.999999999999999999999999999999999e6144`, fail with `overflow`.

This applies to irrational results too, so a result is the same in every conforming implementation.

_Informative:_ for `+`, `-`, `*` and `/`, this is the rounding of Python's `decimal` with `prec=34`, `Emax=6144`, `Emin=-6143` and `ROUND_HALF_EVEN`. Python's `**` is not correctly rounded in every case, so it is no reference for `^`.

_Informative:_ a power is computed with extra digits, adding more until the rounding is decided. A result that is not exact is irrational or has too many digits to be a tie, so that ends. An exact tie, as in `6.2500000002500000000025 ^ 1.5`, which is `15.625000000937500000018750000000125`, has to be recognized first, or the digits would rise forever. With `b = p / q` in lowest terms, it can be exact only if `a` is a perfect `q`-th power. All of this counts against the budget.

```
0.1 + 0.2     // 0.3
4.35 * 100    // 435
10 / 3        // 3.333333333333333333333333333333333
1 / 3 * 3     // 0.9999999999999999999999999999999999
2 ^ 0.5       // 1.414213562373095048801688724209698
```

Division rounds, so `1 / 3 * 3` is not `1`. No finite decimal can hold a third.

### 4.2 Strings

`string` is a sequence of Unicode scalar values. Length and indexes count code points, so `LEN("😀")` is `1`. Strings are not normalized, and two strings are equal only if their code points are.

### 4.3 Booleans

`boolean` has the values `true` and `false`. Booleans are the only values `if`, `when`, `&&`, `||` and `!` accept.

### 4.4 Arrays

`array<T>` is an ordered sequence of values of one type `T`.

### 4.5 Records

A record is a set of fields, each a name and a value. Names are strings, and compare by code point. Field order has no meaning.

A record type lists its fields and their types. It is **closed** if those are all its fields, and **open** if it may have others. It is **uniform** with type `V` if every field it has or might have is of type `V`. A field can be **optional**.

### 4.6 Abstract types

An abstract type is one a host defines, to represent a value from outside the language. See [section 9](#9-abstract-types).

### 4.7 Text form of a number

The text form of a number is what `STR` and interpolation produce. A number with at most 34 digits in plain notation, not counting a sign, a point or the single zero before a point, is written in plain notation with no trailing zeros. Any other is written in scientific notation, as digits with one before the point, then `e`, then the exponent, with no `+`.

```
STR(1.50)      // "1.5"
STR(0.0000001) // "0.0000001"
STR(1e33)      // "1000000000000000000000000000000000"
STR(1e34)      // "1e34"
STR(-1.5e-40)  // "-1.5e-40"
```

Text form is valid literal syntax, apart from a leading `-`. `NUM(STR(x)) == x` holds for every number.

## 5. Syntax and meaning

The grammar in [Appendix A](#appendix-a-grammar) is complete. This section explains it and defines what each construct means.

Expressions evaluate strictly, left to right. The only exceptions are the ones stated: `&&`, `||`, `??`, `if`, and the parts of `for`.

### 5.1 Programs and statements

A program is one or more statements. Its value is the value of its last statement, which MUST be an expression (`missing-result`). An empty program is an `empty-program` error.

Statements are separated by `;` or a line break. Two statements on one line without a `;` are an `unexpected-token` error.

A line break ends a statement if the statement is complete and the next token cannot continue it. So an expression continues onto the next line if that line starts with a binary operator, and also if a line ends with an operator.

`-`, `(` and `[` can continue an expression or start one. They start one if a line break comes before them, unless they are **enclosed**. Code is enclosed inside `()`, `[]`, `{}` and an interpolation, between `if` and its `else`, and between `for` and its `then`.

```
a = 5
-1          // a new statement

b = a
  + 1       // continues

c = a -
  1         // continues

d = (a
  - 1)      // continues
d
```

### 5.2 Bindings

`name = expression` binds `name` to a value.

`name ?= expression` declares an input with a default. If the host supplies `name`, the name has that value, and it MUST have the type of the expression. Otherwise the expression is evaluated, and the name has its value.

A name read but bound nowhere in the program is an input. It is **optional** if every read of it is a step of the path of a `??`, and **required** otherwise. See [Missing values](#56-missing-values). The host MUST supply a required input.

Bindings are statements, so they appear only at the top level of a program. A binding is not an expression, and `a = b = 1` is a syntax error. These rules also apply:

- A name is bound at most once (`duplicate-binding`).
- A name is read only after its binding (`used-before-binding`).
- `=` always means the program's value. A value the host supplies for a name that is not an input of the program is ignored. A name bound with `?=` is an input whether or not it is read.

### 5.3 Literals and names

Reading a name gives its value. An array literal `[a, b, c]` has elements of one type, and `[]` fits any array type. A trailing comma is allowed.

`true`, `false`, numbers and strings evaluate to themselves. A string with interpolations desugars as [section 7](#7-desugaring) says.

### 5.4 Records

```
{ name: "Ana", "tax id": 12, total }
{ ...item, total: item.price * item.quantity }
```

A member is one of:

- `name: expression`. The name is an identifier, a keyword, a reserved word, or a string without interpolation. A string stays as written.
- `name`, which is shorthand for `name: name`, and needs an identifier.
- `...expression`, which adds every field of a record.

Members evaluate in order, and a later field replaces an earlier one of the same name. Two explicit fields of one name are a `duplicate-field` error. A trailing comma is allowed.

`{}` is the record with no fields.

### 5.5 Field access and indexing

`record.name` reads a field. The name is an identifier, a keyword or a reserved word.

`value[index]` depends on the type of `value`:

- **Array or string:** `index` MUST be an integer (`not-an-integer`). Counting starts at 0. A negative index counts from the end, so `-1` is the last. The element of a string is a one-code-point string. Past either end, the access is [missing](#56-missing-values).
- **Record:** `index` is a string. If it is a string literal without interpolation, the access is the same as `.name`. Anything else is a **dynamic** index, and the record MUST be uniform (`type-mismatch`). A dynamic index on a key the record lacks is missing.

```
rates = { AR: 0.21, UY: 0.22 }
rates[country] ?? 0
```

### 5.6 Missing values

A value can be **missing** in four ways: an optional input the host did not supply, an optional field a record does not have, an index past the end, and a key a record does not have. There is no value that stands for "missing".

`path ?? fallback` evaluates `path`. If it is missing, the result is `fallback`, which is evaluated only then. `path` MUST be a **path**: a name, followed by any number of `.field` and `[index]`, with no parentheses around it or around any of its steps. Parentheses inside an `[index]` are ordinary. Anything else is an `invalid-fallback` error, because `??` catches missing values and nothing else.

The steps of a path evaluate left to right, and the first missing step ends the path, so later indexes are not evaluated. Any step can be missing, so `order.customer.tier ?? "none"` works whether `order`, `customer` or `tier` is absent.

The expression inside `[index]` is ordinary code, not a step. An error in it is not caught, and a name or field it reads is an ordinary read.

An index or key that is missing anywhere else fails with `missing-value`.

`path` and `fallback` have one type.

### 5.7 Operators

| Prec. | Operators                   | Assoc. | Operands                                 |
| ----- | --------------------------- | ------ | ---------------------------------------- |
| 1     | `()` `[]` `.`               | left   | See above                                |
| 2     | `^`                         | right  | numbers                                  |
| 3     | `-` `!` (prefix)            | right  | number, boolean                          |
| 4     | `*` `/` `%`                 | left   | numbers                                  |
| 5     | `+` `-`                     | left   | See below                                |
| 6     | `..` `..=`                  | none   | integers                                 |
| 7     | `??`                        | right  | See [Missing values](#56-missing-values) |
| 8     | `==` `!=` `<` `>` `<=` `>=` | left   | See below                                |
| 9     | `&&`                        | left   | booleans                                 |
| 10    | `\|\|`                      | left   | booleans                                 |
| 11    | `\|>`                       | left   | See [Pipes](#510-pipes)                  |

A prefix operator takes its operand at the level of `^`, so `-2 ^ 2` is `-4`. It can follow any operator, so `2 ^ -1 * 3` is `1.5`.

**Arithmetic.** Both operands of an operator have one type.

- `+` adds numbers, joins strings, joins arrays, and applies `add` on an abstract type.
- `-` subtracts numbers, and applies `subtract` on an abstract type.
- `*` and `/` take numbers. `/` fails with `division-by-zero` if the divisor is zero.
- `%` takes numbers. `a % b` is the exact value of `a - b * trunc(a / b)`, rounded once, so the result has the sign of `a`. It fails with `modulo-by-zero` if `b` is zero.
- `^` takes numbers, and is the correctly rounded value of `a` to the power `b`. `0 ^ 0` and `x ^ 0` are `1`. A negative `a` with a `b` that is not an integer fails with `invalid-power`, and so does a zero `a` with a negative `b`.

**Equality.** `==` and `!=` take operands of one type. Numbers, strings and booleans compare by value. Arrays compare element by element, and records by their sets of fields. Abstract types use `equals`, and a type without it cannot be compared.

**Order.** `<`, `>`, `<=` and `>=` take two numbers, two strings, or two values of an abstract type with `compare`. Strings compare by code point, element by element, and a prefix comes first.

**Logic.** `&&` and `||` take booleans. The right operand is evaluated only if the left does not decide the result.

**Ranges.** `a..b` is the array of integers from `a` up to and not including `b`, and `a..=b` includes `b`. Both MUST be integers (`not-an-integer`), which is checked first. `a` MUST NOT exceed `b`, and every element MUST be a number, so `1e34..(1e34 + 20)` is not a range (`invalid-range`).

### 5.8 Conditionals

`if condition then a else b` evaluates `a` or `b`, never both. The condition is a boolean, `else` is required, and `a` and `b` have one type.

`if` and `for` end as far to the right as possible, so what follows the `else` or the `for` body belongs to it:

```
1 + if c then 2 else 3 + 4   // 1 + (if c then 2 else (3 + 4))
```

### 5.9 Loops

```
for x in iterable [when guard] then body
for x in iterable [when guard] into acc = initial then body
```

`iterable` is an array, or a string, whose elements are its code points as one-code-point strings. It is evaluated once, before anything else in the loop.

Without `into`, the loop produces an array: for each element where `guard` holds, the value of `body`.

With `into`, the loop reduces. `initial` is evaluated once, before the first element, and cannot see `x` or `acc`. For each element where `guard` holds, `body` becomes the new `acc`. `body` and `initial` have one type, and the result is the last `acc`. An empty iterable gives `initial`.

`guard` is a boolean, and sees `x` and `acc`. `x` and `acc` exist only in `guard` and `body`.

`x` and `acc` MUST differ, and neither can be a top-level binding, an input of the program, or a variable of an enclosing loop (`duplicate-binding`). A loop encloses only its `guard` and `body`, so `iterable` and `initial` are outside it. Two loops side by side can use the same name, and each is a separate binding.

### 5.10 Pipes

```
value |> F
value |> F(?, 2)
value |> F(?, ?)
```

A step is a function name, or a call with at least one `?`, each a whole argument. `?` is valid nowhere else, and a step with parentheses needs one (`invalid-placeholder`). Parentheses around `?` or a string literal change nothing. `value` is evaluated once, and every `?` receives it. Steps apply left to right.

### 5.11 Functions

`F(a, b)` calls the function `F`. Arguments evaluate left to right. A function name is not a value: functions and variables have separate namespaces, and a function can only be called or used as a pipe step.

The functions available are the [core functions](#10-core-functions) and those the host defines. A host definition replaces a core function of the same name. A name that resolves to neither is an `unknown-function` error, and a wrong number of arguments is a `wrong-argument-count` error.

A function can have optional trailing arguments, and none takes a variable number of them. A signature can list parameters that accept only certain strings. A string literal outside that list is a `type-mismatch` error, and any other expression is checked when the call runs (`invalid-argument`).

## 6. Types

There are no type annotations. The type of every expression is inferred from how it is used, and a program that cannot be given a type is invalid.

### 6.1 Inference

Inference is unification over one program. Each binding has one type for the whole program, and each call instantiates the function's signature afresh. No binding is ever generalized.

Types are finite: unifying a variable with a type that contains it is a `type-mismatch` error. So is any other mismatch.

Inference is a set of constraints, and they have no order: a program has the same outcome in whatever order they are solved. The rules below that wait for a type to be known hold once it is known, wherever in the program that happens. Only [section 6.5](#65-inputs) uses source order, for what is still undecided when nothing else can be solved.

The rules of section 5 say which types must be one type. In particular:

- both branches of an `if` have one type
- the elements of an array have one type
- both sides of `==` have one type, so `1 == "1"` is an error rather than `false`
- `path` and `fallback` of `??` have one type
- a name bound with `?=` has the type of its default

### 6.2 Classes

A type variable can belong to a **class**, a set of types it may become. Unifying narrows the class. An empty class is a `type-mismatch` error. When a variable in `equatable` becomes an array or a record, its element and field types join `equatable`, including fields added later.

| Class          | Types                                                                                                                       | Comes from                         |
| -------------- | --------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| `addable`      | number, string, arrays, abstract types with `add`                                                                           | `+`                                |
| `subtractable` | number, abstract types with `subtract`                                                                                      | binary `-`                         |
| `ordered`      | number, string, abstract types with `compare`                                                                               | `<`, `>`, `<=`, `>=`, `SORT`       |
| `equatable`    | every type, except abstract types without `equals`, and records still open when solving ends, and types that contain either | `==`, `!=`, `CONTAINS`, `INDEX_OF` |
| `showable`     | number, string, boolean, abstract types with `show`                                                                         | `STR`, interpolation               |
| `convertible`  | number, string, boolean                                                                                                     | `NUM`                              |
| `sized`        | string, arrays                                                                                                              | `LEN`, `SLICE`, `for`              |
| `indexable`    | string, arrays, records                                                                                                     | `e[i]`                             |

### 6.3 Indexing, iteration and overloads

`e[i]` puts the container `C` in `indexable`, and relates it to an index `I` and an element `R`. That waits until `C` is known:

| `C`              | `I`      | `R`      |
| ---------------- | -------- | -------- |
| `array<T>`       | `number` | `T`      |
| `string`         | `number` | `string` |
| Uniform with `V` | `string` | `V`      |

An index that is a string, and not a string literal, makes `C` a uniform record. A string literal makes `e[i]` a field read.

`for c in e` puts `e` in `sized`, and waits the same way. An array gives `c` its element type, and a string gives `c` the type `string`.

One container has one element type, even before it is known: every `e[i]` without a string literal index, and every `for` over it, share `R`.

A call of an overloaded function waits until its arguments select one overload. The parameters of an overload resolve together, so `CONTAINS(x, y)` cannot end with `x` a string and `y` a number.

### 6.4 Records

An open record type is a set of known fields and a **row**, a variable that stands for the fields it does not name.

- A record literal has a closed type, unless it spreads an open record.
- Reading a field of a type not yet known makes it an open record with that field.
- Unifying two record types unifies the types of every field they share. A field required on either side is required in the result.
- Two closed types unify only if they have the same fields.
- An open type unifies with a closed type only if the closed type has every field the open one names, required or optional. The open type becomes that closed type.
- Two open types unify into one, with the fields of both and one row.
- A uniform type's `V` unifies with the type of every field of a type it unifies with, and of every field added later.
- Reading a field a closed type does not have is a `type-mismatch` error, even under `??`.

**Spread.** An operand MUST be a record with no optional fields (`type-mismatch`), and spreading a type not yet known makes it a record. The result of a record literal is a record from the start. A spread waits until its operand is closed or [nothing else can be solved](#65-inputs), and a field read from its result waits with it.

A closed operand adds its fields, in any position, and a literal can have any number of them. Later fields replace earlier ones.

An operand still not closed is open:

- It MUST be the first member of its literal, and a literal has at most one (`type-mismatch`).
- The result is open and shares the operand's row. It has the fields the literal sets, with the types of their values, and every other field of it is a field of the operand, with the same type. So a field read from the result that the literal does not set is read from the operand.
- The fields the literal sets place no constraint on the operand, which can have them with any type. If the result then unifies with the result of a spread over another row, the two are one row, so those operands agree on every field, including what the literals hide. So `{ ...a, x: 1 }` and `{ ...b, x: 2 }` can only meet if `a` and `b` have the same fields.
- From then on neither the operand nor the result can be closed: unifying either with a closed type is a `type-mismatch` error.
- The result is uniform with `V` exactly when the operand is uniform with `V` and every field the literal sets is of type `V`. Making the result uniform makes the operand uniform with the same `V`.

### 6.5 Inputs

A name read and never bound is an input, with the type inference gives it.

A name or field read only as a step of the path of a `??` is optional. Any other read makes it required.

A class with one type becomes that type. When nothing else can be solved, the first of these rules that applies is taken, and solving continues:

1. The first waiting spread, in source order, takes its operand as open.
2. The first container or iterable, in source order, with arrays still in its class becomes `array<R>`, where `R` is its element.
3. The first undecided overloaded call, in source order, takes its first overload that fits, in the order its signature lists them.
4. A class that came from `addable`, `subtractable` or `ordered` and contains `number` becomes `number`.

Source order is the order of a node's first token, and for a call written as a pipe step it is the step's. When no rule applies, solving ends. Any type variable left, other than a row, is **generic**: an input of that type can be any type in the class, and all inputs that share the variable have the same one.

A host MAY declare the type of an input, which takes part in inference like any other constraint.

The types of the inputs form the program's **input schema**, which a compiled program exposes to its host.

### 6.6 The boundary

Before any of a program runs, the supplied inputs are checked against its schema. A required input that was not supplied is a `missing-input` error, and that is checked first. Anything that does not match is an `invalid-input` error.

Matching is structural, from the schema down:

- `number`, `string`, `boolean` and an abstract type match values of that type.
- `array<T>` matches an array if every element matches `T`.
- A closed type matches a record with its required fields, any of its optional ones, and no others.
- An open type matches a record with its required fields, and any of its optional ones. Other fields are carried along unread and unchecked, whatever they are.
- A field matches the type of that field. A uniform type matches a record whose fields all match `V`.
- A generic type takes the type of the value: an array's elements have one type, `[]` is `array<T>` for any `T`, and a record has the closed type of its fields. It matches if that type is in the class, and if the types of all values at positions of that variable unify, across all inputs, array elements and fields.

### 6.7 Soundness

A valid program, run on inputs that match its schema and functions that keep their signatures, MUST NOT encounter a value of a type other than the one inferred. An implementation MAY omit runtime type checks on that basis. It SHOULD keep any that cost nothing, so that a defect fails rather than returns a wrong number.

An operation on a generic input is chosen when the program runs, as its type is not known before.

## 7. Desugaring

Desugaring happens before checking. It rewrites two forms. Rewritten nodes keep the location of the form they came from, so a diagnostic points at what the author wrote.

**Pipes.** `v |> F` becomes `F(v)`. `v |> F(a, ?, b)` becomes `F(a, v, b)`. If a step uses `?` more than once, `v` is still evaluated once. Evaluation order follows the rewritten form, except that `v` is evaluated first.

**Interpolation.** `"a#{e}b"` becomes `"a" + STR(e) + "b"`. Empty text pieces are dropped, except that the result always begins with a string, so `"#{e}"` becomes `"" + STR(e)`. This is always the core `STR`, whatever the host defines.

## 8. Compilation

Compilation runs these stages in order, always, on every program:

1. **Lex** the source into tokens.
2. **Parse** the tokens into a tree.
3. **Desugar** the tree.
4. **Check** names and types, as [section 6](#6-types) says.
5. **Optimize** the tree.

A problem in a program is reported as a diagnostic. Compilation reports all the problems it can find, and it succeeds only if none is an error. A failed stage SHOULD NOT stop the report: a parser recovers and continues, and a checker reports every mismatch it can.

A diagnostic has a stable code, a severity, a message and a location. Messages are not stable. The code is.

### 8.1 Optimization

Optimization MUST NOT change what a program does. The result MUST be the same value or the same failure, and functions not declared pure MUST be called the same number of times, with the same arguments, in the same order.

Only pure functions fold. A host declares which of its functions are pure, and every core function is. An operation of an abstract type is host code, and never folds. That covers an operator resolved to one, and a core function that can reach one, such as `SORT` on such values.

### 8.2 Constant failures

A **constant expression** is a literal, a name bound with `=` to a constant expression, an operator, field access or index applied to constant expressions, an array or record literal of constant expressions, or a call of a pure function on constant expressions. `if`, `for`, `??` and anything that can reach an operation of an abstract type are not constant expressions. A missing step in the path of a `??` is not a failure.

An expression **may be skipped** if it is a branch of `if`, the guard or body of `for`, the fallback of `??`, the right operand of `&&` or `||`, the default of `?=`, or an index in the path of a `??`, or is inside one. Every other expression **always runs**, including conditions, iterables and the `initial` of a loop.

A constant expression that always runs and fails is a compile error, with the code it would fail with at runtime. One that may be skipped SHOULD be a warning.

```
x = 1 / 0                    // error: division-by-zero
y = if c then 1 / 0 else 2   // warning, at most
```

Folding is bounded by the compile budget. Running out while folding never fails compilation, and is never a constant failure: folding stops, the expression stays as it is, and any failure in it happens at run time.

## 9. Abstract types

A host defines an abstract type to represent a foreign value, such as a date or an amount of money. A type is built in only if it has literal syntax or the language depends on it, so every other type is abstract. The language privileges none of them.

An abstract type has a name, and a test that says whether a host value belongs to it. It MAY provide any of these operations:

| Operation  | Enables                                 | Signature           |
| ---------- | --------------------------------------- | ------------------- |
| `equals`   | `==`, `!=`, `CONTAINS`, `INDEX_OF`      | `(a, a) -> boolean` |
| `compare`  | `<`, `>`, `<=`, `>=`, `SORT`, `SORT_BY` | `(a, a) -> number`  |
| `add`      | `+`                                     | `(a, a) -> a`       |
| `subtract` | binary `-`                              | `(a, a) -> a`       |
| `show`     | `STR`, interpolation                    | `(a) -> string`     |

`compare` returns a negative number if the first comes first, zero if they are equal, and a positive number if the second comes first. If it is not a consistent order, the result of a sort is whatever the host's order gives.

Using an operator that a type does not provide is a `type-mismatch` error.

An abstract value is opaque. A program can hold one, pass it to functions, keep it in arrays and records, and return it. It has no fields, `.` does not apply to it, and it cannot be indexed. Abstract types have no literals, and no type parameters. Each is a distinct type, even if two are alike: a `usd` and a `eur` cannot be added.

A value that passes more than one type's test, or passes a test while also being a number, string, boolean, array or record, has no single type, and at a generic position it is an `invalid-input` error.

Values of an abstract type come from inputs and from functions. Operations and functions are host code. An implementation MUST meter them and validate what they return, and a failure in one is a `host-error`.

`equals`, `compare` and a type's test MUST NOT fail. Which of these calls a comparison or sort makes is not defined, so if one does fail, whether that surfaces depends on the implementation.

`*`, `/`, `%` and `^` are for numbers only, so that `price * quantity` proves both are numbers.

## 10. Core functions

Core functions are available in every program, with no declaration. Every one is pure. They touch no clock, no random source and no host data.

`T` is any type, and `ordered` and `equatable` are the classes of [section 6.2](#62-classes). Optional arguments are shown in brackets.

### Conversion

| Function | Signature                                 | Result                                                                           |
| -------- | ----------------------------------------- | -------------------------------------------------------------------------------- |
| `STR`    | `(showable) -> string`                    | The text form of a number, `"true"` or `"false"`, a string unchanged, or `show`  |
| `NUM`    | `(number \| string \| boolean) -> number` | A number unchanged, `1` for `true`, `0` for `false`, or a string parsed as below |

`NUM` removes surrounding `White_Space`, then accepts an optional `+` or `-`, the digits of [section 3.5](#35-numbers) with an optional point, with at least one digit on some side of it, and an optional exponent. Separators are not accepted. Anything else, more than 34 significant digits, or a value out of range is an `invalid-argument` error.

### Strings and arrays

In this table `S` is either `string` or `array<T>`.

| Function   | Signature                                                                 | Result                                                                                                                                                                                                          |
| ---------- | ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `LEN`      | `(S) -> number`                                                           | The number of code points or elements                                                                                                                                                                           |
| `SLICE`    | `(S, number, [number]) -> S`                                              | The part from `start` up to and not including `end`, or to the end. Negative positions count from the end, and positions past an end are clamped. Both are integers. It is empty if `start` is not before `end` |
| `CONTAINS` | `(string, string) -> boolean`, `(array<equatable>, equatable) -> boolean` | Whether the substring or element is present                                                                                                                                                                     |
| `INDEX_OF` | `(string, string) -> number`, `(array<equatable>, equatable) -> number`   | The first position, counted in code points or elements, or `-1`                                                                                                                                                 |

The empty string is contained in every string, at position 0.

### Strings

| Function  | Signature                            | Result                                                                                                                                                                                                        |
| --------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `UPPER`   | `(string) -> string`                 | The full `toUppercase` of the Unicode Standard, section 3.13, with no locale tailoring                                                                                                                        |
| `LOWER`   | `(string) -> string`                 | The full `toLowercase` of that section, with `Final_Sigma` and no locale tailoring                                                                                                                            |
| `TRIM`    | `(string) -> string`                 | The string without `White_Space` at either end                                                                                                                                                                |
| `SPLIT`   | `(string, string) -> array<string>`  | The parts between separators, found left to right without overlaps, one more than there are separators, so `SPLIT("", ",")` is `[""]`. An empty separator splits into code points, so `SPLIT("", "")` is `[]` |
| `REPLACE` | `(string, string, string) -> string` | Every occurrence replaced, left to right, without overlaps. The replacement is literal. An empty search is an `invalid-argument` error                                                                        |

### Arrays

| Function  | Signature                                | Result                                                                                                                             |
| --------- | ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `SORT`    | `(array<ordered>) -> array<ordered>`     | Ascending, and stable                                                                                                              |
| `SORT_BY` | `(array<T>, array<ordered>) -> array<T>` | The first array, ascending by the keys in the second, and stable. Different lengths are an `invalid-argument` error, checked first |
| `JOIN`    | `(array<string>, string) -> string`      | The strings, with the separator between them                                                                                       |

```
SORT_BY(items, for i in items then i.price)
```

### Numbers

| Function | Signature                              | Result                                             |
| -------- | -------------------------------------- | -------------------------------------------------- |
| `FLOOR`  | `(number) -> number`                   | The greatest integer not above it                  |
| `CEIL`   | `(number) -> number`                   | The least integer not below it                     |
| `ROUND`  | `(number, [number], [mode]) -> number` | Rounded to `digits` places, as below               |
| `FIXED`  | `(number, number, [mode]) -> string`   | Rounded, then written with exactly `digits` places |

`digits` is an integer. It defaults to 0 in `ROUND`, and can be negative there to round to tens, hundreds and so on. In `FIXED` it is not negative. `FIXED` always uses plain notation.

`mode` is one of these strings. The default is `"half_away"`.

| Mode          | Meaning                                | `2.5` | `-2.5` |
| ------------- | -------------------------------------- | ----- | ------ |
| `"half_away"` | To nearest, ties away from zero        | `3`   | `-3`   |
| `"half_even"` | To nearest, ties to the even neighbour | `2`   | `-2`   |
| `"floor"`     | Toward negative infinity               | `2`   | `-3`   |
| `"ceil"`      | Toward positive infinity               | `3`   | `-2`   |
| `"trunc"`     | Toward zero                            | `2`   | `-2`   |

```
ROUND(1.005, 2)    // 1.01
ROUND(1234, -2)    // 1200
FIXED(1.1, 2)      // "1.10"
FIXED(-2.5, 0)     // "-3"
```

A core function fails with `invalid-argument` if an argument breaks a requirement of this section, including an integer requirement. `ROUND` can also fail with `overflow`.

## 11. Limits

These limits are part of the language, so a program valid on one implementation is valid on all of them:

| Limit                     | Value  | Code                  |
| ------------------------- | ------ | --------------------- |
| Nesting                   | 256    | `too-deep`            |
| Height of the parsed tree | 1024   | `too-deep`            |
| Length of an identifier   | 1024   | `identifier-too-long` |
| Depth of a type           | 256    | `type-too-large`      |
| Size of a type            | 65,536 | `type-too-large`      |

**Nesting** counts open `()`, `[]`, `{}` and `#{ }`, and an `if` until its `else` and a `for` until its `then`. So an `else if` chain does not nest.

**Height** is measured before desugaring. A leaf is 1. Every operator, pipe step, field access, index, call, array, record, `if` and `for` is 1 more than its tallest child. Parentheses add nothing. A string with interpolations counts as its desugared chain of `+`, in which each `STR` counts as a call.

**The size of a type** is its node count written out in full, however much of it is shared, and its **depth** is the same count along the longest path. A leaf, including a type variable, is 1. `array<T>` and a record each add 1. A row and a field name add nothing, and the `V` of an open uniform type counts as one more field.

Evaluation is bounded. An implementation MUST stop any program that exceeds its budget, with `limit-exceeded`, before the program can exhaust time or memory. Compilation is bounded in the same way, so that no source text can make it run away, and outside folding it fails with the same code. The size of a budget, and what each operation costs, are the implementation's to define and the host's to configure. Budgets are the one case where two implementations can differ.

A program can have values far larger than the work that built it, as arrays and records can share parts. Budgets MUST account for that.

## Appendix A: Grammar

The notation is EBNF: `{ x }` is zero or more, `[ x ]` is optional. Terminals are in quotes. `identifier`, `number` and `string` are defined in [section 3](#3-lexical-structure). `[no break]` means no line break may come before the next token, unless it is [enclosed](#51-programs-and-statements).

```
program     = { separator } statement { separator { separator } statement } { separator } ;
separator   = ";" | line break ;
statement   = binding | expression ;
binding     = identifier ( "=" | "?=" ) expression ;

expression  = or { "|>" step } ;
step        = identifier [ [no break] "(" [ args ] ")" ] ;

or          = and { "||" and } ;
and         = compare { "&&" compare } ;
compare     = coalesce { compare_op coalesce } ;
compare_op  = "==" | "!=" | "<" | ">" | "<=" | ">=" ;
coalesce    = range [ "??" coalesce ] ;
range       = add [ ( ".." | "..=" ) add ] ;
add         = mul { ( "+" | [no break] "-" ) mul } ;
mul         = unary { ( "*" | "/" | "%" ) unary } ;
unary       = ( "-" | "!" ) unary | power ;
power       = postfix [ "^" unary ] ;
postfix     = primary { [no break] "[" expression "]" | "." field_name } ;

primary     = number | string | "true" | "false"
            | identifier | call | array | record
            | "(" expression ")" | if | for | "?" ;
call        = identifier [no break] "(" [ args ] ")" ;
args        = expression { "," expression } [ "," ] ;
array       = "[" [ args ] "]" ;

record      = "{" [ member { "," member } [ "," ] ] "}" ;
member      = field_key ":" expression | identifier | "..." expression ;
field_key   = field_name | plain_string ;
field_name  = identifier | keyword ;

if          = "if" expression "then" expression "else" expression ;
for         = "for" identifier "in" expression
              [ "when" expression ]
              [ "into" identifier "=" expression ]
              "then" expression ;
```

`keyword` is any word of [section 3.2](#32-keywords). `plain_string` is a string with no interpolation.

A `binding` is chosen over an `expression` when the token after an identifier is `=` or `?=`, with or without a line break between them.

The grammar accepts some things the language rejects. The left operand of `??` must be a path, as [section 5.6](#56-missing-values) says. `?` is valid only as a whole argument of a pipe step, and a pipe step with parentheses needs at least one.

## Appendix B: Error codes

Codes are stable, and part of the language.

### Compile time

| Code                   | Stage | Meaning                                                                                    |
| ---------------------- | ----- | ------------------------------------------------------------------------------------------ |
| `invalid-character`    | Lex   | A character that begins no token                                                           |
| `invalid-number`       | Lex   | A malformed number, or one that cannot be represented                                      |
| `invalid-escape`       | Lex   | An unknown escape, or a `\u{...}` that is no scalar value                                  |
| `unterminated-string`  | Lex   | A string that does not end                                                                 |
| `identifier-too-long`  | Lex   | More than 1024 code points                                                                 |
| `unexpected-token`     | Parse | A token the grammar does not allow here                                                    |
| `empty-program`        | Parse | No statements                                                                              |
| `too-deep`             | Parse | Past a nesting or height limit                                                             |
| `invalid-placeholder`  | Parse | `?` anywhere but as a whole argument of a pipe step, or a step with parentheses and no `?` |
| `invalid-fallback`     | Parse | The left of `??` is not a path                                                             |
| `duplicate-field`      | Parse | Two explicit fields of one name in a record literal                                        |
| `missing-result`       | Check | The last statement is a binding                                                            |
| `duplicate-binding`    | Check | A name bound twice, or a loop name already in use                                          |
| `used-before-binding`  | Check | A name read before its binding                                                             |
| `unknown-function`     | Check | A call of a function that does not exist                                                   |
| `wrong-argument-count` | Check | Too few or too many arguments                                                              |
| `type-mismatch`        | Check | Types that do not unify, including a field a closed record does not have                   |
| `type-too-large`       | Check | A type past the depth or size limit                                                        |
| `limit-exceeded`       | Any   | The compile budget ran out                                                                 |

A constant failure ([section 8.2](#82-constant-failures)) is reported with its runtime code.

### Run time

| Code               | Meaning                                                                      |
| ------------------ | ---------------------------------------------------------------------------- |
| `missing-input`    | A required input was not supplied                                            |
| `invalid-input`    | A supplied input does not match the input schema                             |
| `division-by-zero` | `/` by zero                                                                  |
| `modulo-by-zero`   | `%` by zero                                                                  |
| `overflow`         | A result beyond the largest number                                           |
| `invalid-power`    | A negative base with a non-integer exponent, or zero to a negative power     |
| `not-an-integer`   | An index or range bound that is not an integer                               |
| `invalid-range`    | A range whose start exceeds its end, or with an element that is not a number |
| `missing-value`    | An index or key that is missing outside the path of a `??`                   |
| `invalid-argument` | A core function rejected an argument                                         |
| `host-error`       | A host function or operation failed                                          |
| `limit-exceeded`   | The evaluation budget ran out                                                |

### Warnings

Warnings do not stop a program. A host MAY treat them as errors.

| Code                 | Meaning                                                           |
| -------------------- | ----------------------------------------------------------------- |
| `unused-binding`     | A name that is never read                                         |
| `unused-statement`   | An expression statement, other than the last, whose value is lost |
| `constant-condition` | A condition that is always true or always false                   |
| `never-missing`      | The left of `??` can never be missing                             |
| `may-fail`           | A constant failure in code that may not run                       |
