import type { Location, RoutineSlot } from './types'

export interface Step {
  key: string // `${slot.id}:${round}`
  slot: RoutineSlot
  group: number
  round: number
  rounds: number // total rounds in this group, including added ones
}

const DEFAULT_SETS = 3

/** Slots that apply at this location ('both' slots always apply). */
export function slotsForLocation(slots: RoutineSlot[], location: Location): RoutineSlot[] {
  return slots.filter((s) => s.location === 'both' || s.location === location)
}

/**
 * Expand a routine into the ordered list of sets to log:
 * for each superset group, round 1 of every exercise, then round 2, and so on.
 * `extraRounds` maps a group number (as a string) to rounds added during the workout.
 */
export function buildSteps(
  slots: RoutineSlot[],
  location: Location,
  extraRounds: Record<string, number> = {},
): Step[] {
  const visible = slotsForLocation(slots, location).filter((s) => s.block === 'superset')
  const groups = new Map<number, RoutineSlot[]>()
  for (const s of visible) {
    const arr = groups.get(s.superset_group) ?? []
    arr.push(s)
    groups.set(s.superset_group, arr)
  }

  const steps: Step[] = []
  for (const g of [...groups.keys()].sort((a, b) => a - b)) {
    const members = [...(groups.get(g) ?? [])].sort((a, b) => a.position - b.position)
    const extra = extraRounds[String(g)] ?? 0
    const rounds = Math.max(...members.map((m) => m.target_sets ?? DEFAULT_SETS)) + extra
    for (let r = 1; r <= rounds; r++) {
      for (const m of members) {
        if (r <= (m.target_sets ?? DEFAULT_SETS) + extra) {
          steps.push({ key: `${m.id}:${r}`, slot: m, group: g, round: r, rounds })
        }
      }
    }
  }
  return steps
}

export function finisherSlots(slots: RoutineSlot[], location: Location): RoutineSlot[] {
  return slotsForLocation(slots, location)
    .filter((s) => s.block === 'finisher')
    .sort((a, b) => a.superset_group - b.superset_group || a.position - b.position)
}

/** The exercise actually being done for a slot, honoring a one-off substitution. */
export function effectiveExerciseId(slot: RoutineSlot, subs: Record<string, string>): string {
  return subs[slot.id] ?? slot.exercise_id
}

/** Index of the first step that is neither logged nor skipped, or -1 when all are handled. */
export function findCurrentIndex(
  steps: Step[],
  isDone: (s: Step) => boolean,
  skipped: ReadonlySet<string>,
): number {
  return steps.findIndex((s) => !isDone(s) && !skipped.has(s.key))
}
