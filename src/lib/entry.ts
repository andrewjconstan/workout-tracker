import type { ExerciseKind } from './types'

export interface Entry {
  weight: number | null
  reps: number
  marker: string | null
}

/** Validate what was typed for one set, according to the exercise type. */
export function parseEntry(
  kind: ExerciseKind,
  weight: string,
  reps: string,
  marker: string,
): { entry: Entry } | { error: string } {
  const r = reps.trim()
  if (!/^\d+$/.test(r) || Number(r) > 9999) return { error: 'Enter reps as a whole number.' }

  let w: number | null = null
  if (kind === 'weighted') {
    const t = weight.trim().replace(',', '.')
    if (t === '') return { error: 'Enter a weight (use 0 if there is none).' }
    const n = Number(t)
    if (!Number.isFinite(n) || n < 0 || n > 9999) return { error: 'Weight must be a number.' }
    w = n
  }
  return { entry: { weight: w, reps: Number(r), marker: kind === 'band' ? marker.trim() || null : null } }
}
