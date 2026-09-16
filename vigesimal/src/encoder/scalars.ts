import type { FieldType } from '../types'
import { parseNumericLiteral } from '../numeric'

export function quoteCsv(s: string): string {
  return '"' + s.replace(/"/g, '""') + '"'
}

// vigesimal scalars: true->1 false->0 null/undefined->_ ; strings CSV-quoted when
// they contain a comma, quote, or newline.
export function encodeScalar(v: unknown): string {
  if (v === true) return '1'
  if (v === false) return '0'
  if (v === null || v === undefined) return '_'
  if (typeof v !== 'string' && (typeof v !== 'number' || !Number.isFinite(v) || Object.is(v, -0))) {
    throw new Error('Unsupported scalar value')
  }
  const s = String(v)
  if (s === '' || s === '_' || /[,"\r\n]/.test(s)) return quoteCsv(s)
  return s
}

// Decode is schema-aware: '1'/'0' are booleans only when the field says so.
export function decodeScalar(s: string, type: FieldType): unknown {
  if (s === '_') return null
  let raw = s
  if (raw.startsWith('"') && raw.endsWith('"') && raw.length >= 2) {
    raw = raw.slice(1, -1).replace(/""/g, '"')
  }
  if (type === 'boolean') {
    if (raw !== '1' && raw !== '0') throw new Error(`Invalid boolean: ${raw}`)
    return raw === '1'
  }
  if (type === 'numeric') {
    return parseNumericLiteral(raw)
  }
  return raw
}

// Split one CSV row, honoring quoted fields (quotes kept on the parts;
// decodeScalar strips them).
export function splitCsvRow(line: string): string[] {
  const parts: string[] = []
  let current = ''
  let inQuotes = false
  let closed = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '""'
        i++
      } else if (ch === '"') {
        current += '"'
        inQuotes = false
        closed = true
      } else {
        current += ch
      }
    } else if (ch === '"') {
      if (current !== '' && !/^~[^=]+=\s*$/.test(current)) throw new Error('Unexpected quote in CSV field')
      if (closed) throw new Error('Unexpected quote after CSV field')
      current += '"'
      inQuotes = true
    } else if (ch === ',') {
      parts.push(current)
      current = ''
      closed = false
    } else {
      if (closed) throw new Error('Unexpected text after quoted CSV field')
      current += ch
    }
  }
  if (inQuotes) throw new Error('Unterminated quoted CSV field')
  parts.push(current)
  return parts
}
