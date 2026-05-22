import { describe, it, expect } from 'vitest'
import type { VigesimalSchema } from '../../types'
import { Panel } from '../../types'
import { SchemaRegistry } from '../SchemaRegistry'

const manualSchema: VigesimalSchema = {
  name: 'S1',
  fields: [
    { name: 'tier', type: 'string', domain: ['prem', 'free'] },
    { name: 'step', type: 'string' },
  ],
}

describe('SchemaRegistry', () => {
  it('stores and retrieves a manually registered schema', () => {
    const reg = new SchemaRegistry()
    reg.register('user', manualSchema)
    expect(reg.get('user')).toEqual(manualSchema)
  })

  it('throws when getting an unregistered schema', () => {
    const reg = new SchemaRegistry()
    expect(() => reg.get('missing')).toThrow('Schema "missing" not found')
  })

  it('infers a schema from sample data and stores it', () => {
    const reg = new SchemaRegistry()
    const sample = [
      { id: 1, active: true },
      { id: 2, active: false },
    ]
    const schema = reg.infer('item', sample)
    expect(schema.fields.map(f => f.name)).toEqual(['id', 'active'])
    expect(reg.get('item')).toEqual(schema)
  })

  it('getCodex returns a Panel-A codex block for a registered schema', () => {
    const reg = new SchemaRegistry()
    reg.register('user', manualSchema)
    const codex = reg.getCodex('user')
    expect(codex).toContain('## GRAMMAR v4 [A:core]')
    expect(codex).toContain('S1[tier|step]')
    expect(codex).toContain('  tier:prem|free')
  })

  it('getCodex passes requested panels to buildCodex', () => {
    const reg = new SchemaRegistry()
    reg.register('user', manualSchema)
    const codex = reg.getCodex('user', [Panel.A, Panel.B])
    expect(codex).toContain('[A:core B:tabular]')
  })

  it('register overwrites an existing schema with the same name', () => {
    const reg = new SchemaRegistry()
    reg.register('user', manualSchema)
    const updated: VigesimalSchema = { name: 'S2', fields: [{ name: 'x', type: 'string' }] }
    reg.register('user', updated)
    expect(reg.get('user').name).toBe('S2')
  })
})
