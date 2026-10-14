import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import HistoryStrip from '../components/HistoryStrip'
import SwapFields from '../components/SwapFields'
import LineChart from '../components/LineChart'
import { formatDate, formatShortDate } from '../lib/dates'
import { formatSet, groupSessions, sessionTopWeight, sessionTotalReps } from '../lib/history'
import { HISTORY_SELECT, toHistory } from '../lib/queries'
import { swapGroups } from '../lib/swap'
import { fetchAll, supabase } from '../lib/supabase'
import type { Block, Exercise, ExerciseKind, Location } from '../lib/types'
import { KIND_LABEL } from './Exercises'
import type { HistorySet } from '../lib/history'

export default function ExerciseDetail() {
  const { exerciseId } = useParams()
  const [exercise, setExercise] = useState<Exercise | null>(null)
  const [rows, setRows] = useState<HistorySet[]>([])
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [block, setBlock] = useState<Block>('superset')
  const [filter, setFilter] = useState<'all' | Location>('all')
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState('')
  const [kind, setKind] = useState<ExerciseKind>('weighted')
  const [loadNote, setLoadNote] = useState('')
  const [repsNote, setRepsNote] = useState('')
  const [swapGroup, setSwapGroup] = useState('')
  const [onlyAt, setOnlyAt] = useState<'' | Location>('')
  const [knownGroups, setKnownGroups] = useState<string[]>([])

  const load = useCallback(async () => {
    try {
      const ex = await supabase.from('exercises').select('*').eq('id', exerciseId).single()
      if (ex.error || !ex.data) throw new Error(ex.error?.message ?? 'Exercise not found')
      const e = ex.data as Exercise
      setExercise(e)
      setName(e.name)
      setKind(e.kind)
      setLoadNote(e.load_note ?? '')
      setRepsNote(e.reps_note ?? '')
      setSwapGroup(e.swap_group ?? '')
      setOnlyAt(e.only_at ?? '')
      const g = await supabase.from('exercises').select('swap_group')
      setKnownGroups(swapGroups(((g.data ?? []) as { swap_group: string | null }[]).map((r) => ({ swap_group: r.swap_group }) as Exercise)))

      const data = await fetchAll<unknown>((from, to) =>
        supabase
          .from('sets')
          .select(HISTORY_SELECT)
          .eq('exercise_id', exerciseId)
          .order('logged_at', { ascending: false })
          .range(from, to),
      )
      setRows(data.map(toHistory))

      const n = await supabase.from('workout_exercise_notes').select('workout_id, note').eq('exercise_id', exerciseId)
      const map: Record<string, string> = {}
      ;((n.data ?? []) as { workout_id: string; note: string }[]).forEach((x) => (map[x.workout_id] = x.note))
      setNotes(map)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load exercise')
    }
    setLoading(false)
  }, [exerciseId])

  useEffect(() => {
    void load()
  }, [load])

  const sessions = useMemo(
    () => groupSessions(rows, { block, location: filter === 'all' ? undefined : filter }),
    [rows, block, filter],
  )
  const hasFinisher = useMemo(() => rows.some((r) => r.block === 'finisher'), [rows])

  async function save() {
    if (!exercise) return
    const patch: Partial<Exercise> = {
      name: name.trim(),
      load_note: loadNote.trim() || null,
      reps_note: repsNote.trim() || null,
      swap_group: swapGroup.trim() || null,
      only_at: onlyAt || null,
    }
    if (rows.length === 0) patch.kind = kind
    const { error } = await supabase.from('exercises').update(patch).eq('id', exercise.id)
    if (error) {
      setError(/duplicate|unique/i.test(error.message) ? 'You already have an exercise with that name.' : error.message)
      return
    }
    setError(null)
    setEditing(false)
    void load()
  }

  async function toggleArchive() {
    if (!exercise) return
    if (
      !exercise.archived &&
      !window.confirm(`Archive ${exercise.name}? It will be hidden from pickers. Your history is kept and you can unarchive it later.`)
    ) {
      return
    }
    const { error } = await supabase.from('exercises').update({ archived: !exercise.archived }).eq('id', exercise.id)
    if (error) setError(error.message)
    else void load()
  }

  if (loading) return <p className="muted">Loading…</p>
  if (!exercise) return <div><p className="error">{error}</p><Link to="/exercises">Back</Link></div>

  const chronological = [...sessions].reverse().slice(-30)
  const topPoints = chronological
    .map((s) => ({ label: formatShortDate(s.date), value: sessionTopWeight(s) }))
    .filter((p): p is { label: string; value: number } => p.value !== null)
  const repPoints = chronological.map((s) => ({ label: formatShortDate(s.date), value: sessionTotalReps(s) }))

  return (
    <div>
      <p><Link to="/exercises">← Exercises</Link></p>
      <div className="row between">
        <h1>{exercise.name}</h1>
        <button className="small" onClick={() => setEditing((v) => !v)}>{editing ? 'Close' : 'Edit'}</button>
      </div>
      <p className="muted small">
        {KIND_LABEL[exercise.kind]}
        {exercise.load_note ? ` · weight: ${exercise.load_note}` : ''}
        {exercise.reps_note ? ` · reps: ${exercise.reps_note}` : ''}
        {exercise.archived ? ' · archived' : ''}
      </p>
      {error && <p className="error">{error}</p>}

      {editing && (
        <div className="card stack">
          <label>
            Name
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label>
            Type {rows.length > 0 && <span className="small">(locked once sets are logged)</span>}
            <select value={kind} disabled={rows.length > 0} onChange={(e) => setKind(e.target.value as ExerciseKind)}>
              {Object.entries(KIND_LABEL).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </label>
          <label>
            Weight note
            <input value={loadNote} onChange={(e) => setLoadNote(e.target.value)} />
          </label>
          <label>
            Reps note
            <input value={repsNote} onChange={(e) => setRepsNote(e.target.value)} />
          </label>
          <SwapFields group={swapGroup} onGroup={setSwapGroup} onlyAt={onlyAt} onOnlyAt={setOnlyAt} knownGroups={knownGroups} />
          <div className="row">
            <button className="primary grow" disabled={!name.trim()} onClick={() => void save()}>Save</button>
            <button onClick={() => void toggleArchive()}>{exercise.archived ? 'Unarchive' : 'Archive'}</button>
          </div>
        </div>
      )}

      <div className="row wrap between" style={{ margin: '12px 0' }}>
        <div className="seg" role="group" aria-label="Location filter">
          <button className={filter === 'all' ? 'on' : ''} onClick={() => setFilter('all')}>All</button>
          <button className={filter === 'office' ? 'on' : ''} onClick={() => setFilter('office')}>Office</button>
          <button className={filter === 'home' ? 'on' : ''} onClick={() => setFilter('home')}>Home</button>
        </div>
        {hasFinisher && (
          <div className="seg" role="group" aria-label="Set type">
            <button className={block === 'superset' ? 'on' : ''} onClick={() => setBlock('superset')}>Working</button>
            <button className={block === 'finisher' ? 'on' : ''} onClick={() => setBlock('finisher')}>Finisher</button>
          </div>
        )}
      </div>

      {sessions.length === 0 ? (
        <p className="muted">Nothing logged yet.</p>
      ) : (
        <>
          <div className="card">
            {exercise.kind === 'weighted' && <LineChart title="Top weight per session" unit="lb" points={topPoints} />}
            <LineChart title="Total reps per session" points={repPoints} />
          </div>

          <h2>Sessions ({sessions.length})</h2>
          <div className="card">
            <ul className="sessionlist">
              {sessions.map((s) => (
                <li key={s.workoutId}>
                  <div className="row between">
                    <Link to={`/workout/${s.workoutId}`}><strong>{formatDate(s.date)}</strong></Link>
                    <span className={`badge ${s.location}`}>{s.location === 'office' ? 'Office' : 'Home'}</span>
                  </div>
                  <div className="strip-sets">
                    {s.sets.map((x) => (
                      <span key={x.setNumber}>{formatSet(x, exercise.kind)}</span>
                    ))}
                  </div>
                  {notes[s.workoutId] && <p className="muted small">Note: {notes[s.workoutId]}</p>}
                </li>
              ))}
            </ul>
          </div>
          <details>
            <summary className="muted small">Latest 5 at a glance</summary>
            <HistoryStrip sessions={sessions.slice(0, 5)} kind={exercise.kind} />
          </details>
        </>
      )}
    </div>
  )
}
