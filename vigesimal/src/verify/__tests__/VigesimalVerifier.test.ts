import { describe, it, expect } from 'vitest'
import type { VigesimalSchema } from '../../types'
import { VigesimalVerifier } from '../VigesimalVerifier'
import { splitByUnescapedPipe } from '../decode'

const schema: VigesimalSchema = {
  name: 'S1',
  fields: [
    { name: 'tier', type: 'string' },
    { name: 'step', type: 'string' },
    { name: 'active', type: 'boolean' },
  ],
}

describe('splitByUnescapedPipe', () => {
  it('splits on unescaped pipes', () => {
    expect(splitByUnescapedPipe('a|b|c')).toEqual(['a', 'b', 'c'])
  })
  it('does not split on escaped pipes', () => {
    expect(splitByUnescapedPipe('a\\|b|c')).toEqual(['a\\|b', 'c'])
  })
  it('handles empty segments', () => {
    expect(splitByUnescapedPipe('a||c')).toEqual(['a', '', 'c'])
  })
})

describe('VigesimalVerifier.decode()', () => {
  const verifier = new VigesimalVerifier()

  it('decodes a tuple back to a record', () => {
    const result = verifier.decode('S1[prem|3/7|+]', schema)
    expect(result).toEqual({ tier: 'prem', step: '3/7', active: true })
  })

  it('decodes _ as null', () => {
    const result = verifier.decode('S1[_|1/5|-]', schema)
    expect(result.tier).toBeNull()
    expect(result.active).toBe(false)
  })

  it('decodes 0 as 0', () => {
    const numSchema: VigesimalSchema = {
      name: 'N1',
      fields: [{ name: 'count', type: 'numeric' }],
    }
    expect(verifier.decode('N1[0]', numSchema)).toEqual({ count: 0 })
  })
})

describe('VigesimalVerifier.verify()', () => {
  const verifier = new VigesimalVerifier()

  it('returns valid=true for a correctly encoded tuple', () => {
    const original = { tier: 'prem', step: '3/7', active: true }
    const encoded = 'S1[prem|3/7|+]'
    const result = verifier.verify(encoded, original, schema)
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('returns valid=false with error when encoding does not match', () => {
    const original = { tier: 'prem', step: '3/7', active: true }
    const wrongEncoded = 'S1[free|3/7|+]'  // tier is wrong
    const result = verifier.verify(wrongEncoded, original, schema)
    expect(result.valid).toBe(false)
    expect(result.errors.length).toBeGreaterThan(0)
  })
})
