import { describe, it, expect } from 'vitest'
import type { VigesimalSchema } from '../../types'
import { encodeHeader, encodeRow, encodeTabular, encodeDelta, LEGEND } from '../panels'
import { buildCodes } from '../codes'

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
  { id: 3, department: 'Engineering', active: true },
]

describe('encodeHeader', () => {
  it('emits name, count, fields, codes, legend', () => {
    const codes = buildCodes(['id', 'department', 'active'], records)
    const h = encodeHeader('employees', records.length, schema, codes)
    expect(h.split('\n')).toEqual([
      '## employees: 3 rows',
      'fields: id,department,active',
      'codes: D1=Engineering',
      LEGEND,
      '',
    ])
  })

  it('omits codes line when no codes', () => {
    const h = encodeHeader('t', 1, schema, new Map())
    expect(h).not.toContain('codes:')
  })

  it('quotes multiword code values', () => {
    const recs = Array.from({ length: 10 }, () => ({ city: 'New York City' }))
    const s: VigesimalSchema = { name: 'c', fields: [{ name: 'city', type: 'string' }] }
    const codes = buildCodes(['city'], recs)
    expect(encodeHeader('c', 10, s, codes)).toContain('codes: C1="New York City"')
  })
})

describe('encodeRow', () => {
  it('substitutes codes and renders scalars', () => {
    const codes = buildCodes(['id', 'department', 'active'], records)
    expect(encodeRow(records[0], schema, codes)).toBe('1,D1,1')
    expect(encodeRow(records[1], schema, codes)).toBe('2,D1,0')
  })

  it('renders absent fields as _', () => {
    expect(encodeRow({ id: 5 }, schema, new Map())).toBe('5,_,_')
  })

  it('quotes a literal equal to an assigned code', () => {
    const recs = [...records.map(r => ({ department: r.department })), { department: 'D1' }]
    const s: VigesimalSchema = { name: 'x', fields: [{ name: 'department', type: 'string' }] }
    const codes = buildCodes(['department'], recs)
    expect(encodeRow({ department: 'D1' }, s, codes)).toBe('"D1"')
  })
})

describe('encodeTabular', () => {
  it('emits header plus one row per record', () => {
    const out = encodeTabular('employees', records, schema)
    const lines = out.split('\n')
    expect(lines[0]).toBe('## employees: 3 rows')
    expect(lines.at(-2)).toBe('3,D1,1')
    expect(lines.at(-1)).toBe('')
  })

  it('handles empty record lists', () => {
    expect(encodeTabular('e', [], schema)).toBe('## e: 0 rows\n')
  })
})

describe('encodeDelta', () => {
  it('renders keyed changed fields', () => {
    expect(encodeDelta({ step: '3/5', status: 'err' })).toBe('~step=3/5,~status=err')
  })
  it('renders deletions as _', () => {
    expect(encodeDelta({ gone: undefined })).toBe('~gone=_')
  })
  it('quotes values containing commas', () => {
    expect(encodeDelta({ msg: 'a,b' })).toBe('~msg="a,b"')
  })
  it('renders empty delta as empty ~', () => {
    expect(encodeDelta({})).toBe('~')
  })
})
