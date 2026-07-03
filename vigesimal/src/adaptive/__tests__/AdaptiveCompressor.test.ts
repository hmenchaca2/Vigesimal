import { describe, it, expect } from 'vitest'
import { Panel } from '../../types'
import { SchemaRegistry } from '../../schema/SchemaRegistry'
import { AdaptiveCompressor } from '../AdaptiveCompressor'

const sampleUsers = [
  { tier: 'free', step: '1/5', active: true },
  { tier: 'prem', step: '2/5', active: false },
  { tier: 'free', step: '3/5', active: true },
]

function makeCompressor() {
  const reg = new SchemaRegistry()
  reg.infer('user', sampleUsers)
  return new AdaptiveCompressor(reg)
}

describe('AdaptiveCompressor.compress()', () => {
  it('compresses a single record to a tuple', () => {
    const c = makeCompressor()
    const { output } = c.compress({ tier: 'prem', step: '3/5', active: true }, 'user')
    expect(output).toMatch(/^## user: 1 rows/)
  })

  it('uses only Panel-A for a single record', () => {
    const c = makeCompressor()
    const { panelsUsed } = c.compress({ tier: 'prem', step: '3/5', active: true }, 'user')
    expect(panelsUsed).toEqual([Panel.A])
  })

  it('returns stats with positive inputTokenEstimate', () => {
    const c = makeCompressor()
    const { stats } = c.compress({ tier: 'prem', step: '3/5', active: true }, 'user')
    expect(stats.inputTokenEstimate).toBeGreaterThan(0)
    expect(stats.outputTokenEstimate).toBeGreaterThan(0)
    expect(stats.reduction).toBeGreaterThanOrEqual(0)
    expect(stats.reduction).toBeLessThan(1)
  })
})

describe('AdaptiveCompressor.compressRecords()', () => {
  it('uses Panel-B for 3 or more records', () => {
    const c = makeCompressor()
    const { panelsUsed, output } = c.compressRecords(sampleUsers, 'user')
    expect(panelsUsed).toContain(Panel.B)
    expect(output).toContain('## user: 3 rows')
  })

  it('uses only Panel-A for fewer than 3 records', () => {
    const c = makeCompressor()
    const { panelsUsed } = c.compressRecords(sampleUsers.slice(0, 2), 'user')
    expect(panelsUsed).not.toContain(Panel.B)
  })
})

describe('AdaptiveCompressor.createSession()', () => {
  it('first compress in session returns full tuple', () => {
    const c = makeCompressor()
    const session = c.createSession('user')
    const { output, panelsUsed } = session.compress({ tier: 'free', step: '1/5', active: true })
    expect(panelsUsed).toEqual([Panel.A])
    expect(output).toMatch(/^## user: 1 rows/)
  })

  it('second compress with single field change returns delta (Panel-C)', () => {
    const c = makeCompressor()
    const session = c.createSession('user')
    session.compress({ tier: 'free', step: '1/5', active: true })
    const { output, panelsUsed } = session.compress({ tier: 'free', step: '2/5', active: true })
    expect(panelsUsed).toContain(Panel.C)
    expect(output).toMatch(/^~step=/)
  })

  it('reset() makes the next compress return a full tuple again', () => {
    const c = makeCompressor()
    const session = c.createSession('user')
    session.compress({ tier: 'free', step: '1/5', active: true })
    session.compress({ tier: 'free', step: '2/5', active: true })
    session.reset()
    const { panelsUsed } = session.compress({ tier: 'free', step: '2/5', active: true })
    expect(panelsUsed).not.toContain(Panel.C)
    expect(panelsUsed).toContain(Panel.A)
  })
})
