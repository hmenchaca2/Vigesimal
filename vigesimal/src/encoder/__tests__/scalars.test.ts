import { describe, it, expect } from 'vitest'
import { encodeScalar, decodeScalar, quoteCsv, splitCsvRow } from '../scalars'

describe('encodeScalar', () => {
  it('encodes true as 1', () => expect(encodeScalar(true)).toBe('1'))
  it('encodes false as 0', () => expect(encodeScalar(false)).toBe('0'))
  it('encodes null as _', () => expect(encodeScalar(null)).toBe('_'))
  it('encodes undefined as _', () => expect(encodeScalar(undefined)).toBe('_'))
  it('encodes numbers literally', () => expect(encodeScalar(42)).toBe('42'))
  it('encodes zero as 0', () => expect(encodeScalar(0)).toBe('0'))
  it('encodes plain strings literally', () => expect(encodeScalar('hello')).toBe('hello'))
  it('quotes strings containing commas', () => expect(encodeScalar('a,b')).toBe('"a,b"'))
  it('quotes and doubles internal quotes', () =>
    expect(encodeScalar('say "hi"')).toBe('"say ""hi"""'))
  it('quotes strings containing newlines', () => expect(encodeScalar('a\nb')).toBe('"a\nb"'))
  it('leaves empty string empty', () => expect(encodeScalar('')).toBe(''))
})

describe('decodeScalar', () => {
  it('decodes _ as null', () => expect(decodeScalar('_', 'string')).toBeNull())
  it('decodes 1 as true for boolean fields', () => expect(decodeScalar('1', 'boolean')).toBe(true))
  it('decodes 0 as false for boolean fields', () => expect(decodeScalar('0', 'boolean')).toBe(false))
  it('decodes numerics as numbers', () => expect(decodeScalar('42', 'numeric')).toBe(42))
  it('decodes 0 as number 0 for numeric fields', () => expect(decodeScalar('0', 'numeric')).toBe(0))
  it('decodes strings as-is', () => expect(decodeScalar('hello', 'string')).toBe('hello'))
  it('unquotes quoted strings', () => expect(decodeScalar('"a,b"', 'string')).toBe('a,b'))
  it('undoubles quotes', () => expect(decodeScalar('"say ""hi"""', 'string')).toBe('say "hi"'))
  it('round-trips a comma string', () =>
    expect(decodeScalar(encodeScalar('x,y'), 'string')).toBe('x,y'))
})

describe('splitCsvRow', () => {
  it('splits plain rows', () => expect(splitCsvRow('a,b,c')).toEqual(['a', 'b', 'c']))
  it('respects quoted commas', () => expect(splitCsvRow('a,"b,c",d')).toEqual(['a', '"b,c"', 'd']))
  it('handles doubled quotes inside quoted fields', () =>
    expect(splitCsvRow('"say ""hi""",x')).toEqual(['"say ""hi"""', 'x']))
  it('handles empty fields', () => expect(splitCsvRow('a,,c')).toEqual(['a', '', 'c']))
})

describe('quoteCsv', () => {
  it('wraps and doubles quotes', () => expect(quoteCsv('a"b')).toBe('"a""b"'))
})
