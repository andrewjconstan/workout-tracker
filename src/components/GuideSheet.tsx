import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Exercise } from '../lib/types'
import ExerciseAnimation from './ExerciseAnimation'

const SECTIONS: { key: 'setup' | 'how' | 'focus' | 'avoid'; title: string; ordered?: boolean }[] = [
  { key: 'setup', title: 'Setup' },
  { key: 'how', title: 'How', ordered: true },
  { key: 'focus', title: 'Focus on' },
  { key: 'avoid', title: 'Avoid' },
]

/**
 * Bottom sheet with an exercise's how-to. It is only an overlay: the workout screen stays mounted
 * underneath, so nothing typed there is lost. Closes with the X, a tap outside, a swipe down,
 * Escape, or the browser back gesture.
 */
export default function GuideSheet({
  exercise,
  onClose,
  onSetupSaved,
}: {
  exercise: Exercise
  onClose: () => void
  onSetupSaved: (id: string, text: string | null) => void
}) {
  const guide = exercise.guide ?? {}
  const [setup, setSetup] = useState(exercise.setup_note ?? '')
  const [error, setError] = useState<string | null>(null)
  const [dragY, setDragY] = useState(0)
  const touchStart = useRef<number | null>(null)
  const closeRef = useRef(onClose)
  closeRef.current = onClose

  // Back gesture closes the sheet instead of leaving the workout.
  useEffect(() => {
    window.history.pushState({ ...(window.history.state ?? {}), guide: true }, '')
    const onPop = () => closeRef.current()
    window.addEventListener('popstate', onPop)
    return () => {
      window.removeEventListener('popstate', onPop)
      if (window.history.state?.guide) window.history.back()
    }
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeRef.current()
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [])

  async function saveSetup() {
    const clean = setup.trim()
    if (clean === (exercise.setup_note ?? '')) return
    const { error } = await supabase.from('exercises').update({ setup_note: clean || null }).eq('id', exercise.id)
    if (error) setError(error.message)
    else {
      setError(null)
      onSetupSaved(exercise.id, clean || null)
    }
  }

  return (
    <div className="sheet-backdrop" onClick={onClose} data-testid="guide-backdrop">
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label={`${exercise.name} guide`}
        style={dragY ? { transform: `translateY(${dragY}px)`, transition: 'none' } : undefined}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="sheet-head"
          onTouchStart={(e) => { touchStart.current = e.touches[0].clientY }}
          onTouchMove={(e) => {
            if (touchStart.current !== null) setDragY(Math.max(0, e.touches[0].clientY - touchStart.current))
          }}
          onTouchEnd={() => {
            if (dragY > 90) onClose()
            setDragY(0)
            touchStart.current = null
          }}
        >
          <div className="grab" aria-hidden="true" />
          <div className="row between">
            <h2>{exercise.name}</h2>
            <button type="button" className="sheet-x" aria-label="Close guide" onClick={onClose}>✕</button>
          </div>
          {guide.summary && <p className="muted small">{guide.summary}</p>}
        </div>

        <div className="sheet-body">
          {exercise.animation && <ExerciseAnimation kind={exercise.animation} label={exercise.name} />}

          {SECTIONS.map(({ key, title, ordered }) => {
            const items = guide[key]
            if (!items || items.length === 0) return null
            const List = ordered ? 'ol' : 'ul'
            return (
              <section key={key}>
                <h3>{title}</h3>
                <List>
                  {items.map((t, i) => <li key={i}>{t}</li>)}
                </List>
              </section>
            )
          })}

          <section>
            <h3>My settings</h3>
            <textarea
              rows={2}
              placeholder="Seat, pin, pulley height, weight…"
              value={setup}
              onChange={(e) => setSetup(e.target.value)}
              onBlur={() => void saveSetup()}
              aria-label="My settings for this exercise"
            />
            {error && <p className="error">{error}</p>}
          </section>
        </div>
      </div>
    </div>
  )
}
