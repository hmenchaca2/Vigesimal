# Quality evaluation release gate

Status: not run for the new typed format. The local serialization benchmark
does not measure LLM comprehension, production cost, or latency.

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
