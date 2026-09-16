// Compare decimal values rather than spelling: 1e3 and 1000 are equivalent.
function decimalKey(text: string): string {
  const [mantissa, exponent = '0'] = text.toLowerCase().split('e')
  const negative = mantissa.startsWith('-')
  const unsigned = negative ? mantissa.slice(1) : mantissa
  const fraction = unsigned.includes('.') ? unsigned.length - unsigned.indexOf('.') - 1 : 0
  const digits = unsigned.replace('.', '').replace(/^0+/, '')
  if (!digits) return negative ? '-0' : '0'
  const trimmed = digits.replace(/0+$/, '')
  return `${negative ? '-' : ''}${trimmed}e${Number(exponent) - fraction + digits.length - trimmed.length}`
}

/** Reject numeric text that would change when serialized as a JS number. */
export function parseNumericLiteral(text: string): number {
  const value = Number(text)
  if (!/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(text) ||
    !Number.isFinite(value) || Object.is(value, -0) || decimalKey(text) !== decimalKey(JSON.stringify(value))) {
    throw new Error('Invalid number or precision loss. Quote exact IDs or decimals as strings.')
  }
  return value
}
