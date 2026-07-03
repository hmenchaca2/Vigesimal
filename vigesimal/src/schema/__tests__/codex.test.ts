import { describe, it, expect } from 'vitest'
import type { VigesimalSchema } from '../../types'
import { buildCodex } from '../codex'

const schema: VigesimalSchema = {
  name: 'S1',
  fields: [
    { name: 'tier', type: 'string', domain: ['prem', 'free', 'trial'] },
    { name: 'step', type: 'string' },
    { name: 'active', type: 'boolean', domain: ['+', '-'] },
  ],
}

describe('buildCodex', () => {
  it('includes the fields line', () => {
    const codex = buildCodex(schema)
    expect(codex).toContain('fields: tier,step,active')
  })

  it('includes the symbol legend line', () => {
    const codex = buildCodex(schema)
    expect(codex).toContain('bool: 1=yes 0=no  null: _')
  })

  it('includes domain declarations for fields with closed domains', () => {
    const codex = buildCodex(schema)
    expect(codex).toContain('  tier: prem|free|trial')
    expect(codex).toContain('  active: +|-')
  })

  it('omits domain line for fields without a domain', () => {
    const codex = buildCodex(schema)
    expect(codex).not.toContain('  step:')
  })

  it('ends with a newline', () => {
    const codex = buildCodex(schema)
    expect(codex.endsWith('\n')).toBe(true)
  })
})
