export function escapeString(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/\[/g, '\\[').replace(/\]/g, '\\]').replace(/\|/g, '\\|')
}

export function unescapeString(s: string): string {
  return s.replace(/\\\|/g, '|').replace(/\\\[/g, '[').replace(/\\\]/g, ']').replace(/\\\\/g, '\\')
}

export function encodeScalar(v: unknown): string {
  if (v === null || v === undefined) return '_'
  if (v === true) return '+'
  if (v === false) return '-'
  if (typeof v === 'number' && v === 0) return '0'
  return escapeString(String(v))
}

export function decodeScalar(s: string): unknown {
  if (s === '_') return null
  if (s === '+') return true
  if (s === '-') return false
  if (s === '0') return 0
  return unescapeString(s)
}
