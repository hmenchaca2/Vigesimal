import type { FieldDef, FieldType, VigesimalSchema } from '../types'
import { encodeScalar } from '../encoder/scalars'

export function inferSchema(
  name: string,
  sampleData: Record<string, unknown>[]
): VigesimalSchema {
  if (sampleData.length === 0) return { name, fields: [] }

  const fieldNames = [...new Set(sampleData.flatMap(r => Object.keys(r)))]

  const fields: FieldDef[] = fieldNames.map(fieldName => {
    const allValues = sampleData.map(r => r[fieldName])
    const hasNull = allValues.some(v => v === null || v === undefined)
    const nonNull = allValues.filter(v => v !== null && v !== undefined)

    let type: FieldType
    if (nonNull.every(v => typeof v === 'boolean')) {
      type = 'boolean'
    } else if (nonNull.every(v => typeof v === 'number')) {
      type = hasNull ? 'nullable' : 'numeric'
    } else {
      type = hasNull ? 'nullable' : 'string'
    }

    const uniqueEncoded = [...new Set(allValues.map(v => encodeScalar(v)))]
    const domain = uniqueEncoded.length <= 8 ? uniqueEncoded : undefined

    return { name: fieldName, type, domain }
  })

  return { name, fields }
}
