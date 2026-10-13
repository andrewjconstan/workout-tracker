import { formatShortDate } from '../lib/dates'
import { formatSet, type HistorySession } from '../lib/history'
import type { ExerciseKind } from '../lib/types'

export default function HistoryStrip({
  sessions,
  kind,
  highlightSet,
  notes,
}: {
  sessions: HistorySession[]
  kind: ExerciseKind
  highlightSet?: number
  /** Notes written in earlier workouts, keyed by workout id. */
  notes?: Record<string, string>
}) {
  if (sessions.length === 0) return <p className="muted small">No previous sessions yet.</p>
  return (
    <ul className="strip">
      {sessions.map((s) => (
        <li key={s.workoutId}>
          <span className="strip-date">{formatShortDate(s.date)}</span>
          <span className={`badge ${s.location}`}>{s.location === 'office' ? 'Office' : 'Home'}</span>
          <span className="strip-sets">
            {s.sets.map((x) => (
              <span key={x.setNumber} className={x.setNumber === highlightSet ? 'hl' : undefined}>
                {formatSet(x, kind)}
              </span>
            ))}
          </span>
          {notes?.[s.workoutId] && <span className="strip-note">{notes[s.workoutId]}</span>}
        </li>
      ))}
    </ul>
  )
}
