# Contributing

Development requires Node 22.12+ or Node 24+ (the test runner's requirement).

After changing the library, run `npm run sync:playground` in `vigesimal/` and
commit the refreshed playground bundle with the source. CI checks this snapshot
against a fresh build, then runs playground tests, typechecking and its production
build. Run `npm run check:playground` to check the snapshot without changing it.
Run `cd vigesimal && npm ci && npm run typecheck && npm run test:run && npm run build`.
Run `npm run benchmark` for local serialization measurements. It makes no model calls.

For a codec bug, include a minimal sanitized input, expected output, actual output,
package version and whether a schema was provided. Add a failing regression test
before changing the parser. Never submit credentials or private payloads.

Generated property tests use a fixed seed for reproducibility. Keep the supported
input contract and migration notes in sync with behavior. Do not infer model
accuracy or production savings from serialization-only tests.

Useful contributions: real-world sanitized fixtures, explicit unsupported-input
tests, benchmark reproducibility, and integration examples backed by actual use.
