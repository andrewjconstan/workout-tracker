import type { HistorySet } from './history'
import type { SetRow } from './types'

/** Columns needed to build history for an exercise (joined to the workout's date and location). */
export const HISTORY_SELECT =
  'workout_id, exercise_id, set_number, block, weight, reps, marker, logged_at, workouts!inner(performed_on, location)'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function toHistory(r: any): HistorySet {
  const w = Array.isArray(r.workouts) ? r.workouts[0] : r.workouts
  return {
    workout_id: r.workout_id,
    exercise_id: r.exercise_id,
    set_number: r.set_number,
    block: r.block,
    weight: r.weight === null || r.weight === undefined ? null : Number(r.weight),
    reps: r.reps ?? null,
    marker: r.marker ?? null,
    logged_at: r.logged_at,
    performed_on: w.performed_on,
    location: w.location,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function toSetRow(r: any): SetRow {
  return {
    id: r.id,
    workout_id: r.workout_id,
    exercise_id: r.exercise_id,
    block: r.block,
    set_number: r.set_number,
    weight: r.weight === null || r.weight === undefined ? null : Number(r.weight),
    reps: r.reps ?? null,
    marker: r.marker ?? null,
    note: r.note ?? null,
    logged_at: r.logged_at,
  }
}
