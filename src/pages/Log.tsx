import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import HistoryStrip from '../components/HistoryStrip'
import { formatDate } from '../lib/dates'
import { parseEntry } from '../lib/entry'
import { fmtNum, formatSet, groupSessions, suggestedWeight, type HistorySet } from '../lib/history'
import { clearPending, enqueue, loadPending, type PendingSet } from '../lib/pending'
import { HISTORY_SELECT, toHistory, toSetRow } from '../lib/queries'
import { REST_HINTS_KEY, restHintText } from '../lib/hints'
import { suggestSwaps } from '../lib/swap'
import { buildSteps, effectiveExerciseId, finisherSlots, findCurrentIndex } from '../lib/steps'
import { useLocalState } from '../lib/storage'
import { supabase } from '../lib/supabase'
import type { Block, Exercise, Routine, RoutineSlot, SetRow, Workout } from '../lib/types'

const ON_CONFLICT = 'workout_id,exercise_id,block,set_number'
const setKey = (exerciseId: string, block: Block, n: number) => `${exerciseId}|${block}|${n}`

export default function Log() {
  const { workoutId } = useParams()
  if (!workoutId) return null
  // Remount per workout so persisted local state (skips, swaps, added rounds) is read fresh.
  return <LogInner key={workoutId} workoutId={workoutId} />
}

function LogInner({ workoutId }: { workoutId: string }) {
  const nav = useNavigate()

  const [workout, setWorkout] = useState<Workout | null>(null)
  const [routine, setRoutine] = useState<Routine | null>(null)
  const [slots, setSlots] = useState<RoutineSlot[]>([])
  const [exercises, setExercises] = useState<Map<string, Exercise>>(new Map())
  const [sets, setSets] = useState<SetRow[]>([])
  const [history, setHistory] = useState<HistorySet[]>([])
  const [notes, setNotes] = useState<Record<string, string>>({})
  // Notes from earlier workouts: exercise id -> workout id -> note.
  const [pastNotes, setPastNotes] = useState<Record<string, Record<string, string>>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pendingCount, setPendingCount] = useState(0)

  const [subs, setSubs] = useLocalState<Record<string, string>>(`wt-subs-${workoutId}`, {})
  const [skipped, setSkipped] = useLocalState<string[]>(`wt-skipped-${workoutId}`, [])
  const [extra, setExtra] = useLocalState<Record<string, number>>(`wt-extra-${workoutId}`, {})
  const [stripCount] = useLocalState<number>('wt-strip-count', 5)
  const [restHints] = useLocalState<boolean>(REST_HINTS_KEY, true)

  const [focusKey, setFocusKey] = useState<string | null>(null)
  const [weight, setWeight] = useState('')
  const [reps, setReps] = useState('')
  const [marker, setMarker] = useState('')
  const [showSwap, setShowSwap] = useState(false)
  const [showFinisher, setShowFinisher] = useState(false)
  const [showFinish, setShowFinish] = useState(false)
  const [sessionNote, setSessionNote] = useState('')

  const weightRef = useRef<HTMLInputElement>(null)
  const repsRef = useRef<HTMLInputElement>(null)
  const loadedHistory = useRef(new Set<string>())
  const flushing = useRef(false)
  const lastStepId = useRef<string | null>(null)
  const touched = useRef(false)

  // ---- loading -----------------------------------------------------------

  const ensureHistory = useCallback(
    async (ids: string[]) => {
      const need = ids.filter((id) => !loadedHistory.current.has(id))
      if (need.length === 0) return
      need.forEach((id) => loadedHistory.current.add(id))
      const results = await Promise.all(
        need.map((id) =>
          supabase
            .from('sets')
            .select(HISTORY_SELECT)
            .eq('exercise_id', id)
            .neq('workout_id', workoutId)
            .order('logged_at', { ascending: false })
            .limit(80),
        ),
      )
      const rows: HistorySet[] = []
      results.forEach((res, i) => {
        if (res.error) loadedHistory.current.delete(need[i])
        else rows.push(...(res.data ?? []).map(toHistory))
      })
      if (rows.length) setHistory((prev) => [...prev, ...rows])
      const nt = await supabase
        .from('workout_exercise_notes')
        .select('workout_id, exercise_id, note')
        .in('exercise_id', need)
        .neq('workout_id', workoutId)
      if (!nt.error && nt.data?.length) {
        setPastNotes((prev) => {
          const next = { ...prev }
          for (const n of nt.data as { workout_id: string; exercise_id: string; note: string }[]) {
            next[n.exercise_id] = { ...next[n.exercise_id], [n.workout_id]: n.note }
          }
          return next
        })
      }
    },
    [workoutId],
  )

  useEffect(() => {
    let cancelled = false
    async function load() {
      const w = await supabase.from('workouts').select('*').eq('id', workoutId).single()
      if (cancelled) return
      if (w.error || !w.data) {
        setError(w.error?.message ?? 'Workout not found')
        setLoading(false)
        return
      }
      const wk = w.data as Workout

      let routineData: Routine | null = null
      let slotData: RoutineSlot[] = []
      if (wk.routine_id) {
        const [r, s] = await Promise.all([
          supabase.from('routines').select('*').eq('id', wk.routine_id).single(),
          supabase.from('routine_slots').select('*').eq('routine_id', wk.routine_id),
        ])
        routineData = (r.data ?? null) as Routine | null
        slotData = (s.data ?? []) as RoutineSlot[]
      }
      const [ex, st, nt] = await Promise.all([
        supabase.from('exercises').select('*'),
        supabase.from('sets').select('*').eq('workout_id', workoutId),
        supabase.from('workout_exercise_notes').select('exercise_id, note').eq('workout_id', workoutId),
      ])
      if (cancelled) return

      const exMap = new Map<string, Exercise>()
      ;((ex.data ?? []) as Exercise[]).forEach((e) => exMap.set(e.id, e))

      const loaded = (st.data ?? []).map(toSetRow)
      const pending = loadPending().filter((p) => p.workout_id === workoutId)
      const merged = [
        ...loaded.filter(
          (s) => !pending.some((p) => p.exercise_id === s.exercise_id && p.block === s.block && p.set_number === s.set_number),
        ),
        ...pending.map<SetRow>((p) => ({
          id: `local-${p.exercise_id}-${p.block}-${p.set_number}`,
          workout_id: p.workout_id,
          exercise_id: p.exercise_id,
          block: p.block,
          set_number: p.set_number,
          weight: p.weight,
          reps: p.reps,
          marker: p.marker,
          note: null,
          logged_at: new Date().toISOString(),
        })),
      ]

      const noteMap: Record<string, string> = {}
      ;((nt.data ?? []) as { exercise_id: string; note: string }[]).forEach((n) => (noteMap[n.exercise_id] = n.note))

      setWorkout(wk)
      setRoutine(routineData)
      setSlots(slotData)
      setExercises(exMap)
      setSets(merged)
      setNotes(noteMap)
      setSessionNote(wk.notes ?? '')
      setPendingCount(loadPending().length)
      setLoading(false)
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [workoutId])

  useEffect(() => {
    if (loading) return
    const ids = new Set<string>([...slots.map((s) => s.exercise_id), ...Object.values(subs)])
    void ensureHistory([...ids])
  }, [loading, slots, subs, ensureHistory])

  // ---- saving ------------------------------------------------------------

  const flushPending = useCallback(async () => {
    if (flushing.current) return
    const items = loadPending()
    if (items.length === 0) return
    flushing.current = true
    try {
      const { error } = await supabase.from('sets').upsert(items, { onConflict: ON_CONFLICT })
      if (!error) clearPending(items)
    } finally {
      flushing.current = false
      setPendingCount(loadPending().length)
    }
  }, [])

  useEffect(() => {
    const onOnline = () => void flushPending()
    window.addEventListener('online', onOnline)
    void flushPending()
    return () => window.removeEventListener('online', onOnline)
  }, [flushPending])

  const persistSet = useCallback(
    async (p: PendingSet) => {
      const matches = (s: SetRow) => s.exercise_id === p.exercise_id && s.block === p.block && s.set_number === p.set_number
      // Show it immediately; sync in the background.
      setSets((prev) => [
        ...prev.filter((s) => !matches(s)),
        {
          id: `local-${p.exercise_id}-${p.block}-${p.set_number}`,
          workout_id: p.workout_id,
          exercise_id: p.exercise_id,
          block: p.block,
          set_number: p.set_number,
          weight: p.weight,
          reps: p.reps,
          marker: p.marker,
          note: null,
          logged_at: new Date().toISOString(),
        },
      ])
      const { data, error } = await supabase.from('sets').upsert(p, { onConflict: ON_CONFLICT }).select().single()
      if (error || !data) {
        enqueue(p)
        setPendingCount(loadPending().length)
        return
      }
      clearPending([p])
      setSets((prev) => prev.map((s) => (matches(s) ? toSetRow(data) : s)))
      setPendingCount(loadPending().length)
      void flushPending()
    },
    [flushPending],
  )

  async function removeSet(row: SetRow) {
    if (!window.confirm('Remove this logged set?')) return
    setSets((prev) => prev.filter((s) => s.id !== row.id))
    if (row.id.startsWith('local-')) {
      clearPending([
        {
          workout_id: row.workout_id,
          exercise_id: row.exercise_id,
          block: row.block,
          set_number: row.set_number,
          weight: row.weight,
          reps: row.reps,
          marker: row.marker,
        },
      ])
      setPendingCount(loadPending().length)
      return
    }
    const { error } = await supabase.from('sets').delete().eq('id', row.id)
    if (error) setError(error.message)
  }

  async function saveNote(exerciseId: string, text: string) {
    const clean = text.trim()
    setNotes((prev) => ({ ...prev, [exerciseId]: clean }))
    const { error } = clean
      ? await supabase
          .from('workout_exercise_notes')
          .upsert({ workout_id: workoutId, exercise_id: exerciseId, note: clean }, { onConflict: 'workout_id,exercise_id' })
      : await supabase.from('workout_exercise_notes').delete().eq('workout_id', workoutId).eq('exercise_id', exerciseId)
    if (error) setError(error.message)
  }

  // ---- derived state -----------------------------------------------------

  const location = workout?.location ?? 'office'
  const steps = useMemo(() => buildSteps(slots, location, extra), [slots, location, extra])
  const finishers = useMemo(() => finisherSlots(slots, location), [slots, location])
  const setsByKey = useMemo(() => new Map(sets.map((s) => [setKey(s.exercise_id, s.block, s.set_number), s])), [sets])

  const isDone = useCallback(
    (step: { slot: RoutineSlot; round: number }) =>
      setsByKey.has(setKey(effectiveExerciseId(step.slot, subs), 'superset', step.round)),
    [setsByKey, subs],
  )

  const skippedSet = useMemo(() => new Set(skipped), [skipped])
  const focusIdx = focusKey ? steps.findIndex((s) => s.key === focusKey) : -1
  const currentIdx = focusIdx >= 0 ? focusIdx : findCurrentIndex(steps, isDone, skippedSet)
  const step = currentIdx >= 0 ? steps[currentIdx] : undefined
  const exId = step ? effectiveExerciseId(step.slot, subs) : ''
  const exercise = step ? exercises.get(exId) : undefined

  const sessions = useMemo(
    () =>
      exId
        ? groupSessions(
            history.filter((h) => h.exercise_id === exId),
            { block: 'superset', excludeWorkoutId: workoutId },
          )
        : [],
    [history, exId, workoutId],
  )
  const exHistoryCount = useMemo(() => history.filter((h) => h.exercise_id === exId).length, [history, exId])

  // Pre-fill inputs when the step changes (and when this exercise's history arrives).
  // A layout effect so the previous step's values never flash on screen.
  useLayoutEffect(() => {
    if (!step) return
    const id = `${step.key}|${exId}`
    const changed = lastStepId.current !== id
    lastStepId.current = id
    if (changed) touched.current = false
    else if (touched.current) return

    const existing = setsByKey.get(setKey(exId, 'superset', step.round))
    if (existing) {
      setWeight(existing.weight === null ? '' : fmtNum(existing.weight))
      setReps(existing.reps === null ? '' : String(existing.reps))
      setMarker(existing.marker ?? '')
    } else {
      const mine = sets
        .filter((s) => s.exercise_id === exId && s.block === 'superset')
        .sort((a, b) => a.set_number - b.set_number)
      const prev = mine.length ? mine[mine.length - 1] : null
      const w = prev?.weight ?? suggestedWeight(sessions, step.round)
      setWeight(w === null || w === undefined ? '' : fmtNum(w))
      setReps('')
      setMarker(prev?.marker ?? sessions[0]?.sets.find((x) => x.marker)?.marker ?? '')
    }
    // Put the cursor where typing is needed: reps when the weight is already filled in.
    const focusSoon = () =>
      window.requestAnimationFrame(() => {
        const weightEmpty = exercise?.kind === 'weighted' && !weightRef.current?.value
        ;(weightEmpty ? weightRef.current : repsRef.current)?.focus()
      })
    if (changed) focusSoon()
    else if (document.activeElement === weightRef.current) focusSoon() // history just arrived and filled the weight
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step?.key, exId, exHistoryCount])

  // ---- actions -----------------------------------------------------------

  function saveStep(e?: FormEvent) {
    e?.preventDefault()
    if (!step || !exercise) return
    const parsed = parseEntry(exercise.kind, weight, reps, marker)
    if ('error' in parsed) {
      setError(parsed.error)
      return
    }
    setError(null)
    void persistSet({
      workout_id: workoutId,
      exercise_id: exId,
      block: 'superset',
      set_number: step.round,
      weight: parsed.entry.weight,
      reps: parsed.entry.reps,
      marker: parsed.entry.marker,
    })
    setSkipped((prev) => prev.filter((k) => k !== step.key))
    setFocusKey(null)
  }

  function skipStep() {
    if (!step) return
    setSkipped((prev) => (prev.includes(step.key) ? prev : [...prev, step.key]))
    setFocusKey(null)
    setError(null)
  }

  function goBack() {
    const target = currentIdx === -1 ? steps.length - 1 : currentIdx - 1
    if (target >= 0) {
      setFocusKey(steps[target].key)
      setError(null)
    }
  }

  function addRound() {
    const group = step ? step.group : steps.length ? steps[steps.length - 1].group : null
    if (group === null) return
    setExtra((prev) => ({ ...prev, [String(group)]: (prev[String(group)] ?? 0) + 1 }))
    setFocusKey(null)
  }

  function swapTo(newId: string) {
    if (!step) return
    setSubs((prev) => {
      const next = { ...prev }
      if (newId === step.slot.exercise_id) delete next[step.slot.id]
      else next[step.slot.id] = newId
      return next
    })
    setShowSwap(false)
  }

  async function finish() {
    setError(null)
    await flushPending()
    if (loadPending().length > 0) {
      setError('Some sets have not synced yet. Check your connection and try again.')
      return
    }
    const { error } = await supabase
      .from('workouts')
      .update({ status: 'completed', completed_at: new Date().toISOString(), notes: sessionNote.trim() || null })
      .eq('id', workoutId)
    if (error) {
      setError(error.message)
      return
    }
    nav('/')
  }

  async function discard() {
    const msg = sets.length
      ? 'Discard this workout and everything logged in it?'
      : 'Discard this empty workout?'
    if (!window.confirm(msg)) return
    const { error } = await supabase.from('workouts').delete().eq('id', workoutId)
    if (error) {
      setError(error.message)
      return
    }
    clearPending(loadPending().filter((p) => p.workout_id === workoutId))
    nav('/')
  }

  // ---- render ------------------------------------------------------------

  if (loading) return <p className="muted">Loading…</p>
  if (!workout) {
    return (
      <div>
        <p className="error">{error ?? 'Workout not found.'}</p>
        <Link to="/">Back</Link>
      </div>
    )
  }

  const exerciseOptions = [...exercises.values()].filter((e) => !e.archived).sort((a, b) => a.name.localeCompare(b.name))
  const suggested = suggestSwaps(exercise, exerciseOptions, location)
  const groupSteps = step ? steps.filter((s) => s.group === step.group) : []
  const groupMembers = step ? [...new Set(groupSteps.map((s) => s.slot.id))].length : 0
  const loggedSteps = steps.filter(isDone).length
  const supersetsDone = !step
  const showFinishers = (supersetsDone || showFinisher) && finishers.length > 0

  return (
    <div>
      <div className="row between">
        <div>
          <h1>{routine?.name ?? 'Workout'}</h1>
          <p className="muted small">
            {formatDate(workout.performed_on)} ·{' '}
            <span className={`badge ${workout.location}`}>{workout.location === 'office' ? 'Office' : 'Home'}</span>
          </p>
        </div>
        <Link to="/"><button className="small">Exit</button></Link>
      </div>

      {pendingCount > 0 && (
        <div className="banner">{pendingCount} set{pendingCount === 1 ? '' : 's'} waiting to sync. They are saved on this phone and will upload when you are back online.</div>
      )}
      {error && <p className="error">{error}</p>}

      {step && exercise && (
        <div className="card">
          <p className="progress">
            Superset {step.group} · Round {step.round} of {step.rounds}
            {groupMembers > 1 ? ` · exercise ${groupSteps.filter((s) => s.round === step.round).findIndex((s) => s.key === step.key) + 1} of ${groupMembers}` : ''}
          </p>
          {restHints && <p className="resthint">{restHintText(groupMembers > 1)}</p>}
          <div className="dots" aria-hidden="true">
            {steps.map((s) => (
              <span key={s.key} className={`${isDone(s) ? 'done' : ''} ${s.key === step.key ? 'now' : ''}`} />
            ))}
          </div>

          <div className="exercise-name">{exercise.name}</div>
          <p className="target">
            {step.slot.rep_min !== null && step.slot.rep_max !== null
              ? step.slot.rep_min === step.slot.rep_max
                ? `Target ${step.slot.rep_min} reps`
                : `Target ${step.slot.rep_min}-${step.slot.rep_max} reps`
              : 'No rep target'}
            {step.slot.note ? ` · ${step.slot.note}` : ''}
            {focusKey ? ' · editing' : ''}
          </p>

          <form onSubmit={saveStep}>
            <div className={`inputs${exercise.kind === 'reps_only' ? ' single' : ''}`}>
              {exercise.kind === 'weighted' && (
                <label>
                  Weight (lb){exercise.load_note ? ` · ${exercise.load_note}` : ''}
                  <input
                    ref={weightRef}
                    inputMode="decimal"
                    value={weight}
                    onChange={(e) => { touched.current = true; setWeight(e.target.value) }}
                  />
                </label>
              )}
              {exercise.kind === 'band' && (
                <label>
                  Band / marker
                  <input
                    value={marker}
                    onChange={(e) => { touched.current = true; setMarker(e.target.value) }}
                    placeholder="x, 0, yes, color…"
                  />
                </label>
              )}
              <label>
                Reps{exercise.reps_note ? ` · ${exercise.reps_note}` : ''}
                <input
                  ref={repsRef}
                  inputMode="numeric"
                  enterKeyHint="next"
                  value={reps}
                  onChange={(e) => { touched.current = true; setReps(e.target.value) }}
                />
              </label>
            </div>
            <button className="primary big" type="submit">Next</button>
          </form>

          <div className="row wrap" style={{ marginTop: 8 }}>
            <button className="small" onClick={goBack} disabled={currentIdx === 0}>Back</button>
            <button className="small" onClick={skipStep}>Skip</button>
            <button className="small" onClick={() => setShowSwap((v) => !v)}>Swap exercise</button>
            <button className="small" onClick={addRound}>+ Round</button>
          </div>

          {showSwap && (
            <label style={{ marginTop: 8 }}>
              Do this instead (this workout only)
              <select value={exId} onChange={(e) => swapTo(e.target.value)}>
                <option value={exId}>{exercise.name} (current)</option>
                {suggested.length > 0 && (
                  <optgroup label="Suggested">
                    {suggested.map((o) => (
                      <option key={o.id} value={o.id}>{o.name}</option>
                    ))}
                  </optgroup>
                )}
                <optgroup label={suggested.length > 0 ? 'All exercises' : 'Exercises'}>
                  {exerciseOptions.filter((o) => o.id !== exId).map((o) => (
                    <option key={o.id} value={o.id}>{o.name}</option>
                  ))}
                </optgroup>
              </select>
            </label>
          )}

          <h4 style={{ marginTop: 14 }}>Previous sessions</h4>
          <HistoryStrip
            sessions={sessions.slice(0, stripCount)}
            kind={exercise.kind}
            highlightSet={step.round}
            notes={pastNotes[exId]}
          />

          <details key={exId}>
            <summary>Note{notes[exId] ? ' ✓' : ''}</summary>
            <textarea
              defaultValue={notes[exId] ?? ''}
              placeholder="Form cue, how it felt, why the weight changed…"
              onBlur={(e) => {
                if (e.target.value.trim() !== (notes[exId] ?? '')) void saveNote(exId, e.target.value)
              }}
            />
          </details>
        </div>
      )}

      {supersetsDone && steps.length > 0 && (
        <div className="card">
          <h3>Supersets done</h3>
          <p className="muted small">{loggedSteps} of {steps.length} sets logged.</p>
          <div className="row wrap">
            <button className="small" onClick={goBack}>Back</button>
            <button className="small" onClick={addRound}>+ Round</button>
          </div>
        </div>
      )}

      {steps.length === 0 && finishers.length === 0 && (
        <div className="card">
          <p>This routine has no exercises for {workout.location}. Add some under Plan.</p>
        </div>
      )}

      {!supersetsDone && finishers.length > 0 && !showFinisher && (
        <button className="link" onClick={() => setShowFinisher(true)}>Go to finisher →</button>
      )}

      {showFinishers && (
        <>
          <h2>Finisher</h2>
          {finishers.map((slot) => {
            const id = effectiveExerciseId(slot, subs)
            const ex = exercises.get(id)
            if (!ex) return null
            return (
              <FinisherCard
                key={slot.id}
                slot={slot}
                exercise={ex}
                sets={sets.filter((s) => s.exercise_id === id && s.block === 'finisher')}
                history={history.filter((h) => h.exercise_id === id)}
                workoutId={workoutId}
                note={notes[id] ?? ''}
                pastNotes={pastNotes[id]}
                onSave={(p) => void persistSet(p)}
                onDelete={(row) => void removeSet(row)}
                onNote={(text) => void saveNote(id, text)}
                onNeedHistory={() => void ensureHistory([id])}
                stripCount={stripCount}
              />
            )
          })}
        </>
      )}

      {steps.length > 0 && (
        <details className="card">
          <summary>All sets in this workout ({loggedSteps}/{steps.length})</summary>
          <ul className="steplist">
            {steps.map((s) => {
              const id = effectiveExerciseId(s.slot, subs)
              const ex = exercises.get(id)
              const row = setsByKey.get(setKey(id, 'superset', s.round))
              const isSkipped = !row && skippedSet.has(s.key)
              return (
                <li key={s.key} className={isSkipped ? 'skipped' : ''} onClick={() => setFocusKey(s.key)}>
                  <span>S{s.group}·R{s.round} {ex?.name ?? 'Exercise'}</span>
                  <span>
                    {row
                      ? formatSet({ setNumber: row.set_number, weight: row.weight, reps: row.reps, marker: row.marker }, ex?.kind ?? 'weighted')
                      : isSkipped
                        ? 'skipped'
                        : '—'}
                  </span>
                </li>
              )
            })}
          </ul>
        </details>
      )}

      <div className="card">
        {!showFinish ? (
          <div className="row">
            <button className="primary big" onClick={() => setShowFinish(true)}>Finish workout</button>
          </div>
        ) : (
          <div className="stack">
            <label>
              Workout notes (optional)
              <textarea value={sessionNote} onChange={(e) => setSessionNote(e.target.value)} />
            </label>
            <div className="row">
              <button className="primary grow" onClick={() => void finish()}>Save &amp; finish</button>
              <button onClick={() => setShowFinish(false)}>Cancel</button>
            </div>
          </div>
        )}
        <div className="row" style={{ marginTop: 10 }}>
          <button className="link danger" onClick={() => void discard()}>Discard workout</button>
        </div>
      </div>
    </div>
  )
}

function FinisherCard({
  slot,
  exercise,
  sets,
  history,
  workoutId,
  note,
  pastNotes,
  onSave,
  onDelete,
  onNote,
  onNeedHistory,
  stripCount,
}: {
  slot: RoutineSlot
  exercise: Exercise
  sets: SetRow[]
  history: HistorySet[]
  workoutId: string
  note: string
  pastNotes?: Record<string, string>
  onSave: (p: PendingSet) => void
  onDelete: (row: SetRow) => void
  onNote: (text: string) => void
  onNeedHistory: () => void
  stripCount: number
}) {
  const sorted = useMemo(() => [...sets].sort((a, b) => a.set_number - b.set_number), [sets])
  const past = useMemo(() => groupSessions(history, { block: 'finisher', excludeWorkoutId: workoutId }), [history, workoutId])
  const [weight, setWeight] = useState('')
  const [reps, setReps] = useState('')
  const [marker, setMarker] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(onNeedHistory, [exercise.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (weight !== '') return
    const last = sorted.length ? sorted[sorted.length - 1].weight : suggestedWeight(past, 1)
    if (last !== null && last !== undefined) setWeight(fmtNum(last))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [past.length])

  function add(e: FormEvent) {
    e.preventDefault()
    const parsed = parseEntry(exercise.kind, weight, reps, marker)
    if ('error' in parsed) {
      setError(parsed.error)
      return
    }
    setError(null)
    onSave({
      workout_id: workoutId,
      exercise_id: exercise.id,
      block: 'finisher',
      set_number: (sorted.length ? sorted[sorted.length - 1].set_number : 0) + 1,
      weight: parsed.entry.weight,
      reps: parsed.entry.reps,
      marker: parsed.entry.marker,
    })
    setReps('')
  }

  return (
    <div className="card">
      <div className="exercise-name">{exercise.name}</div>
      {slot.note && <p className="target">{slot.note}</p>}

      {sorted.map((s) => (
        <div key={s.id} className="setline">
          <span className="n">{s.set_number}</span>
          <span className="grow">
            {formatSet({ setNumber: s.set_number, weight: s.weight, reps: s.reps, marker: s.marker }, exercise.kind)}
          </span>
          <button className="small" onClick={() => onDelete(s)}>Remove</button>
        </div>
      ))}

      <form onSubmit={add}>
        <div className={`inputs${exercise.kind === 'reps_only' ? ' single' : ''}`}>
          {exercise.kind === 'weighted' && (
            <label>
              Weight (lb){exercise.load_note ? ` · ${exercise.load_note}` : ''}
              <input inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} />
            </label>
          )}
          {exercise.kind === 'band' && (
            <label>
              Band / marker
              <input value={marker} onChange={(e) => setMarker(e.target.value)} />
            </label>
          )}
          <label>
            Reps{exercise.reps_note ? ` · ${exercise.reps_note}` : ''}
            <input inputMode="numeric" value={reps} onChange={(e) => setReps(e.target.value)} />
          </label>
        </div>
        {error && <p className="error">{error}</p>}
        <button className="primary big" type="submit">Add set</button>
      </form>

      <h4 style={{ marginTop: 14 }}>Previous finishers</h4>
      <HistoryStrip sessions={past.slice(0, stripCount)} kind={exercise.kind} notes={pastNotes} />

      <details>
        <summary>Note{note ? ' ✓' : ''}</summary>
        <textarea
          defaultValue={note}
          onBlur={(e) => {
            if (e.target.value.trim() !== note) onNote(e.target.value)
          }}
        />
      </details>
    </div>
  )
}
