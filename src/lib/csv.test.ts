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
