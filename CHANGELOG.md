# Changelog

## 2.0.0-next.0 — unreleased

Breaking: typed headers, conservative legacy decoding, strict malformed-input
and schema rejection, unsupported-value rejection, and signed compression
statistics. Upgrade readers before producers; see [migration](docs/migration.md).

Fixed: underscore/null collisions, multiline rows and dictionaries, empty-string
row loss, cross-column dictionary literals, empty-array decoding, and Unicode
field-name code generation. Verification checks types and session validation
occurs before advancing state.

Review fixes: block and delta decoding reject precision-losing numbers; raw
JSON rejects duplicate keys, including escaped aliases. Session codices now
include field types. Failed playground requests can be retried unchanged.
Analysis compares coded and uncoded candidates and caches token counts. CI
checks library/playground synchronization, playground types and production build.

Added: local `analyze` API with verified JSON fallback; CLI with optional token
counts; regression/property tests; CI and package smoke tests; official-library
serialization benchmark; local-first playground; tool-output example; pilot and
quality-evaluation protocols.

Historical accuracy claims were removed from the product introduction. No new
model-quality run, npm publication, outreach, or retention claim accompanies
this prerelease preparation.
