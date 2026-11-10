import test from 'node:test'
import assert from 'node:assert/strict'
import { csvEscape, toCsv } from './csv'

test('escapes commas, quotes and newlines', () => {
  assert.equal(csvEscape('plain'), 'plain')
  assert.equal(csvEscape('a,b'), '"a,b"')
  assert.equal(csvEscape('say "hi"'), '"say ""hi"""')
  assert.equal(csvEscape('line\nbreak'), '"line\nbreak"')
  assert.equal(csvEscape(null), '')
  assert.equal(csvEscape(12.5), '12.5')
})

test('builds rows', () => {
  assert.equal(toCsv([['a', 'b'], [1, null]]), 'a,b\r\n1,\r\n')
})

test('neutralizes spreadsheet formulas in text cells but leaves numbers alone', () => {
  assert.equal(csvEscape('=SUM(A1)'), "'=SUM(A1)")
  assert.equal(csvEscape('+1'), "'+1")
  assert.equal(csvEscape('@cmd'), "'@cmd")
  assert.equal(csvEscape('-5 reps'), "'-5 reps")
  assert.equal(csvEscape(-5), '-5')
  assert.equal(csvEscape('2026-11-10'), '2026-11-10')
})
