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

export function encodeDelta(
  delta: DeltaMap,
  schema: VigesimalSchema
): string {
  const values = schema.fields.map(f => {
    if (!(f.name in delta)) return ''
    return encodeScalar(delta[f.name])
  })
  return `~[${values.join('|')}]`
}

export function encodeEmblem(aliases: EmblemMap): string {
  const pairs = Object.entries(aliases).map(([id, alias]) => `${id}=${alias}`)
  return `EMBLEM: ${pairs.join(', ')}`
}
