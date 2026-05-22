import { describe, it, expect } from 'vitest'
import { encodeScalar, decodeScalar, escapeString, unescapeString } from '../scalars'

describe('escapeString', () => {
  it('escapes pipe characters', () => {
    expect(escapeString('a|b')).toBe('a\\|b')
  })
  it('escapes open bracket', () => {
    expect(escapeString('a[b')).toBe('a\\[b')
  })
  it('escapes close bracket', () => {
    expect(escapeString('a]b')).toBe('a\\]b')
  })
  it('escapes multiple special chars', () => {
    expect(escapeString('[a|b]')).toBe('\\[a\\|b\\]')
  })
  it('leaves plain strings untouched', () => {
    expect(escapeString('hello')).toBe('hello')
  })
})

describe('unescapeString', () => {
  it('unescapes pipe', () => {
    expect(unescapeString('a\\|b')).toBe('a|b')
  })
  it('unescapes brackets', () => {
    expect(unescapeString('\\[a\\]')).toBe('[a]')
  })
  it('round-trips with escapeString', () => {
    const s = 'user[role|admin]'
    expect(unescapeString(escapeString(s))).toBe(s)
  })
})

describe('encodeScalar', () => {
  it('encodes null as _', () => {
    expect(encodeScalar(null)).toBe('_')
  })
  it('encodes undefined as _', () => {
    expect(encodeScalar(undefined)).toBe('_')
  })
  it('encodes true as +', () => {
    expect(encodeScalar(true)).toBe('+')
  })
  it('encodes false as -', () => {
    expect(encodeScalar(false)).toBe('-')
  })
  it('encodes numeric zero as 0', () => {
    expect(encodeScalar(0)).toBe('0')
  })
  it('encodes positive number as string', () => {
    expect(encodeScalar(42)).toBe('42')
  })
  it('encodes negative number as string', () => {
    expect(encodeScalar(-3)).toBe('-3')
  })
  it('encodes plain string as-is', () => {
    expect(encodeScalar('hello')).toBe('hello')
  })
  it('escapes special chars in strings', () => {
    expect(encodeScalar('a|b')).toBe('a\\|b')
  })
})

describe('decodeScalar', () => {
  it('decodes _ as null', () => {
    expect(decodeScalar('_')).toBeNull()
  })
  it('decodes + as true', () => {
    expect(decodeScalar('+')).toBe(true)
  })
  it('decodes - as false', () => {
    expect(decodeScalar('-')).toBe(false)
  })
  it('decodes 0 as 0', () => {
    expect(decodeScalar('0')).toBe(0)
  })
  it('decodes other strings by unescaping', () => {
    expect(decodeScalar('hello')).toBe('hello')
  })
  it('decodes escaped pipe back to string with pipe', () => {
    expect(decodeScalar('a\\|b')).toBe('a|b')
  })
  it('round-trips with encodeScalar for strings', () => {
    expect(decodeScalar(encodeScalar('hello|world'))).toBe('hello|world')
  })
})
