import type { DeltaMap, EmblemMap, VigesimalSchema } from '../types'
import { encodeTuple, encodeTabular, encodeDelta, encodeEmblem } from './panels'

export class VigesimalEncoder {
  encode(record: Record<string, unknown>, schema: VigesimalSchema): string {
    return encodeTuple(record, schema)
  }

  encodeTabular(records: Record<string, unknown>[], schema: VigesimalSchema): string {
    return encodeTabular(records, schema)
  }

  encodeDelta(delta: DeltaMap, schema: VigesimalSchema): string {
    return encodeDelta(delta, schema)
  }

  encodeEmblem(aliases: EmblemMap): string {
    return encodeEmblem(aliases)
  }
}
