import { describe, it, expect } from 'vitest'
import type { VigesimalSchema } from '../../types'
import { encodeTabular, encodeDelta } from '../../encoder/panels'
import { decodeTabular, decodeDelta } from '../decode'
import { inferSchema } from '../../schema/infer'
import { VigesimalVerifier } from '../VigesimalVerifier'

const schema: VigesimalSchema = {
  name: 'employees',
  fields: [
    { name: 'id', type: 'numeric' },
    { name: 'department', type: 'string' },
    { name: 'active', type: 'boolean' },
  ],
}

const records = [
  { id: 1, department: 'Engineering', active: true },
  { id: 2, department: 'Engineering', active: false },
  { id: 3, department: 'Sales, West', active: true },
]

describe('decodeTabular', () => {
  it('round-trips records through encode/decode', () => {
    const encoded = encodeTabular('employees', records, schema)
    expect(decodeTabular(encoded, schema)).toEqual(records)
  })

  it('resolves codes back to values', () => {
    const many = Array.from({ length: 10 }, (_, i) => ({
      id: i, department: 'Engineering', active: true,
    }))
    const encoded = encodeTabular('e', many, schema)
    expect(encoded).toContain('codes: D1=Engineering')
    expect(decodeTabular(encoded, schema)[0].department).toBe('Engineering')
  })

  it('decodes quoted code-collision literals as literals', () => {
    const s: VigesimalSchema = { name: 'x', fields: [{ name: 'department', type: 'string' }] }
    const recs = [
      ...Array.from({ length: 10 }, () => ({ department: 'Engineering' })),
      { department: 'D1' },
    ]
    const decoded = decodeTabular(encodeTabular('x', recs, s), s)
    expect(decoded[decoded.length - 1]).toEqual({ department: 'D1' })
  })

  it('decodes absent fields as null', () => {
    const encoded = '## t: 1 rows\nfields: id,department,active\nbool: 1=yes 0=no  null: _\n\n7,_,_\n'
    expect(decodeTabular(encoded, schema)).toEqual([{ id: 7, department: null, active: null }])
  })

  it('throws on malformed input', () => {
    expect(() => decodeTabular('not a v4 block', schema)).toThrow()
  })
})

describe('decodeDelta', () => {
  it('round-trips a keyed delta', () => {
    const delta = { department: 'Sales', active: false }
    expect(decodeDelta(encodeDelta(delta), schema)).toEqual(delta)
  })
  it('decodes _ as null', () => {
    expect(decodeDelta('~department=_', schema)).toEqual({ department: null })
  })
  it('decodes empty delta', () => {
    expect(decodeDelta('~', schema)).toEqual({})
  })
  it('handles quoted values with commas', () => {
    expect(decodeDelta('~msg="a,b"', schema)).toEqual({ msg: 'a,b' })
  })
})

describe('VigesimalVerifier', () => {
  it('verifies a faithful encoding', () => {
    const encoded = encodeTabular('employees', records, schema)
    const result = new VigesimalVerifier().verify(encoded, records, schema)
    expect(result.valid).toBe(true)
    expect(result.errors).toEqual([])
  })

  it('reports a corrupted encoding', () => {
    const encoded = encodeTabular('employees', records, schema).replace('Engineering', 'Sales')
    const result = new VigesimalVerifier().verify(encoded, records, schema)
    expect(result.valid).toBe(false)
    expect(result.errors.length).toBeGreaterThan(0)
  })
})

describe('inferred schema round-trip', () => {
  it('numeric fields with nulls decode back as numbers and nulls', () => {
    const data = [
      { name: 'a', score: 42 },
      { name: 'b', score: null },
      { name: 'c', score: 7 },
    ]
    const s = inferSchema('scores', data)
    const decoded = decodeTabular(encodeTabular('scores', data, s), s)
    expect(decoded).toEqual(data)
    expect(typeof decoded[0].score).toBe('number')
    expect(decoded[1].score).toBeNull()
  })
})
