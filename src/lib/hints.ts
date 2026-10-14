/** Rest guidance shown as a reminder (can be switched off in More). Seconds. */
export const REST_WITHIN_SUPERSET = '30 s'
export const REST_AFTER_ROUND = '45-60 s'

export const REST_HINTS_KEY = 'wt-rest-hints'

/** Reminder text; supersets of one exercise have no "between exercises" rest. */
export function restHintText(pairedExercises: boolean): string {
  return pairedExercises
    ? `Rest ${REST_WITHIN_SUPERSET} between exercises · ${REST_AFTER_ROUND} after each round`
    : `Rest ${REST_AFTER_ROUND} after each round`
}
