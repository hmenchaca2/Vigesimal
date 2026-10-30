import type { DeltaMap } from '../types'

// Merges a decoded delta onto a prior state. A field whose delta value is
// undefined (wire: ~field with no value) is deleted; null (wire: ~field=_)
// is kept as an explicit null. Does not mutate the input state.
export function applyDelta(
  state: Record<string, unknown>,
  delta: DeltaMap
): Record<string, unknown> {
  const next = { ...state }
  for (const [field, value] of Object.entries(delta)) {
    if (value === undefined) delete next[field]
    else next[field] = value
  }
  return next
}
