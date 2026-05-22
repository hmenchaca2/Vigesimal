import type { DeltaMap, DeltaResult, DeltaTrackerConfig } from '../types'
import { computeResetThreshold } from './venus'

export class DeltaTracker {
  private prevState: Record<string, unknown> | null = null
  private turnCount = 0
  private totalDeltaFields = 0
  private config: DeltaTrackerConfig

  constructor(config: DeltaTrackerConfig = {}) {
    this.config = config
  }

  update(newState: Record<string, unknown>): DeltaResult {
    if (this.prevState === null) {
      this.prevState = { ...newState }
      this.turnCount = 1
      return { type: 'reset', delta: {}, resetReason: 'session_start' }
    }

    // Check typed reset rules before computing delta
    for (const rule of this.config.resetRules ?? []) {
      const oldVal = this.prevState[rule.field]
      const newVal = newState[rule.field]
      if (rule.condition(oldVal, newVal)) {
        this.prevState = { ...newState }
        this.totalDeltaFields = 0
        this.turnCount = 1
        return { type: 'reset', delta: {}, resetReason: rule.event }
      }
    }

    // Compute per-field delta
    const delta: DeltaMap = {}
    let changedCount = 0
    for (const key of Object.keys(newState)) {
      if (newState[key] !== this.prevState[key]) {
        delta[key] = newState[key]
        changedCount++
      }
    }

    this.turnCount++
    this.totalDeltaFields += changedCount

    // Check Venus correction threshold
    const threshold = computeResetThreshold(this.totalDeltaFields, this.turnCount)
    if (this.turnCount > threshold) {
      this.prevState = { ...newState }
      this.totalDeltaFields = 0
      this.turnCount = 1
      return { type: 'reset', delta: {}, resetReason: 'drift_exceeded' }
    }

    this.prevState = { ...newState }
    return { type: 'delta', delta }
  }

  shouldReset(): boolean {
    const threshold = computeResetThreshold(this.totalDeltaFields, this.turnCount)
    return this.turnCount > threshold
  }

  getResetThreshold(): number {
    return computeResetThreshold(this.totalDeltaFields, this.turnCount)
  }

  getFieldChangeRate(): number {
    if (this.turnCount === 0) return 0
    return this.totalDeltaFields / this.turnCount
  }

  reset(): void {
    this.prevState = null
    this.turnCount = 0
    this.totalDeltaFields = 0
  }
}
