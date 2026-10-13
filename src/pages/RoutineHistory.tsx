import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { formatDate } from '../lib/dates'
import { formatSet } from '../lib/history'
import { toSetRow } from '../lib/queries'
import { supabase } from '../lib/supabase'
import type { Exercise, Location, Routine, SetRow, Workout } from '../lib/types'

type SetWithExercise = SetRow & { exercises: Pick<Exercise, 'id' | 'name' | 'kind'> | null }
type WorkoutWithSets = Workout & { sets: SetWithExercise[] }

export default function RoutineHistory() {
  const { routineId } = useParams()
  const [routine, setRoutine] = useState<Routine | null>(null)
  const [workouts, setWorkouts] = useState<WorkoutWithSets[]>([])
  const [filter, setFilter] = useState<'all' | Location>('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!routineId) return
    async function load() {
      const [r, w] = await Promise.all([
        supabase.from('routines').select('*').eq('id', routineId).single(),
        supabase
          .from('workouts')
          .select('*, sets(*, exercises(id, name, kind))')
          .eq('routine_id', routineId)
          .order('performed_on', { ascending: false })
          .order('created_at', { ascending: false }),
      ])
      if (r.error || w.error) setError((r.error ?? w.error)!.message)
      setRoutine((r.data ?? null) as Routine | null)
      setWorkouts((w.data ?? []) as WorkoutWithSets[])
      setLoading(false)
    }
    void load()
  }, [routineId])

  const shown = useMemo(
    () => workouts.filter((w) => filter === 'all' || w.location === filter),
    [workouts, filter],
  )
  const counts = useMemo(
    () => ({
      all: workouts.length,
      office: workouts.filter((w) => w.location === 'office').length,
      home: workouts.filter((w) => w.location === 'home').length,
    }),
    [workouts],
  )

  if (loading) return <p className="muted">Loading…</p>

  return (
    <div>
      <p><Link to="/history">← History</Link></p>
      <h1>{routine?.name ?? 'Routine'}</h1>
      {error && <p className="error">{error}</p>}

      <div className="seg" role="group" aria-label="Location filter">
        <button className={filter === 'all' ? 'on' : ''} onClick={() => setFilter('all')}>All ({counts.all})</button>
        <button className={filter === 'office' ? 'on' : ''} onClick={() => setFilter('office')}>Office ({counts.office})</button>
        <button className={filter === 'home' ? 'on' : ''} onClick={() => setFilter('home')}>Home ({counts.home})</button>
      </div>

      {shown.length === 0 && <p className="muted">No workouts yet.</p>}

      {shown.map((w) => {
        // Group this workout's sets by exercise, in the order the exercise was first logged.
        const order: string[] = []
        const byEx = new Map<string, SetWithExercise[]>()
        for (const s of [...w.sets].sort((a, b) => a.logged_at.localeCompare(b.logged_at))) {
          if (!byEx.has(s.exercise_id)) {
            byEx.set(s.exercise_id, [])
            order.push(s.exercise_id)
          }
          byEx.get(s.exercise_id)!.push(s)
        }
        return (
          <Link key={w.id} to={`/workout/${w.id}`} className="card link">
            <div className="row between">
              <strong>{formatDate(w.performed_on)}</strong>
              <span className="row">
                {w.status === 'in_progress' && <span className="badge kind">In progress</span>}
                <span className={`badge ${w.location}`}>{w.location === 'office' ? 'Office' : 'Home'}</span>
              </span>
            </div>
            <ul className="sessionlist">
              {order.map((id) => {
                const rows = byEx.get(id)!.map(toSetRow).sort((a, b) => a.block.localeCompare(b.block) || a.set_number - b.set_number)
                const ex = byEx.get(id)![0].exercises
                return (
                  <li key={id}>
                    <div className="small">{ex?.name ?? 'Exercise'}</div>
                    <div className="strip-sets">
                      {rows.map((s) => (
                        <span key={s.id}>
                          {formatSet({ setNumber: s.set_number, weight: s.weight, reps: s.reps, marker: s.marker }, ex?.kind ?? 'weighted')}
                          {s.block === 'finisher' ? ' (fin.)' : ''}
                        </span>
                      ))}
                    </div>
                  </li>
                )
              })}
            </ul>
            {w.notes && <p className="muted small">{w.notes}</p>}
          </Link>
        )
      })}
    </div>
  )
}
