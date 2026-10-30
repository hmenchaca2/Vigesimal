# Design decisions

Vigesimal targets repeated flat records in LLM input, not arbitrary JSON.
Positional rows remove repeated keys; dictionaries can shorten recurring values.

## Correctness before minimum size

New blocks include type metadata so numeric-looking identifiers and booleans do
not require guesses. This adds tokens. The analyzer makes that cost visible and
falls back to compact JSON when the full block is not smaller.

## Measure rather than promise

Dictionary payoff is a heuristic using a placeholder code. Complete-block counts
are authoritative under the selected tokenizer. Character estimates are labeled.
Neither token counts nor lossless decoding establish model task accuracy.

## Alternatives

- Compact JSON is universal and often best for small, nested, or mixed payloads.
- Standard CSV is efficient for flat text tables, but needs an external convention
  to distinguish JSON types and null from empty strings.
- Official TOON supports quoting and lossless JSON representation. Historical
  comparisons here used a custom TOON-style approximation, not the official SDK.
  Compare the pinned official library in current benchmarks.
- Vigesimal adds typed headers and payoff-gated dictionaries, with explicit
  limitations and fallback. It does not claim universal superiority.

Session deltas are experimental transport shorthand. Retained-history costs,
resynchronization and downstream task quality need separate evaluation.

## Exported but undocumented: the adaptive/session layer

`AdaptiveCompressor`, `SchemaRegistry`, `VigesimalVerifier`, and `selectPanels`
are public exports with their own tests, but no stable, documented contract.
`AdaptiveCompressor.createSession()` tracks state turn-by-turn and emits either
a full block (on reset) or a delta string (`encodeDelta`); nothing in the
library reconstructs session state from that stream — a caller must apply
`applyDelta` (for the delta case) or `decode` (for the reset case) itself.
Treat this layer as internal/experimental until it has its own design writeup;
it may change shape without a semver-major bump until then.
