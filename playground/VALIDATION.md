# Validation notes

- The analyzer uses the built parent library; its regression/property tests are
  run before refreshing the bundled snapshot.
- TypeScript and production builds are checked locally.
- Lint covers authored code. The unmodified starter component catalog and the
  generated library snapshot are excluded; the library is tested separately.
- The requested review exercised desktop/mobile layouts, samples, fallback,
  numeric precision and special-token edge cases, plus WebMCP success/failure.
- Review fixes add raw JSON numeric validation, ordinary-text token counting,
  and debounced, cancellable browser-worker analysis. Loading is limited to
  15 seconds and computation to 5 seconds; timeouts select no output. Input and
  counter changes terminate old work and prevent stale results from displaying.
- `npm test` covers worker result/error cleanup, cancellation, both deadlines,
  input limits, raw numeric rejection and both real tokenizers. Library tests
  and package smoke checks cover the same numeric/CLI regressions.
- The default counter is o200k_base. Estimates require explicit selection and
  are labeled in the savings headline; no estimate silently replaces a timeout.
- September review: raw input duplicate keys (including escaped aliases) are
  rejected. The error state exposes Retry analysis, which starts fresh work for
  unchanged input. Local browser verification confirmed error → retry → pending.
- Parent CI verifies that this bundled library matches a fresh library build,
  then tests, typechecks and production-builds this app.
- Optional WebMCP `analyze_json_payload` uses the same bounded worker path and
  refuses to overwrite newer manual input or counter changes.
- Tokenizer assets are served with the app; pasted data is never sent to them.
- The site is exported as static assets, with a browser Web Worker and no
  application backend. Worker assets are bundled by Vite's `?worker` import.
- npm installation reported dependency advisories. The audit endpoint timed
  out during follow-up; do not interpret build success as a clean security audit.
