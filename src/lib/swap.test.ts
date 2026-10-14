import assert from 'node:assert/strict'
import test from 'node:test'
import { suggestSwaps, swapGroups } from './swap'
import type { Exercise } from './types'

const ex = (id: string, name: string, swap_group: string | null, only_at: Exercise['only_at'] = null, archived = false): Exercise => ({
  id, name, kind: 'weighted', load_note: null, reps_note: null, archived, swap_group, only_at,
})

const all = [
  ex('bridge', 'Glute Bridge', 'glutes & legs', 'home'),
  ex('sumo', 'Sumo Squat', 'glutes & legs'),
  ex('lunge', 'Lunge', 'Glutes & Legs'),
  ex('old', 'Old Squat', 'glutes & legs', null, true),
  ex('press', 'Press', 'chest'),
  ex('none', 'Mystery', null),
]

test('swap suggestions: same group, not itself, not archived, sorted by name', () => {
  const names = suggestSwaps(all[1], all, 'home').map((e) => e.name)
  assert.deepEqual(names, ['Glute Bridge', 'Lunge'])
})

test('swap suggestions respect location', () => {
  const names = suggestSwaps(all[1], all, 'office').map((e) => e.name)
  assert.deepEqual(names, ['Lunge'])
})

test('swap suggestions are empty without a group', () => {
  assert.deepEqual(suggestSwaps(all[5], all, 'home'), [])
  assert.deepEqual(suggestSwaps(undefined, all, 'home'), [])
})

test('swap groups are distinct (ignoring case) and sorted', () => {
  assert.deepEqual(swapGroups(all), ['chest', 'glutes & legs'])
})
