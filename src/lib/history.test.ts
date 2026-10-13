import test from 'node:test'
import assert from 'node:assert/strict'
import {
  fmtNum, formatSet, groupSessions, sessionTopWeight, sessionTotalReps, suggestedWeight, type HistorySet,
} from './history'

function row(p: Partial<HistorySet>): HistorySet {
  return {
    workout_id: 'w1', exercise_id: 'e', set_number: 1, block: 'superset', weight: 40, reps: 10, marker: null,
    logged_at: '2026-10-07T12:00:00Z', performed_on: '2026-10-07', location: 'office', ...p,
  }
}

test('sessions are newest first and sets are ordered', () => {
  const rows = [
    row({ workout_id: 'old', performed_on: '2026-09-30', set_number: 2 }),
    row({ workout_id: 'old', performed_on: '2026-09-30', set_number: 1 }),
    row({ workout_id: 'new', performed_on: '2026-10-07', set_number: 1 }),
  ]
  const s = groupSessions(rows)
  assert.deepEqual(s.map((x) => x.workoutId), ['new', 'old'])
  assert.deepEqual(s[1].sets.map((x) => x.setNumber), [1, 2])
})

test('limit, exclusion, block and location filters', () => {
  const rows = [
    row({ workout_id: 'a', performed_on: '2026-10-01' }),
    row({ workout_id: 'b', performed_on: '2026-10-02', location: 'home' }),
    row({ workout_id: 'c', performed_on: '2026-10-03', block: 'finisher' }),
  ]
  assert.equal(groupSessions(rows, { limit: 1 }).length, 1)
  assert.equal(groupSessions(rows, { excludeWorkoutId: 'a' }).length, 2)
  assert.deepEqual(groupSessions(rows, { block: 'superset' }).map((x) => x.workoutId), ['b', 'a'])
  assert.deepEqual(groupSessions(rows, { location: 'home' }).map((x) => x.workoutId), ['b'])
})

test('same date ties break by most recently logged', () => {
  const rows = [
    row({ workout_id: 'a', logged_at: '2026-10-07T08:00:00Z' }),
    row({ workout_id: 'b', logged_at: '2026-10-07T18:00:00Z' }),
  ]
  assert.deepEqual(groupSessions(rows).map((x) => x.workoutId), ['b', 'a'])
})

test('set formatting by exercise kind', () => {
  assert.equal(formatSet({ setNumber: 1, weight: 40, reps: 10, marker: null }, 'weighted'), '40×10')
  assert.equal(formatSet({ setNumber: 1, weight: 27.5, reps: 8, marker: null }, 'weighted'), '27.5×8')
  assert.equal(formatSet({ setNumber: 1, weight: null, reps: 15, marker: null }, 'reps_only'), '15')
  assert.equal(formatSet({ setNumber: 1, weight: null, reps: 12, marker: 'red' }, 'band'), 'red×12')
  assert.equal(formatSet({ setNumber: 1, weight: null, reps: 12, marker: null }, 'band'), '12')
  assert.equal(fmtNum(40), '40')
  assert.equal(fmtNum(27.5), '27.5')
})

test('session totals', () => {
  const [s] = groupSessions([
    row({ set_number: 1, weight: 35, reps: 10 }),
    row({ set_number: 2, weight: 40, reps: 9 }),
  ])
  assert.equal(sessionTopWeight(s), 40)
  assert.equal(sessionTotalReps(s), 19)
})

test('weight suggestion prefers the same set number from the last session', () => {
  const sessions = groupSessions([
    row({ workout_id: 'x', set_number: 1, weight: 35 }),
    row({ workout_id: 'x', set_number: 2, weight: 40 }),
  ])
  assert.equal(suggestedWeight(sessions, 1), 35)
  assert.equal(suggestedWeight(sessions, 2), 40)
  assert.equal(suggestedWeight(sessions, 4), 40) // falls back to the last set's weight
  assert.equal(suggestedWeight([], 1), null)
})
