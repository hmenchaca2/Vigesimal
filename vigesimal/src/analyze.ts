import { encode, decode, type EncodeOptions } from './api'
import { estTokens } from './encoder/codes'
import { inferSchema } from './schema/infer'
import { validateName, validateRecords } from './schema/validate'
import { encodeHeader, encodeRow } from './encoder/panels'
import type { VigesimalSchema } from './types'

export interface AnalyzeOptions extends EncodeOptions {
  /** Label for the supplied counter, e.g. o200k_base. Never inferred. */
  tokenizer?: string
}

export interface Analysis {
  supported: boolean
  roundTrip: boolean
  format: 'vigesimal' | 'json'
  output: string
  encoded: string | null
  inputTokens: number
  vigesimalTokens: number | null
  outputTokens: number
  reduction: number
  tokenizer: string
  estimated: boolean
  warnings: string[]
}

// JSON fallback must never silently discard non-JSON values or cycles.
function validateJson(value: unknown, ancestors = new Set<object>()): void {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return
  if (typeof value === 'number' && Number.isFinite(value) && !Object.is(value, -0)) return
  if (typeof value !== 'object' || !value) throw new Error('Analysis requires JSON-compatible data')
  if (ancestors.has(value)) throw new Error('Analysis requires acyclic JSON data')
  if (!Array.isArray(value) && ![Object.prototype, null].includes(Object.getPrototypeOf(value))) {
    throw new Error('Analysis requires plain JSON objects')
  }
  if (Object.getOwnPropertySymbols(value).length) throw new Error('Symbol keys are not JSON-compatible')
  ancestors.add(value)
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) validateJson(value[i], ancestors)
  } else {
    for (const entry of Object.values(value)) validateJson(entry, ancestors)
  }
  ancestors.delete(value)
}

/** Analyze complete payloads locally. Falls back to compact JSON unless a
 * supported, verified Vigesimal block is strictly smaller by the counter. */
export function analyze(data: unknown, options: AnalyzeOptions = {}): Analysis {
  validateJson(data)
  const json = JSON.stringify(data)
  const counter = options.est ?? estTokens
  const counts = new Map<string, number>()
  const count = (text: string) => {
    const cached = counts.get(text)
    if (cached !== undefined) return cached
    const result = counter(text)
    if (!Number.isSafeInteger(result) || result < 0) throw new Error('Token counter must return a nonnegative integer')
    counts.set(text, result)
    return result
  }
  const inputTokens = count(json)
  const warnings: string[] = []
  let supported = false
  let roundTrip = false
  let encoded: string | null = null
  let schema: VigesimalSchema | undefined
  // Validate separately so tokenizer errors are not mislabeled as unsupported data.
  try {
    if (!Array.isArray(data)) throw new Error('Vigesimal requires an array of flat records')
    const rows = data as Record<string, unknown>[]
    validateName(options.name ?? 'data')
    schema = options.schema ?? inferSchema(options.name ?? 'data', rows)
    validateRecords(rows, schema)
    // Sparse records normalize to null, so use JSON when exact JSON shape matters.
    const fields = schema.fields
    if (rows.some(row => fields.some(f => !Object.prototype.hasOwnProperty.call(row, f.name)))) {
      throw new Error('Sparse records normalize missing fields to null; keeping JSON preserves their shape')
    }
    supported = true
  } catch (error) {
    warnings.push((error as Error).message)
  }
  if (supported) {
    const rows = data as Record<string, unknown>[]
    encoded = encode(rows, { ...options, schema, est: count })
    if (rows.length && encoded.includes('\ncodes: ')) {
      const codes = new Map<string, Map<string, string>>()
      const uncoded = encodeHeader(options.name ?? 'data', rows.length, schema!, codes) +
        rows.map(row => encodeRow(row, schema!, codes)).join('\n') + '\n'
      if (count(uncoded) <= count(encoded)) encoded = uncoded
    }
    const decoded = decode(encoded)
    roundTrip = decoded.length === rows.length && decoded.every((row, index) =>
      Object.keys(row).length === Object.keys(rows[index]).length &&
      Object.keys(row).every(key => Object.is(row[key], rows[index][key])))
    if (!roundTrip) warnings.push('Round-trip verification failed; keeping JSON')
  }
  const vigesimalTokens = encoded === null ? null : count(encoded)
  const useVigesimal = roundTrip && vigesimalTokens !== null && vigesimalTokens < inputTokens
  const outputTokens = useVigesimal ? vigesimalTokens! : inputTokens
  if (supported && !useVigesimal && roundTrip) warnings.push('Vigesimal is not smaller; keeping compact JSON')
  if (!options.est) warnings.push('Token counts are character-based estimates, not model billing counts')
  return {
    supported, roundTrip, format: useVigesimal ? 'vigesimal' : 'json',
    output: useVigesimal ? encoded! : json, encoded, inputTokens, vigesimalTokens,
    outputTokens, reduction: inputTokens ? 1 - outputTokens / inputTokens : 0,
    tokenizer: options.tokenizer ?? (options.est ? 'custom' : 'chars/4'),
    estimated: !options.est, warnings,
  }
}
