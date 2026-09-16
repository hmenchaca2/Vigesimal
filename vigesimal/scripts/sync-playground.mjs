import { readFileSync, copyFileSync } from 'node:fs'
const check = process.argv.includes('--check')
const files = [
  ['dist/index.mjs', '../playground/lib/vigesimal.mjs'],
  ['dist/index.mjs.map', '../playground/lib/index.mjs.map'],
  ['dist/index.d.ts', '../playground/lib/vigesimal.d.mts'],
]
for (const [source, target] of files) {
  const from = new URL(`../${source}`, import.meta.url)
  const to = new URL(`../${target}`, import.meta.url)
  if (check) {
    if (!readFileSync(from).equals(readFileSync(to))) {
      throw new Error(`${target} is stale. Run npm run sync:playground in vigesimal and commit the refreshed bundle.`)
    }
  } else copyFileSync(from, to)
}
console.log(check ? 'Playground bundle matches the library build.' : 'Playground bundle refreshed.')
