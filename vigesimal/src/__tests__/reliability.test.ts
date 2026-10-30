import { describe, expect, it } from 'vitest'
import { encode, decode, inferSchema, VigesimalVerifier, encodeDelta, decodeDelta, DeltaTracker, applyDelta } from '../index'

describe('supported round-trips', () => {
  const cases = [[], [{ x: '_' }], [{ x: '' }], [{ x: '00123' }], [{ x: 'a\nb' }],
    [{ x: 'a\r\nb' }], [{ x: '"' }], [{ x: null }], [{ x: true }],
    [{ x: 1e-20 }], [{ x: 1e30 }],
    Array.from({ length: 30 }, () => ({ department: 'Engineering', other: 'D1' })),
    Array.from({ length: 30 }, () => ({ x: 'long\nmultiline\tvalue "quoted"' })),
    Array.from({ length: 30 }, () => ({ 'ß': 'Engineering', '日本語': 'long repeated string' })),
    [JSON.parse('{"__proto__":"safe","constructor":"value"}')],
  ]
  it.each(cases.map((rows, index) => ({ rows, index })))('case $index with and without external schema', ({ rows }) => {
    const schema = inferSchema('data', rows)
    const encoded = encode(rows)
    expect(decode(encoded)).toEqual(rows)
    expect(decode(encoded, schema)).toEqual(rows)
    expect(new VigesimalVerifier().verify(encoded, rows, schema).valid).toBe(true)
  })
  it('normalizes missing and undefined fields to null', () => {
    expect(decode(encode([{ x: 'a' }, { y: 1 }, { x: undefined }]))).toEqual([
      { x: 'a', y: null }, { x: null, y: 1 }, { x: null, y: null },
    ])
  })
  it('does not read inherited prototype properties in sparse records', () => {
    const rows: Record<string, unknown>[] = [{ constructor: 'hello' }, { x: 1 }]
    expect(decode(encode(rows))).toEqual([{ constructor: 'hello', x: null }, { constructor: null, x: 1 }])
  })
  it('tracks prototype-named delta fields as data', () => {
    const tracker = new DeltaTracker()
    tracker.update(JSON.parse('{"__proto__":"old","constructor":"old"}'))
    const next = tracker.update(JSON.parse('{"__proto__":"new"}'))
    expect(Object.keys(next.delta)).toEqual(['__proto__', 'constructor'])
    expect(encodeDelta(next.delta)).toBe('~__proto__=new,~constructor=')
  })
  it('distinguishes a deleted field from one explicitly set to null, end to end', () => {
    const tracker = new DeltaTracker()
    tracker.update({ a: 1, b: 2 })
    const next = tracker.update({ a: null })
    const schema = { name: 't', fields: [{ name: 'a', type: 'numeric' as const }, { name: 'b', type: 'numeric' as const }] }
    const encoded = encodeDelta(next.delta)
    expect(encoded).toBe('~a=_,~b=')
    const decoded = decodeDelta(encoded, schema)
    expect(decoded.a).toBe(null)
    expect(decoded.b).toBe(undefined)
    expect('b' in decoded).toBe(true)
    expect(applyDelta({ a: 1, b: 2 }, decoded)).toEqual({ a: null })
  })
  it('reads legacy blocks without guessing types', () => {
    const legacy = '## t: 1 rows\nfields: id\nbool: 1=yes 0=no  null: _\n\n00123\n'
    expect(decode(legacy)).toEqual([{ id: '00123' }])
  })
  it('handles multiline deltas and reserved strings', () => {
    const row = { x: 'a\nb,"c"', y: '_', z: '' }
    expect(decodeDelta(encodeDelta(row), inferSchema('t', [row]))).toEqual(row)
  })
})

describe('strict rejection', () => {
  it.each([[{ x: {} }], [{ x: [] }], [{ x: NaN }], [{ x: Infinity }], [{ x: -0 }],
    [{ x: true }, { x: 'hello' }], [{}], [{ 'a,b': 1 }], [{ x: new Date() }]].map(rows => ({ rows })))('rejects unsupported records $rows', ({ rows }) => {
    expect(() => encode(rows)).toThrow()
  })
  const valid = encode([{ x: 'hello', y: 1 }])
  it.each([
    valid.replace('1 rows', '2 rows'), valid.replace('hello,1', 'hello'),
    valid.replace('hello,1', 'hello,1,extra'), valid.replace('hello,1', '"hello,1'),
    valid.replace('hello,1', '"hello"junk,1'), valid.replace('hello,1', 'hello,no'),
    valid.replace('fields: x,y', 'fields: x,x'), valid.replace('string,numeric', 'string,nope'),
  ])('rejects malformed blocks', block => expect(() => decode(block)).toThrow())
  it('rejects schema mismatch and omitted source fields', () => {
    const schema = inferSchema('t', [{ x: 1 }])
    expect(() => encode([{ x: '1' }], { schema })).toThrow()
    expect(() => encode([{ x: 1, other: true }], { schema })).toThrow()
    expect(() => decode(valid, schema)).toThrow()
  })
  it('verifier rejects type changes', () => {
    const block = encode([{ x: 1 }])
    expect(new VigesimalVerifier().verify(block, [{ x: '1' }], inferSchema('t', [{ x: 1 }])).valid).toBe(false)
  })
})
