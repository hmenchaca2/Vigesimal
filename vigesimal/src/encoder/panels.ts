import type { DeltaMap, VigesimalSchema } from '../types'
import { encodeScalar, quoteCsv } from './scalars'
import { buildCodes, codesValue, type TokenEstimator } from './codes'

export const LEGEND = 'bool: 1=yes 0=no  null: _'

export type CodeTable = Map<string, Map<string, string>>

export function encodeHeader(
  name: string,
  rowCount: number,
  schema: VigesimalSchema,
  codes: CodeTable
): string {
  const lines = [`## ${name}: ${rowCount} rows`, `fields: ${schema.fields.map(f => f.name).join(',')}`]
  if (codes.size > 0) {
    const pairs: string[] = []
    for (const field of schema.fields) {
      const m = codes.get(field.name)
      if (!m) continue
      for (const [value, code] of m) pairs.push(`${code}=${codesValue(value)}`)
    }
    lines.push('codes: ' + pairs.join(' '))
  }
  lines.push(LEGEND)
  // Blank line separates header from data rows (canonical wire format,
  // matches the benchmarked Python reference encoder)
  lines.push('')
  lines.push('')
  return lines.join('\n')
}

export function encodeRow(
  record: Record<string, unknown>,
  schema: VigesimalSchema,
  codes: CodeTable
): string {
  return schema.fields
    .map(f => {
      const v = record[f.name]
      const fieldCodes = codes.get(f.name)
      if (fieldCodes && typeof v === 'string') {
        const code = fieldCodes.get(v)
        if (code !== undefined) return code
        // Literal colliding with an assigned code must stay distinguishable
        if ([...fieldCodes.values()].includes(v)) return quoteCsv(v)
      }
      return encodeScalar(v)
    })
    .join(',')
}

export function encodeTabular(
  name: string,
  records: Record<string, unknown>[],
  schema: VigesimalSchema,
  est?: TokenEstimator
): string {
  if (records.length === 0) return `## ${name}: 0 rows\n`
  const codes = buildCodes(schema.fields.map(f => f.name), records, est)
  const header = encodeHeader(name, records.length, schema, codes)
  const rows = records.map(r => encodeRow(r, schema, codes))
  return header + rows.join('\n') + '\n'
}

// Keyed delta: ~field=value pairs, comma-separated; undefined -> _ (deletion).
export function encodeDelta(delta: DeltaMap): string {
  const pairs = Object.entries(delta).map(([k, v]) => `~${k}=${encodeScalar(v)}`)
  return pairs.length > 0 ? pairs.join(',') : '~'
}
