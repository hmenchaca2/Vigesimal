# Vigesimal v1 — Wire Format Reference

## Tabular block

```
## <name>: <N> rows
fields: f1,f2,f3
codes: D1=Engineering L1="New York"        (omitted when no value qualifies)
bool: 1=yes 0=no  null: _

<row>
<row>
```

- **Header line** — `## <name>: <N> rows`. An empty dataset is exactly `## <name>: 0 rows\n` with no further lines.
- **fields** — comma-separated field names, declared once. Rows are positional; the field union across all records is used (first-seen order), so sparse records are supported.
- **codes** — space-separated `CODE=value` pairs. A code is one uppercase letter (derived from the field name; collisions resolved by the next distinct letter) plus one base-20 digit (`1-9`, `A-J`) — max 19 codes per field. Values containing a space, `=`, `,`, or `"` are CSV-quoted: `L1="New York"`.
- **legend** — always `bool: 1=yes 0=no  null: _`.
- **blank line**, then one CSV row per record.

## Scalars

| Value | Wire form |
|---|---|
| `true` / `false` | `1` / `0` |
| `null` / absent field | `_` |
| number | literal (`42`, `3.5`, `0`) |
| string | literal; CSV-quoted (RFC-4180-style, `""` escapes a quote) when it contains `,`, `"`, or a newline |

Decode is **schema-aware**: `1`/`0` decode to booleans only when the field's type says so; numeric fields parse to numbers; everything else stays a string. `_` is null for every type.

## Dictionary substitution and collisions

In a row, an **unquoted** token matching an assigned code (e.g. `D1`) decodes to its dictionary value. A literal data value that happens to equal an assigned code in the same field is emitted **quoted** (`"D1"`) so it stays distinguishable. Quoted tokens are never dictionary-resolved.

## The payoff rule

A value earns a code only when:

```
occurrences × (est(value) − est(code)) > est(" X1=" + quoted_value)
```

`est` is a token estimator — chars/4 by default, or a real tokenizer via the
pluggable estimator. Code and declaration costs use the fixed placeholder
`X1`; the real letter is assigned after payoff decisions, so per-letter
tokenization differences are deliberately ignored. When more than 19 values
qualify, the 19 highest-payoff values win. Numbers, booleans, and nulls are
never coded.

## Delta blocks (sessions)

```
~step=3/5,~status=ok        changed fields only, keyed
~old_field=_                deletion / set-to-null
~                            empty delta (no changes)
```

Values follow the same scalar rules (CSV-quoted when needed; the pair splitter respects quotes). Deltas are keyed rather than positional so a dropped field is explicit. Note: `_` conflates "set to null" with "deleted" — a known limitation.

## Config blocks (nested dicts)

```
## <name>
bool: 1=yes 0=no  null: _

database.host: db.example.com
features.dark_mode: 1
```

Flat dotted-key lines; no code table (config values rarely repeat).

## Known edge cases

- List-valued leaves in config blocks stringify via `String(v)` — not round-trippable; flatten or JSON-encode them yourself.
- Empty nested dicts produce no output line.
- Without a schema, `decode()` coerces all-numeric columns to numbers; booleans decode as `1`/`0` numbers. Keep the schema for exact round-trips.
