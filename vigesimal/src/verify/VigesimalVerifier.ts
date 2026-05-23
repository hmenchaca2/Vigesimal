import type { VerifyResult, VigesimalSchema } from '../types'
import { VigesimalEncoder } from '../encoder/VigesimalEncoder'
import { decodeTuple } from './decode'

export class VigesimalVerifier {
  private encoder = new VigesimalEncoder()

  decode(encoded: string, schema: VigesimalSchema): Record<string, unknown> {
    return decodeTuple(encoded, schema)
  }

  verify(
    encoded: string,
    original: Record<string, unknown>,
    schema: VigesimalSchema
  ): VerifyResult {
    const expected = this.encoder.encode(original, schema)
    if (encoded === expected) return { valid: true, errors: [] }
    return {
      valid: false,
      errors: [`Expected "${expected}", got "${encoded}"`],
    }
  }
}
