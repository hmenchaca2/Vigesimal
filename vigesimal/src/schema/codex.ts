import type { VigesimalSchema } from '../types'
import { LEGEND } from '../encoder/panels'
import { validateSchema } from './validate'

// The vigesimal "codex" is just the header contract: field order + legend.
// Inject this once per session so the model knows the wire format.
export function buildCodex(schema: VigesimalSchema): string {
  validateSchema(schema)
  const lines = [
    `fields: ${schema.fields.map(f => f.name).join(',')}`,
    `types: ${schema.fields.map(f => f.type).join(',')}`,
    LEGEND,
  ]
  for (const field of schema.fields) {
    if (field.domain && field.domain.length > 0) {
      lines.push(`  ${field.name}: ${field.domain.join('|')}`)
    }
  }
  return lines.join('\n') + '\n'
}
