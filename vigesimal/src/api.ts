import type { VigesimalSchema } from './types'
import type { TokenEstimator } from './encoder/codes'
import { encodeTabular } from './encoder/panels'
import { decodeTabular } from './verify/decode'
import { inferSchema } from './schema/infer'

export interface EncodeOptions {
  /** Dataset name shown in the header. Default: "data". */
  name?: string
  /** Explicit schema; inferred from the records when omitted. */
  schema?: VigesimalSchema
  /** Token estimator for code-payoff decisions (e.g. js-tiktoken-backed). */
  est?: TokenEstimator
}

/** One-call happy path: infer the schema and encode records as a v1 block. */
export function encode(
  records: Record<string, unknown>[],
  options: EncodeOptions = {}
): string {
  const name = options.name ?? 'data'
  const schema = options.schema ?? inferSchema(name, records)
  return encodeTabular(name, records, schema, options.est)
}

/** One-call decode. Pass the schema from `inferSchema`/`encode` for exact
 * field types; without one, every field decodes as a string (except `_`,
 * which is always null). */
export function decode(
  encoded: string,
  schema?: VigesimalSchema
): Record<string, unknown>[] {
  if (schema) return decodeTabular(encoded, schema)
  // Schema-less fallback: derive a string-typed schema from the header,
  // then coerce purely-numeric columns to numbers.
  const fieldsLine = encoded.split('\n').find(l => l.startsWith('fields: '))
  if (!fieldsLine) throw new Error('Malformed vigesimal block: missing "fields:" line')
  const fields = fieldsLine.slice('fields: '.length).split(',')
  const fallback: VigesimalSchema = {
    name: 'decoded',
    fields: fields.map(f => ({ name: f, type: 'string' as const })),
  }
  const rows = decodeTabular(encoded, fallback)
  for (const field of fields) {
    const values = rows.map(r => r[field]).filter(v => v !== null)
    if (
      values.length > 0 &&
      values.every(v => typeof v === 'string' && /^-?\d+(\.\d+)?$/.test(v))
    ) {
      for (const row of rows) {
        if (row[field] !== null) row[field] = Number(row[field])
      }
    }
  }
  return rows
}
