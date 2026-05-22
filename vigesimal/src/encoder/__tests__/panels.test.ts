import { describe, it, expect } from 'vitest'
import type { VigesimalSchema } from '../../types'
import { encodeTuple, encodeTabular } from '../panels'

const userSchema: VigesimalSchema = {
  name: 'S1',
  fields: [
    { name: 'tier', type: 'string', domain: ['prem', 'free'] },
    { name: 'step', type: 'string' },
    { name: 'lang', type: 'string' },
    { name: 'active', type: 'boolean' },
  ],
}

describe('encodeTuple (Panel-A)', () => {
  it('encodes a record to a positional tuple', () => {
    const record = { tier: 'prem', step: '3/7', lang: 'en', active: true }
    expect(encodeTuple(record, userSchema)).toBe('S1[prem|3/7|en|+]')
  })

  it('encodes null as _', () => {
    const record = { tier: null, step: '1/3', lang: 'en', active: false }
    expect(encodeTuple(record, userSchema)).toBe('S1[_|1/3|en|-]')
  })

  it('encodes missing fields as _', () => {
    const record = { tier: 'free', step: '1/3' }
    expect(encodeTuple(record, userSchema)).toBe('S1[free|1/3|_|_]')
  })

  it('escapes special chars in string values', () => {
    const record = { tier: 'a|b', step: '1/3', lang: 'en', active: true }
    expect(encodeTuple(record, userSchema)).toBe('S1[a\\|b|1/3|en|+]')
  })
})

const ticketSchema: VigesimalSchema = {
  name: 'T1',
  fields: [
    { name: 'id', type: 'numeric' },
    { name: 'status', type: 'string', domain: ['open', 'closed'] },
    { name: 'priority', type: 'string', domain: ['high', 'low'] },
  ],
}

describe('encodeTabular (Panel-B)', () => {
  it('produces S1xN header and comma-delimited rows', () => {
    const records = [
      { id: 101, status: 'open', priority: 'high' },
      { id: 102, status: 'closed', priority: 'low' },
      { id: 103, status: 'open', priority: 'high' },
    ]
    const result = encodeTabular(records, ticketSchema)
    expect(result).toBe(
      'T1x3[id,status,priority]:\n  101,open,high\n  102,closed,low\n  103,open,high'
    )
  })

  it('uses scalar encoding in rows (booleans, nulls)', () => {
    const schema: VigesimalSchema = {
      name: 'R1',
      fields: [
        { name: 'id', type: 'numeric' },
        { name: 'active', type: 'boolean' },
        { name: 'score', type: 'numeric' },
      ],
    }
    const records = [
      { id: 1, active: true, score: 0 },
      { id: 2, active: false, score: null },
      { id: 3, active: true, score: 5 },
    ]
    expect(encodeTabular(records, schema)).toBe(
      'R1x3[id,active,score]:\n  1,+,0\n  2,-,_\n  3,+,5'
    )
  })
})
