import type { VerifyResult, VigesimalSchema } from '../types'
import { decodeTabular } from './decode'

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
        const want = original[i][f.name] ?? null
        const got = decoded[i][f.name] ?? null
        const wantNorm = want === undefined ? null : want
        if (String(wantNorm) !== String(got) && !(wantNorm === null && got === null)) {
          errors.push(`row ${i} field ${f.name}: expected ${String(wantNorm)}, got ${String(got)}`)
        }
      }
    }
    return { valid: errors.length === 0, errors }
  }
}
