import { describe, expect, it } from 'vitest'
import { analyze, parseJson } from '../index'

describe('raw JSON numeric fidelity', () => {
  it.each(['9007199254740993', '-9007199254740993', '1.0000000000000001', '1e400', '1e-400', '-0', '-0.0'])('rejects %s before analysis', number => {
    expect(() => parseJson(`[{"id":${number}}]`)).toThrow(/precision loss/)
  })
  it.each(['0', '0.1', '1.2300', '1e3', '1E+003', '9007199254740992', '1e20', '5e-324', '0e999999'])('accepts equivalent decimal %s', number => {
    expect(parseJson(number)).toBe(JSON.parse(number))
  })
  it('preserves quoted IDs, escaped text and numeric keys', () => {
    const input = '[{"9007199254740993":"9007199254740993","text":"\\\" 9007199254740993 \\\\"}]'
    expect(parseJson(input)).toEqual(JSON.parse(input))
    expect(analyze(parseJson('[{"id":"9007199254740993"}]')).roundTrip).toBe(true)
  })
  it('rejects invalid JSON syntax', () => {
    expect(() => parseJson('[01]')).toThrow()
    expect(() => parseJson('not JSON')).toThrow()
  })
})
