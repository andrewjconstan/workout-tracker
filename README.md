# Workout Tracker

A personal workout log built for superset routines: pick a routine and location (office or home),
type reps for each set and hit **Next**, with your previous sessions for that exercise shown while you log.

- **Frontend:** React + Vite + TypeScript, installable to the iPhone home screen
- **Backend:** Supabase (Postgres + email and password login), every row protected by row-level security
- **Hosting:** GitHub Pages, deployed by a workflow on every push to `main`

## What it does

- Routines per day with **office and home variants** (a slot can be limited to one location, e.g. cable fly at the office, band fly at home)
- Superset flow: one exercise and set at a time; **Next** saves and advances; **Back**, **Skip**, **+ Round**, and a one-off **Swap exercise**
- Last 3-10 sessions for the current exercise shown while logging (count is a setting), with the matching set highlighted
- Finishers with free-form sets, kept separate from working sets so they never skew trends
- History by routine with an All / Office / Home toggle, and by exercise with charts of top weight and total reps
- Edit or delete any logged set, per-exercise and per-workout notes, CSV export
- Plan editor for routines, exercises, and variants, so new routines need no code changes
- Sets entered with bad signal are kept on the phone and uploaded when you are back online

Exercise types: **weight x reps** (lb), **reps only**, and **band** (free-text marker x reps, left out of weight trends).

## One-time setup

### 1. Supabase (project `Workout-Tracker-Supa`)

The schema is in `supabase/migrations/` and has already been applied. To recreate it elsewhere, run the files in order.

In the Supabase dashboard:

1. **Authentication, Sign In / Providers:** keep Email enabled and turn **off** "Allow new users to sign up".
2. **Authentication, Users:** use **Add user, Create new user** with an email and password and **Auto Confirm User** on
   (one per person, e.g. your partner if wanted). The app signs in with that email and password.
3. **Authentication, URL Configuration:** set the Site URL to `https://andrewjconstan.github.io/workout-tracker/`.

The client configuration is in `.env.production`. The publishable key is designed to be public; the data is protected
by login and row-level security, not by hiding the key.

### 2. GitHub Pages

Repo **Settings, Pages, Source: GitHub Actions**. Merging to `main` then deploys to
`https://andrewjconstan.github.io/workout-tracker/`.

### 3. First run

Open the site, sign in with your email and password, and tap **Load starter plan** on the Today screen.
On iPhone: Share, **Add to Home Screen**.

## Development

```bash
npm install
npm run dev        # local dev server
npm test           # unit tests for the pure logic in src/lib
npm run build      # typecheck + production build
```

CI (`.github/workflows/ci.yml`) typechecks, tests, and builds every branch push.

## Data model

`exercises`, `routines`, `routine_slots` (which exercise, group, order, location, sets, rep range),
`workouts` (one per session, with the local date and location), `sets`, `workout_exercise_notes`.
History belongs to exercises, not routines, so editing or archiving a routine never touches logged sets.
Every table has a `user_id` and an "own rows" policy, so each person only sees their own data.

## Backups

Free Supabase projects are not backed up automatically, so use **More, Export all sets (CSV)** now and then.
