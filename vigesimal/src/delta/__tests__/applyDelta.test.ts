import { describe, expect, it } from 'vitest'
import { applyDelta } from '../applyDelta'

describe('applyDelta', () => {
  it('sets changed fields', () => {
    expect(applyDelta({ a: 1, b: 2 }, { a: 3 })).toEqual({ a: 3, b: 2 })
  })
  it('keeps an explicit null rather than deleting the field', () => {
    expect(applyDelta({ a: 1 }, { a: null })).toEqual({ a: null })
    expect('a' in applyDelta({ a: 1 }, { a: null })).toBe(true)
  })
  it('deletes a field whose delta value is undefined', () => {
    const result = applyDelta({ a: 1, b: 2 }, { a: undefined })
    expect(result).toEqual({ b: 2 })
    expect('a' in result).toBe(false)
  })
  it('does not mutate the input state', () => {
    const state = { a: 1 }
    applyDelta(state, { a: undefined })
    expect(state).toEqual({ a: 1 })
  })
  it('leaves state untouched for an empty delta', () => {
    expect(applyDelta({ a: 1 }, {})).toEqual({ a: 1 })
  })
})
