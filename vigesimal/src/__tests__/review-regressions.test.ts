import { describe, expect, it } from 'vitest'
import { getEncoding } from 'js-tiktoken'
import { analyze, buildCodex, decode, decodeDelta, encode, encodeHeader, encodeRow, inferSchema, parseJson } from '../index'

describe('untrusted numeric wire values', () => {
  const schema = { name: 'data', fields: [{ name: 'id', type: 'numeric' as const }] }
  it.each(['9007199254740993', '1e-400', '1.0000000000000001', '1e400', '-0'])('rejects %s in blocks and deltas', value => {
    const block = encodeHeader('data', 1, schema, new Map()) + value + '\n'
    expect(() => decode(block)).toThrow(/precision loss/)
    expect(() => decodeDelta(`~id=${value}`, schema)).toThrow(/precision loss/)
  })
  it.each(['1e3', '1.2300', '5e-324', '9007199254740992', '0.1'])('accepts faithful %s', value => {
    expect(decodeDelta(`~id=${value}`, schema)).toEqual({ id: Number(value) })
  })
})

describe('duplicate JSON keys', () => {
  it.each([
    '[{"id":"original","id":"replacement"}]',
    '{"id":1,"\\u0069d":2}',
    '{"outer":[{"x":null,"x":false}]}',
    '{"__proto__":1,"__proto__":2}',
    '{"":1,"":2}',
  ])('rejects duplicates in %s', text => {
    expect(() => parseJson(text)).toThrow(/Duplicate JSON key/)
  })
  it.each([
    '{"x":1,"child":{"x":2}}',
    '[{"x":1},{"x":2}]',
    '{"x":[true,null,false,"x"],"y":{"a":"a","b":[]}}',
    '{"__proto__":1,"constructor":2,"id":"\\\"id\\\":3"}',
  ])('retains independently scoped keys and string contents', text => {
    expect(parseJson(text)).toEqual(JSON.parse(text))
  })
})

it('codex distinguishes strings, numbers and booleans and validates schemas', () => {
  const outputs = ['1', 1, true].map(v => buildCodex(inferSchema('data', [{ v }])))
  expect(new Set(outputs).size).toBe(3)
  expect(outputs[0]).toContain('types: string')
  expect(outputs[1]).toContain('types: numeric')
  expect(outputs[2]).toContain('types: boolean')
  expect(() => buildCodex({ name: 'bad\nname', fields: [] })).toThrow()
})

it('compares dictionary and uncoded candidates using full real-token counts', () => {
  const tokenizer = getEncoding('o200k_base')
  const est = (text: string) => tokenizer.encode(text, [], []).length
  const rows = Array.from({ length: 3 }, (_, id) => ({ value: 'a'.repeat(40), id }))
  const schema = inferSchema('data', rows)
  const uncoded = encodeHeader('data', rows.length, schema, new Map()) +
    rows.map(row => encodeRow(row, schema, new Map())).join('\n') + '\n'
  expect(est(encode(rows, { est }))).toBeGreaterThan(est(uncoded))
  const report = analyze(rows, { est })
  expect(report.encoded).toBe(uncoded)
  expect(report.vigesimalTokens).toBe(est(uncoded))
  expect(report.outputTokens).toBeLessThanOrEqual(report.inputTokens)
  expect(decode(report.encoded!)).toEqual(rows)
})

it('counts each distinct text once per analysis', () => {
  const calls = new Map<string, number>()
  analyze(Array.from({ length: 40 }, () => ({ department: 'Engineering' })), {
    est: text => { calls.set(text, (calls.get(text) ?? 0) + 1); return Math.ceil(text.length / 4) },
  })
  expect([...calls.values()].every(count => count === 1)).toBe(true)
})
