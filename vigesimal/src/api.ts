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

/** Infer the schema and encode records as a typed block. */
export function encode(
  records: Record<string, unknown>[],
  options: EncodeOptions = {}
): string {
  const name = options.name ?? 'data'
  const schema = options.schema ?? inferSchema(name, records)
  return encodeTabular(name, records, schema, options.est)
}

/** Decode typed blocks exactly. Legacy blocks without metadata need a schema
 * for typed decoding; otherwise their scalars remain strings/null. */
export function decode(
  encoded: string,
  schema?: VigesimalSchema
): Record<string, unknown>[] {
  return decodeTabular(encoded, schema)
}
