import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { DAY_NAMES, dayOfWeekMon1, formatDate, localDateString } from '../lib/dates'
import { useLocalState } from '../lib/storage'
import type { Location, Routine, Workout } from '../lib/types'

type WorkoutWithRoutine = Workout & { routines: { name: string } | null }

export default function Home() {
  const nav = useNavigate()
  const [routines, setRoutines] = useState<Routine[]>([])
  const [active, setActive] = useState<WorkoutWithRoutine[]>([])
  const [recent, setRecent] = useState<WorkoutWithRoutine[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [location, setLocation] = useLocalState<Location>('wt-location', 'office')
  const [date, setDate] = useState(localDateString())
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const [r, a, c] = await Promise.all([
      supabase.from('routines').select('*').eq('archived', false).order('sort_order'),
      supabase.from('workouts').select('*, routines(name)').eq('status', 'in_progress').order('created_at', { ascending: false }),
      supabase.from('workouts').select('*, routines(name)').eq('status', 'completed').order('performed_on', { ascending: false }).limit(5),
    ])
    const firstError = r.error ?? a.error ?? c.error
    if (firstError) setError(firstError.message)
    setRoutines((r.data ?? []) as Routine[])
    setActive((a.data ?? []) as WorkoutWithRoutine[])
    setRecent((c.data ?? []) as WorkoutWithRoutine[])
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function start(routine: Routine) {
    setBusy(true)
    setError(null)
    const { data, error } = await supabase
      .from('workouts')
      .insert({ routine_id: routine.id, performed_on: date, location })
      .select('id')
      .single()
    setBusy(false)
    if (error || !data) {
      setError(error?.message ?? 'Could not start workout')
      return
    }
    nav(`/log/${(data as { id: string }).id}`)
  }

  async function discard(id: string) {
    if (!window.confirm('Discard this unfinished workout and any sets logged in it?')) return
    const { error } = await supabase.from('workouts').delete().eq('id', id)
    if (error) setError(error.message)
    void load()
  }

  async function loadStarter() {
    setBusy(true)
    const { error } = await supabase.rpc('seed_starter_plan')
    setBusy(false)
    if (error) setError(error.message)
    void load()
  }

  if (loading) return <p className="muted">Loading…</p>

  const today = dayOfWeekMon1()

  return (
    <div>
      <h1>Today</h1>
      {error && <p className="error">{error}</p>}

      {active.map((w) => (
        <div key={w.id} className="card today">
          <div className="row between">
            <div>
              <h3>In progress: {w.routines?.name ?? 'Workout'}</h3>
              <p className="muted small">{formatDate(w.performed_on)} · {w.location === 'office' ? 'Office' : 'Home'}</p>
            </div>
          </div>
          <div className="row">
            <Link to={`/log/${w.id}`} className="grow"><button className="primary big">Resume</button></Link>
            <button className="danger" onClick={() => discard(w.id)}>Discard</button>
          </div>
        </div>
      ))}

      {routines.length === 0 ? (
        <div className="card">
          <p>No routines yet. Load the starter plan (Mon / Tue / Wed supersets) to begin.</p>
          <button className="primary big" disabled={busy} onClick={loadStarter}>Load starter plan</button>
        </div>
      ) : (
        <>
          <div className="row wrap between">
            <div className="seg" role="group" aria-label="Location">
              <button className={location === 'office' ? 'on' : ''} onClick={() => setLocation('office')}>Office</button>
              <button className={location === 'home' ? 'on' : ''} onClick={() => setLocation('home')}>Home</button>
            </div>
            <details>
              <summary className="small muted">Date: {formatDate(date)}</summary>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value || localDateString())} />
            </details>
          </div>

          {routines.map((r) => (
            <div key={r.id} className={`card${r.day_of_week === today ? ' today' : ''}`}>
              <div className="row between">
                <div>
                  <h3>{r.name}</h3>
                  <p className="muted small">
                    {r.day_of_week ? DAY_NAMES[r.day_of_week] : 'Any day'}
                    {r.day_of_week === today ? ' · today' : ''}
                  </p>
                </div>
                <button className="primary" disabled={busy} onClick={() => start(r)}>
                  Start ({location === 'office' ? 'Office' : 'Home'})
                </button>
              </div>
            </div>
          ))}
        </>
      )}

      {recent.length > 0 && (
        <>
          <h2>Recent</h2>
          {recent.map((w) => (
            <Link key={w.id} to={`/workout/${w.id}`} className="card link">
              <div className="row between">
                <span>
                  <strong>{formatDate(w.performed_on)}</strong> · {w.routines?.name ?? 'Workout'}
                </span>
                <span className={`badge ${w.location}`}>{w.location === 'office' ? 'Office' : 'Home'}</span>
              </div>
            </Link>
          ))}
        </>
      )}
    </div>
  )
}
