import { describe, it, expect } from 'vitest'
import type { VigesimalSchema } from '../../types'
import { Panel } from '../../types'
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
  it('starts with GRAMMAR v4 header', () => {
    const codex = buildCodex(schema, [Panel.A])
    expect(codex).toContain('## GRAMMAR v4 [A:core]')
  })

  it('includes the symbol legend line', () => {
    const codex = buildCodex(schema, [Panel.A])
    expect(codex).toContain('[]+,+  +=present _=absent 0=zero -=err')
  })

  it('includes schema declaration with [|] notation', () => {
    const codex = buildCodex(schema, [Panel.A])
    expect(codex).toContain('S1[tier|step|active]')
  })

  it('includes domain declarations for fields with closed domains', () => {
    const codex = buildCodex(schema, [Panel.A])
    expect(codex).toContain('  tier:prem|free|trial')
    expect(codex).toContain('  active:+|-')
  })

  it('omits domain line for fields without a domain', () => {
    const codex = buildCodex(schema, [Panel.A])
    expect(codex).not.toContain('  step:')
  })

  it('ends with a newline', () => {
    const codex = buildCodex(schema, [Panel.A])
    expect(codex.endsWith('\n')).toBe(true)
  })

  it('includes Panel-B note when Panel.B is requested', () => {
    const codex = buildCodex(schema, [Panel.A, Panel.B])
    expect(codex).toContain('[A:core B:tabular]')
  })

  it('includes Panel-C note when Panel.C is requested', () => {
    const codex = buildCodex(schema, [Panel.A, Panel.C])
    expect(codex).toContain('[A:core C:delta]')
  })
})
