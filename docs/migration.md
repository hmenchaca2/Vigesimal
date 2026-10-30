# Migration to the unreleased typed format

This is a breaking format/API-behavior update and must ship as a new major
release, not silently replace 1.0.0. The working tree is not a published release.

1. Upgrade decoders before producers. Old decoders cannot read the new `types:`
   header. Do not mix new producers with old consumers.
2. New `encode` blocks preserve types when calling `decode(block)` directly.
3. Legacy blocks without types still decode with an explicit schema. Without a
   schema they now preserve string/null values, rather than guessing numbers.
4. Literal underscores and empty strings are quoted. Multiline values and
   cross-column dictionary collisions now round-trip correctly.
5. Malformed blocks and schema mismatches now throw. Unsupported nested values,
   mixed columns, nonfinite numbers and negative zero also throw.
6. Missing/undefined fields still normalize to null. Use `analyze` on JSON input
   to retain sparse record shape through fallback.
7. Compression statistics can be negative when encoding expands a payload.
8. Unknown/duplicate delta fields are rejected; update your explicit schema.
9. Deletion now has its own delta syntax: `~field=` (no value) deletes a
   field, distinct from `~field=_` (sets it to null). A consumer that
   special-cased `_` as "deleted" must switch to the empty-value form, or
   use the new `applyDelta(state, decodedDelta)` helper, which does this
   correctly.

Run saved fixtures through both producers and consumers before rollout. Re-run
model-quality tests: the old benchmark does not validate the new payloads.

No npm publication, Git push, paid evaluation or external outreach has been
performed merely by preparing this update.
