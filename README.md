# Vigesimal

**Token-efficient serialization for LLM context — inspired by the Maya vigesimal number system.**

Vigesimal compresses structured data (JSON records, agent state, tool output) into a compact, LLM-native wire format. On our benchmark it uses **~62% fewer tokens than pretty-printed JSON** while being *more* accurately read by the model — and it edges out [TOON](https://github.com/toon-format/toon)-style CSV on accuracy, tokens, and efficiency simultaneously.

```
## employee_records: 50 rows
fields: id,name,department,role,seniority_years,location,salary,active
codes: D1=Engineering D2=Marketing D3=Sales R1=Junior R2=Senior L1=Chicago L2=Austin
bool: 1=yes 0=no  null: _

1,Olivia Wilson,D1,R1,9,NYC,62512,1
2,Carol Johnson,D2,R1,19,NYC,80412,1
3,Ivan Allen,D3,R2,18,SF,75257,0
```

## The Maya inspiration

The Maya built one of history's most token-efficient writing systems for numbers. Their **vigesimal (base-20)** positional system expressed enormous values with three symbols — a dot (1), a bar (5), and a shell (0) — and they were among the first civilizations to use a true zero. A Long Count date spanning thousands of years fits in five compact glyphs.

The same principles drive this format:

- **Base-20 digits.** Dictionary codes use exactly 19 symbols (`1-9`, `A-J`) per field — one Maya-style "score" minus the zero, because a 20th code never pays for itself before the letter changes.
- **Positional economy.** Like Maya positional notation, a value's meaning comes from *where* it sits: rows carry no field names, only positions declared once in the header.
- **The zero-glyph.** The shell glyph gave the Maya a way to say "nothing here" in one symbol. Vigesimal's `_` does the same for null/absent, and `1`/`0` collapse booleans to single glyphs.
- **Glyph substitution.** Maya scribes swapped long syllabic spellings for single logograms when a word appeared often. The `codes:` dictionary does exactly this — `Engineering` becomes `D1`, but only when it appears often enough to earn its glyph (a token-payoff rule decides).

## Why it works (the benefits)

1. **Fewer tokens = lower cost, more context.** ~62% smaller than pretty JSON, ~40% smaller than compact JSON, measurably smaller than TOON-style CSV — across employee records, e-commerce orders, time series, GitHub repos, and event logs.
2. **The model reads it *better*, not worse.** Compressed ≠ cryptic. Benchmarked on claude-haiku-4-5 with 179 retrieval/aggregation/filtering questions: Vigesimal v1 scored **63.7%** accuracy vs 63.1% for TOON and 54.2% for pretty JSON. Verbose JSON actively hurts comprehension.
3. **Lossless, unlike naive CSV.** Values containing commas or quotes are properly quoted; literals that collide with dictionary codes are disambiguated. Everything round-trips — there's a decoder and verifier built in.
4. **Session deltas.** For agent state that changes a little every turn, send only what changed: `~step=3/5,~status=ok`. A drift-aware tracker decides when to re-send the full state.
5. **Honest compression.** Dictionary codes are declared only when a real token-count payoff rule says they save more than they cost. No code spam.

### Benchmark results

| Encoder | Accuracy | Avg tokens | Efficiency (acc/token) |
|---|---|---|---|
| **vigesimal v1 (this release)** | **63.7%** | **1,888** | **0.296** |
| toon | 63.1% | 1,901 | 0.287 |
| early prototype | 58.7% | 2,074 | 0.246 |
| json_compact | 56.4% | 3,253 | 0.155 |
| json_pretty | 54.2% | 5,005 | 0.091 |

*claude-haiku-4-5, 179 questions × 6 datasets. Reproduce with `benchmark/` (needs `ANTHROPIC_API_KEY`, costs ~$0.10 per encoder).*

## Use cases

**Agent state across turns.** An agent loop that re-injects its full state every turn (user tier, workflow step, tool results, flags) pays for the same tokens dozens of times. Encode the state once as a vigesimal block, then send only `~step=3/5,~status=ok` deltas — the `DeltaTracker` re-baselines automatically when the state churns too much.

**Tool output compression.** Database queries, API responses, and search results arrive as verbose JSON arrays. A 50-row query result that costs ~6,400 tokens pretty-printed fits in ~2,000 as a vigesimal block — and the model answers retrieval questions over it *more* accurately.

**RAG over structured data.** When retrieved chunks are tabular (product catalogs, order histories, log excerpts), encoding them vigesimal instead of JSON lets you fit roughly 2.5× more records into the same context budget.

**Long-running conversations with context limits.** Summarize-and-compress checkpoints: encode accumulated session facts as a block, verify the round-trip with `VigesimalVerifier`, and drop the verbose originals from context.

**Multi-agent handoffs.** When one agent passes structured findings to another, the handoff payload is pure token overhead. A compact, self-describing block (header + legend travel with the data) means the receiving agent needs no side-channel schema.

**Batch classification/extraction pipelines.** Sending hundreds of records per prompt for labeling? Token savings scale linearly with volume — at Sonnet input prices, a 60% reduction on a 10M-token/day pipeline is real money.

**When *not* to use it:** deeply nested or heterogeneous JSON (the format is optimized for flat, repeated records), one-off tiny payloads (the header overhead outweighs savings below ~3 rows), and aggregation-heavy tasks (models are bad at arithmetic over *any* serialization — ours included; do the math in code and send results).

## Installation

```bash
cd vigesimal
npm install
npm run build
```

## Usage

### Encode a dataset

```ts
import { SchemaRegistry, AdaptiveCompressor } from 'vigesimal'

const registry = new SchemaRegistry()
registry.infer('users', users)          // infer schema from sample data

const compressor = new AdaptiveCompressor(registry)
const { output, stats } = compressor.compressRecords(users, 'users')

console.log(output)                     // vigesimal block: header + codes + CSV rows
console.log(stats.reduction)            // e.g. 0.58 — 58% estimated token savings
```

### Session deltas for agent state

```ts
const session = compressor.createSession('agentState')

session.compress({ tier: 'free', step: '1/5', status: 'ok' })
// → full block:  ## agentState: 1 rows ... free,1/5,ok

session.compress({ tier: 'free', step: '2/5', status: 'ok' })
// → delta only:  ~step=2/5

session.reset()                         // force a full re-send next turn
```

The built-in `DeltaTracker` fires typed resets (`session_start`, `tier_upgrade`, `drift_exceeded`, …) and re-baselines automatically when the state churns too much for deltas to stay worthwhile.

### Decode and verify

```ts
import { decodeTabular, decodeDelta, VigesimalVerifier } from 'vigesimal'

const records = decodeTabular(encoded, schema)      // lossless round-trip
const changes = decodeDelta('~step=3/5', schema)    // { step: '3/5' }

const check = new VigesimalVerifier().verify(encoded, original, schema)
// { valid: true, errors: [] }
```

### Real-tokenizer payoff decisions

By default the code-dictionary payoff rule uses a chars/4 estimate. For exact decisions, plug in a real tokenizer:

```ts
import { encodeTabular } from 'vigesimal'
import { getEncoding } from 'js-tiktoken'

const enc = getEncoding('o200k_base')
const est = (s: string) => enc.encode(s).length

encodeTabular('users', users, schema, est)
```

## Format reference

| Element | Wire form | Notes |
|---|---|---|
| Header | `## <name>: <N> rows` | dataset name + row count |
| Fields | `fields: a,b,c` | declared once; rows are positional |
| Dictionary | `codes: D1=Engineering L1="New York"` | only values that pay for themselves; max 19 per field |
| Legend | `bool: 1=yes 0=no  null: _` | the whole grammar, one line |
| Row | `1,D1,9,NYC,1` | CSV; RFC-4180-style quoting |
| Delta | `~step=3/5,~status=_` | keyed; `_` = null/deleted |

## Repository layout

- `vigesimal/` — the TypeScript library (this is what you `import`)
- `benchmark/` — Python harness measuring token counts *and* model comprehension across encoders
- `tokenizer-bench/` — js-tiktoken micro-benchmarks used to design the format
- `evals/` — evaluation definitions

## License

MIT
