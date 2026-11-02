# Conformance suite

The test of `SPEC.md` (at the root of the repository), section 2. It is plain data, so it runs against any implementation.

Each `.jsonl` file holds one case per line, written from the spec rather than from any implementation.

| Field     | Meaning                                                                     |
| --------- | --------------------------------------------------------------------------- |
| `spec`    | The section of `SPEC.md` the case tests                                     |
| `source`  | The program                                                                 |
| `inputs`  | Optional. The inputs, as JSON values. With no field, the host supplies none |
| `value`   | The program is valid, and has this value, in the canonical text below       |
| `error`   | The program is invalid, and this is the code of its one error               |
| `failure` | The program is valid, and fails with this code when evaluated               |

Every case has exactly one of `value`, `error` and `failure`.

## Inputs

A number in `inputs` has at most 15 significant digits. `null` is a host value of no type, which matches nothing, and is not the same as leaving the input out.

## Canonical text

A value is compared as text, so that no number goes through a double:

- A number is its text form, from section 4.7.
- A string is a JSON string: `"` and `\` are escaped, as are control characters, by `\b`, `\f`, `\n`, `\r` and `\t` or else `\u` and four lowercase hexadecimal digits. Nothing else is.
- A boolean is `true` or `false`.
- An array is `[a, b]`, and an empty one `[]`.
- A record is `{"a": 1, "b": 2}`, with its fields in order of code point, and an empty one `{}`. A field carried unread is written the same way, from its JSON value.

No case has an abstract value as its result.

## Running it

- Warnings are not part of conformance, and the cases say nothing about them.
- An invalid program has one error, so a report that includes its code passes, as section 2 asks. A stricter runner can also refuse any other code, as ours does, since each of these programs has nothing else to report.
- Budgets are the implementation's own, so give a program room. A case whose expected code is `limit-exceeded` has a result too large for any budget to pay for. On any other case, `limit-exceeded` means the budget was too small, which section 2 allows, so report it apart from a failure.
- An input past the limit on the size of a type would take a megabyte of data, so the size limit of section 11 has no case at the boundary, and the depth limit does.
- `14-surrogates.jsonl` holds programs with unpaired surrogates, written as JSON escapes. They are only for an implementation whose strings can hold one: a strict JSON parser rejects those lines, and section 3.1 excuses the rest.

## The host

`12-abstract.jsonl` needs two abstract types from the host, and the functions below.

| Function                   | Meaning                                                                                                                                       |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `USD(number) -> usd`       | Pure. An amount, of a type that provides `equals`, `compare`, `add` and `subtract` on amounts, and `show`, which writes `$` and its text form |
| `CENTS(usd) -> number`     | Pure. The amount back                                                                                                                         |
| `OPAQUE(number) -> opaque` | Pure. A value of a type that provides no operation                                                                                            |
| `BOOM() -> number`         | Not pure. It always fails                                                                                                                     |

`packages/littlewing/test/conformance.test.ts` is the runner for this implementation, and a template for others.
