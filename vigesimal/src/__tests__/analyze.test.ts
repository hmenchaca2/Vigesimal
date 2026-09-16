import { expect, it } from 'vitest'
import { analyze, decode } from '../index'

it('selects a smaller verified complete block', () => {
  const rows = Array.from({ length: 50 }, (_, id) => ({ id, department: 'Engineering', active: true }))
  const report = analyze(rows, { est: s => s.length, tokenizer: 'characters-test' })
  expect(report.format).toBe('vigesimal')
  expect(report.outputTokens).toBeLessThan(report.inputTokens)
  expect(decode(report.output)).toEqual(rows)
  expect(report.estimated).toBe(false)
})
it('preserves tiny, nested, sparse and mixed data with JSON fallback', () => {
  for (const data of [[], [{ x: 1 }], [{ x: { y: true } }], [{ x: 1 }, { y: 2 }], [{ x: 1 }, { x: 's' }]]) {
    const result = analyze(data)
    expect(result.format).toBe('json')
    expect(JSON.parse(result.output)).toEqual(data)
  }
})
it('labels estimates and does not hide broken token counters', () => {
  expect(analyze([{ x: 1 }]).estimated).toBe(true)
  expect(() => analyze([{ x: 1 }], { est: () => NaN })).toThrow()
  expect(() => analyze([{ x: 1 }], { est: () => { throw new Error('counter failed') } })).toThrow('counter failed')
})
it('refuses lossy JSON fallbacks', () => {
  for (const data of [undefined, NaN, Infinity, -0, { x: undefined }, { x: new Date() }]) {
    expect(() => analyze(data)).toThrow()
  }
  const cyclic: Record<string, unknown> = {}; cyclic.x = cyclic
  expect(() => analyze(cyclic)).toThrow()
})
