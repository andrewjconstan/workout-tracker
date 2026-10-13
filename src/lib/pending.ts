import type { Block } from './types'

/** Sets that could not be saved (bad signal) wait here until the next successful sync. */
export interface PendingSet {
  workout_id: string
  exercise_id: string
  block: Block
  set_number: number
  weight: number | null
  reps: number | null
  marker: string | null
}

const KEY = 'wt-pending-sets'

const same = (a: PendingSet, b: PendingSet) =>
  a.workout_id === b.workout_id &&
  a.exercise_id === b.exercise_id &&
  a.block === b.block &&
  a.set_number === b.set_number

function write(list: PendingSet[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list))
  } catch {
    /* storage unavailable: nothing more we can do */
  }
}

export function loadPending(): PendingSet[] {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as PendingSet[]) : []
  } catch {
    return []
  }
}

export function enqueue(p: PendingSet) {
  const list = loadPending().filter((x) => !same(x, p))
  list.push(p)
  write(list)
}

export function clearPending(items: PendingSet[]) {
  write(loadPending().filter((x) => !items.some((i) => same(i, x))))
}
