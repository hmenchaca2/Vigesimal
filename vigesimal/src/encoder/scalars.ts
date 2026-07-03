import type { FieldType } from '../types'

export function quoteCsv(s: string): string {
  return '"' + s.replace(/"/g, '""') + '"'
}

// vigesimal scalars: true->1 false->0 null/undefined->_ ; strings CSV-quoted when
// they contain a comma, quote, or newline.
export function encodeScalar(v: unknown): string {
  if (v === true) return '1'
  if (v === false) return '0'
  if (v === null || v === undefined) return '_'
  const s = String(v)
  if (s.includes(',') || s.includes('"') || s.includes('\n')) return quoteCsv(s)
  return s
}

// Decode is schema-aware: '1'/'0' are booleans only when the field says so.
export function decodeScalar(s: string, type: FieldType): unknown {
  if (s === '_') return null
  let raw = s
  if (raw.startsWith('"') && raw.endsWith('"') && raw.length >= 2) {
    raw = raw.slice(1, -1).replace(/""/g, '"')
  }
  if (type === 'boolean') return raw === '1'
  if (type === 'numeric') return Number(raw)
  return raw
}

// Split one CSV row, honoring quoted fields (quotes kept on the parts;
// decodeScalar strips them).
export function splitCsvRow(line: string): string[] {
  const parts: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '""'
        i++
      } else if (ch === '"') {
        current += '"'
        inQuotes = false
      } else {
        current += ch
      }
    } else if (ch === '"') {
      current += '"'
      inQuotes = true
    } else if (ch === ',') {
      parts.push(current)
      current = ''
    } else {
      current += ch
    }
  }
  parts.push(current)
  return parts
}
