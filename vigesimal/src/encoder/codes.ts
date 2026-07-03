import { quoteCsv } from './scalars'

export type TokenEstimator = (s: string) => number

// Base-20 code digits: 1-9 then A-J (19 codes max per field)
const DIGITS = '123456789ABCDEFGHIJ'

export function estTokens(s: string): number {
  return Math.max(1, Math.ceil(s.length / 4))
}

// Render a value for the codes: header line — quoted when ambiguous.
export function codesValue(s: string): string {
  if (/[ =,"]/.test(s)) return quoteCsv(s)
  return s
}

export function fieldLetters(fields: string[]): Map<string, string> {
  const taken = new Set<string>()
  const letters = new Map<string, string>()
  for (const field of fields) {
    let letter: string | undefined
    for (const ch of field) {
      const up = ch.toUpperCase()
      if (/[A-Z]/.test(up) && !taken.has(up)) {
        letter = up
        break
      }
    }
    if (letter === undefined) {
      for (const up of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') {
        if (!taken.has(up)) {
          letter = up
          break
        }
      }
    }
    if (letter === undefined) continue // >26 coded fields — leave uncoded
    taken.add(letter)
    letters.set(field, letter)
  }
  return letters
}

// Per-field value->code maps. A value is coded only when it pays for itself:
//   occurrences * (est(value) - est(code)) > est(declaration)
// Costs use the fixed placeholder "X1" — the real letter is assigned after
// payoff decisions, so per-letter tokenization differences are ignored.
export function buildCodes(
  fields: string[],
  records: Record<string, unknown>[],
  est: TokenEstimator = estTokens
): Map<string, Map<string, string>> {
  const codeCost = est('X1')
  const qualifying = new Map<string, [string, number][]>()

  for (const field of fields) {
    const counts = new Map<string, number>()
    for (const r of records) {
      const v = r[field]
      if (typeof v === 'string') counts.set(v, (counts.get(v) ?? 0) + 1)
    }
    const payers: [string, number][] = []
    for (const [value, occ] of counts) {
      if (occ * (est(value) - codeCost) > est(` X1=${codesValue(value)}`)) {
        payers.push([value, occ])
      }
    }
    if (payers.length > 0) {
      payers.sort((a, b) => b[1] * (est(b[0]) - codeCost) - a[1] * (est(a[0]) - codeCost))
      qualifying.set(field, payers.slice(0, 19))
    }
  }

  const letters = fieldLetters([...qualifying.keys()])
  const codes = new Map<string, Map<string, string>>()
  for (const [field, payers] of qualifying) {
    const letter = letters.get(field)
    if (letter === undefined) continue
    const m = new Map<string, string>()
    payers.forEach(([value], i) => m.set(value, `${letter}${DIGITS[i]}`))
    codes.set(field, m)
  }
  return codes
}
