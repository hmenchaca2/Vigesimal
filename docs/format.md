# Typed wire format (unreleased)

```text
## employees: 2 rows
fields: id,department,active
types: string,string,boolean
codes: D1=Engineering
bool: 1=yes 0=no  null: _

00123,D1,1
00124,D1,0
```

The dictionary line is optional and selected by a payoff heuristic. The type line
is required in newly emitted nonempty blocks. Legacy blocks without types are
readable: supply a schema to recover types, or receive strings/null.

An empty dataset is `## <name>: 0 rows\n`. Nonempty datasets require at least
one field. Dataset names cannot contain quotes or control characters. Field
names cannot be empty or contain quotes, commas, equals signs, tildes, or control
characters. Duplicate fields are invalid. Object keys such as `__proto__` are
handled as data, not prototype setters.

## Supported scalars

| Input | Wire form |
|---|---|
| true / false | 1 / 0 in boolean columns |
| null / missing / undefined | _ |
| finite number other than -0 | JavaScript decimal or exponent representation |
| empty string | "" |
| literal underscore | "_" |
| other string | literal, quoted when necessary |

CSV quoting doubles embedded quotes. Quoted strings can contain commas, CR/LF,
and quotes. The decoder scans logical records, not physical lines. Dictionary
values follow the same quoting rule and may span lines. A literal equal to any
assigned block code is quoted, regardless of its column. Only unquoted codes
are substituted; codes cannot appear in numeric/boolean columns.

Columns must have one non-null scalar type. Objects, arrays, symbols, functions,
bigints, nonfinite numbers, negative zero and mixed-type columns are rejected.
Missing and undefined fields normalize to null; this is not a general-purpose
JavaScript object serializer. `analyze` uses JSON fallback for sparse records.

## Validation

Declared row counts, field counts, types, quoting, dictionary declarations and
provided schemas are checked. Extra/missing cells, duplicate declarations,
invalid numbers/booleans, precision-losing numeric literals, and incompatible schemas cause errors. Do not depend
on the older decoder's permissive repair behavior.

## Dictionaries and accounting

Codes are one uppercase letter plus a digit from `1-9A-J`, at most 19 per field
and 26 coded fields. Candidate selection estimates substitution payoff with an
`X1` placeholder. Even a real counter does not make that heuristic an exact
whole-block optimization. `analyze` compares complete output against compact
JSON, so dictionary overhead cannot produce a larger selected payload under
the chosen counter. The analyzer also compares coded and uncoded Vigesimal
blocks and retains the smaller candidate. The low-level encoder retains its
dictionary heuristic; use `analyze` for measured format selection.

Raw JSON entry points reject duplicate object keys, including escaped aliases,
before reporting a verified conversion. Session codices include ordered types
alongside the fields and scalar legend.

## Experimental deltas

`~field=value` pairs use scalar quoting and a caller-supplied schema. Unknown
or duplicate fields are rejected. `~` is an empty delta. `_` still conflates
deletion and setting null. There is no sequence/baseline recovery protocol.
Keep the baseline available and do not treat deltas as self-contained records.

Nested config blocks in historical Python experiments are not part of this
TypeScript API. Keep nested values as JSON rather than silently flattening them.
