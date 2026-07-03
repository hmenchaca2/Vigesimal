# Design Notes — why the format looks like this

## Design history in one paragraph

Earlier iterations (v3 internally) used Unicode delimiters (`⟨⟩·`) and symbolic scalars (`+`/`-` for booleans). Benchmarking killed both: `⟨` and `⟩` tokenize to **3 tokens each** in o200k_base — a 6-token bracket tax per tuple — and the symbol legend measurably hurt model comprehension (structure-aware questions dropped ~17 points when the header carried branding the model misparsed). The released format (internally v4, shipped as v1) is deliberately boring on the surface — CSV rows, plain-English header — with the novelty concentrated where it pays: the dictionary and the deltas.

## Why CSV rows

Models are pretrained on enormous amounts of CSV-like text. Positional rows with single-token delimiters (`,`) are both the cheapest and the most natively readable encoding for flat records. The benchmark showed compressed tabular formats *beat* verbose JSON on accuracy — the model loses signal in JSON's structural noise.

## Why a payoff-gated dictionary (and not always-on codes)

Dictionary codes are the one lever CSV-style formats don't have. But a code declaration costs header tokens, so unconditional substitution loses on low-repetition data — an early iteration declared 19 codes for values appearing 2–3 times and *lost* to plain CSV on token count. The payoff rule (`saved > declared`) makes compression self-justifying, and accepts a pluggable real tokenizer for exact decisions. On a cache miss the estimator throws rather than silently blending cost models.

## Why 19 codes per field

Codes are one letter + one base-20 digit (`1-9`, `A-J` — the Maya "score" minus zero). One-token codes stop paying off past two characters, and per-field letters keep codes mnemonic (`D1` = a department). In practice fields rarely have more than a handful of high-frequency values; the cap has never bound on real datasets.

## Why `1`/`0`/`_` scalars

Single tokens, pretraining-native (`1`/`0` are truthy/falsy everywhere), and no legend lookup required. The earlier `+`/`-` symbols required the model to consult the legend and collided visually with signed numbers.

## Why the header has no format branding

The model reads `## VIG4 employees` and answers "VIG4 employees" when asked the dataset name — measured, five benchmark questions lost. The header is `## <name>: <N> rows`; the format identifies itself by shape, not by name.

## Tradeoffs vs the alternatives

| vs | Vigesimal wins | Vigesimal loses |
|---|---|---|
| pretty JSON | ~62% fewer tokens; higher measured accuracy | JSON is universal, nested, schemaless |
| compact JSON | ~40% fewer tokens; higher accuracy | same |
| TOON / bare CSV | lossless (quoting, code-collision handling); dictionary compression; delta transport | TOON's rows are marginally cheaper on comma-heavy text because it doesn't quote — at the cost of ambiguity |
| MessagePack et al. | text-native — models can read it; binary formats tokenize catastrophically | binary wins machine-to-machine |

## Deltas: keyed, not positional

Positional deltas (`~[|3/5|]`) were rejected: unreadable for models and humans, and silent on field deletion. Keyed pairs (`~step=3/5`) cost a few more tokens and eliminate both problems. Known limitation: `_` conflates deletion with set-to-null; an `applyDelta` helper with explicit tombstones is future work.
