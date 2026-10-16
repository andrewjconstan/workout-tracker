import type { Block } from './types'

/**
 * Quick workouts reuse one hidden (archived) routine with this name. Its slots are replaced each time,
 * so past sessions keep their sets and no extra routines pile up in Plan.
 */
export const QUICK_ROUTINE_NAME = 'Quick workout'

export interface QuickSlotRow {
  routine_id: string
  exercise_id: string
  block: Block
  superset_group: number
  position: number
  location: 'both'
  target_sets: number
  rep_min: null
  rep_max: null
  note: null
}

/**
 * Slots for a quick workout, in the order the exercises were picked.
 * Alternating puts them all in one superset group; otherwise each is its own group (straight sets).
 */
export function buildQuickSlots(routineId: string, exerciseIds: string[], sets: number, alternate: boolean): QuickSlotRow[] {
  return exerciseIds.map((id, i) => ({
    routine_id: routineId,
    exercise_id: id,
    block: 'superset',
    superset_group: alternate ? 1 : i + 1,
    position: alternate ? i + 1 : 1,
    location: 'both',
    target_sets: sets,
    rep_min: null,
    rep_max: null,
    note: null,
  }))
}
