import { createHash } from 'node:crypto'

export const SYSTEM_PROMPT = [
  'Answer the question using only the supplied data.',
  'Return only the answer with no explanation.',
  'For a list, return comma-separated values sorted alphabetically.',
  'For a boolean, return yes or no.',
].join(' ')

export const FORMAT_INSTRUCTIONS = {
  json_compact: 'The data is compact JSON.',
  toon_official: 'The data is TOON: indentation shows nesting and tabular headers declare array fields.',
  vigesimal_typed: 'The data is typed Vigesimal: fields and types declare columns, codes expand repeated strings, 1/0 are booleans in boolean columns, and _ is null.',
}

export function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

function scalarFields(rows) {
  if (!rows.length) return []
  return Object.keys(rows[0]).filter(key => rows.every(row => {
    const value = row[key]
    return value === null || ['string', 'number', 'boolean'].includes(typeof value)
  }))
}

function answer(value) {
  if (typeof value === 'boolean') return value ? 'yes' : 'no'
  return String(value)
}

function keyField(fields) {
  return fields.find(field => field === 'id' || field.endsWith('_id') || field === 'date') ?? fields[0]
}

/** Generate deterministic, code-derived gold questions for a flat record set. */
export function generateQuestions(dataset, rows) {
  if (!Array.isArray(rows) || rows.length === 0) return []
  const fields = scalarFields(rows)
  if (fields.length < 2) return []
  const key = keyField(fields)
  const valueField = fields.find(field => field !== key && rows[0][field] !== null)
  const questions = []

  if (valueField) {
    questions.push({
      id: `${dataset}:retrieve`, dataset, category: 'field_retrieval', answerType: typeof rows[0][valueField] === 'boolean' ? 'boolean' : typeof rows[0][valueField] === 'number' ? 'numeric' : 'exact',
      text: `What is the ${valueField} for the record whose ${key} is ${answer(rows[0][key])}?`,
      expectedAnswer: answer(rows[0][valueField]),
    })
  }

  const categorical = fields.find(field => {
    const cardinality = new Set(rows.map(row => row[field])).size
    return field !== key && ['string', 'boolean'].includes(typeof rows[0][field]) && cardinality > 1 && cardinality < rows.length
  })
  if (categorical) {
    const selected = rows[0][categorical]
    questions.push({
      id: `${dataset}:filter-count`, dataset, category: 'filtering', answerType: 'numeric',
      text: `How many records have ${categorical} equal to ${answer(selected)}?`,
      expectedAnswer: String(rows.filter(row => row[categorical] === selected).length),
    })
    const display = fields.find(field => field !== key && field !== categorical && typeof rows[0][field] === 'string') ?? key
    const values = rows.filter(row => row[categorical] === selected).map(row => String(row[display])).sort((a, b) => a.localeCompare(b))
    questions.push({
      id: `${dataset}:filter-list`, dataset, category: 'filtering', answerType: 'list',
      text: `List the ${display} values, including duplicates, for records whose ${categorical} equals ${answer(selected)}.`,
      expectedAnswer: values.join(', '),
    })
  }

  const numeric = fields.findLast(field => field !== key && !field.toLowerCase().includes('timestamp') && typeof rows[0][field] === 'number')
  if (numeric) {
    const total = rows.reduce((sum, row) => sum + Number(row[numeric]), 0)
    questions.push({
      id: `${dataset}:sum`, dataset, category: 'aggregation', answerType: 'numeric',
      text: `What is the sum of ${numeric} across all records?`, expectedAnswer: String(total),
    })
  }
  return questions
}

export function buildUserMessage(format, payload, question) {
  return `${FORMAT_INSTRUCTIONS[format]}\n\nDATA:\n${payload}\n\nQUESTION: ${question}\n\nAnswer:`
}

function normalizeText(value) {
  return String(value ?? '').trim().replace(/^['"]|['"]$/g, '').replace(/[.!]$/, '').trim().toLowerCase()
}

export function scoreAnswer(expected, actual, answerType) {
  if (answerType === 'numeric') {
    const clean = value => String(value ?? '').trim().replace(/[$,%\s]/g, '').replace(/,/g, '')
    const left = Number(clean(expected))
    const right = Number(clean(actual))
    return Number.isFinite(left) && Number.isFinite(right) && Math.abs(left - right) <= 1e-9
  }
  if (answerType === 'boolean') {
    const bool = value => ({ yes: true, true: true, '1': true, no: false, false: false, '0': false })[normalizeText(value)]
    return bool(expected) !== undefined && bool(expected) === bool(actual)
  }
  if (answerType === 'list') {
    const items = value => String(value ?? '').split(',').map(normalizeText).filter(Boolean).sort()
    return JSON.stringify(items(expected)) === JSON.stringify(items(actual))
  }
  return normalizeText(expected) === normalizeText(actual)
}

export function seededShuffle(values, seed = 20260929) {
  let state = seed >>> 0
  const next = () => {
    state ^= state << 13; state ^= state >>> 17; state ^= state << 5
    return (state >>> 0) / 4294967296
  }
  const result = [...values]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

function percentile(sorted, probability) {
  if (!sorted.length) return null
  const index = Math.min(sorted.length - 1, Math.max(0, Math.floor(probability * sorted.length)))
  return sorted[index]
}

/** Question-clustered bootstrap: all repetitions of a question stay together. */
export function pairedAccuracyComparison(rows, baselineFormat = 'json_compact', samples = 2000, seed = 20260929) {
  const formats = [...new Set(rows.map(row => row.format))].filter(format => format !== baselineFormat).sort()
  const comparisons = {}
  for (const format of formats) {
    const relevant = rows.filter(row => row.format === baselineFormat || row.format === format)
    const byQuestion = new Map()
    for (const row of relevant) {
      const cluster = byQuestion.get(row.questionId) ?? { baseline: [], candidate: [] }
      cluster[row.format === baselineFormat ? 'baseline' : 'candidate'].push(Number(row.correct))
      byQuestion.set(row.questionId, cluster)
    }
    const differences = [...byQuestion.values()]
      .filter(cluster => cluster.baseline.length && cluster.candidate.length)
      .map(cluster => cluster.candidate.reduce((a, b) => a + b, 0) / cluster.candidate.length - cluster.baseline.reduce((a, b) => a + b, 0) / cluster.baseline.length)
    if (!differences.length) continue
    const observed = differences.reduce((a, b) => a + b, 0) / differences.length
    let state = seed >>> 0
    const next = () => { state ^= state << 13; state ^= state >>> 17; state ^= state << 5; return (state >>> 0) / 4294967296 }
    const estimates = []
    for (let sample = 0; sample < samples; sample++) {
      let total = 0
      for (let i = 0; i < differences.length; i++) total += differences[Math.floor(next() * differences.length)]
      estimates.push(total / differences.length)
    }
    estimates.sort((a, b) => a - b)
    comparisons[format] = {
      baselineFormat, questionClusters: differences.length, accuracyDifference: observed,
      confidenceLevel: 0.95, confidenceInterval: [percentile(estimates, 0.025), percentile(estimates, 0.975)],
    }
  }
  return comparisons
}

export function summarize(requests, responses) {
  const requestById = new Map(requests.map(request => [request.requestId, request]))
  const seen = new Set()
  const rows = responses.map(response => {
    if (!response.requestId || seen.has(response.requestId)) throw new Error(`Missing or duplicate response requestId: ${response.requestId ?? '<missing>'}`)
    seen.add(response.requestId)
    const request = requestById.get(response.requestId)
    if (!request) throw new Error(`Unknown requestId: ${response.requestId}`)
    const failed = Boolean(response.error)
    return { ...request, ...response, failed, correct: failed ? false : scoreAnswer(request.expectedAnswer, response.response, request.answerType) }
  })

  const missing = requests.filter(request => !seen.has(request.requestId)).map(request => request.requestId)
  const byFormat = {}
  for (const row of rows) {
    const group = byFormat[row.format] ??= { attempted: 0, completed: 0, correct: 0, inputTokens: 0, outputTokens: 0, latencyMs: 0, preparedInputTokens: 0 }
    group.attempted++
    group.preparedInputTokens += Number(row.fullInputTokens ?? 0)
    if (!row.failed) {
      group.completed++
      group.correct += Number(row.correct)
      group.inputTokens += Number(row.inputTokens ?? 0)
      group.outputTokens += Number(row.outputTokens ?? 0)
      group.latencyMs += Number(row.latencyMs ?? 0)
    }
  }
  for (const group of Object.values(byFormat)) {
    group.completionRate = group.attempted ? group.completed / group.attempted : 0
    group.accuracyOnCompleted = group.completed ? group.correct / group.completed : 0
    group.accuracyAllAttempts = group.attempted ? group.correct / group.attempted : 0
    group.avgLatencyMs = group.completed ? group.latencyMs / group.completed : 0
  }
  const baseline = byFormat.json_compact
  const gates = {}
  for (const [format, group] of Object.entries(byFormat)) {
    if (format === 'json_compact') continue
    const inputReduction = baseline?.preparedInputTokens ? 1 - group.preparedInputTokens / baseline.preparedInputTokens : null
    gates[format] = {
      thresholds: { minimumInputReduction: 0.30, minimumCompletionRate: 0.99, maximumAccuracyRegression: 0.01 },
      inputReduction,
      inputReductionPass: inputReduction === null ? null : inputReduction >= 0.30,
      completionPass: group.completionRate >= 0.99,
    }
  }
  const comparisons = pairedAccuracyComparison(rows)
  for (const [format, comparison] of Object.entries(comparisons)) {
    const lower = comparison.confidenceInterval[0]
    gates[format] ??= {}
    gates[format].accuracyPass = lower !== null && lower >= -0.01
    gates[format].overallPass = gates[format].inputReductionPass === true && gates[format].completionPass === true && gates[format].accuracyPass === true
  }
  return { rows, missing, byFormat, comparisons, gates }
}
