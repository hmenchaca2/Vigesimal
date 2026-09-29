# Quality evaluation release gate

Status: provider-neutral evaluation preparation is implemented; paid model runs
have not been authorized for the new typed format. The local serialization
benchmark does not measure LLM comprehension, production cost, or latency.

## Prepare a frozen run

```bash
cd vigesimal
npm ci
npm run quality:test
npm run quality:prepare -- --run-id pilot-01
```

This builds the current library, verifies JSON-value round trips for compact
JSON, official TOON and typed Vigesimal, derives deterministic gold answers,
randomizes conditions with a recorded seed, and writes `requests.jsonl` plus a
hashed manifest under `benchmark/quality-runs/pilot-01/`. It makes no model
calls. Nested datasets are recorded as excluded instead of being flattened.

To prepare the same experiment from a directory of sanitized real workloads,
place one flat JSON record array in each `.json` file and run:

```bash
npm run quality:prepare -- \
  --run-id partner-01 \
  --datasets-dir /absolute/path/to/sanitized-json
```

The generated requests contain the complete payloads. Keep the ignored run
directory private and review every input before sending it to a provider.

Provider responses use one JSON object per line with `requestId`, `response`,
and optional `inputTokens`, `outputTokens`, `latencyMs`, or `error`. Score them
without an LLM judge:

```bash
npm run quality:score -- \
  --requests ../benchmark/quality-runs/pilot-01/requests.jsonl \
  --responses ../benchmark/quality-runs/pilot-01/responses.jsonl
```

The report separates provider failures from wrong answers and shows both
completion rate and accuracy conditional on completed calls. It also reports a
question-clustered paired bootstrap interval and predeclared gates: at least 30%
input reduction, at least 99% completion, and no more than a one-percentage-point
accuracy regression at the lower 95% confidence bound. Run directories
are ignored by Git because prompts and responses may contain pilot data; publish
only reviewed, sanitized artifacts.

Before spending: choose exact provider/model IDs and approve a capped budget.
Do not use the historical hard-coded pricing table for a new budget estimate.

## Proposed protocol

1. Freeze the built TypeScript package, official TOON version, tokenizer,
   dataset hashes, harness hash and question set in a manifest.
2. Use the same tasks and selected fields for every encoder. Compare compact
   JSON, official TOON, typed Vigesimal and CSV on the flat track. Compare only
   applicable formats on nested data; never flatten one condition silently.
3. Prepare a fixed retrieval/filtering task set and a separately reported
   aggregation set. Generate gold answers with code, not an LLM judge.
4. Repeat each format/question at least three times with fixed output limits,
   recorded sampling settings and randomized condition order. Include a second
   model family before making cross-model claims.
5. Record complete requests, format-instruction overhead, API usage (including
   cached and output tokens), retries, latency and task completion. Sanitize
   samples before any provider call.
6. Store infrastructure failures separately from wrong answers. Report both
   service completion rate and accuracy conditional on successful calls.
7. Report paired accuracy differences with dataset/question-clustered bootstrap
   intervals. Keep repeated observations of a question together. A small
   ranking difference is not evidence of superiority when uncertainty overlaps.
8. Report wins and losses per dataset and task category. Evaluate the actual
   `analyze()` selection policy in addition to the raw format.
9. Require no unacceptable quality regression under the pilot's predeclared
   tolerance, plus positive end-to-end savings after caching and retries.

Save raw results and the complete manifest together. Preserve historical
artifacts rather than reusing their filenames or relabeling their encoders.
