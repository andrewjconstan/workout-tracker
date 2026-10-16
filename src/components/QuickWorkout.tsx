import { useState } from 'react'
import { QUICK_ROUTINE_NAME, buildQuickSlots } from '../lib/quick'
import { supabase } from '../lib/supabase'
import type { Exercise, Location } from '../lib/types'

/** Start a one-off workout with any exercises, no routine needed. */
export default function QuickWorkout({
  location,
  date,
  blocked,
  onStarted,
  onError,
}: {
  location: Location
  date: string
  /** True while an earlier quick workout is still in progress (it shares the hidden routine). */
  blocked: boolean
  onStarted: (workoutId: string) => void
  onError: (message: string | null) => void
}) {
  const [open, setOpen] = useState(false)
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [picked, setPicked] = useState<string[]>([])
  const [sets, setSets] = useState(3)
  const [alternate, setAlternate] = useState(true)
  const [busy, setBusy] = useState(false)

  async function openPanel() {
    setOpen(true)
    if (exercises.length) return
    const { data, error } = await supabase.from('exercises').select('*').eq('archived', false).order('name')
    if (error) onError(error.message)
    else setExercises((data ?? []) as Exercise[])
  }

  const choices = exercises.filter((e) => !e.only_at || e.only_at === location)

  function toggle(id: string) {
    setPicked((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  async function start() {
    setBusy(true)
    onError(null)
    try {
      const found = await supabase
        .from('routines')
        .select('id')
        .eq('name', QUICK_ROUTINE_NAME)
        .eq('archived', true)
        .limit(1)
      if (found.error) throw found.error
      let routineId = (found.data?.[0] as { id: string } | undefined)?.id
      if (!routineId) {
        const created = await supabase
          .from('routines')
          .insert({ name: QUICK_ROUTINE_NAME, archived: true, sort_order: 999 })
          .select('id')
          .single()
        if (created.error || !created.data) throw created.error ?? new Error('Could not create quick routine')
        routineId = (created.data as { id: string }).id
      }

      const cleared = await supabase.from('routine_slots').delete().eq('routine_id', routineId)
      if (cleared.error) throw cleared.error
      const added = await supabase.from('routine_slots').insert(buildQuickSlots(routineId, picked, sets, alternate))
      if (added.error) throw added.error

      const workout = await supabase
        .from('workouts')
        .insert({ routine_id: routineId, performed_on: date, location })
        .select('id')
        .single()
      if (workout.error || !workout.data) throw workout.error ?? new Error('Could not start workout')
      onStarted((workout.data as { id: string }).id)
    } catch (e) {
      onError(e instanceof Error ? e.message : (e as { message?: string }).message ?? 'Could not start quick workout')
    }
    setBusy(false)
  }

  return (
    <div className="card">
      <div className="row between">
        <div>
          <h3>{QUICK_ROUTINE_NAME}</h3>
          <p className="muted small">Pick a few exercises, no routine needed.</p>
        </div>
        <button onClick={() => (open ? setOpen(false) : void openPanel())}>{open ? 'Close' : 'Choose'}</button>
      </div>

      {open && (
        <div className="stack" style={{ marginTop: 12 }}>
          {blocked && (
            <p className="muted small">
              A quick workout is already in progress. Resume or discard it above before starting another.
            </p>
          )}
          <div>
            {choices.map((e) => {
              const n = picked.indexOf(e.id)
              return (
                <label key={e.id} className="row" style={{ padding: '6px 0' }}>
                  <input type="checkbox" checked={n >= 0} onChange={() => toggle(e.id)} />
                  <span className="grow">{e.name}</span>
                  {n >= 0 && <span className="muted small">#{n + 1}</span>}
                </label>
              )
            })}
          </div>
          <div className="row">
            <label className="grow">
              Sets each
              <select value={sets} onChange={(e) => setSets(Number(e.target.value))}>
                {[1, 2, 3, 4, 5, 6].map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </label>
          </div>
          <label className="row">
            <input type="checkbox" checked={alternate} onChange={(e) => setAlternate(e.target.checked)} />
            <span>Alternate exercises (superset)</span>
          </label>
          <button className="primary big" disabled={busy || blocked || picked.length === 0} onClick={() => void start()}>
            {busy ? 'Starting…' : `Start (${location === 'office' ? 'Office' : 'Home'})`}
          </button>
        </div>
      )}
    </div>
  )
}
