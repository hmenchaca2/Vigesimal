import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import assert from 'node:assert/strict'

// Keep the generated tarball for inspection; never publish or alter global installs.
const directory = mkdtempSync(join(tmpdir(), 'vigesimal-package-'))
const result = JSON.parse(execFileSync('npm', ['pack', '--json', '--pack-destination', directory], { encoding: 'utf8' }))
const archive = join(directory, result[0].filename)
execFileSync('tar', ['-xzf', archive, '-C', directory])
const packageDir = join(directory, 'package')
execFileSync(process.execPath, ['--input-type=module', '-e', "import {encode,decode} from './dist/index.mjs'; if(decode(encode([{id:'00123',ok:true}]))[0].id!=='00123') process.exit(1)"], { cwd: packageDir })
execFileSync(process.execPath, ['-e', "const {analyze}=require('./dist/index.cjs');if(analyze([{x:1}]).format!=='json')process.exit(1)"], { cwd: packageDir })
const report = JSON.parse(execFileSync(process.execPath, ['bin/vigesimal.mjs', 'analyze', '-', '--json'], { cwd: packageDir, input: '[{"id":"00123"}]', encoding: 'utf8' }))
if (!report.roundTrip || report.format !== 'json') throw new Error('Packaged CLI failed')
assert.throws(() => execFileSync(process.execPath, ['bin/vigesimal.mjs', 'analyze', '-', '--json'], {
  cwd: packageDir, input: '[{"id":9007199254740993}]', stdio: ['pipe', 'pipe', 'pipe'],
}), /precision loss/)
assert.throws(() => execFileSync(process.execPath, ['bin/vigesimal.mjs', 'analyze', '-', '--json'], {
  cwd: packageDir, input: '[{"id":1,"\\u0069d":2}]', stdio: ['pipe', 'pipe', 'pipe'],
}), /Duplicate JSON key/)
// The source checkout includes the optional tokenizer dependency.
for (const tokenizer of ['o200k_base', 'cl100k_base']) {
  const counted = JSON.parse(execFileSync(process.execPath, ['bin/vigesimal.mjs', 'analyze', '-', '--json', '--tokenizer', tokenizer], {
    input: '[{"text":"<|endoftext|>"}]', encoding: 'utf8',
  }))
  assert.equal(counted.roundTrip, true)
  assert.ok(counted.output.includes('<|endoftext|>'))
}
const manifest = JSON.parse(readFileSync(join(packageDir, 'package.json'), 'utf8'))
if (!manifest.bin.vigesimal) throw new Error('CLI missing from package')
console.log(`Verified packaged ESM, CommonJS and CLI: ${archive}`)
