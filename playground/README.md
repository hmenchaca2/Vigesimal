# Vigesimal Payload Lab

Local-first evaluator. Input is held in React state only; no payload uploads,
analytics, local storage, or external fonts. This is an unreleased typed-format
preview, not a claim about the current npm release.

The self-contained `lib/vigesimal.mjs` and declaration file are generated from
the parent library. After changes, run from `vigesimal/`:

```bash
npm run build
node scripts/sync-playground.mjs
```

Then run `npm run dev` or `npm run build` from this directory. Never edit the
generated snapshot by hand. The bundled library retains its MIT license.
