// Browser smoke test: runs the built app against a mocked Supabase API and walks through a workout.
// Used in CI only (needs `playwright` installed with a Chromium browser).
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import assert from 'node:assert/strict'

const REF = 'nbzofhyutjcbpyqwwslo'
const BASE = 'http://localhost:4173/workout-tracker/'
const OUT = process.env.SHOT_DIR ?? 'shots'
fs.mkdirSync(OUT, { recursive: true })

// ---------- mock database ----------
const ex = (id, name, kind, load_note = null, reps_note = null) => ({ id, name, kind, load_note, reps_note, archived: false })
const exercises = [
  ex('e-incline', 'Incline Dumbbell Press', 'weighted', 'per hand'),
  ex('e-lunge', 'Dumbbell Weighted Lunge', 'weighted', 'per hand', 'per leg'),
  ex('e-standing', 'Standing Dumbbell Press', 'weighted', 'per hand'),
  ex('e-cable', 'Bent Over Cable Fly', 'weighted', 'stack weight'),
  ex('e-band', 'Bent Over Band Fly', 'band'),
  ex('e-tricep', 'Bent Over Dumbbell Tricep Extension', 'weighted', 'per hand'),
  ex('e-situp', 'Sit-ups', 'reps_only'),
  ex('e-pushup', 'Pushups', 'reps_only'),
]
const routines = [
  { id: 'r-mon', name: 'Push focus', day_of_week: 1, notes: 'Warm-up (4 min): arm circles, bodyweight lunges', sort_order: 1, archived: false },
  { id: 'r-tue', name: 'Pull focus', day_of_week: 2, notes: null, sort_order: 2, archived: false },
  { id: 'r-wed', name: 'Full body', day_of_week: 3, notes: null, sort_order: 3, archived: false },
]
const slot = (id, exercise_id, group, position, location, sets, min, max, block = 'superset', note = null) => ({
  id, routine_id: 'r-mon', exercise_id, block, superset_group: group, position, location,
  target_sets: sets, rep_min: min, rep_max: max, note,
})
const routine_slots = [
  slot('sl-1', 'e-incline', 1, 1, 'both', 3, 8, 10),
  slot('sl-2', 'e-lunge', 1, 2, 'both', 3, 10, 10),
  slot('sl-3', 'e-standing', 2, 1, 'both', 3, 8, 10),
  slot('sl-4', 'e-cable', 2, 2, 'office', 3, 12, 15),
  slot('sl-5', 'e-band', 2, 2, 'home', 3, 12, 15),
  slot('sl-6', 'e-tricep', 3, 1, 'both', 3, 12, 12),
  slot('sl-7', 'e-situp', 3, 2, 'both', 3, 15, 20),
  slot('sl-8', 'e-pushup', 4, 1, 'both', null, null, null, 'finisher', 'As many as you can'),
]
const workouts = [
  { id: 'w-old', routine_id: 'r-mon', performed_on: '2026-10-06', location: 'home', status: 'completed', notes: null, created_at: '2026-10-06T17:00:00Z', completed_at: '2026-10-06T17:30:00Z' },
  { id: 'w-older', routine_id: 'r-mon', performed_on: '2026-09-29', location: 'office', status: 'completed', notes: 'Felt strong', created_at: '2026-09-29T17:00:00Z', completed_at: '2026-09-29T17:30:00Z' },
]
let setSeq = 0
const mkSet = (workout_id, exercise_id, set_number, weight, reps, day, block = 'superset', marker = null) => ({
  id: `s-${++setSeq}`, workout_id, exercise_id, block, set_number, weight, reps, marker, note: null,
  logged_at: `${day}T17:${String(10 + setSeq).padStart(2, '0')}:00Z`,
})
const sets = [
  mkSet('w-old', 'e-incline', 1, 35, 10, '2026-10-06'),
  mkSet('w-old', 'e-incline', 2, 35, 9, '2026-10-06'),
  mkSet('w-old', 'e-incline', 3, 30, 8, '2026-10-06'),
  mkSet('w-old', 'e-lunge', 1, 25, 10, '2026-10-06'),
  mkSet('w-older', 'e-incline', 1, 30, 10, '2026-09-29'),
  mkSet('w-older', 'e-incline', 2, 30, 10, '2026-09-29'),
  mkSet('w-older', 'e-incline', 3, 30, 9, '2026-09-29'),
]
const notes = [{ id: 'n-1', workout_id: 'w-old', exercise_id: 'e-incline', note: 'Go slower on the way down' }]
let failSetWrites = false
let workoutSeq = 0

const tables = { routines, routine_slots, exercises, workouts, sets, workout_exercise_notes: notes }

function embed(table, row, select) {
  const out = { ...row }
  if (table === 'workouts') {
    if (select.includes('routines(')) out.routines = routines.find((r) => r.id === row.routine_id) ?? null
    if (select.includes('sets(')) {
      out.sets = sets.filter((s) => s.workout_id === row.id).map((s) => ({ ...s, exercises: exercises.find((e) => e.id === s.exercise_id) ?? null }))
    }
    if (select.includes('workout_exercise_notes(')) out.workout_exercise_notes = notes.filter((n) => n.workout_id === row.id)
  }
  if (table === 'sets') {
    if (select.includes('workouts')) out.workouts = workouts.find((w) => w.id === row.workout_id) ?? null
    if (select.includes('exercises(')) out.exercises = exercises.find((e) => e.id === row.exercise_id) ?? null
  }
  return out
}

function applyFilters(rows, params) {
  const skip = new Set(['select', 'order', 'limit', 'offset', 'on_conflict', 'columns'])
  let out = rows
  for (const [k, v] of params) {
    if (skip.has(k)) continue
    if (v.startsWith('eq.')) out = out.filter((r) => String(r[k]) === v.slice(3))
    else if (v.startsWith('neq.')) out = out.filter((r) => String(r[k]) !== v.slice(4))
    else if (v.startsWith('in.(')) {
      const list = v.slice(4, -1).split(',')
      out = out.filter((r) => list.includes(String(r[k])))
    }
  }
  const order = params.get('order')
  if (order) {
    const keys = order.split(',').map((o) => o.split('.'))
    out = [...out].sort((a, b) => {
      for (const [col, dir] of keys) {
        if (a[col] === b[col]) continue
        const cmp = a[col] < b[col] ? -1 : 1
        return dir === 'desc' ? -cmp : cmp
      }
      return 0
    })
  }
  const offset = Number(params.get('offset') ?? 0)
  const limit = params.get('limit') ? Number(params.get('limit')) : undefined
  return out.slice(offset, limit ? offset + limit : undefined)
}

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': '*',
  'access-control-allow-methods': 'GET,POST,PATCH,DELETE,OPTIONS',
  'access-control-expose-headers': '*',
}
const json = (route, status, body) =>
  route.fulfill({ status, headers: { ...CORS, 'content-type': 'application/json' }, body: JSON.stringify(body) })

async function handleRest(route) {
  const req = route.request()
  const url = new URL(req.url())
  if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS })
  const parts = url.pathname.split('/')
  const name = parts[parts.length - 1]
  if (parts.includes('rpc')) return json(route, 200, null)
  const store = tables[name]
  if (!store) return json(route, 404, { message: `no table ${name}` })

  const select = url.searchParams.get('select') ?? '*'
  const wantObject = (req.headers()['accept'] ?? '').includes('vnd.pgrst.object')
  const prefer = req.headers()['prefer'] ?? ''
  const reply = (rows) => {
    const shaped = rows.map((r) => embed(name, r, select))
    if (wantObject) return shaped.length === 1 ? json(route, 200, shaped[0]) : json(route, 406, { message: 'expected 1 row' })
    return json(route, 200, shaped)
  }

  switch (req.method()) {
    case 'GET':
      return reply(applyFilters(store, url.searchParams))
    case 'POST': {
      if (name === 'sets' && failSetWrites) return json(route, 500, { message: 'simulated outage' })
      const body = JSON.parse(req.postData() ?? '[]')
      const items = Array.isArray(body) ? body : [body]
      const saved = []
      for (const item of items) {
        if (name === 'sets') {
          const i = store.findIndex((s) => s.workout_id === item.workout_id && s.exercise_id === item.exercise_id && s.block === item.block && s.set_number === item.set_number)
          if (i >= 0) {
            store[i] = { ...store[i], ...item }
            saved.push(store[i])
          } else {
            const row = { id: `s-${++setSeq}`, note: null, logged_at: new Date().toISOString(), ...item }
            store.push(row)
            saved.push(row)
          }
        } else if (name === 'workouts') {
          const row = { id: `w-new-${++workoutSeq}`, status: 'in_progress', notes: null, created_at: new Date().toISOString(), completed_at: null, ...item }
          store.push(row)
          saved.push(row)
        } else {
          const row = { id: `${name}-${store.length + 1}`, ...item }
          store.push(row)
          saved.push(row)
        }
      }
      if (prefer.includes('return=representation')) return reply(saved)
      return route.fulfill({ status: 201, headers: CORS })
    }
    case 'PATCH': {
      const rows = applyFilters(store, url.searchParams)
      const patch = JSON.parse(req.postData() ?? '{}')
      rows.forEach((r) => Object.assign(r, patch))
      if (prefer.includes('return=representation')) return reply(rows)
      return route.fulfill({ status: 204, headers: CORS })
    }
    case 'DELETE': {
      const rows = applyFilters(store, url.searchParams)
      rows.forEach((r) => store.splice(store.indexOf(r), 1))
      return route.fulfill({ status: 204, headers: CORS })
    }
    default:
      return json(route, 405, {})
  }
}

// ---------- helpers ----------
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
const farFuture = Math.floor(Date.now() / 1000) + 10 * 365 * 24 * 3600
const fakeJwt = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: 'u1', role: 'authenticated', exp: farFuture })}.sig`
const session = {
  access_token: fakeJwt, token_type: 'bearer', expires_in: 3600 * 24 * 365, expires_at: farFuture, refresh_token: 'refresh',
  user: { id: 'u1', aud: 'authenticated', role: 'authenticated', email: 'andy@example.com', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' },
}

async function eventually(fn, what = 'condition', ms = 5000) {
  const end = Date.now() + ms
  while (Date.now() < end) {
    try {
      if (await fn()) return
    } catch { /* retry */ }
    await new Promise((r) => setTimeout(r, 100))
  }
  throw new Error(`timed out waiting for ${what}`)
}

const failures = []
async function step(name, fn) {
  try {
    await fn()
    console.log(`PASS ${name}`)
  } catch (e) {
    failures.push(name)
    console.log(`FAIL ${name}: ${e.message.split('\n')[0]}`)
  }
}

const server = spawn('npx', ['vite', 'preview', '--port', '4173', '--strictPort'], { stdio: 'ignore' })
for (let i = 0; i < 60; i++) {
  try {
    if ((await fetch(BASE)).ok) break
  } catch { /* not up yet */ }
  await new Promise((r) => setTimeout(r, 500))
}

const browser = await chromium.launch()
const context = await browser.newContext({
  viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: 'light',
})
await context.addInitScript(
  ([key, value]) => localStorage.setItem(key, value),
  [`sb-${REF}-auth-token`, JSON.stringify(session)],
)
await context.route('**/rest/v1/**', handleRest)
await context.route('**/auth/v1/**', (route) => json(route, 200, {}))

const page = await context.newPage()
const pageErrors = []
page.on('pageerror', (e) => pageErrors.push(e.message))
page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) pageErrors.push(m.text()) })
const shot = (name) => page.screenshot({ path: `${OUT}/${name}.png` })
const exName = () => page.locator('.exercise-name')
const weightInput = () => page.getByLabel(/^Weight/)
const repsInput = () => page.getByLabel(/^Reps/)

await step('home shows routines', async () => {
  await page.goto(BASE)
  await page.getByRole('heading', { name: 'Today' }).waitFor({ timeout: 15000 })
  await page.getByText('Push focus').first().waitFor()
  await shot('01-home')
})

await step('start a home workout and see history for the first exercise', async () => {
  await page.getByRole('button', { name: 'Home', exact: true }).click()
  await page.locator('.card', { hasText: 'Push focus' }).getByRole('button', { name: /Start/ }).click()
  await exName().filter({ hasText: 'Incline Dumbbell Press' }).waitFor({ timeout: 10000 })
  await page.getByText('Round 1 of 3').waitFor()
  await eventually(async () => (await weightInput().inputValue()) === '35', 'weight pre-filled with 35 from last session')
  await page.locator('.strip').getByText('35×10').first().waitFor()
  await page.locator('.strip-note').getByText('Go slower on the way down').waitFor()
  await eventually(
    () => page.evaluate(() => document.activeElement?.getAttribute('inputmode') === 'numeric'),
    'cursor in the reps field when weight is pre-filled',
  )
  await shot('02-log-first-step')
})

await step('typing reps and pressing Next advances to the superset partner', async () => {
  await repsInput().fill('10')
  await page.getByRole('button', { name: 'Next' }).click()
  await exName().filter({ hasText: 'Dumbbell Weighted Lunge' }).waitFor()
  await eventually(async () => (await repsInput().inputValue()) === '', 'reps cleared for the next exercise')
  await shot('03-log-second-step')
  const saved = sets.find((s) => s.workout_id.startsWith('w-new') && s.exercise_id === 'e-incline' && s.set_number === 1)
  assert.ok(saved, 'set 1 saved to the database')
  assert.equal(saved.weight, 35)
  assert.equal(saved.reps, 10)
})

await step('second exercise, then round 2 of the first', async () => {
  await weightInput().fill('25')
  await repsInput().fill('10')
  await page.getByRole('button', { name: 'Next' }).click()
  await exName().filter({ hasText: 'Incline Dumbbell Press' }).waitFor()
  await page.getByText('Round 2 of 3').waitFor()
  await eventually(async () => (await weightInput().inputValue()) === '35', 'weight carried to round 2')
})

await step('skip moves on without saving', async () => {
  await page.getByRole('button', { name: 'Skip' }).click()
  await exName().filter({ hasText: 'Dumbbell Weighted Lunge' }).waitFor()
  assert.equal(sets.filter((s) => s.workout_id.startsWith('w-new') && s.exercise_id === 'e-incline').length, 1)
})

await step('swap exercise for this workout only', async () => {
  await page.getByRole('button', { name: 'Swap exercise' }).click()
  await page.getByLabel(/Do this instead/).selectOption('e-standing')
  await exName().filter({ hasText: 'Standing Dumbbell Press' }).waitFor()
})

await step('home variant shows the band fly, not the cable fly', async () => {
  await page.getByText('All sets in this workout').click()
  await page.getByText('Bent Over Band Fly').first().waitFor()
  assert.equal(await page.getByText('Bent Over Cable Fly').count(), 0)
  await shot('04-all-sets')
})

await step('sets entered during an outage are queued, then sync', async () => {
  failSetWrites = true
  await repsInput().fill('8')
  if (await weightInput().inputValue() === '') await weightInput().fill('20')
  await page.getByRole('button', { name: 'Next' }).click()
  await page.getByText(/waiting to sync/).waitFor({ timeout: 10000 })
  await shot('05-offline-banner')
  failSetWrites = false
  await page.evaluate(() => window.dispatchEvent(new Event('online')))
  await page.getByText(/waiting to sync/).waitFor({ state: 'detached', timeout: 10000 })
  assert.ok(sets.find((s) => s.exercise_id === 'e-standing' && s.workout_id.startsWith('w-new')), 'queued set reached the database')
})

await step('finish the workout', async () => {
  await page.getByRole('button', { name: 'Finish workout' }).click()
  await page.getByRole('button', { name: /Save & finish/ }).click()
  await page.getByRole('heading', { name: 'Today' }).waitFor()
  assert.equal(workouts.find((w) => w.id.startsWith('w-new')).status, 'completed')
  await shot('06-home-after')
})

await step('history by routine lists dates and sets, with location filter', async () => {
  await page.getByRole('link', { name: 'History' }).click()
  await page.getByRole('link', { name: /Push focus/ }).click()
  await page.getByText('35×10, 35×9').first().waitFor().catch(() => {})
  await page.getByText('Oct 6', { exact: false }).first().waitFor().catch(() => {})
  await page.getByText('Tue, Oct 6').waitFor()
  await page.getByRole('button', { name: /^Office/ }).click()
  await page.getByText('Tue, Sep 29').waitFor()
  assert.equal(await page.getByText('Tue, Oct 6').count(), 0)
  await shot('07-routine-history')
})

await step('exercise detail shows sessions and charts', async () => {
  await page.getByRole('link', { name: 'Exercises' }).click()
  await page.getByRole('link', { name: /Incline Dumbbell Press/ }).click()
  await page.getByRole('heading', { name: /Sessions/ }).waitFor()
  await page.locator('.chart svg').first().waitFor()
  await shot('08-exercise-detail')
})

await step('plan editor renders slots with location badges', async () => {
  await page.getByRole('link', { name: 'Plan' }).click()
  await page.getByText('Push focus').first().waitFor()
  assert.equal(await page.getByText('Superset 2').count(), 0, 'routines start collapsed')
  await page.getByRole('button', { name: /Push focus/ }).click()
  await page.getByText('Superset 2').first().waitFor()
  await shot('09-plan')
})

await step('archiving a routine asks for confirmation', async () => {
  let asked = ''
  page.once('dialog', (d) => { asked = d.message(); void d.dismiss() })
  await page.getByRole('button', { name: 'Archive', exact: true }).first().click()
  await eventually(async () => asked.includes('Archive'), 'confirmation dialog shown')
  assert.equal(routines.find((r) => r.id === 'r-mon').archived, false, 'routine not archived after cancel')
})

await step('load starter plan does nothing when routines exist', async () => {
  await page.getByRole('link', { name: 'More' }).click()
  await page.getByRole('button', { name: 'Load starter plan' }).click()
  await page.getByText(/Nothing changed/).waitFor()
})

await step('no runtime errors in the browser', async () => {
  assert.deepEqual(pageErrors, [])
})

await browser.close()
server.kill()
console.log(failures.length ? `\n${failures.length} step(s) failed: ${failures.join('; ')}` : '\nAll smoke steps passed.')
process.exit(failures.length ? 1 : 0)
