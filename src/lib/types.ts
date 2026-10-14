export type ExerciseKind = 'weighted' | 'reps_only' | 'band'
export type Location = 'office' | 'home'
export type Block = 'superset' | 'finisher'

export interface Exercise {
  id: string
  name: string
  kind: ExerciseKind
  load_note: string | null
  reps_note: string | null
  archived: boolean
  /** "Similar to" tag used to suggest swaps, e.g. "chest" or "glutes & legs". */
  swap_group: string | null
  /** Limits suggestions to one location (e.g. a cable fly only makes sense at the office). */
  only_at: Location | null
}

export interface Routine {
  id: string
  name: string
  day_of_week: number | null // 1 = Monday
  notes: string | null
  sort_order: number
  archived: boolean
}

export interface RoutineSlot {
  id: string
  routine_id: string
  exercise_id: string
  block: Block
  superset_group: number
  position: number
  location: 'both' | Location
  target_sets: number | null
  rep_min: number | null
  rep_max: number | null
  note: string | null
}

export interface Workout {
  id: string
  routine_id: string | null
  performed_on: string // YYYY-MM-DD, local date
  location: Location
  status: 'in_progress' | 'completed'
  notes: string | null
  created_at: string
  completed_at: string | null
}

export interface SetRow {
  id: string
  workout_id: string
  exercise_id: string
  block: Block
  set_number: number
  weight: number | null
  reps: number | null
  marker: string | null
  note: string | null
  logged_at: string
}
