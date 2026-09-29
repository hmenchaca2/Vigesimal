import test from 'node:test'
import assert from 'node:assert/strict'
import { generateQuestions, pairedAccuracyComparison, scoreAnswer, seededShuffle, summarize } from './quality-eval-lib.mjs'

test('question gold answers are derived deterministically from records', () => {
  const rows = [
    { id: 1, name: 'Ada', team: 'Core', score: 3, active: true },
    { id: 2, name: 'Grace', team: 'Core', score: 7, active: false },
    { id: 3, name: 'Linus', team: 'Tools', score: 2, active: true },
  ]
  const questions = generateQuestions('people', rows)
  assert.deepEqual(questions.map(q => [q.category, q.expectedAnswer]), [
    ['field_retrieval', 'Ada'], ['filtering', '2'], ['filtering', 'Ada, Grace'], ['aggregation', '12'],
  ])
})

test('deterministic scorers accept harmless formatting only', () => {
  assert.equal(scoreAnswer('1,200', '$1,200', 'numeric'), true)
  assert.equal(scoreAnswer('yes', 'TRUE.', 'boolean'), true)
  assert.equal(scoreAnswer('Ada, Grace', 'grace, ada', 'list'), true)
  assert.equal(scoreAnswer('Ada', 'Ada Lovelace', 'exact'), false)
})

test('seeded shuffle is stable and non-mutating', () => {
  const values = [1, 2, 3, 4, 5]
  assert.deepEqual(seededShuffle(values, 7), seededShuffle(values, 7))
  assert.deepEqual(values, [1, 2, 3, 4, 5])
})

test('summary separates provider failures from wrong answers', () => {
  const requests = [
    { requestId: 'a', format: 'json_compact', expectedAnswer: '4', answerType: 'numeric' },
    { requestId: 'b', format: 'json_compact', expectedAnswer: 'yes', answerType: 'boolean' },
    { requestId: 'c', format: 'toon_official', expectedAnswer: 'x', answerType: 'exact' },
  ]
  const report = summarize(requests, [
    { requestId: 'a', response: '4' }, { requestId: 'b', error: 'timeout' }, { requestId: 'c', response: 'wrong' },
  ])
  assert.equal(report.byFormat.json_compact.completionRate, 0.5)
  assert.equal(report.byFormat.json_compact.accuracyOnCompleted, 1)
  assert.equal(report.byFormat.json_compact.accuracyAllAttempts, 0.5)
  assert.equal(report.byFormat.toon_official.accuracyOnCompleted, 0)
})

test('paired comparison keeps question repetitions in one cluster', () => {
  const rows = [
    { questionId: 'q1', format: 'json_compact', correct: true },
    { questionId: 'q1', format: 'json_compact', correct: true },
    { questionId: 'q1', format: 'vigesimal_typed', correct: false },
    { questionId: 'q1', format: 'vigesimal_typed', correct: true },
    { questionId: 'q2', format: 'json_compact', correct: false },
    { questionId: 'q2', format: 'vigesimal_typed', correct: true },
  ]
  const comparison = pairedAccuracyComparison(rows, 'json_compact', 100, 7).vigesimal_typed
  assert.equal(comparison.questionClusters, 2)
  assert.equal(comparison.accuracyDifference, 0.25)
  assert.equal(comparison.confidenceInterval.length, 2)
})
