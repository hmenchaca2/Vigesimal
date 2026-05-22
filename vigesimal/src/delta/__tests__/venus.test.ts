import { describe, it, expect } from 'vitest'
import { computeResetThreshold } from '../venus'

describe('computeResetThreshold', () => {
  it('returns 18 when no turns observed', () => {
    expect(computeResetThreshold(0, 0)).toBe(18)
  })

  it('returns 18 when avg change rate is zero', () => {
    expect(computeResetThreshold(0, 5)).toBe(18)
  })

  it('calculates floor(18 / avg) for normal usage', () => {
    // avg = 6/3 = 2 fields/turn → floor(18/2) = 9
    expect(computeResetThreshold(6, 3)).toBe(9)
  })

  it('handles avg of 1 field per turn', () => {
    // avg = 5/5 = 1 → floor(18/1) = 18
    expect(computeResetThreshold(5, 5)).toBe(18)
  })

  it('handles high avg change rate', () => {
    // avg = 24/4 = 6 → floor(18/6) = 3
    expect(computeResetThreshold(24, 4)).toBe(3)
  })

  it('floors the result', () => {
    // avg = 7/4 = 1.75 → floor(18/1.75) = floor(10.28) = 10
    expect(computeResetThreshold(7, 4)).toBe(10)
  })
})
