import test from 'node:test'
import assert from 'node:assert/strict'
import { buildSteps, effectiveExerciseId, finisherSlots, findCurrentIndex } from './steps'
import type { RoutineSlot } from './types'

let n = 0
function slot(p: Partial<RoutineSlot>): RoutineSlot {
  n += 1
  return {
    id: `s${n}`, routine_id: 'r', exercise_id: `e${n}`, block: 'superset', superset_group: 1, position: 1,
    location: 'both', target_sets: 3, rep_min: null, rep_max: null, note: null, ...p,
  }
}

test('supersets alternate exercises round by round', () => {
  const a = slot({ id: 'a', position: 1 })
  const b = slot({ id: 'b', position: 2 })
  const steps = buildSteps([b, a], 'office')
  assert.deepEqual(steps.map((s) => s.key), ['a:1', 'b:1', 'a:2', 'b:2', 'a:3', 'b:3'])
})

test('groups run in order', () => {
  const g2 = slot({ id: 'x', superset_group: 2 })
  const g1 = slot({ id: 'y', superset_group: 1 })
  const steps = buildSteps([g2, g1], 'home')
  assert.equal(steps[0].slot.id, 'y')
  assert.equal(steps[steps.length - 1].slot.id, 'x')
})

test('location variants: only the matching fly appears', () => {
  const press = slot({ id: 'press', position: 1 })
  const cable = slot({ id: 'cable', position: 2, location: 'office' })
  const band = slot({ id: 'band', position: 2, location: 'home' })
  const office = buildSteps([press, cable, band], 'office').map((s) => s.slot.id)
  const home = buildSteps([press, cable, band], 'home').map((s) => s.slot.id)
  assert.ok(office.includes('cable') && !office.includes('band'))
  assert.ok(home.includes('band') && !home.includes('cable'))
})

test('added rounds extend a group', () => {
  const a = slot({ id: 'a', position: 1, superset_group: 2 })
  const b = slot({ id: 'b', position: 2, superset_group: 2 })
  const steps = buildSteps([a, b], 'office', { '2': 1 })
  assert.equal(steps.length, 8)
  assert.equal(steps[steps.length - 1].round, 4)
  assert.equal(steps[0].rounds, 4)
})

test('finishers are not steps but are listed separately', () => {
  const a = slot({ id: 'a' })
  const f = slot({ id: 'f', block: 'finisher', superset_group: 4 })
  assert.equal(buildSteps([a, f], 'office').some((s) => s.slot.id === 'f'), false)
  assert.deepEqual(finisherSlots([a, f], 'office').map((s) => s.id), ['f'])
})

test('substitution overrides the exercise for one slot', () => {
  const a = slot({ id: 'a', exercise_id: 'orig' })
  assert.equal(effectiveExerciseId(a, {}), 'orig')
  assert.equal(effectiveExerciseId(a, { a: 'other' }), 'other')
})

test('current index skips done and skipped steps', () => {
  const a = slot({ id: 'a', position: 1 })
  const b = slot({ id: 'b', position: 2 })
  const steps = buildSteps([a, b], 'office')
  const done = new Set(['a:1'])
  assert.equal(findCurrentIndex(steps, (s) => done.has(s.key), new Set()), 1)
  assert.equal(findCurrentIndex(steps, (s) => done.has(s.key), new Set(['b:1'])), 2)
  assert.equal(findCurrentIndex(steps, () => true, new Set()), -1)
})
