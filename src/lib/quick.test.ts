import assert from 'node:assert/strict'
import test from 'node:test'
import { buildQuickSlots } from './quick'

test('alternating quick workout: one group, positions in pick order', () => {
  const rows = buildQuickSlots('r', ['curl', 'pushup'], 3, true)
  assert.deepEqual(rows.map((r) => [r.exercise_id, r.superset_group, r.position, r.target_sets]), [
    ['curl', 1, 1, 3],
    ['pushup', 1, 2, 3],
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
