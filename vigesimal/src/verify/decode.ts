import { decodeScalar } from '../encoder/scalars'
import type { VigesimalSchema } from '../types'

export function splitByUnescapedPipe(s: string): string[] {
  const parts: string[] = []
  let current = ''
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '\\' && i + 1 < s.length && s[i + 1] === '|') {
      current += '\\|'
      i++
    } else if (s[i] === '|') {
      parts.push(current)
      current = ''
    } else {
      current += s[i]
    }
  }
  parts.push(current)
  return parts
}

export function decodeTuple(
  encoded: string,
  schema: VigesimalSchema
): Record<string, unknown> {
  // Strip schema prefix and brackets: "S1[a|b|c]" → "a|b|c"
  const inner = encoded.replace(/^[A-Za-z0-9]+\[/, '').replace(/\]$/, '')
  const parts = splitByUnescapedPipe(inner)
  const result: Record<string, unknown> = {}
  for (let i = 0; i < schema.fields.length; i++) {
    result[schema.fields[i].name] = decodeScalar(parts[i] ?? '_')
  }
  return result
}
