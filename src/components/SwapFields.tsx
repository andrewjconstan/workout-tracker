import type { Location } from '../lib/types'

/** Form fields for the swap-suggestion tags on an exercise. */
export default function SwapFields({
  group,
  onGroup,
  onlyAt,
  onOnlyAt,
  knownGroups,
}: {
  group: string
  onGroup: (v: string) => void
  onlyAt: '' | Location
  onOnlyAt: (v: '' | Location) => void
  knownGroups: string[]
}) {
  return (
    <>
      <label>
        Similar to (swap group)
        <input list="swap-groups" value={group} onChange={(e) => onGroup(e.target.value)} placeholder="e.g. chest, glutes & legs" />
        <datalist id="swap-groups">
          {knownGroups.map((g) => (
            <option key={g} value={g} />
          ))}
        </datalist>
      </label>
      <label>
        Only suggest at
        <select value={onlyAt} onChange={(e) => onOnlyAt(e.target.value as '' | Location)}>
          <option value="">Anywhere</option>
          <option value="office">Office</option>
          <option value="home">Home</option>
        </select>
      </label>
    </>
  )
}
