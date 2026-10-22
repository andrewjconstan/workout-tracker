import assert from 'node:assert/strict'
import test from 'node:test'
import { buildQuickSlots } from './quick'

test('alternating quick workout: pairs of exercises', () => {
  const rows = buildQuickSlots('r', ['curl', 'pushup'], 3, true)
  assert.deepEqual(rows.map((r) => [r.exercise_id, r.superset_group, r.position, r.target_sets]), [
    ['curl', 1, 1, 3],
    ['pushup', 1, 2, 3],
  ])
})

test('alternating with four exercises pairs 1+2 and 3+4', () => {
  const rows = buildQuickSlots('r', ['a', 'b', 'c', 'd'], 3, true)
  assert.deepEqual(rows.map((r) => [r.exercise_id, r.superset_group, r.position]), [
    ['a', 1, 1], ['b', 1, 2], ['c', 2, 1], ['d', 2, 2],
  ])
})

test('alternating with an odd count leaves the last exercise alone at the end', () => {
  const rows = buildQuickSlots('r', ['a', 'b', 'c'], 3, true)
  assert.deepEqual(rows.map((r) => [r.exercise_id, r.superset_group, r.position]), [
    ['a', 1, 1], ['b', 1, 2], ['c', 2, 1],
  ])
})

test('straight sets quick workout: one group per exercise', () => {
  const rows = buildQuickSlots('r', ['curl', 'pushup', 'row'], 4, false)
  assert.deepEqual(rows.map((r) => [r.exercise_id, r.superset_group, r.position]), [
    ['curl', 1, 1],
    ['pushup', 2, 1],
    ['row', 3, 1],
  ])
  assert.ok(rows.every((r) => r.routine_id === 'r' && r.block === 'superset' && r.location === 'both'))
})
