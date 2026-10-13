import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { fmtNum } from '../lib/history'
import { parseEntry } from '../lib/entry'
import { toSetRow } from '../lib/queries'
import { supabase } from '../lib/supabase'
import { formatDate } from '../lib/dates'
import type { Block, Exercise, Location, SetRow, Workout } from '../lib/types'

type SetWithExercise = SetRow & { exercises: Exercise | null }
type Detail = Workout & {
  routines: { name: string } | null
  sets: SetWithExercise[]
  workout_exercise_notes: { exercise_id: string; note: string }[]
}

export default function WorkoutDetail() {
  const { workoutId } = useParams()
  const nav = useNavigate()
  const [detail, setDetail] = useState<Detail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [date, setDate] = useState('')
  const [location, setLocation] = useState<Location>('office')
  const [notes, setNotes] = useState('')

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('workouts')
      .select('*, routines(name), sets(*, exercises(*)), workout_exercise_notes(exercise_id, note)')
      .eq('id', workoutId)
      .single()
    if (error || !data) {
      setError(error?.message ?? 'Workout not found')
      setLoading(false)
      return
    }
    const d = data as Detail
    setDetail(d)
    setDate(d.performed_on)
    setLocation(d.location)
    setNotes(d.notes ?? '')
    setLoading(false)
  }, [workoutId])

  useEffect(() => {
    void load()
  }, [load])

  async function saveMeta() {
    const { error } = await supabase
      .from('workouts')
      .update({ performed_on: date, location, notes: notes.trim() || null })
      .eq('id', workoutId)
    setError(error ? error.message : null)
    if (!error) void load()
  }

  async function reopen() {
    const { error } = await supabase.from('workouts').update({ status: 'in_progress', completed_at: null }).eq('id', workoutId)
    if (error) setError(error.message)
    else nav(`/log/${workoutId}`)
  }

  async function removeWorkout() {
    if (!window.confirm('Delete this workout and all of its sets? This cannot be undone.')) return
    const { error } = await supabase.from('workouts').delete().eq('id', workoutId)
    if (error) setError(error.message)
    else nav('/history')
  }

  if (loading) return <p className="muted">Loading…</p>
  if (!detail) return <div><p className="error">{error}</p><Link to="/history">Back</Link></div>

  // Group sets by exercise (working sets, then finisher sets).
  const groups = new Map<string, { exercise: Exercise | null; sets: SetWithExercise[] }>()
  for (const s of [...detail.sets].sort((a, b) => a.logged_at.localeCompare(b.logged_at))) {
    const g = groups.get(s.exercise_id) ?? { exercise: s.exercises, sets: [] }
    g.sets.push(s)
    groups.set(s.exercise_id, g)
  }
  const noteFor = (id: string) => detail.workout_exercise_notes.find((n) => n.exercise_id === id)?.note

  return (
    <div>
      <p>
        <Link to={detail.routine_id ? `/history/${detail.routine_id}` : '/history'}>← Back</Link>
      </p>
      <h1>{detail.routines?.name ?? 'Workout'}</h1>
      {error && <p className="error">{error}</p>}

      <div className="card stack">
        <div className="row">
          <label className="grow">
            Date
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label className="grow">
            Location
            <select value={location} onChange={(e) => setLocation(e.target.value as Location)}>
              <option value="office">Office</option>
              <option value="home">Home</option>
            </select>
          </label>
        </div>
        <label>
          Notes
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
        <div className="row wrap">
          <button className="primary" onClick={() => void saveMeta()} disabled={!date}>Save details</button>
          {detail.status === 'completed' && <button onClick={() => void reopen()}>Reopen to log more</button>}
        </div>
        <p className="muted small">
          {formatDate(detail.performed_on)} · {detail.status === 'completed' ? 'Completed' : 'In progress'}
        </p>
      </div>

      {[...groups.entries()].map(([exerciseId, g]) =>
        g.exercise ? (
          <ExerciseSets
            key={exerciseId}
            workoutId={detail.id}
            exercise={g.exercise}
            sets={g.sets.map(toSetRow)}
            note={noteFor(exerciseId)}
            onChanged={() => void load()}
            onError={setError}
          />
        ) : null,
      )}

      <div className="row" style={{ marginTop: 16 }}>
        <button className="danger" onClick={() => void removeWorkout()}>Delete workout</button>
      </div>
    </div>
  )
}

function ExerciseSets({
  workoutId,
  exercise,
  sets,
  note,
  onChanged,
  onError,
}: {
  workoutId: string
  exercise: Exercise
  sets: SetRow[]
  note?: string
  onChanged: () => void
  onError: (msg: string | null) => void
}) {
  const ordered = [...sets].sort((a, b) => a.block.localeCompare(b.block) || a.set_number - b.set_number)
  const [adding, setAdding] = useState(false)
  // New sets go into the working block if there is one, otherwise the finisher block.
  const addBlock: Block = ordered.some((s) => s.block === 'superset') ? 'superset' : 'finisher'
  const nextNumber = Math.max(0, ...ordered.filter((s) => s.block === addBlock).map((s) => s.set_number)) + 1

  return (
    <div className="card">
      <h3>{exercise.name}</h3>
      {note && <p className="muted small">Note: {note}</p>}
      {ordered.map((s) => (
        <SetEditor key={s.id} set={s} exercise={exercise} onChanged={onChanged} onError={onError} />
      ))}
      {adding ? (
        <NewSet
          workoutId={workoutId}
          exercise={exercise}
          block={addBlock}
          nextNumber={nextNumber}
          onDone={() => { setAdding(false); onChanged() }}
          onError={onError}
        />
      ) : (
        <button className="small" onClick={() => setAdding(true)}>+ Add a set</button>
      )}
    </div>
  )
}

function SetEditor({
  set,
  exercise,
  onChanged,
  onError,
}: {
  set: SetRow
  exercise: Exercise
  onChanged: () => void
  onError: (msg: string | null) => void
}) {
  const [weight, setWeight] = useState(set.weight === null ? '' : fmtNum(set.weight))
  const [reps, setReps] = useState(set.reps === null ? '' : String(set.reps))
  const [marker, setMarker] = useState(set.marker ?? '')

  async function save() {
    const parsed = parseEntry(exercise.kind, weight, reps, marker)
    if ('error' in parsed) return onError(parsed.error)
    const { error } = await supabase
      .from('sets')
      .update({ weight: parsed.entry.weight, reps: parsed.entry.reps, marker: parsed.entry.marker })
      .eq('id', set.id)
    onError(error ? error.message : null)
    if (!error) onChanged()
  }

  async function remove() {
    const { error } = await supabase.from('sets').delete().eq('id', set.id)
    onError(error ? error.message : null)
    if (!error) onChanged()
  }

  const dirty =
    reps !== (set.reps === null ? '' : String(set.reps)) ||
    weight !== (set.weight === null ? '' : fmtNum(set.weight)) ||
    marker !== (set.marker ?? '')

  return (
    <div className="setline">
      <span className="n">{set.block === 'finisher' ? 'F' : ''}{set.set_number}</span>
      {exercise.kind === 'weighted' && (
        <input aria-label="Weight" inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} />
      )}
      {exercise.kind === 'band' && (
        <input aria-label="Marker" value={marker} onChange={(e) => setMarker(e.target.value)} />
      )}
      <input aria-label="Reps" inputMode="numeric" value={reps} onChange={(e) => setReps(e.target.value)} />
      <button className="small primary" disabled={!dirty} onClick={() => void save()}>Save</button>
      <button className="small" onClick={() => void remove()}>✕</button>
    </div>
  )
}

function NewSet({
  workoutId,
  exercise,
  block,
  nextNumber,
  onDone,
  onError,
}: {
  workoutId: string
  exercise: Exercise
  block: Block
  nextNumber: number
  onDone: () => void
  onError: (msg: string | null) => void
}) {
  const [weight, setWeight] = useState('')
  const [reps, setReps] = useState('')
  const [marker, setMarker] = useState('')

  async function add() {
    const parsed = parseEntry(exercise.kind, weight, reps, marker)
    if ('error' in parsed) return onError(parsed.error)
    const { error } = await supabase.from('sets').insert({
      workout_id: workoutId,
      exercise_id: exercise.id,
      block,
      set_number: nextNumber,
      weight: parsed.entry.weight,
      reps: parsed.entry.reps,
      marker: parsed.entry.marker,
    })
    onError(error ? error.message : null)
    if (!error) onDone()
  }

  return (
    <div className="setline">
      <span className="n">{nextNumber}</span>
      {exercise.kind === 'weighted' && (
        <input aria-label="Weight" inputMode="decimal" placeholder="lb" value={weight} onChange={(e) => setWeight(e.target.value)} />
      )}
      {exercise.kind === 'band' && (
        <input aria-label="Marker" placeholder="marker" value={marker} onChange={(e) => setMarker(e.target.value)} />
      )}
      <input aria-label="Reps" inputMode="numeric" placeholder="reps" value={reps} onChange={(e) => setReps(e.target.value)} />
      <button className="small primary" onClick={() => void add()}>Add</button>
      <button className="small" onClick={onDone}>Cancel</button>
    </div>
  )
}
