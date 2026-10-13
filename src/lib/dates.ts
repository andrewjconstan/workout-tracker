const pad = (n: number) => String(n).padStart(2, '0')

/** Local calendar date as YYYY-MM-DD (never UTC, so evening workouts stay on the right day). */
export function localDateString(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Monday = 1 ... Sunday = 7. */
export function dayOfWeekMon1(d: Date = new Date()): number {
  const g = d.getDay()
  return g === 0 ? 7 : g
}

function parseLocal(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** "Wed, Oct 7" */
export function formatDate(iso: string): string {
  const d = parseLocal(iso)
  return `${DAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}`
}

/** "Oct 7" */
export function formatShortDate(iso: string): string {
  const d = parseLocal(iso)
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`
}

export const DAY_NAMES = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
