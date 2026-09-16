import type { VerifyResult, VigesimalSchema } from '../types'
import { decodeTabular } from './decode'
import { validateRecords } from '../schema/validate'

export class VigesimalVerifier {
  decode(encoded: string, schema: VigesimalSchema): Record<string, unknown>[] {
    return decodeTabular(encoded, schema)
  }

  verify(
    encoded: string,
    original: Record<string, unknown>[],
    schema: VigesimalSchema
  ): VerifyResult {
    let decoded: Record<string, unknown>[]
    try {
      validateRecords(original, schema)
      decoded = decodeTabular(encoded, schema)
    } catch (e) {
      return { valid: false, errors: [`decode failed: ${(e as Error).message}`] }
    }
    const errors: string[] = []
    if (decoded.length !== original.length) {
      errors.push(`row count mismatch: expected ${original.length}, got ${decoded.length}`)
    }
    const n = Math.min(decoded.length, original.length)
    for (let i = 0; i < n; i++) {
      for (const f of schema.fields) {
        const want = Object.prototype.hasOwnProperty.call(original[i], f.name) ? original[i][f.name] ?? null : null
        const got = decoded[i][f.name] ?? null
        const wantNorm = want === undefined ? null : want
        if (!Object.is(wantNorm, got)) {
          errors.push(`row ${i} field ${f.name}: expected ${String(wantNorm)}, got ${String(got)}`)
        }
      }
    }
    return { valid: errors.length === 0, errors }
  }
}
