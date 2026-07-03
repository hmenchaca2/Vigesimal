import { describe, it, expect } from 'vitest'
import { inferSchema } from '../infer'

const employees = [
  { id: 1, name: 'Alice', dept: 'Eng', active: true, score: null },
  { id: 2, name: 'Bob',   dept: 'Sales', active: false, score: 42 },
  { id: 3, name: 'Carol', dept: 'Eng', active: true, score: 0 },
  { id: 4, name: 'Dave',  dept: 'HR', active: true, score: 7 },
]

describe('inferSchema', () => {
  it('returns a schema with the correct name', () => {
    const s = inferSchema('S1', employees)
    expect(s.name).toBe('S1')
  })

  it('infers field names from first record', () => {
    const s = inferSchema('S1', employees)
    expect(s.fields.map(f => f.name)).toEqual(['id', 'name', 'dept', 'active', 'score'])
  })

  it('infers numeric type for all-number fields', () => {
    const s = inferSchema('S1', employees)
    expect(s.fields.find(f => f.name === 'id')?.type).toBe('numeric')
  })

  it('infers boolean type for all-boolean fields', () => {
    const s = inferSchema('S1', employees)
    expect(s.fields.find(f => f.name === 'active')?.type).toBe('boolean')
  })

  it('infers the underlying type for fields with null values', () => {
    const s = inferSchema('S1', employees)
    expect(s.fields.find(f => f.name === 'score')?.type).toBe('numeric')
  })

  it('infers string type for string fields', () => {
    const s = inferSchema('S1', employees)
    expect(s.fields.find(f => f.name === 'name')?.type).toBe('string')
  })

  it('includes domain when unique encoded values <= 8', () => {
    const s = inferSchema('S1', employees)
    const dept = s.fields.find(f => f.name === 'dept')
    expect(dept?.domain).toEqual(expect.arrayContaining(['Eng', 'Sales', 'HR']))
    expect(dept?.domain?.length).toBe(3)
  })

  it('omits domain when unique encoded values > 8', () => {
    const bigData = Array.from({ length: 20 }, (_, i) => ({ tag: `tag-${i}` }))
    const s = inferSchema('T1', bigData)
    expect(s.fields.find(f => f.name === 'tag')?.domain).toBeUndefined()
  })

  it('returns empty fields for empty sample data', () => {
    expect(inferSchema('S1', []).fields).toEqual([])
  })
})
