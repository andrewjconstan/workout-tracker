import { useState } from 'react'
import { useAuth } from '../lib/auth'
import { toCsv } from '../lib/csv'
import { clearPending, loadPending } from '../lib/pending'
import { fetchAll, supabase } from '../lib/supabase'
import { REST_HINTS_KEY } from '../lib/hints'
import { QUICK_ROUTINE_NAME } from '../lib/quick'
import { useLocalState } from '../lib/storage'
import { applyTheme, THEME_KEY, THEME_LABEL, type Theme } from '../lib/theme'

interface ExportRow {
  block: string
  set_number: number
  weight: number | null
  reps: number | null
  marker: string | null
  note: string | null
  logged_at: string
  exercises: { name: string } | null
  workouts: {
    performed_on: string
    location: string
    notes: string | null
    routines: { name: string } | null
  } | null
}

export default function Settings() {
  const { session } = useAuth()
  const [stripCount, setStripCount] = useLocalState<number>('wt-strip-count', 5)
  const [theme, setTheme] = useLocalState<Theme>(THEME_KEY, 'auto')
  const [restHints, setRestHints] = useLocalState<boolean>(REST_HINTS_KEY, true)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [pending, setPending] = useState(loadPending().length)

  async function exportCsv() {
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      const rows = await fetchAll<ExportRow>((from, to) =>
        supabase
          .from('sets')
          .select('block, set_number, weight, reps, marker, note, logged_at, exercises(name), workouts(performed_on, location, notes, routines(name))')
          .order('logged_at', { ascending: true })
          .range(from, to),
      )
      const csv = toCsv([
        ['date', 'location', 'routine', 'exercise', 'block', 'set', 'weight_lb', 'reps', 'marker', 'set_note', 'workout_notes', 'logged_at'],
        ...rows.map((r) => [
          r.workouts?.performed_on,
          r.workouts?.location,
          r.workouts?.routines?.name,
          r.exercises?.name,
          r.block,
          r.set_number,
          r.weight,
          r.reps,
          r.marker,
          r.note,
          r.workouts?.notes,
          r.logged_at,
        ]),
      ])
      const filename = `workouts-${new Date().toISOString().slice(0, 10)}.csv`
      const file = new File([csv], filename, { type: 'text/csv' })
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Workout export' })
      } else {
        const url = URL.createObjectURL(file)
        const a = document.createElement('a')
        a.href = url
        a.download = filename
        document.body.appendChild(a)
        a.click()
        a.remove()
        URL.revokeObjectURL(url)
      }
      setMessage(`Exported ${rows.length} sets.`)
    } catch (e) {
      if (!(e instanceof DOMException && e.name === 'AbortError')) {
        setError(e instanceof Error ? e.message : 'Export failed')
      }
    }
    setBusy(false)
  }

  async function syncNow() {
    const items = loadPending()
    if (items.length === 0) return
    const { error } = await supabase
      .from('sets')
      .upsert(items, { onConflict: 'workout_id,exercise_id,block,set_number' })
    if (error) setError(error.message)
    else clearPending(items)
    setPending(loadPending().length)
  }

  async function loadStarter() {
    setBusy(true)
    setError(null)
    setMessage(null)
    // The starter plan only ever adds to an empty account; it never changes or removes anything.
    const { data: existing, error: countError } = await supabase.from('routines').select('id, archived').neq('name', QUICK_ROUTINE_NAME)
    if (countError) {
      setBusy(false)
      setError(countError.message)
      return
    }
    if (existing && existing.length > 0) {
      const archivedCount = existing.filter((r) => r.archived).length
      setBusy(false)
      setMessage(
        `Nothing changed. You already have ${existing.length} routine(s)` +
          (archivedCount ? ` (${archivedCount} archived)` : '') +
          '. The starter plan only loads into an empty account. To restore an archived routine, go to Plan, tick "Show archived routines", and tap Unarchive.',
      )
      return
    }
    if (!window.confirm('Load the starter exercises and Mon/Tue/Wed routines? Nothing existing will be changed.')) {
      setBusy(false)
      return
    }
    const { error } = await supabase.rpc('seed_starter_plan')
    setBusy(false)
    if (error) setError(error.message)
    else setMessage('Starter plan loaded.')
  }

  return (
    <div>
      <h1>More</h1>
      {error && <p className="error">{error}</p>}
      {message && <p className="muted">{message}</p>}

      <div className="card stack">
        <h3>History</h3>
        <label>
          Sessions shown while logging
          <select value={stripCount} onChange={(e) => setStripCount(Number(e.target.value))}>
            {[3, 4, 5, 6, 7, 8, 10].map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </label>
        <p className="muted small">Applies to this device.</p>
      </div>

      <div className="card stack">
        <h3>Hints</h3>
        <label className="row">
          <input type="checkbox" checked={restHints} onChange={(e) => setRestHints(e.target.checked)} />
          <span>Show rest reminders</span>
        </label>
        <p className="muted small">Shows rest times on the log screen and in Plan. Applies to this device.</p>
      </div>

      <div className="card stack">
        <h3>Appearance</h3>
        <label>
          Theme
          <select
            value={theme}
            onChange={(e) => {
              const next = e.target.value as Theme
              setTheme(next)
              applyTheme(next)
            }}
          >
            {(Object.keys(THEME_LABEL) as Theme[]).map((t) => (
              <option key={t} value={t}>{THEME_LABEL[t]}</option>
            ))}
          </select>
        </label>
        <p className="muted small">"Match this device" follows your phone or computer. Applies to this device.</p>
      </div>

      <div className="card stack">
        <h3>Data</h3>
        <button disabled={busy} onClick={() => void exportCsv()}>Export all sets (CSV)</button>
        <button disabled={busy} onClick={() => void loadStarter()}>Load starter plan</button>
        {pending > 0 && (
          <div>
            <p className="muted small">{pending} set(s) on this phone have not synced yet.</p>
            <button onClick={() => void syncNow()}>Sync now</button>
          </div>
        )}
      </div>

      <div className="card stack">
        <h3>Account</h3>
        <p className="muted small">{session?.user.email}</p>
        <button onClick={() => void supabase.auth.signOut()}>Sign out</button>
      </div>

      <p className="muted small" style={{ textAlign: 'center' }} data-testid="app-version">
        Version {__APP_VERSION__}
      </p>
    </div>
  )
}
