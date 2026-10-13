-- Workout tracker schema.
-- Every table is owned by a user (user_id) and protected by row-level security,
-- so each person only ever sees their own exercises, routines, and history.

create table public.exercises (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name        text not null,
  -- weighted: lb x reps | reps_only: reps | band: free-text marker x reps
  kind        text not null check (kind in ('weighted', 'reps_only', 'band')),
  load_note   text,   -- shown on the weight input, e.g. 'per hand'
  reps_note   text,   -- shown on the reps input, e.g. 'per leg'
  archived    boolean not null default false,
  created_at  timestamptz not null default now(),
  unique (user_id, name)
);

create table public.routines (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name        text not null,
  day_of_week smallint check (day_of_week between 1 and 7), -- 1 = Monday
  notes       text,   -- e.g. warm-up instructions (not logged)
  sort_order  smallint not null default 0,
  archived    boolean not null default false,
  created_at  timestamptz not null default now()
);

-- One row per exercise slot in a routine. A slot can be limited to one location,
-- which is how the cable fly (office) and band fly (home) share a position.
create table public.routine_slots (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,
  routine_id      uuid not null references public.routines (id) on delete cascade,
  exercise_id     uuid not null references public.exercises (id) on delete restrict,
  block           text not null default 'superset' check (block in ('superset', 'finisher')),
  superset_group  smallint not null,
  position        smallint not null,
  location        text not null default 'both' check (location in ('both', 'office', 'home')),
  target_sets     smallint,   -- null = free-form (finishers)
  rep_min         smallint,
  rep_max         smallint,
  note            text
);

create table public.workouts (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  routine_id    uuid references public.routines (id) on delete set null,
  performed_on  date not null,   -- local date chosen in the app, not UTC
  location      text not null check (location in ('office', 'home')),
  status        text not null default 'in_progress' check (status in ('in_progress', 'completed')),
  notes         text,
  created_at    timestamptz not null default now(),
  completed_at  timestamptz
);

create table public.sets (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  workout_id   uuid not null references public.workouts (id) on delete cascade,
  exercise_id  uuid not null references public.exercises (id) on delete restrict,
  set_number   smallint not null,
  weight       numeric(6, 2) check (weight >= 0),   -- pounds
  reps         smallint check (reps >= 0),
  marker       text,                                -- band exercises: x, 0, yes, a color...
  note         text,
  logged_at    timestamptz not null default now(),
  unique (workout_id, exercise_id, set_number)
);

create table public.workout_exercise_notes (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  workout_id   uuid not null references public.workouts (id) on delete cascade,
  exercise_id  uuid not null references public.exercises (id) on delete cascade,
  note         text not null,
  unique (workout_id, exercise_id)
);

-- Indexes: user_id for RLS, plus the lookups the app does most.
create index exercises_user_idx              on public.exercises (user_id);
create index routines_user_idx               on public.routines (user_id);
create index routine_slots_user_idx          on public.routine_slots (user_id);
create index routine_slots_routine_idx       on public.routine_slots (routine_id);
create index routine_slots_exercise_idx      on public.routine_slots (exercise_id);
create index workouts_user_date_idx          on public.workouts (user_id, performed_on desc);
create index workouts_routine_idx            on public.workouts (routine_id);
create index sets_user_idx                   on public.sets (user_id);
create index sets_exercise_logged_idx        on public.sets (exercise_id, logged_at desc);
create index sets_workout_idx                on public.sets (workout_id);
create index workout_exercise_notes_user_idx on public.workout_exercise_notes (user_id);
create index workout_exercise_notes_ex_idx   on public.workout_exercise_notes (exercise_id);

-- Row-level security: signed-in users can only touch their own rows.
do $$
declare
  t text;
begin
  foreach t in array array[
    'exercises', 'routines', 'routine_slots', 'workouts', 'sets', 'workout_exercise_notes'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy "own rows" on public.%I for all to authenticated
         using ((select auth.uid()) = user_id)
         with check ((select auth.uid()) = user_id)', t);
  end loop;
end
$$;
