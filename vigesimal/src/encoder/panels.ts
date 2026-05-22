import type { DeltaMap, EmblemMap, VigesimalSchema } from '../types'
import { encodeScalar } from './scalars'

export function encodeTuple(
  record: Record<string, unknown>,
  schema: VigesimalSchema
): string {
  const values = schema.fields.map(f => encodeScalar(record[f.name]))
  return `${schema.name}[${values.join('|')}]`
}

export function encodeTabular(
  records: Record<string, unknown>[],
  schema: VigesimalSchema
): string {
  const fieldNames = schema.fields.map(f => f.name)
  const header = `${schema.name}x${records.length}[${fieldNames.join(',')}]:`
  const rows = records.map(r => {
    const vals = schema.fields.map(f => encodeScalar(r[f.name]))
    return `  ${vals.join(',')}`
  })
  return [header, ...rows].join('\n')
}

// Panel-C and Panel-D added in Task 5
export function encodeDelta(_delta: DeltaMap, _schema: VigesimalSchema): string {
  throw new Error('not implemented')
}

export function encodeEmblem(_aliases: EmblemMap): string {
  throw new Error('not implemented')
}
