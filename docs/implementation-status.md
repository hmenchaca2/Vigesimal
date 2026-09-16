# Implementation status — 2026-09-16

## Completed locally

- Prepared `2.0.0-next.0` with typed blocks, strict validation, prototype-safe
  field handling, conservative legacy decoding, and signed savings statistics.
- Added analyzer/JSON fallback, CLI, optional real-tokenizer counts, integration
  example, CI, regression tests and reproducible property tests.
- Verified 191 library tests (including 1,500 generated cases), 7 playground
  worker tests, TypeScript, authored-code lint and production builds.
- Verified a local package tarball's ESM, CommonJS and CLI entry points.
- Ran the official TOON / standard CSV / JSON / TypeScript serialization benchmark.
- Built the static, local-first playground and checked authored-code lint and
  TypeScript. No payload uploads or hidden telemetry were added.
- Prepared migration, contribution, pilot and quality-evaluation documents.
- Fixed review findings: reject precision-losing raw JSON numbers in browser,
  WebMCP and CLI; count delimiter-like text normally; run browser analysis in
  cancellable, deadline-bounded workers. Real token counts are the UI default.
- Extended numeric fidelity checks to block/delta decoding, rejected duplicate
  JSON keys (including escaped aliases), added typed session codices and an
  explicit retry control. The analyzer compares uncoded/coded candidates and
  caches token counts. CI checks bundle synchronization and builds the playground.

## Findings

On the five flat synthetic datasets, total o200k_base payload tokens are 18,169
for compact JSON, 10,277 for official TOON and 10,254 for typed Vigesimal.
That is 43.6% fewer than compact JSON and a near tie with TOON. Vigesimal loses
to TOON on two of five datasets. No inference about model accuracy follows.

## Release / growth gates still open

1. Dependency security: initial installs reported advisories. The old library
   test runner was replaced with Vitest 5.0.0; development/CI now uses Node 22/24.
   Follow-up audit calls timed out, so a clean security audit is still pending,
   especially for the playground starter tree. Builds are not security audits.
2. Live quality evaluation: choose provider/model IDs and an explicit spend cap;
   run the [protocol](quality-evaluation.md). No paid calls were made.
3. Browser interaction QA: the requested review covered desktop/mobile views,
   normal flows, fallback and WebMCP. Fix verification exercised precision
   rejection, delimiter counting, a 10,000-character stress-case timeout and
   recovery. This is targeted coverage, not exhaustive browser certification;
   see playground/VALIDATION.md.
4. Release review: approve the breaking-version migration and npm publication.
   Source publication does not publish the npm prerelease.
5. Pilot: select recipients and approve outreach. No developers were contacted.
   Observe four weeks of usage before claiming retention or traction.

The playground has a separate private Sites source snapshot. Publishing that
preview does not publish the library or make a public launch.
