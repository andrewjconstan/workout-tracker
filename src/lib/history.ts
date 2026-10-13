import type { Block, ExerciseKind, Location } from './types'

export interface HistorySet {
  workout_id: string
  exercise_id: string
  set_number: number
  block: Block
  weight: number | null
  reps: number | null
  marker: string | null
  logged_at: string
  performed_on: string
  location: Location
}

export interface SessionSet {
  setNumber: number
  weight: number | null
  reps: number | null
  marker: string | null
}

export interface HistorySession {
  workoutId: string
  date: string
  location: Location
  lastLogged: string
  sets: SessionSet[]
}

export function fmtNum(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Number(n.toFixed(2)))
}

/** Group set rows into one session per workout, newest first. */
export function groupSessions(
  rows: HistorySet[],
  opts: { limit?: number; excludeWorkoutId?: string; block?: Block; location?: Location } = {},
): HistorySession[] {
  const map = new Map<string, HistorySession>()
  for (const r of rows) {
    if (opts.excludeWorkoutId && r.workout_id === opts.excludeWorkoutId) continue
    if (opts.block && r.block !== opts.block) continue
    if (opts.location && r.location !== opts.location) continue
    let s = map.get(r.workout_id)
    if (!s) {
      s = { workoutId: r.workout_id, date: r.performed_on, location: r.location, lastLogged: r.logged_at, sets: [] }
      map.set(r.workout_id, s)
    }
    s.sets.push({ setNumber: r.set_number, weight: r.weight, reps: r.reps, marker: r.marker })
    if (r.logged_at > s.lastLogged) s.lastLogged = r.logged_at
  }
  const sessions = [...map.values()]
  for (const s of sessions) s.sets.sort((a, b) => a.setNumber - b.setNumber)
  sessions.sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1
    if (a.lastLogged !== b.lastLogged) return a.lastLogged < b.lastLogged ? 1 : -1
    return 0
  })
  return opts.limit ? sessions.slice(0, opts.limit) : sessions
}

/** "40×10", "15" (reps only), "red×12" (band). */
export function formatSet(s: SessionSet, kind: ExerciseKind): string {
  const reps = s.reps === null ? '–' : String(s.reps)
  if (kind === 'reps_only') return reps
  if (kind === 'band') return s.marker ? `${s.marker}×${reps}` : reps
  return s.weight === null ? reps : `${fmtNum(s.weight)}×${reps}`
}

export function sessionTopWeight(s: HistorySession): number | null {
  const ws = s.sets.map((x) => x.weight).filter((n): n is number => n !== null)
  return ws.length ? Math.max(...ws) : null
}

export function sessionTotalReps(s: HistorySession): number {
  return s.sets.reduce((sum, x) => sum + (x.reps ?? 0), 0)
}

/** Weight to pre-fill: same set number last time, else the last set's weight last time. */
export function suggestedWeight(sessions: HistorySession[], setNumber: number): number | null {
  const last = sessions[0]
  if (!last) return null
  const same = last.sets.find((x) => x.setNumber === setNumber && x.weight !== null)
  if (same) return same.weight
  const withWeight = last.sets.filter((x) => x.weight !== null)
  return withWeight.length ? withWeight[withWeight.length - 1].weight : null
}
