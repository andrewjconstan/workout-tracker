import type { Exercise, Location } from './types'

const byName = (a: Exercise, b: Exercise) => a.name.localeCompare(b.name)

/** Exercises worth offering as a replacement for `current`: same swap group, usable at this location. */
export function suggestSwaps(current: Exercise | undefined, all: Exercise[], location: Location): Exercise[] {
  const group = current?.swap_group?.trim().toLowerCase()
  if (!current || !group) return []
  return all
    .filter(
      (e) =>
        e.id !== current.id &&
        !e.archived &&
        e.swap_group?.trim().toLowerCase() === group &&
        (e.only_at === null || e.only_at === undefined || e.only_at === location),
    )
    .sort(byName)
}

/** Distinct swap groups already in use (case-insensitive), for autocomplete. */
export function swapGroups(all: Exercise[]): string[] {
  const seen = new Map<string, string>()
  for (const e of all) {
    const g = e.swap_group?.trim()
    if (g && !seen.has(g.toLowerCase())) seen.set(g.toLowerCase(), g)
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b))
}
