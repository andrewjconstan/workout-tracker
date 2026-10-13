import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { DAY_NAMES } from '../lib/dates'
import { supabase } from '../lib/supabase'
import type { Block, Exercise, Routine, RoutineSlot } from '../lib/types'

type SlotLocation = RoutineSlot['location']

const overlaps = (a: RoutineSlot, b: RoutineSlot) =>
  a.location === 'both' || b.location === 'both' || a.location === b.location

const byOrder = (a: RoutineSlot, b: RoutineSlot) =>
  (a.block === b.block ? 0 : a.block === 'superset' ? -1 : 1) ||
  a.superset_group - b.superset_group ||
  a.position - b.position ||
  a.id.localeCompare(b.id)

export default function Plan() {
  const [routines, setRoutines] = useState<Routine[]>([])
  const [slots, setSlots] = useState<RoutineSlot[]>([])
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [showArchived, setShowArchived] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [newRoutine, setNewRoutine] = useState(false)

  const load = useCallback(async () => {
    const [r, s, e] = await Promise.all([
      supabase.from('routines').select('*').order('sort_order').order('created_at'),
      supabase.from('routine_slots').select('*'),
      supabase.from('exercises').select('*').order('name'),
    ])
    const firstError = r.error ?? s.error ?? e.error
    if (firstError) setError(firstError.message)
    setRoutines((r.data ?? []) as Routine[])
    setSlots((s.data ?? []) as RoutineSlot[])
    setExercises((e.data ?? []) as Exercise[])
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  if (loading) return <p className="muted">Loading…</p>

  const shown = routines.filter((r) => showArchived || !r.archived)

  return (
    <div>
      <div className="row between">
        <h1>Plan</h1>
        <button onClick={() => setNewRoutine((v) => !v)}>{newRoutine ? 'Cancel' : '+ Routine'}</button>
      </div>
      <p className="muted small">
        Changes here apply to future workouts. Past workouts and their history are never altered.
      </p>
      {error && <p className="error">{error}</p>}

      {newRoutine && (
        <RoutineForm
          nextSort={Math.max(0, ...routines.map((r) => r.sort_order)) + 1}
          onDone={() => { setNewRoutine(false); void load() }}
          onError={setError}
        />
      )}

      {shown.map((r) => (
        <RoutineCard
          key={r.id}
          routine={r}
          slots={slots.filter((s) => s.routine_id === r.id).sort(byOrder)}
          exercises={exercises}
          onChanged={() => void load()}
          onError={setError}
        />
      ))}

      <label style={{ marginTop: 12 }}>
        <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
        Show archived routines
      </label>
    </div>
  )
}

function RoutineForm({
  routine,
  nextSort,
  onDone,
  onError,
}: {
  routine?: Routine
  nextSort?: number
  onDone: () => void
  onError: (m: string | null) => void
}) {
  const [name, setName] = useState(routine?.name ?? '')
  const [day, setDay] = useState<string>(routine?.day_of_week ? String(routine.day_of_week) : '')
  const [notes, setNotes] = useState(routine?.notes ?? '')

  async function submit(e: FormEvent) {
    e.preventDefault()
    const payload = { name: name.trim(), day_of_week: day ? Number(day) : null, notes: notes.trim() || null }
    const { error } = routine
      ? await supabase.from('routines').update(payload).eq('id', routine.id)
      : await supabase.from('routines').insert({ ...payload, sort_order: nextSort ?? 0 })
    onError(error ? error.message : null)
    if (!error) onDone()
  }

  return (
    <form className="card stack" onSubmit={submit}>
      <label>
        Name
        <input value={name} onChange={(e) => setName(e.target.value)} required />
      </label>
      <label>
        Day
        <select value={day} onChange={(e) => setDay(e.target.value)}>
          <option value="">Any day</option>
          {DAY_NAMES.slice(1).map((d, i) => (
            <option key={d} value={i + 1}>{d}</option>
          ))}
        </select>
      </label>
      <label>
        Notes (e.g. warm-up)
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
      </label>
      <button className="primary" disabled={!name.trim()}>{routine ? 'Save routine' : 'Create routine'}</button>
    </form>
  )
}

function RoutineCard({
  routine,
  slots,
  exercises,
  onChanged,
  onError,
}: {
  routine: Routine
  slots: RoutineSlot[]
  exercises: Exercise[]
  onChanged: () => void
  onError: (m: string | null) => void
}) {
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editSlot, setEditSlot] = useState<string | 'new' | null>(null)
  const exName = (id: string) => exercises.find((e) => e.id === id)?.name ?? 'Exercise'

  async function toggleArchive() {
    if (
      !routine.archived &&
      !window.confirm(`Archive "${routine.name}"? It will disappear from Today. Your history is kept and you can restore it from Plan → Show archived routines.`)
    ) {
      return
    }
    const { error } = await supabase.from('routines').update({ archived: !routine.archived }).eq('id', routine.id)
    onError(error ? error.message : null)
    if (!error) onChanged()
  }

  async function removeSlot(s: RoutineSlot) {
    if (!window.confirm(`Remove ${exName(s.exercise_id)} from this routine? Logged history is kept.`)) return
    const { error } = await supabase.from('routine_slots').delete().eq('id', s.id)
    onError(error ? error.message : null)
    if (!error) onChanged()
  }

  async function move(s: RoutineSlot, dir: -1 | 1) {
    const group = slots.filter((x) => x.block === s.block && x.superset_group === s.superset_group)
    const i = group.findIndex((x) => x.id === s.id)
    let j = i + dir
    while (j >= 0 && j < group.length && !overlaps(s, group[j])) j += dir
    if (j < 0 || j >= group.length) return
    const reordered = [...group]
    ;[reordered[i], reordered[j]] = [reordered[j], reordered[i]]
    const updates = reordered
      .map((x, idx) => ({ id: x.id, position: idx + 1, was: x.position }))
      .filter((u) => u.position !== u.was)
    const results = await Promise.all(
      updates.map((u) => supabase.from('routine_slots').update({ position: u.position }).eq('id', u.id)),
    )
    const failed = results.find((r) => r.error)
    onError(failed?.error ? failed.error.message : null)
    onChanged()
  }

  const names = [...new Set(slots.map((x) => exName(x.exercise_id)))]
  const summary = names.length ? `${names.length} exercises` : 'no exercises yet'

  // Group slots for display.
  const sections: { title: string; items: RoutineSlot[] }[] = []
  for (const s of slots) {
    const title = s.block === 'finisher' ? 'Finisher' : `Superset ${s.superset_group}`
    const last = sections[sections.length - 1]
    if (last && last.title === title) last.items.push(s)
    else sections.push({ title, items: [s] })
  }

  return (
    <div className="card">
      <button
        className="link"
        style={{ display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center', textAlign: 'left' }}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span>
          <strong>{routine.name}{routine.archived ? ' (archived)' : ''}</strong>
          <br />
          <span className="muted small">
            {routine.day_of_week ? DAY_NAMES[routine.day_of_week] : 'Any day'} · {summary}
          </span>
        </span>
        <span aria-hidden="true">{open ? '▾' : '▸'}</span>
      </button>

      {open && (
        <div className="row" style={{ marginTop: 8 }}>
          <button className="small" onClick={() => setEditing((v) => !v)}>{editing ? 'Close' : 'Edit'}</button>
          <button className="small" onClick={() => void toggleArchive()}>{routine.archived ? 'Unarchive' : 'Archive'}</button>
        </div>
      )}
      {open && routine.notes && <p className="muted small">{routine.notes}</p>}

      {open && editing && (
        <RoutineForm routine={routine} onDone={() => { setEditing(false); onChanged() }} onError={onError} />
      )}

      {open && sections.map((sec) => (
        <div key={sec.title}>
          <h4 style={{ marginTop: 12 }}>{sec.title}</h4>
          {sec.items.map((s, idx) => (
            <div key={s.id}>
              <div className="slotrow">
                <div className="slotname">
                  <span className="n">{idx + 1}</span>
                  <span className="grow">
                    {exName(s.exercise_id)}
                    {s.location !== 'both' && <> <span className={`badge ${s.location}`}>{s.location}</span></>}
                    <span className="muted small">
                      {' '}
                      · {s.target_sets ? `${s.target_sets} × ` : 'free-form '}
                      {s.rep_min !== null && s.rep_max !== null
                        ? s.rep_min === s.rep_max ? s.rep_min : `${s.rep_min}-${s.rep_max}`
                        : ''}
                      {s.note ? ` · ${s.note}` : ''}
                    </span>
                  </span>
                </div>
                <div className="slotactions">
                  <button className="small" aria-label="Move up" onClick={() => void move(s, -1)}>↑</button>
                  <button className="small" aria-label="Move down" onClick={() => void move(s, 1)}>↓</button>
                  <button className="small" onClick={() => setEditSlot(editSlot === s.id ? null : s.id)}>Edit</button>
                  <button className="small" aria-label="Remove" onClick={() => void removeSlot(s)}>✕</button>
                </div>
              </div>
              {editSlot === s.id && (
                <SlotForm
                  routineId={routine.id}
                  slot={s}
                  slots={slots}
                  exercises={exercises}
                  onDone={() => { setEditSlot(null); onChanged() }}
                  onError={onError}
                />
              )}
            </div>
          ))}
        </div>
      ))}

      {open && <div style={{ marginTop: 12 }}>
        {editSlot === 'new' ? (
          <SlotForm
            routineId={routine.id}
            slots={slots}
            exercises={exercises}
            onDone={() => { setEditSlot(null); onChanged() }}
            onError={onError}
          />
        ) : (
          <button className="small" onClick={() => setEditSlot('new')}>+ Add exercise</button>
        )}
      </div>}
    </div>
  )
}

function SlotForm({
  routineId,
  slot,
  slots,
  exercises,
  onDone,
  onError,
}: {
  routineId: string
  slot?: RoutineSlot
  slots: RoutineSlot[]
  exercises: Exercise[]
  onDone: () => void
  onError: (m: string | null) => void
}) {
  const lastSuperset = Math.max(1, ...slots.filter((s) => s.block === 'superset').map((s) => s.superset_group))
  const [exerciseId, setExerciseId] = useState(slot?.exercise_id ?? '')
  const [block, setBlock] = useState<Block>(slot?.block ?? 'superset')
  const [group, setGroup] = useState(String(slot?.superset_group ?? lastSuperset))
  const [location, setLocation] = useState<SlotLocation>(slot?.location ?? 'both')
  const [targetSets, setTargetSets] = useState(slot ? (slot.target_sets === null ? '' : String(slot.target_sets)) : '3')
  const [repMin, setRepMin] = useState(slot?.rep_min != null ? String(slot.rep_min) : '')
  const [repMax, setRepMax] = useState(slot?.rep_max != null ? String(slot.rep_max) : '')
  const [note, setNote] = useState(slot?.note ?? '')

  const options = exercises.filter((e) => !e.archived || e.id === slot?.exercise_id)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!exerciseId) return onError('Pick an exercise.')
    const g = Number(group)
    if (!Number.isInteger(g) || g < 1) return onError('Group must be a whole number, 1 or higher.')
    const num = (v: string) => (v.trim() === '' ? null : Number(v))
    const sets = num(targetSets)
    const min = num(repMin)
    const max = num(repMax)
    if ([sets, min, max].some((n) => n !== null && (!Number.isInteger(n) || n < 0))) {
      return onError('Sets and reps must be whole numbers.')
    }
    if (min !== null && max !== null && min > max) return onError('Rep minimum cannot exceed the maximum.')

    const siblings = slots.filter((s) => s.block === block && s.superset_group === g && s.id !== slot?.id)
    const position =
      slot && slot.block === block && slot.superset_group === g
        ? slot.position
        : Math.max(0, ...siblings.map((s) => s.position)) + 1

    const payload = {
      routine_id: routineId,
      exercise_id: exerciseId,
      block,
      superset_group: g,
      position,
      location,
      target_sets: block === 'finisher' ? sets : sets ?? 3,
      rep_min: min,
      rep_max: max,
      note: note.trim() || null,
    }
    const { error } = slot
      ? await supabase.from('routine_slots').update(payload).eq('id', slot.id)
      : await supabase.from('routine_slots').insert(payload)
    onError(error ? error.message : null)
    if (!error) onDone()
  }

  return (
    <form className="card stack" onSubmit={submit}>
      <label>
        Exercise
        <select value={exerciseId} onChange={(e) => setExerciseId(e.target.value)}>
          <option value="">Choose…</option>
          {options.map((o) => (
            <option key={o.id} value={o.id}>{o.name}</option>
          ))}
        </select>
      </label>
      <div className="row">
        <label className="grow">
          Block
          <select value={block} onChange={(e) => setBlock(e.target.value as Block)}>
            <option value="superset">Superset</option>
            <option value="finisher">Finisher</option>
          </select>
        </label>
        <label className="grow">
          Group #
          <input inputMode="numeric" value={group} onChange={(e) => setGroup(e.target.value)} />
        </label>
      </div>
      <label>
        Where
        <select value={location} onChange={(e) => setLocation(e.target.value as SlotLocation)}>
          <option value="both">Office and home</option>
          <option value="office">Office only</option>
          <option value="home">Home only</option>
        </select>
      </label>
      <div className="row">
        <label className="grow">
          Sets {block === 'finisher' && <span className="small">(blank = free-form)</span>}
          <input inputMode="numeric" value={targetSets} onChange={(e) => setTargetSets(e.target.value)} />
        </label>
        <label className="grow">
          Reps min
          <input inputMode="numeric" value={repMin} onChange={(e) => setRepMin(e.target.value)} />
        </label>
        <label className="grow">
          Reps max
          <input inputMode="numeric" value={repMax} onChange={(e) => setRepMax(e.target.value)} />
        </label>
      </div>
      <label>
        Note
        <input value={note} onChange={(e) => setNote(e.target.value)} />
      </label>
      <div className="row">
        <button className="primary grow">{slot ? 'Save' : 'Add to routine'}</button>
        <button type="button" onClick={onDone}>Cancel</button>
      </div>
    </form>
  )
}
