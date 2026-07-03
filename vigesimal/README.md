# vigesimal

**Token-efficient serialization for LLM context.** Flat, repeated records — query results, agent state, tool output — encoded in a compact block the model reads at least as accurately as JSON, at a fraction of the tokens.

```json
[
  { "id": 1, "department": "Engineering", "role": "Senior", "active": true },
  { "id": 2, "department": "Engineering", "role": "Junior", "active": false }
]
```

becomes

```
## employees: 2 rows
fields: id,department,role,active
codes: D1=Engineering
bool: 1=yes 0=no  null: _

1,D1,Senior,1
2,D1,Junior,0
```

Field names declared once; repeated values earn short dictionary codes only when a token-payoff rule proves they save more than they cost; booleans and nulls collapse to single glyphs. Lossless — proper CSV quoting and code-collision handling, unlike bare CSV.

**Benchmark-validated on two Claude models**: beats TOON-style CSV on accuracy *and* tokens (63.7% vs 63.1% at fewer tokens on claude-haiku-4-5; 59.2% vs 57.0% on claude-sonnet-5), and uses ~62% fewer tokens than pretty JSON while scoring ~9 points higher. Full methodology and raw per-question results: [BENCHMARK.md](https://github.com/hmenchaca2/Vigesimal/blob/main/BENCHMARK.md).

## Install

```bash
npm install vigesimal
```

## Usage

```ts
import { encode, decode, inferSchema } from 'vigesimal'

const block = encode(users, { name: 'users' })   // schema inferred
const rows  = decode(block)                      // numeric columns coerced

// Exact round-trip (booleans included): keep the schema
const schema = inferSchema('users', users)
const exact  = decode(encode(users, { name: 'users', schema }), schema)
```

### Session deltas for agent state

Send full state once, then only what changed each turn:

```ts
import { SchemaRegistry, AdaptiveCompressor } from 'vigesimal'

const registry = new SchemaRegistry()
registry.infer('agentState', [initialState])
const session = new AdaptiveCompressor(registry).createSession('agentState')

session.compress({ tier: 'free', step: '1/5', status: 'ok' })  // full block
session.compress({ tier: 'free', step: '2/5', status: 'ok' })  // "~step=2/5"
```

A drift-aware tracker re-sends the full state automatically when deltas stop paying off.

### Exact token accounting

The dictionary payoff rule defaults to a chars/4 estimate; plug in a real tokenizer for exact decisions:

```ts
import { getEncoding } from 'js-tiktoken'
const enc = getEncoding('o200k_base')
encode(users, { name: 'users', est: (s) => enc.encode(s).length })
```

## When not to use it

Deeply nested or heterogeneous JSON (the format targets flat, repeated records), payloads under ~3 rows (header overhead dominates), and aggregation-heavy prompts (models are bad at arithmetic over any serialization — do the math in code).

## Docs

- [Wire-format reference](https://github.com/hmenchaca2/Vigesimal/blob/main/docs/format.md)
- [Design rationale](https://github.com/hmenchaca2/Vigesimal/blob/main/docs/design.md)
- [Benchmark methodology](https://github.com/hmenchaca2/Vigesimal/blob/main/BENCHMARK.md)

## License

MIT
