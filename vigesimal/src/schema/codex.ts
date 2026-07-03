import type { VigesimalSchema } from '../types'
import { LEGEND } from '../encoder/panels'

// The vigesimal "codex" is just the header contract: field order + legend.
// Inject this once per session so the model knows the wire format.
export function buildCodex(schema: VigesimalSchema): string {
  const lines = [
    `fields: ${schema.fields.map(f => f.name).join(',')}`,
    LEGEND,
  ]
  for (const field of schema.fields) {
    if (field.domain && field.domain.length > 0) {
      lines.push(`  ${field.name}: ${field.domain.join('|')}`)
    }
  }
  return lines.join('\n') + '\n'
}
