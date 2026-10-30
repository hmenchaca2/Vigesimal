# Vigesimal

**Compact structured data for LLM context.** Shared field headers and dictionary
codes reduce repetition in flat database/API records. Measure your own payload;
keep compact JSON whenever Vigesimal is unsupported or not smaller.

> This checkout contains an unreleased breaking update. New blocks include a
> `types:` header. Read [migration notes](docs/migration.md) before upgrading.
> Published npm behavior may differ. No new model-accuracy claim is made.

## Try it locally

```bash
cd vigesimal
npm ci
npm run build
node bin/vigesimal.mjs analyze ../benchmark/datasets/employee_records.json --tokenizer o200k_base
```

The CLI runs locally without telemetry or API calls. Omit `--tokenizer` for
clearly labeled character-based estimates; use `--json` for the complete report
and selected payload. Pass `-` as the filename to read standard input.

After a release containing the CLI, the equivalent installed command will be
`npx vigesimal analyze results.json`. It is not a promise about the currently
published package. Tokenizer mode requires `js-tiktoken` installed alongside it.

## Evaluate before integrating

```ts
import { analyze } from 'vigesimal'

const report = analyze(records)
console.log(report.format)       // 'vigesimal' or 'json'
console.log(report.reduction)    // selected payload's savings
console.log(report.roundTrip)    // whether Vigesimal was verified
console.log(report.warnings)     // estimates, unsupported shape, fallback
const context = report.output   // use with the explicit format label
```

`analyze()` compares complete payloads, verifies the decoded values, and selects
Vigesimal only when smaller under the supplied counter. It does not predict model
quality, billing, or end-to-end latency. Default counts are estimates.

```ts
import { getEncoding } from 'js-tiktoken'
const tokenizer = getEncoding('o200k_base')
const report = analyze(records, {
  est: text => tokenizer.encode(text, [], []).length,
  tokenizer: 'o200k_base',
})
```

Use the tokenizer appropriate to your model. `o200k_base` is not a Claude token
counter. Counts refer to the encoded data, not the surrounding request or output.

## Encode and decode

```ts
import { encode, decode } from 'vigesimal'
const rows = [{ id: '00123', department: 'Engineering', active: true }]
const block = encode(rows, { name: 'employees' })
const restored = decode(block) // typed header preserves strings and booleans
```

The output declares fields and types once:

```text
## employees: 1 rows
fields: id,department,active
types: string,string,boolean
bool: 1=yes 0=no  null: _

00123,Engineering,1
```

Repeated strings can earn dictionary codes. Literal underscores, empty strings,
newlines, quotes, and assigned-code collisions are escaped. Malformed blocks
and schema mismatches fail explicitly.

## Supported data

- Arrays of plain, flat records with homogeneous types per column.
- Strings, booleans, finite numbers other than negative zero, and null.
- Empty arrays. Missing/undefined fields normalize to null in `encode()`.
- Nested or mixed data is rejected by `encode()`; `analyze()` preserves valid
  JSON through fallback. Sparse records also use JSON fallback to retain shape.

Do not use this as a general JSON replacement, a prompt-injection defense, or
an arithmetic engine. Keep trusted instructions separate from tool content.
Compute aggregations in application code.

## Evidence, not guarantees

[The current serialization benchmark](benchmark/results/current-serialization.md)
compares this TypeScript build, official TOON, compact/pretty JSON, and standard
CSV. It records exact dependencies, content hashes, token counts and local
encoding timings. Nested data is a separate track. CSV checks textual cell
fidelity, not typed JSON round-trips. Run it with `cd vigesimal && npm run benchmark`.

[Historical model evaluations](BENCHMARK.md) used an older format and a custom
TOON-style baseline. The primary recorded accuracy difference was one question
(114/179 vs 113/179), not established superiority. Those numbers do not validate
the new format. Fresh paid quality evaluations remain pending. The
[provider-neutral quality workflow](docs/quality-evaluation.md) can already
freeze randomized requests from the repository fixtures or a private directory
of sanitized real workloads, then score provider responses without an LLM judge.

## Integrate and contribute

- [Runnable tool-output example](vigesimal/examples/tool-output.mjs): prepares a
  request, includes expected results, and reports measured payload savings; no API calls.
- [Wire format](docs/format.md) and [migration](docs/migration.md).
- [Design decisions](docs/design.md).
- [Contributing](CONTRIBUTING.md) and [pilot plan](docs/pilot-plan.md).

Session deltas remain experimental. They require a retained baseline, and
`applyDelta()` to merge a decoded delta back onto it. Do not assume a short
delta guarantees a cheaper or reliable complete conversation.

## Development

```bash
cd vigesimal
npm ci
npm run typecheck
npm run test:run
npm run build
npm run benchmark
node examples/tool-output.mjs
```

The name is inspired by the Maya base-20 number system. The codec itself is
plain text with positional rows and payoff-gated dictionary substitutions.

MIT licensed. See [LICENSE](LICENSE).
