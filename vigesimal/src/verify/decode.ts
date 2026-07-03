import type { VigesimalSchema } from '../types'
import { decodeScalar, splitCsvRow } from '../encoder/scalars'

interface ParsedHeader {
  fields: string[]
  codes: Map<string, string> // code -> value (codes are globally unique per block)
  bodyStart: number
}

function parseHeader(lines: string[]): ParsedHeader {
  if (!lines[0]?.startsWith('## ')) {
    throw new Error(`Malformed v4 block: expected "## <name>: N rows", got ${lines[0]!}`)
  }
  const fieldsLine = lines[1]
  if (!fieldsLine?.startsWith('fields: ')) {
    throw new Error('Malformed v4 block: missing "fields:" line')
  }
  const fields = fieldsLine.slice('fields: '.length).split(',')

  const codes = new Map<string, string>()
  let i = 2
  if (lines[i]?.startsWith('codes: ')) {
    // pairs: CODE=value or CODE="quoted value", space-separated
    const src = lines[i].slice('codes: '.length)
    const pairRe = /([A-Z][1-9A-J])=("(?:[^"]|"")*"|\S+)/g
    for (const m of src.matchAll(pairRe)) {
      let value = m[2]
      if (value.startsWith('"')) value = value.slice(1, -1).replace(/""/g, '"')
      codes.set(m[1], value)
    }
    i++
  }
  if (!lines[i]?.startsWith('bool: ')) {
    throw new Error('Malformed v4 block: missing legend line')
  }
  // Body starts immediately after the legend line
  return { fields, codes, bodyStart: i + 1 }
}

export function decodeTabular(
  encoded: string,
  schema: VigesimalSchema
): Record<string, unknown>[] {
  const lines = encoded.split('\n')
  if (lines[0]?.match(/^## .*: 0 rows$/)) return []
  const { fields, codes, bodyStart } = parseHeader(lines)
  const types = new Map(schema.fields.map(f => [f.name, f.type]))

  const out: Record<string, unknown>[] = []
  for (const line of lines.slice(bodyStart)) {
    if (line === '') continue
    const parts = splitCsvRow(line)
    const rec: Record<string, unknown> = {}
    fields.forEach((field, i) => {
      const part = parts[i] ?? '_'
      // Unquoted code token -> dictionary value; quoted "D1" stays literal.
      if (!part.startsWith('"') && codes.has(part)) {
        rec[field] = codes.get(part)
      } else {
        rec[field] = decodeScalar(part, types.get(field) ?? 'string')
      }
    })
    out.push(rec)
  }
  return out
}

export function decodeDelta(
  encoded: string,
  schema: VigesimalSchema
): Record<string, unknown> {
  if (encoded === '~') return {}
  const types = new Map(schema.fields.map(f => [f.name, f.type]))
  const out: Record<string, unknown> = {}
  for (const part of splitCsvRow(encoded)) {
    if (!part.startsWith('~')) throw new Error(`Malformed delta pair: ${part}`)
    const eq = part.indexOf('=')
    if (eq === -1) throw new Error(`Malformed delta pair: ${part}`)
    const field = part.slice(1, eq)
    out[field] = decodeScalar(part.slice(eq + 1), types.get(field) ?? 'string')
  }
  return out
}
