#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { analyze, parseJson } from '../dist/index.mjs'

const args = process.argv.slice(2)
if (args.includes('--help') || args.length === 0) {
  console.log('Usage: vigesimal analyze <file.json|-> [--json] [--tokenizer o200k_base|cl100k_base]\nReads locally. No network requests or telemetry. Install js-tiktoken for tokenizer counts.')
} else {
  try {
    const [command, file, ...flags] = args
    if (command !== 'analyze' || !file || file.startsWith('--')) throw new Error('Expected: analyze <file.json|->')
    let tokenizer
    let machine = false
    for (let i = 0; i < flags.length; i++) {
      if (flags[i] === '--json') machine = true
      else if (flags[i] === '--tokenizer' && ['o200k_base', 'cl100k_base'].includes(flags[i + 1])) tokenizer = flags[++i]
      else throw new Error(`Unknown or invalid option: ${flags[i]}`)
    }
    const options = {}
    if (tokenizer) {
      let module
      try { module = await import('js-tiktoken') }
      catch { throw new Error('Tokenizer unavailable. Install js-tiktoken next to vigesimal, or omit --tokenizer for estimates.') }
      const encoder = module.getEncoding(tokenizer)
      options.est = text => encoder.encode(text, [], []).length
      options.tokenizer = tokenizer
    }
    const result = analyze(parseJson(readFileSync(file === '-' ? 0 : file, 'utf8')), options)
    if (machine) console.log(JSON.stringify(result, null, 2))
    else {
      console.log(`Selected: ${result.format}\nCounter: ${result.tokenizer}${result.estimated ? ' (estimate)' : ''}\nCompact JSON: ${result.inputTokens} tokens\nVigesimal: ${result.vigesimalTokens ?? 'unsupported'} tokens\nSelected savings: ${(result.reduction * 100).toFixed(1)}%\nRound-trip: ${result.roundTrip ? 'verified' : 'not verified / unsupported'}`)
      for (const warning of result.warnings) console.log(`Note: ${warning}`)
    }
  } catch (error) {
    console.error(`vigesimal: ${error.message}`)
    process.exitCode = 1
  }
}
