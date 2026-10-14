/** Rest guidance shown as a reminder (can be switched off in More). */
export const REST_WITHIN_SUPERSET = '30s'
export const REST_AFTER_ROUND = '45-60s'

export const REST_HINTS_KEY = 'wt-rest-hints'

/** One-line reminder; supersets of one exercise have no "between exercises" rest. */
export function restHintText(pairedExercises: boolean): string {
  return pairedExercises
    ? `Rest ${REST_WITHIN_SUPERSET} // ${REST_AFTER_ROUND} after each round`
    : `Rest ${REST_AFTER_ROUND} after each round`
}
