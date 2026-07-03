# Vigesimal

**Token-efficient serialization for LLM context.** Flat, repeated records — query results, agent state, tool output — encoded in a compact block the model reads at least as accurately as JSON, at a fraction of the tokens.

## Show me in 30 seconds

Input JSON:

```json
[
  { "id": 1, "department": "Engineering", "role": "Senior", "active": true },
  { "id": 2, "department": "Engineering", "role": "Junior", "active": false },
  { "id": 3, "department": "Engineering", "role": "Senior", "active": true }
]
```

Vigesimal:

```
## employees: 3 rows
fields: id,department,role,active
codes: D1=Engineering
bool: 1=yes 0=no  null: _

1,D1,Senior,1
2,D1,Junior,0
3,D1,Senior,1
```

Why it's smaller: field names are declared once, not per record; repeated values earn short dictionary codes — but only when a token-payoff rule proves the code saves more than its declaration costs; booleans and nulls collapse to single glyphs. Values with commas are properly quoted, so unlike naive CSV the block decodes losslessly.

```ts
import { encode, decode } from 'vigesimal'

const block = encode(records, { name: 'employees' })
const back  = decode(block)
```

## Benchmark results

Measured on claude-haiku-4-5 with 179 retrieval/aggregation/filtering questions across 6 datasets (methodology, raw per-question results, and threats to validity in [BENCHMARK.md](BENCHMARK.md)):

| Encoder | Accuracy | Avg tokens | Efficiency (acc/token) |
|---|---|---|---|
| **vigesimal v1 (this release)** | **63.7%** | **1,888** | **0.296** |
| [TOON](https://github.com/toon-format/toon)-style CSV | 63.1% | 1,901 | 0.287 |
| json_compact | 56.4% | 3,253 | 0.155 |
| json_pretty | 54.2% | 5,005 | 0.091 |

The headline: **vigesimal edges out TOON-style CSV on accuracy, tokens, and efficiency simultaneously**, while remaining lossless where bare CSV is ambiguous. Against JSON the gap is larger: on this flat-structured benchmark, verbose JSON both cost ~2.7× the tokens *and* scored ~9 points lower — the model appears to lose signal in the structural noise. (Scope honestly stated: flat tabular data, two models tested. The vigesimal-over-TOON ranking replicates on claude-sonnet-5 — 59.2% vs 57.0% accuracy at fewer tokens; see BENCHMARK.md for the full cross-model table and limitations.)

## Installation

```bash
cd vigesimal
npm install
npm run build
```

## Usage

### Happy path

```ts
import { encode, decode, inferSchema } from 'vigesimal'

const block = encode(users, { name: 'users' })     // schema inferred
const rows  = decode(block)                         // numeric columns coerced

// Exact round-trip (booleans included): keep the schema
const schema = inferSchema('users', users)
const exact  = decode(encode(users, { name: 'users', schema }), schema)
```

### Session deltas for agent state

```ts
import { SchemaRegistry, AdaptiveCompressor } from 'vigesimal'

const registry = new SchemaRegistry()
registry.infer('agentState', [initialState])
const session = new AdaptiveCompressor(registry).createSession('agentState')

session.compress({ tier: 'free', step: '1/5', status: 'ok' })
// → full block:  ## agentState: 1 rows ...

session.compress({ tier: 'free', step: '2/5', status: 'ok' })
// → delta only:  ~step=2/5
```

The built-in `DeltaTracker` fires typed resets (`session_start`, `tier_upgrade`, `drift_exceeded`, …) and re-baselines automatically when the state churns too much for deltas to stay worthwhile.

### Verify and decode

```ts
import { decodeTabular, decodeDelta, VigesimalVerifier } from 'vigesimal'

const records = decodeTabular(encoded, schema)      // lossless round-trip
const changes = decodeDelta('~step=3/5', schema)    // { step: '3/5' }
const check   = new VigesimalVerifier().verify(encoded, original, schema)
```

### Real-tokenizer payoff decisions

By default the code-dictionary payoff rule uses a chars/4 estimate. For exact decisions, plug in a real tokenizer:

```ts
import { getEncoding } from 'js-tiktoken'

const enc = getEncoding('o200k_base')
encode(users, { name: 'users', est: (s) => enc.encode(s).length })
```

## Use cases

**Agent state across turns.** An agent loop that re-injects its full state every turn pays for the same tokens dozens of times. Encode once, then send only `~step=3/5,~status=ok` deltas.

**Tool output compression.** A 50-row query result that costs ~6,400 tokens pretty-printed fits in ~2,000 as a vigesimal block — and the model answers retrieval questions over it at least as accurately.

**RAG over structured data.** When retrieved chunks are tabular (catalogs, order histories, log excerpts), vigesimal fits roughly 2.5× more records into the same context budget than pretty JSON.

**Multi-agent handoffs.** The block is self-describing — header and legend travel with the data, so the receiving agent needs no side-channel schema.

**Batch pipelines.** Token savings scale linearly with volume; a 60% reduction on a high-volume labeling pipeline is real money.

**When *not* to use it:** deeply nested or heterogeneous JSON (the format is optimized for flat, repeated records — flatten selected fields or split nested sections into separate blocks, and keep original JSON for complex trees); one-off tiny payloads (header overhead outweighs savings below ~3 rows); and aggregation-heavy tasks (models are bad at arithmetic over *any* serialization — ours included; do the math in code and send results).

## The Maya inspiration

The name comes from the Maya **vigesimal (base-20)** number system — one of history's most token-efficient writing systems. The Maya wrote enormous values with three symbols (a dot, a bar, and a shell for zero) and positional notation; scribes swapped long syllabic spellings for single logograms when a word appeared often.

The format borrows all three ideas: dictionary codes use 19 base-20 digits (`1-9`, `A-J`) per field; rows are positional (meaning comes from *where* a value sits, declared once in the header); `_`, `1`, `0` are the single-glyph shell/dot equivalents for null and booleans; and frequent values earn their own glyph — but only when the payoff rule proves the glyph pays for itself.

## Documentation

- [BENCHMARK.md](BENCHMARK.md) — full methodology, exact prompts, scoring, raw results, threats to validity
- [docs/format.md](docs/format.md) — wire-format grammar: quoting, collision rules, delta semantics, edge cases
- [docs/design.md](docs/design.md) — why these choices: the payoff rule, 19 codes, tradeoffs vs CSV/JSON/TOON

## Repository layout

- `vigesimal/` — the TypeScript library (this is what you `import`)
- `benchmark/` — Python harness measuring token counts *and* model comprehension across encoders
- `tokenizer-bench/` — js-tiktoken micro-benchmarks used to design the format
- `evals/` — evaluation definitions

## License

MIT
