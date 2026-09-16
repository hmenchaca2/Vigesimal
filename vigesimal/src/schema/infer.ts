import type { FieldDef, FieldType, VigesimalSchema } from '../types'
import { encodeScalar } from '../encoder/scalars'
import { validateName, validateRecords } from './validate'

export function inferSchema(
  name: string,
  sampleData: Record<string, unknown>[]
): VigesimalSchema {
  validateName(name)
  validateRecords(sampleData)
  if (sampleData.length === 0) return { name, fields: [] }

  const fieldNames = [...new Set(sampleData.flatMap(r => Object.keys(r)))]

  const fields: FieldDef[] = fieldNames.map(fieldName => {
    const allValues = sampleData.map(r => Object.prototype.hasOwnProperty.call(r, fieldName) ? r[fieldName] : undefined)
    const nonNull = allValues.filter(v => v !== null && v !== undefined)

    let type: FieldType
    if (nonNull.length && nonNull.every(v => typeof v === 'boolean')) {
      type = 'boolean'
    } else if (nonNull.length && nonNull.every(v => typeof v === 'number')) {
      type = 'numeric'
    } else {
      type = 'string'
    }

    const uniqueEncoded = [...new Set(allValues.map(v => encodeScalar(v)))]
    const domain = uniqueEncoded.length <= 8 ? uniqueEncoded : undefined

    return { name: fieldName, type, domain }
  })

  return { name, fields }
}
