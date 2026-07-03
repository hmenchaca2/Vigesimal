import { describe, it, expect } from 'vitest'
import { encode, decode } from '../api'
import { inferSchema } from '../schema/infer'

const records = [
  { id: 1, department: 'Engineering', active: true },
  { id: 2, department: 'Engineering', active: false },
  { id: 3, department: 'Sales, West', active: true },
]

describe('encode', () => {
  it('encodes with an inferred schema and default name', () => {
    const out = encode(records)
    expect(out).toMatch(/^## data: 3 rows/)
    expect(out).toContain('fields: id,department,active')
  })

  it('honors the name option', () => {
    expect(encode(records, { name: 'employees' })).toMatch(/^## employees: 3 rows/)
  })
})

describe('decode', () => {
  it('round-trips exactly with a schema', () => {
    const schema = inferSchema('employees', records)
    const decoded = decode(encode(records, { name: 'employees', schema }), schema)
    expect(decoded).toEqual(records)
  })

  it('decodes without a schema, coercing numeric columns', () => {
    const decoded = decode(encode(records))
    expect(decoded[0].id).toBe(1)
    expect(decoded[0].department).toBe('Engineering')
    // booleans are ambiguous without a schema — decoded as the numbers 1/0
    expect(decoded[0].active).toBe(1)
  })

  it('decodes nulls without a schema', () => {
    const data = [{ a: 'x', b: null }, { a: 'y', b: 7 }]
    const decoded = decode(encode(data))
    expect(decoded[0].b).toBeNull()
    expect(decoded[1].b).toBe(7)
  })

  it('throws on malformed input', () => {
    expect(() => decode('nonsense')).toThrow()
  })
})
