import { describe, it, expect } from 'vitest'
import type { ResetRule } from '../../types'
import { DeltaTracker } from '../DeltaTracker'

const state1 = { tier: 'free', step: '1/5', lang: 'en', status: 'ok' }
const state2 = { tier: 'free', step: '2/5', lang: 'en', status: 'ok' }
const state3 = { tier: 'free', step: '3/5', lang: 'en', status: 'ok' }

describe('DeltaTracker — basic delta', () => {
  it('first update returns session_start reset', () => {
    const tracker = new DeltaTracker()
    const result = tracker.update(state1)
    expect(result.type).toBe('reset')
    if (result.type === 'reset') expect(result.resetReason).toBe('session_start')
  })

  it('second update with single field change returns delta', () => {
    const tracker = new DeltaTracker()
    tracker.update(state1)
    const result = tracker.update(state2)
    expect(result.type).toBe('delta')
    expect(result.delta).toEqual({ step: '2/5' })
  })

  it('delta contains only changed fields', () => {
    const tracker = new DeltaTracker()
    tracker.update(state1)
    tracker.update(state2)
    const result = tracker.update(state3)
    expect(result.type).toBe('delta')
    expect(result.delta).toEqual({ step: '3/5' })
    expect(Object.keys(result.delta)).not.toContain('tier')
  })

  it('unchanged fields are absent from delta', () => {
    const tracker = new DeltaTracker()
    tracker.update(state1)
    const result = tracker.update({ ...state1 })  // no changes
    expect(result.type).toBe('delta')
    expect(result.delta).toEqual({})
  })
})

describe('DeltaTracker — Venus correction (drift_exceeded)', () => {
  it('resets when turn count exceeds Venus threshold', () => {
    // With 4 fields changing every turn, avg=4 → threshold=floor(18/4)=4
    // On turn 5 (after base), turn_count (5) > threshold (4), so reset
    const tracker = new DeltaTracker()
    const base = { a: '0', b: '0', c: '0', d: '0' }
    tracker.update(base)
    for (let i = 1; i <= 4; i++) {
      const s = { a: String(i), b: String(i), c: String(i), d: String(i) }
      tracker.update(s)
    }
    const result = tracker.update({ a: '5', b: '5', c: '5', d: '5' })
    expect(result.type).toBe('reset')
    if (result.type === 'reset') expect(result.resetReason).toBe('drift_exceeded')
  })
})

describe('DeltaTracker — typed reset rules', () => {
  it('fires a custom reset rule when condition is met', () => {
    const tierUpgradeRule: ResetRule = {
      field: 'tier',
      event: 'tier_upgrade',
      condition: (oldVal, newVal) => oldVal === 'free' && newVal === 'prem',
    }
    const tracker = new DeltaTracker({ resetRules: [tierUpgradeRule] })
    tracker.update({ tier: 'free', step: '1/5' })
    const result = tracker.update({ tier: 'prem', step: '1/5' })
    expect(result.type).toBe('reset')
    if (result.type === 'reset') expect(result.resetReason).toBe('tier_upgrade')
  })

  it('does not fire rule when condition is not met', () => {
    const tierUpgradeRule: ResetRule = {
      field: 'tier',
      event: 'tier_upgrade',
      condition: (oldVal, newVal) => oldVal === 'free' && newVal === 'prem',
    }
    const tracker = new DeltaTracker({ resetRules: [tierUpgradeRule] })
    tracker.update({ tier: 'free', step: '1/5' })
    const result = tracker.update({ tier: 'free', step: '2/5' })
    expect(result.type).toBe('delta')
  })
})

describe('DeltaTracker — helper methods', () => {
  it('getFieldChangeRate returns avg fields changed per turn', () => {
    const tracker = new DeltaTracker()
    tracker.update({ a: '1', b: '1' })          // turn 1: session_start, 0 delta fields counted
    tracker.update({ a: '2', b: '1' })          // turn 2: 1 field changed
    tracker.update({ a: '3', b: '2' })          // turn 3: 2 fields changed
    // totalDeltaFields = 3, turnCount = 3
    expect(tracker.getFieldChangeRate()).toBeCloseTo(1)
  })

  it('reset() clears all state', () => {
    const tracker = new DeltaTracker()
    tracker.update(state1)
    tracker.update(state2)
    tracker.reset()
    const result = tracker.update(state1)
    expect(result.type).toBe('reset')
    if (result.type === 'reset') expect(result.resetReason).toBe('session_start')
  })
})
