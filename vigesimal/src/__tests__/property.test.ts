import { expect, it } from 'vitest'
import fc from 'fast-check'
import { encode, decode, analyze } from '../index'

const text = fc.oneof(fc.string(), fc.constantFrom('', '_', 'D1', '00123', '\n', '\r\n', '"', 'a,b', '日本語', '__proto__'))
const row = fc.record({
  id: fc.integer(),
  title: fc.option(text, { nil: null }),
  active: fc.option(fc.boolean(), { nil: null }),
  department: fc.constantFrom('Engineering', 'Sales', 'D1', '_'),
})

it('round-trips supported records through embedded metadata (1,000 generated cases)', () => {
  fc.assert(fc.property(fc.array(row, { maxLength: 60 }), rows => {
    expect(decode(encode(rows))).toEqual(rows)
  }), { numRuns: 1000, seed: 20260904 })
})

it('analyze always preserves JSON data and never selects a larger payload', () => {
  // Canonical JSON excludes JavaScript negative zero (separately tested as rejected).
  fc.assert(fc.property(fc.jsonValue().map(value => JSON.parse(JSON.stringify(value))), data => {
    const report = analyze(data, { est: s => s.length, tokenizer: 'characters-test' })
    expect(report.outputTokens).toBeLessThanOrEqual(report.inputTokens)
    expect(report.format === 'json' ? JSON.parse(report.output) : decode(report.output)).toEqual(data)
  }), { numRuns: 500, seed: 20260904 })
})
