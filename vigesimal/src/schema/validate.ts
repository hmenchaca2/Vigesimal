import type { VigesimalSchema } from '../types'

export function validateName(name: string): void {
  if (!name || /["\r\n\x00-\x1f]/.test(name)) throw new Error('Dataset name must be nonempty, single-line, and contain no quotes')
}

export function validateField(name: string): void {
  if (!name || /[",=~\r\n\x00-\x1f]/.test(name)) throw new Error(`Unsupported field name: ${JSON.stringify(name)}`)
}

export function validateSchema(schema: VigesimalSchema): void {
  validateName(schema.name)
  const names = new Set<string>()
  for (const field of schema.fields) {
    validateField(field.name)
    if (names.has(field.name)) throw new Error(`Duplicate field: ${field.name}`)
    names.add(field.name)
    if (!['string', 'numeric', 'boolean'].includes(field.type)) throw new Error(`Unsupported type: ${field.type}`)
  }
}

export function validateRecords(records: Record<string, unknown>[], schema?: VigesimalSchema): void {
  if (!Array.isArray(records)) throw new Error('Expected an array of flat records')
  if (schema) validateSchema(schema)
  const types = new Map<string, string>()
  for (const [index, row] of records.entries()) {
    if (!row || typeof row !== 'object' || Array.isArray(row) ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(row))) {
      throw new Error(`Row ${index}: expected a plain record`)
    }
    if (Object.getOwnPropertySymbols(row).length) throw new Error(`Row ${index}: symbol keys are unsupported`)
    for (const key of Object.keys(row)) {
      validateField(key)
      const field = schema?.fields.find(f => f.name === key)
      if (schema && !field) throw new Error(`Row ${index}: field ${key} is missing from schema`)
      const value = row[key]
      if (value === null || value === undefined) continue
      const type = typeof value
      if (!['string', 'number', 'boolean'].includes(type) ||
        (type === 'number' && (!Number.isFinite(value) || Object.is(value, -0)))) {
        throw new Error(`Row ${index}, field ${key}: unsupported value; use finite scalars (excluding -0) or null`)
      }
      if (types.has(key) && types.get(key) !== type) throw new Error(`Field ${key}: mixed types are unsupported`)
      types.set(key, type)
      if (field && (field.type === 'numeric' ? 'number' : field.type) !== type) {
        throw new Error(`Row ${index}, field ${key}: value does not match schema type ${field.type}`)
      }
    }
  }
  if (records.length && (schema ? schema.fields.length === 0 : !records.some(r => Object.keys(r).length))) {
    throw new Error('Nonempty datasets must have at least one field')
  }
}
