import test from 'node:test'
import assert from 'node:assert/strict'
import { parseEntry } from './entry'

test('weighted needs weight and whole-number reps', () => {
  assert.deepEqual(parseEntry('weighted', '40', '10', ''), { entry: { weight: 40, reps: 10, marker: null } })
  assert.deepEqual(parseEntry('weighted', '27,5', '8', ''), { entry: { weight: 27.5, reps: 8, marker: null } })
  assert.ok('error' in parseEntry('weighted', '', '10', ''))
  assert.ok('error' in parseEntry('weighted', '40', '', ''))
  assert.ok('error' in parseEntry('weighted', '40', '10.5', ''))
  assert.ok('error' in parseEntry('weighted', 'abc', '10', ''))
  assert.ok('error' in parseEntry('weighted', '-5', '10', ''))
})

test('reps-only ignores weight and marker', () => {
  assert.deepEqual(parseEntry('reps_only', '99', '15', 'x'), { entry: { weight: null, reps: 15, marker: null } })
})

test('band keeps a free-text marker, blank becomes null', () => {
  assert.deepEqual(parseEntry('band', '', '12', ' red '), { entry: { weight: null, reps: 12, marker: 'red' } })
  assert.deepEqual(parseEntry('band', '', '12', ''), { entry: { weight: null, reps: 12, marker: null } })
})
