# Vigesimal

Compact structured data for LLM context. Measure repetitive flat records and
keep compact JSON when Vigesimal is unsupported or not smaller.

**Unreleased breaking update:** new blocks include type metadata. Published npm
behavior may differ. See the repository's migration notes before upgrading.

```ts
import { analyze, encode, decode } from 'vigesimal'

const rows = [{ id: '00123', active: true }]
const restored = decode(encode(rows)) // string ID and boolean preserved
const report = analyze(rows)         // estimates by default
console.log(report.format, report.output, report.warnings)
```

Supported: flat records with homogeneous string, boolean, finite-number or null
columns. Negative zero is rejected. `encode` normalizes missing/undefined fields
to null. `analyze` accepts JSON-compatible data and falls back for nested, mixed,
or sparse records so their JSON shape is retained.

For raw JSON text, use `analyze(parseJson(text))` (import `parseJson` from
`vigesimal`). It rejects numeric literals that would change when serialized back
to JSON, including rounded IDs, underflow, overflow, and negative zero. Quote
exact IDs or high-precision decimals as strings. This is decimal round-trip
validation, not arbitrary-precision arithmetic. `analyze` cannot recover digits
already lost by an earlier `JSON.parse` call. The CLI uses this guard by default.

## Local CLI

```bash
npm ci
npm run build
node bin/vigesimal.mjs analyze results.json
node bin/vigesimal.mjs analyze results.json --json --tokenizer o200k_base
```

Tokenizer mode requires `js-tiktoken`. Default counts are character estimates;
complete payload counts do not include surrounding prompts, output, or retries.
The CLI performs no network requests and collects no telemetry. Its `--json`
report includes the payload: do not send that report to public logs.

`analyze` returns `format`, `output`, `encoded`, `supported`, `roundTrip`,
`inputTokens`, `vigesimalTokens`, `outputTokens`, `reduction`, `tokenizer`,
`estimated`, and `warnings`. Only a verified, strictly smaller Vigesimal payload
is selected. Pass `est` and a descriptive `tokenizer` label for another counter.

Legacy blocks without a `types:` line require a schema for typed decoding;
otherwise values remain strings/null. New decoders reject malformed rows and
schema mismatches. Session deltas are experimental and require retained history.

Historical benchmark results do not establish accuracy for this revised format.
See the repository for the current serialization benchmark and limitations.

[Documentation and source](https://github.com/hmenchaca2/Vigesimal). MIT licensed.
