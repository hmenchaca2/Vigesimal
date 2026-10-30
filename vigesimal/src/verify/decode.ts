import type { FieldType, VigesimalSchema } from '../types'
import { decodeScalar, splitCsvRow } from '../encoder/scalars'
import { validateField, validateSchema } from '../schema/validate'
import { LEGEND } from '../encoder/panels'

// Quoted values may span physical lines, including dictionary declarations.
function logicalLines(encoded: string): string[] {
  const lines: string[] = []
  let current = ''
  let quoted = false
  for (let i = 0; i < encoded.length; i++) {
    const ch = encoded[i]
    if (ch === '"') {
      if (quoted && encoded[i + 1] === '"') {
        current += '""'
        i++
        continue
      }
      quoted = !quoted
    }
    if (ch === '\n' && !quoted) {
      lines.push(current.endsWith('\r') ? current.slice(0, -1) : current)
      current = ''
    } else current += ch
  }
  if (quoted) throw new Error('Unterminated quoted value')
  if (current) lines.push(current)
  return lines
}

export function decodeTabular(encoded: string, schema?: VigesimalSchema): Record<string, unknown>[] {
  if (schema) validateSchema(schema)
  const lines = logicalLines(encoded)
  const header = /^## ([^"\r\n]+): (0|[1-9]\d*) rows$/.exec(lines[0] ?? '')
  if (!header) throw new Error('Malformed vigesimal block: invalid dataset header')
  const count = Number(header[2])
  if (!Number.isSafeInteger(count)) throw new Error('Invalid row count')
  if (count === 0 && lines.length === 1) return []
  if (!lines[1]?.startsWith('fields: ')) throw new Error('Malformed vigesimal block: missing "fields:" line')
  const fields = lines[1].slice(8).split(',')
  fields.forEach(validateField)
  if (new Set(fields).size !== fields.length) throw new Error('Duplicate fields')
  if (schema && (schema.fields.length !== fields.length || schema.fields.some((f, i) => f.name !== fields[i]))) {
    throw new Error('Schema fields do not match the block')
  }
  let i = 2
  let types: FieldType[] = schema?.fields.map(f => f.type) ?? fields.map(() => 'string')
  if (lines[i]?.startsWith('types: ')) {
    const declared = lines[i++].slice(7).split(',')
    if (declared.length !== fields.length || declared.some(t => !['numeric', 'boolean', 'string'].includes(t))) {
      throw new Error('Invalid type declaration')
    }
    if (schema && declared.some((t, index) => t !== types[index])) throw new Error('Schema types do not match the block')
    types = declared as FieldType[]
  }
  const codes = new Map<string, string>()
  if (lines[i]?.startsWith('codes: ')) {
    let src = lines[i++].slice(7)
    while (src) {
      const pair = /^([A-Z][1-9A-J])=("(?:[^"]|"")*"|[^\s"]+)(?: |$)/.exec(src)
      if (!pair || codes.has(pair[1])) throw new Error('Invalid or duplicate dictionary declaration')
      const value = pair[2].startsWith('"') ? pair[2].slice(1, -1).replace(/""/g, '"') : pair[2]
      codes.set(pair[1], value)
      src = src.slice(pair[0].length)
    }
  }
  if (lines[i++] !== LEGEND) throw new Error('Malformed vigesimal block: missing legend line')
  // Legacy blocks can omit the separator; canonical blocks contain one.
  if (lines[i] === '') i++
  const out: Record<string, unknown>[] = []
  for (const line of lines.slice(i)) {
    const parts = splitCsvRow(line)
    if (parts.length !== fields.length) throw new Error(`Row ${out.length}: field count mismatch`)
    const entries = fields.map((field, index) => {
      const part = parts[index]
      if (!part.startsWith('"') && codes.has(part)) {
        if (types[index] !== 'string') throw new Error(`Dictionary code in non-string field ${field}`)
        return [field, codes.get(part)]
      }
      return [field, decodeScalar(part, types[index])]
    })
    out.push(Object.fromEntries(entries))
  }
  if (out.length !== count) throw new Error(`Row count mismatch: expected ${count}, got ${out.length}`)
  return out
}

export function decodeDelta(encoded: string, schema: VigesimalSchema): Record<string, unknown> {
  validateSchema(schema)
  if (encoded === '~') return {}
  const types = new Map(schema.fields.map(f => [f.name, f.type]))
  const entries: [string, unknown][] = []
  const seen = new Set<string>()
  for (const part of splitCsvRow(encoded)) {
    if (!part.startsWith('~')) throw new Error(`Malformed delta pair: ${part}`)
    const eq = part.indexOf('=')
    if (eq === -1) throw new Error(`Malformed delta pair: ${part}`)
    const field = part.slice(1, eq)
    validateField(field)
    if (!types.has(field) || seen.has(field)) throw new Error(`Unknown or duplicate delta field: ${field}`)
    seen.add(field)
    const value = part.slice(eq + 1)
    // Empty value after '=' marks deletion (distinct from '_', which is null).
    entries.push([field, value === '' ? undefined : decodeScalar(value, types.get(field)!)])
  }
  return Object.fromEntries(entries)
}
