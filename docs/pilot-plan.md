# Design-partner pilot

Status: prepared, not launched. No outreach, telemetry, API spend, or publication is authorized by this document.

## Who to recruit

Ten TypeScript developers passing repeated, flat database/API records into an LLM workflow. Prefer existing recurring workloads, not hypothetical interest. Ask for sanitized samples or run the analyzer on their machine; do not collect raw customer payloads.

## Invitation draft

> I'm testing Vigesimal, a library that measures whether repeated structured tool results can use less LLM context. Would you try a local evaluator on a sanitized sample? It keeps JSON when compression doesn't help. I'd like feedback on integration friction and whether savings survive in your actual workflow—not a testimonial commitment.

Send only after selecting recipients and approving outreach. Do not mass-message communities.

## Interview and evaluation

1. What workflow runs repeatedly, and what is its current payload size?
2. What model, tokenizer, caching, latency and task-quality requirements apply?
3. Run `analyze` on representative small, typical and large samples.
4. Verify exact data fidelity; keep unsupported payloads as JSON.
5. Run the same tasks with compact JSON and selected output; record quality, full request/response tokens, retries, failures and latency.
6. Ask what prevented installation or integration. Choose the first adapter from repeated answers, not assumptions.

## Consent-based measurement

Record a participant-chosen project alias, consent date, activation date, evaluation outcome, integration status, weekly self-reported continued use, sample count, net savings, quality regression, fallback/error rates, and abandonment reason. Never record payload text or credentials. No hidden runtime telemetry.

Primary metric: number of projects still using the library four weeks after integration with positive measured workload savings and no unacceptable quality regression. Record numerator and denominator; npm downloads are not retained projects.

Proposed go/no-go target: at least 3 of 10 participants integrate and remain active four weeks later. This is an experiment threshold, not a forecast.

## Case study template

- Workflow and why the data fits (or does not).
- Exact package versions, model, tokenizer, dates, and sample selection.
- Compact JSON baseline, full request/response tokens, caching and retries.
- Task quality, failures and latency before/after.
- Integration effort and limitations, including negative results.
- Partner approval before publishing any name, quote, number or sample.

## External gates

- Maintainer review and release approval before publishing npm or pushing CI.
- Explicit model/budget selection before paid quality evaluations.
- Recipient and message approval before outreach.
- Four weeks of observed usage before retention claims.
