import { describe, it, expect } from 'vitest'
import { estTokens, fieldLetters, buildCodes } from '../codes'

describe('estTokens', () => {
  it('estimates chars/4 rounded up, min 1', () => {
    expect(estTokens('ab')).toBe(1)
    expect(estTokens('Engineering')).toBe(3) // 11 chars
  })
})

describe('fieldLetters', () => {
  it('uses first letter uppercased', () => {
    expect(fieldLetters(['department']).get('department')).toBe('D')
  })
  it('resolves collisions with next distinct letter', () => {
    const m = fieldLetters(['location', 'language'])
    expect(m.get('location')).toBe('L')
    expect(m.get('language')).toBe('A')
  })
})

describe('buildCodes', () => {
  const rep = (v: string, n: number) => Array.from({ length: n }, () => ({ department: v }))

  it('codes a frequent long value', () => {
    const codes = buildCodes(['department'], rep('Engineering', 10))
    expect(codes.get('department')?.get('Engineering')).toBe('D1')
  })

  it('never codes short values', () => {
    expect(buildCodes(['department'], rep('HR', 50)).size).toBe(0)
  })

  it('never codes rare values', () => {
    const records = [...rep('Engineering', 2), ...rep('A', 8)]
    expect(buildCodes(['department'], records).size).toBe(0)
  })

  it('caps at 19 codes keeping highest payoff', () => {
    const records: Record<string, unknown>[] = []
    for (let i = 0; i < 25; i++) {
      for (let j = 0; j < 25 - i; j++) {
        records.push({ department: `VeryLongDepartment${String(i).padStart(2, '0')}` })
      }
    }
    const m = buildCodes(['department'], records).get('department')!
    expect(m.size).toBe(19)
    expect(m.has('VeryLongDepartment00')).toBe(true)
    expect(m.has('VeryLongDepartment24')).toBe(false)
  })

  it('never codes non-strings', () => {
    const records = Array.from({ length: 50 }, () => ({ salary: 95000 }))
    expect(buildCodes(['salary'], records).size).toBe(0)
  })

  it('respects a custom estimator', () => {
    const codes = buildCodes(['department'], rep('Engineering', 50), () => 1)
    expect(codes.size).toBe(0)
  })
})
