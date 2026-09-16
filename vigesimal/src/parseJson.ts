import { parseNumericLiteral } from './numeric'

/** Reject duplicate keys and precision-losing numbers, including escaped key
 * aliases. Quote exact IDs and high-precision decimals to preserve them. */
export function parseJson(text: string): unknown {
  const data: unknown = JSON.parse(text)
  // JSON.parse checks grammar first. Scan iteratively to avoid a second
  // recursive parser; whole string tokens protect escaped punctuation.
  const tokens = /"(?:[^"\\]|\\[\s\S])*"|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|[{}\[\],:]/g
  const stack: Array<{ keys: Set<string> | null; expectingKey: boolean }> = []
  for (const match of text.matchAll(tokens)) {
    const token = match[0]
    const context = stack[stack.length - 1]
    if (token === '{' || token === '[') {
      stack.push({ keys: token === '{' ? new Set() : null, expectingKey: token === '{' })
    } else if (token === '}' || token === ']') {
      stack.pop()
    } else if (token === ',') {
      if (context?.keys) context.expectingKey = true
    } else if (token === ':') {
      if (context) context.expectingKey = false
    } else if (token.startsWith('"')) {
      if (context?.keys && context.expectingKey) {
        const key: string = JSON.parse(token)
        if (context.keys.has(key)) throw new Error(`Duplicate JSON key at character ${match.index + 1}: ${JSON.stringify(key)}`)
        context.keys.add(key)
      }
    } else {
      try { parseNumericLiteral(token) }
      catch { throw new Error(`Numeric value at character ${match.index + 1} cannot round-trip without precision loss. Quote exact IDs or decimals as strings.`) }
    }
  }
  return data
}
