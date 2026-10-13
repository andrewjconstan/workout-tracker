import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { DAY_NAMES, formatDate } from '../lib/dates'
import { fetchAll, supabase } from '../lib/supabase'
import type { Routine } from '../lib/types'

interface Summary {
  count: number
  last: string | null
}

export default function HistoryIndex() {
  const [routines, setRoutines] = useState<Routine[]>([])
  const [summary, setSummary] = useState<Record<string, Summary>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const r = await supabase.from('routines').select('*').order('sort_order')
        if (r.error) throw new Error(r.error.message)
        const workouts = await fetchAll<{ routine_id: string | null; performed_on: string }>((from, to) =>
          supabase
            .from('workouts')
            .select('routine_id, performed_on')
            .eq('status', 'completed')
            .order('performed_on', { ascending: false })
            .range(from, to),
        )
        const s: Record<string, Summary> = {}
        for (const w of workouts) {
          if (!w.routine_id) continue
          const cur = s[w.routine_id] ?? { count: 0, last: null }
          cur.count += 1
          if (!cur.last || w.performed_on > cur.last) cur.last = w.performed_on
          s[w.routine_id] = cur
        }
        setRoutines((r.data ?? []) as Routine[])
        setSummary(s)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not load history')
      }
      setLoading(false)
    }
    void load()
  }, [])

  if (loading) return <p className="muted">Loading…</p>

  return (
    <div>
      <h1>History</h1>
      {error && <p className="error">{error}</p>}
      {routines.length === 0 && <p className="muted">No routines yet.</p>}
      {routines.map((r) => {
        const s = summary[r.id]
        return (
          <Link key={r.id} to={`/history/${r.id}`} className="card link">
            <div className="row between">
              <div>
                <h3>{r.name}{r.archived ? ' (archived)' : ''}</h3>
                <p className="muted small">{r.day_of_week ? DAY_NAMES[r.day_of_week] : 'Any day'}</p>
              </div>
              <div className="muted small" style={{ textAlign: 'right' }}>
                {s ? `${s.count} workout${s.count === 1 ? '' : 's'}` : 'No workouts yet'}
                {s?.last ? <><br />Last: {formatDate(s.last)}</> : null}
              </div>
            </div>
          </Link>
        )
      })}
    </div>
  )
}
