#!/usr/bin/env node
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { isDeepStrictEqual } from 'node:util'
import { encode, decode } from '../dist/index.mjs'
import { encode as toonEncode, decode as toonDecode } from '@toon-format/toon'
import { getEncoding } from 'js-tiktoken'
import { SYSTEM_PROMPT, buildUserMessage, generateQuestions, seededShuffle, sha256, summarize } from './quality-eval-lib.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(here, '../..')
const packageRoot = resolve(here, '..')

function parseArgs(argv) {
  const [command, ...rest] = argv
  const options = {}
  for (let i = 0; i < rest.length; i++) {
    if (!rest[i].startsWith('--')) throw new Error(`Unexpected argument: ${rest[i]}`)
    const key = rest[i].slice(2)
    const value = rest[i + 1]
    if (!value || value.startsWith('--')) throw new Error(`Missing value for --${key}`)
    options[key] = value; i++
  }
  return { command, options }
}

function readJsonl(path) {
  return readFileSync(path, 'utf8').split(/\r?\n/).filter(Boolean).map((line, index) => {
    try { return JSON.parse(line) } catch (error) { throw new Error(`${path}:${index + 1}: ${error.message}`) }
  })
}

function writeJsonl(path, rows) {
  writeFileSync(path, rows.map(row => JSON.stringify(row)).join('\n') + '\n')
}

function prepare(options) {
  const repetitions = Number(options.repetitions ?? 3)
  const seed = Number(options.seed ?? 20260929)
  if (!Number.isInteger(repetitions) || repetitions < 1) throw new Error('--repetitions must be a positive integer')
  if (!Number.isInteger(seed)) throw new Error('--seed must be an integer')
  const runId = options['run-id'] ?? new Date().toISOString().replace(/[:.]/g, '-').replace('Z', '')
  const outputDir = resolve(options.output ?? join(repoRoot, 'benchmark/quality-runs', runId))
  mkdirSync(outputDir, { recursive: true })

  const tokenizer = getEncoding('o200k_base')
  const count = text => tokenizer.encode(text, [], []).length
  const datasetsDir = resolve(options['datasets-dir'] ?? join(repoRoot, 'benchmark/datasets'))
  const datasetFiles = readdirSync(datasetsDir).filter(name => name.endsWith('.json')).sort()
  const conditions = []
  const datasetManifest = []
  const excluded = []

  for (const filename of datasetFiles) {
    const source = readFileSync(join(datasetsDir, filename), 'utf8')
    const data = JSON.parse(source)
    const dataset = filename.slice(0, -5)
    const questions = generateQuestions(dataset, data)
    if (!questions.length) { excluded.push({ dataset, reason: 'not a non-empty flat record array' }); continue }
    const formats = [
      ['json_compact', JSON.stringify(data), JSON.parse],
      ['toon_official', toonEncode(data), toonDecode],
      ['vigesimal_typed', encode(data, { name: dataset, est: count }), decode],
    ]
    for (const [format, payload, parse] of formats) {
      if (!isDeepStrictEqual(parse(payload), data)) throw new Error(`${dataset}/${format}: round-trip verification failed`)
      for (const question of questions) {
        for (let repetition = 1; repetition <= repetitions; repetition++) {
          const user = buildUserMessage(format, payload, question.text)
          conditions.push({
            requestId: `${question.id}:${format}:r${repetition}`,
            questionId: question.id, dataset, category: question.category, answerType: question.answerType,
            expectedAnswer: question.expectedAnswer, format, repetition, system: SYSTEM_PROMPT, user,
            payloadTokens: count(payload), fullInputTokens: count(SYSTEM_PROMPT) + count(user), payloadSha256: sha256(payload),
          })
        }
      }
    }
    datasetManifest.push({ dataset, sha256: sha256(source), records: data.length, questions: questions.length })
  }

  const requests = seededShuffle(conditions, seed)
  const pkg = JSON.parse(readFileSync(join(packageRoot, 'package.json'), 'utf8'))
  const manifest = {
    schemaVersion: 1, runId, createdAt: new Date().toISOString(), status: 'prepared-no-model-calls',
    repetitions, randomizationSeed: seed, tokenizer: 'o200k_base', systemPrompt: SYSTEM_PROMPT,
    requestCount: requests.length, modelCalls: 0, formats: ['json_compact', 'toon_official', 'vigesimal_typed'],
    package: { name: pkg.name, version: pkg.version }, dependencies: { toon: pkg.devDependencies['@toon-format/toon'], jsTiktoken: pkg.devDependencies['js-tiktoken'] },
    librarySha256: sha256(readFileSync(join(packageRoot, 'dist/index.mjs'))), harnessSha256: sha256(readFileSync(fileURLToPath(import.meta.url))),
    datasetSource: options['datasets-dir'] ? 'custom-sanitized-directory' : 'repository-fixtures', datasets: datasetManifest, excluded,
    responseSchema: { requestId: 'string', response: 'string', inputTokens: 'number?', outputTokens: 'number?', latencyMs: 'number?', error: 'string?' },
  }
  writeJsonl(join(outputDir, 'requests.jsonl'), requests)
  writeFileSync(join(outputDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n')
  console.log(`Prepared ${requests.length} randomized requests in ${outputDir}`)
  console.log('No model calls were made. Record provider results as responses.jsonl, then run quality:score.')
}

function score(options) {
  if (!options.requests || !options.responses) throw new Error('score requires --requests <path> and --responses <path>')
  const requestsPath = resolve(options.requests)
  const responsesPath = resolve(options.responses)
  const outputDir = resolve(options.output ?? dirname(responsesPath))
  const report = summarize(readJsonl(requestsPath), readJsonl(responsesPath))
  mkdirSync(outputDir, { recursive: true })
  const serializable = { missingResponseCount: report.missing.length, missingRequestIds: report.missing, byFormat: report.byFormat,
    pairedAccuracyComparisons: report.comparisons, releaseGates: report.gates,
    results: report.rows.map(({ system, user, expectedAnswer, response, ...row }) => ({ ...row, expectedAnswer, response })) }
  writeFileSync(join(outputDir, 'score.json'), JSON.stringify(serializable, null, 2) + '\n')
  const rows = Object.entries(report.byFormat).sort().map(([format, value]) =>
    `| ${format} | ${value.completed}/${value.attempted} | ${(value.accuracyOnCompleted * 100).toFixed(1)}% | ${(value.accuracyAllAttempts * 100).toFixed(1)}% | ${value.avgLatencyMs.toFixed(1)} | ${value.inputTokens + value.outputTokens} |`)
  const gateRows = Object.entries(report.gates).sort().map(([format, gate]) =>
    `| ${format} | ${gate.inputReduction === null ? '—' : `${(gate.inputReduction * 100).toFixed(1)}%`} | ${gate.completionPass ? 'pass' : 'fail'} | ${gate.accuracyPass ? 'pass' : 'fail'} | ${gate.overallPass ? 'pass' : 'fail'} |`)
  const markdown = ['# Quality evaluation', '', `Responses scored: ${report.rows.length}/${report.rows.length + report.missing.length}`, '',
    '| Format | Completed | Accuracy (completed) | Accuracy (all attempts) | Avg latency ms | Provider tokens |', '|---|---:|---:|---:|---:|---:|', ...rows, '',
    '## Predeclared release gates', '', '| Format | Input reduction vs JSON | Completion ≥99% | Accuracy regression ≤1pp (95% CI) | Overall |', '|---|---:|---:|---:|---:|', ...gateRows, '',
    report.missing.length ? `Missing responses: ${report.missing.length}` : 'All prepared requests have responses.', ''].join('\n')
  writeFileSync(join(outputDir, 'report.md'), markdown)
  console.log(markdown)
}

function usage() {
  console.log('Usage:\n  node scripts/quality-eval.mjs prepare [--output DIR] [--datasets-dir DIR] [--repetitions 3] [--seed 20260929] [--run-id ID]\n  node scripts/quality-eval.mjs score --requests FILE --responses FILE [--output DIR]')
}

try {
  const { command, options } = parseArgs(process.argv.slice(2))
  if (command === 'prepare') prepare(options)
  else if (command === 'score') score(options)
  else { usage(); if (command) process.exitCode = 1 }
} catch (error) {
  console.error(`quality-eval: ${error.message}`)
  process.exitCode = 1
}
