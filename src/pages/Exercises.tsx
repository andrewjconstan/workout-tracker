import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import SwapFields from '../components/SwapFields'
import { swapGroups } from '../lib/swap'
import { supabase } from '../lib/supabase'
import type { Exercise, ExerciseKind, Location } from '../lib/types'

export const KIND_LABEL: Record<ExerciseKind, string> = {
  weighted: 'Weight × reps',
  reps_only: 'Reps only',
  band: 'Band / marker × reps',
}

export default function Exercises() {
  const [list, setList] = useState<Exercise[]>([])
  const [showArchived, setShowArchived] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [kind, setKind] = useState<ExerciseKind>('weighted')
  const [loadNote, setLoadNote] = useState('')
  const [repsNote, setRepsNote] = useState('')
  const [swapGroup, setSwapGroup] = useState('')
  const [onlyAt, setOnlyAt] = useState<'' | Location>('')

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('exercises').select('*').order('name')
    if (error) setError(error.message)
    setList((data ?? []) as Exercise[])
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function add(e: FormEvent) {
    e.preventDefault()
    const { error } = await supabase.from('exercises').insert({
      name: name.trim(),
      kind,
      load_note: loadNote.trim() || null,
      reps_note: repsNote.trim() || null,
      swap_group: swapGroup.trim() || null,
      only_at: onlyAt || null,
    })
    if (error) {
      setError(/duplicate|unique/i.test(error.message) ? 'You already have an exercise with that name.' : error.message)
      return
    }
    setError(null)
    setName('')
    setLoadNote('')
    setRepsNote('')
    setSwapGroup('')
    setOnlyAt('')
    setAdding(false)
    void load()
  }

  if (loading) return <p className="muted">Loading…</p>
  const shown = list.filter((x) => showArchived || !x.archived)

  return (
    <div>
      <div className="row between">
        <h1>Exercises</h1>
        <button onClick={() => setAdding((v) => !v)}>{adding ? 'Cancel' : '+ New'}</button>
      </div>
      {error && <p className="error">{error}</p>}

      {adding && (
        <form className="card stack" onSubmit={add}>
          <label>
            Name
            <input value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
          <label>
            Type
            <select value={kind} onChange={(e) => setKind(e.target.value as ExerciseKind)}>
              {Object.entries(KIND_LABEL).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </label>
          <label>
            Weight note (e.g. per hand)
            <input value={loadNote} onChange={(e) => setLoadNote(e.target.value)} />
          </label>
          <label>
            Reps note (e.g. per leg)
            <input value={repsNote} onChange={(e) => setRepsNote(e.target.value)} />
          </label>
          <SwapFields group={swapGroup} onGroup={setSwapGroup} onlyAt={onlyAt} onOnlyAt={setOnlyAt} knownGroups={swapGroups(list)} />
          <button className="primary" disabled={!name.trim()}>Add exercise</button>
        </form>
      )}

      {shown.map((x) => (
        <Link key={x.id} to={`/exercises/${x.id}`} className="card link">
          <div className="row between">
            <strong>{x.name}{x.archived ? ' (archived)' : ''}</strong>
            <span className="badge kind">{KIND_LABEL[x.kind]}</span>
          </div>
        </Link>
      ))}

      <label style={{ marginTop: 12 }}>
        <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
        Show archived
      </label>
    </div>
  )
}
