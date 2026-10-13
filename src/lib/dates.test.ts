import test from 'node:test'
import assert from 'node:assert/strict'
import { dayOfWeekMon1, formatDate, formatShortDate, localDateString } from './dates'

test('local date uses local calendar fields, not UTC', () => {
  assert.equal(localDateString(new Date(2026, 9, 7, 23, 59)), '2026-10-07')
  assert.equal(localDateString(new Date(2026, 0, 2, 0, 1)), '2026-01-02')
})

test('Monday-first weekday numbers', () => {
  assert.equal(dayOfWeekMon1(new Date(2026, 9, 12)), 1) // Mon Oct 12 2026
  assert.equal(dayOfWeekMon1(new Date(2026, 9, 14)), 3) // Wed
  assert.equal(dayOfWeekMon1(new Date(2026, 9, 18)), 7) // Sun
})

test('date formatting does not shift by time zone', () => {
  assert.equal(formatDate('2026-10-14'), 'Wed, Oct 14')
  assert.equal(formatShortDate('2026-10-14'), 'Oct 14')
})
