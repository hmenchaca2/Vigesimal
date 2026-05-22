import { describe, it, expect } from 'vitest'
import type { VigesimalSchema } from '../../types'
import { VigesimalEncoder } from '../VigesimalEncoder'

const schema: VigesimalSchema = {
  name: 'S1',
  fields: [
    { name: 'tier', type: 'string' },
    { name: 'step', type: 'string' },
    { name: 'active', type: 'boolean' },
  ],
}

describe('VigesimalEncoder', () => {
  const enc = new VigesimalEncoder()

  it('encode() delegates to encodeTuple', () => {
    expect(enc.encode({ tier: 'prem', step: '2/5', active: true }, schema))
      .toBe('S1[prem|2/5|+]')
  })

  it('encodeTabular() delegates to encodeTabular', () => {
    const rows = [
      { tier: 'prem', step: '1/5', active: true },
      { tier: 'free', step: '2/5', active: false },
      { tier: 'free', step: '3/5', active: true },
    ]
    const result = enc.encodeTabular(rows, schema)
    expect(result).toContain('S1x3[tier,step,active]:')
    expect(result).toContain('  prem,1/5,+')
  })

  it('encodeDelta() delegates to encodeDelta', () => {
    expect(enc.encodeDelta({ step: '3/5' }, schema)).toBe('~[|3/5|]')
  })

  it('encodeEmblem() delegates to encodeEmblem', () => {
    expect(enc.encodeEmblem({ 'long-id-abc': '@a1' })).toBe('EMBLEM: long-id-abc=@a1')
  })
})
