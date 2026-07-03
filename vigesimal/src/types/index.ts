// Panel identifiers
export enum Panel {
  A = 'A',
  B = 'B',
  C = 'C',
}

// Field type hint for schema inference
export type FieldType = 'boolean' | 'numeric' | 'string' | 'nullable'

// A single field in a schema
export interface FieldDef {
  name: string
  type: FieldType
  domain?: string[]  // closed value set (max 8 unique encoded values)
}

// Named schema definition — fields are ordered; position = identity
export interface VigesimalSchema {
  name: string     // e.g. "S1", "T1"
  fields: FieldDef[]
}

// Delta map: present keys = changed fields, absent keys = unchanged
export type DeltaMap = Record<string, unknown>

// Typed reset event union
export type ResetEvent =
  | 'session_start'
  | 'tier_upgrade'
  | 'err_recovery'
  | 'intent_pivot'
  | 'drift_exceeded'

// Reset rule: watches a field and fires an event when a condition is met
export interface ResetRule {
  field: string
  event: ResetEvent
  condition: (oldValue: unknown, newValue: unknown) => boolean
}

// Config for DeltaTracker
export interface DeltaTrackerConfig {
  resetRules?: ResetRule[]
}

// Result of a DeltaTracker.update() call
export type DeltaResult =
  | { type: 'reset'; delta: DeltaMap; resetReason: ResetEvent }
  | { type: 'delta'; delta: DeltaMap }

// Stats returned with every compression result
export interface CompressStats {
  inputTokenEstimate: number    // rough estimate for original JSON
  outputTokenEstimate: number   // rough estimate for compressed output
  reduction: number             // 0.0–1.0
}

// Result of AdaptiveCompressor.compress() or session.compress()
export interface CompressResult {
  output: string
  panelsUsed: Panel[]
  stats: CompressStats
}

// A stateful session returned by AdaptiveCompressor.createSession()
export interface CompressorSession {
  compress(state: Record<string, unknown>): CompressResult
  reset(): void
}

// Verification result
export interface VerifyResult {
  valid: boolean
  errors: string[]
}
