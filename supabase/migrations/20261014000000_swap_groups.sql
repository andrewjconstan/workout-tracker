-- Swap suggestions: exercises can be tagged with a "similar to" group, and optionally limited to one location.
alter table public.exercises
  add column swap_group text,
  add column only_at text check (only_at in ('office', 'home'));

-- Same as before, but starter exercises now carry swap groups (see swap_groups migration).
-- Loads the starter exercises and Mon/Tue/Wed routines for the signed-in user.
-- Safe to call more than once: it does nothing if the user already has routines.
-- Runs as the caller (security invoker), so row-level security still applies.

create or replace function public.seed_starter_plan()
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  ex_incline  uuid;
  ex_standing uuid;
  ex_lateral  uuid;
  ex_tricep   uuid;
  ex_curl     uuid;
  ex_kroc     uuid;
  ex_shrug    uuid;
  ex_lunge    uuid;
  ex_cable    uuid;
  ex_band     uuid;
  ex_pushup   uuid;
  ex_situp    uuid;
  r_mon uuid;
  r_tue uuid;
  r_wed uuid;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  -- Serialize concurrent calls for the same user so a double tap cannot load the plan twice.
  perform pg_advisory_xact_lock(hashtext(uid::text));

  if exists (select 1 from routines where user_id = uid) then
    return;
  end if;

  -- Exercises (only the exercises this user does not already have)
  insert into exercises (user_id, name, kind, load_note, reps_note, swap_group, only_at) values
    (uid, 'Incline Dumbbell Press',            'weighted',  'per hand', null, 'chest', null),
    (uid, 'Standing Dumbbell Press',           'weighted',  'per hand', null, 'shoulders', null),
    (uid, 'Dumbbell Lateral Raise',            'weighted',  'per hand', null, 'shoulders', null),
    (uid, 'Bent Over Dumbbell Tricep Extension','weighted', 'per hand', null, 'triceps', null),
    (uid, 'Dumbbell Bicep Curl',               'weighted',  'per hand', null, 'biceps', null),
    (uid, 'Dumbbell Kroc Row',                 'weighted',  'per hand', 'per arm', 'back', null),
    (uid, 'Dumbbell Shrug',                    'weighted',  'per hand, both held at once', null, 'back', null),
    (uid, 'Dumbbell Weighted Lunge',           'weighted',  'per hand', 'per leg', 'glutes & legs', null),
    (uid, 'Bent Over Cable Fly',               'weighted',  'stack weight', null, 'chest', 'office'),
    (uid, 'Bent Over Band Fly',                'band',      null, null, 'chest', 'home'),
    (uid, 'Pushups',                           'reps_only', null, null, 'chest', null),
    (uid, 'Sit-ups',                           'reps_only', null, null, 'core', null)
  on conflict (user_id, name) do nothing;

  select id into ex_incline  from exercises where user_id = uid and name = 'Incline Dumbbell Press';
  select id into ex_standing from exercises where user_id = uid and name = 'Standing Dumbbell Press';
  select id into ex_lateral  from exercises where user_id = uid and name = 'Dumbbell Lateral Raise';
  select id into ex_tricep   from exercises where user_id = uid and name = 'Bent Over Dumbbell Tricep Extension';
  select id into ex_curl     from exercises where user_id = uid and name = 'Dumbbell Bicep Curl';
  select id into ex_kroc     from exercises where user_id = uid and name = 'Dumbbell Kroc Row';
  select id into ex_shrug    from exercises where user_id = uid and name = 'Dumbbell Shrug';
  select id into ex_lunge    from exercises where user_id = uid and name = 'Dumbbell Weighted Lunge';
  select id into ex_cable    from exercises where user_id = uid and name = 'Bent Over Cable Fly';
  select id into ex_band     from exercises where user_id = uid and name = 'Bent Over Band Fly';
  select id into ex_pushup   from exercises where user_id = uid and name = 'Pushups';
  select id into ex_situp    from exercises where user_id = uid and name = 'Sit-ups';

  -- Routines
  insert into routines (user_id, name, day_of_week, sort_order, notes)
    values (uid, 'Push focus', 1, 1,
            'Warm-up (4 min): arm circles, bodyweight lunges, 10 light pushups')
    returning id into r_mon;
  insert into routines (user_id, name, day_of_week, sort_order, notes)
    values (uid, 'Pull focus', 2, 2,
            'Warm-up (4 min): arm circles, bodyweight lunges, 10 light rows')
    returning id into r_tue;
  insert into routines (user_id, name, day_of_week, sort_order, notes)
    values (uid, 'Full body', 3, 3,
            'Warm-up (4 min): arm circles, bodyweight lunges, 10 light pushups')
    returning id into r_wed;

  -- Monday: push focus
  insert into routine_slots
    (user_id, routine_id, exercise_id, block, superset_group, position, location, target_sets, rep_min, rep_max, note)
  values
    (uid, r_mon, ex_incline,  'superset', 1, 1, 'both',   3, 8, 10, null),
    (uid, r_mon, ex_lunge,    'superset', 1, 2, 'both',   3, 10, 10, null),
    (uid, r_mon, ex_standing, 'superset', 2, 1, 'both',   3, 8, 10, null),
    (uid, r_mon, ex_cable,    'superset', 2, 2, 'office', 3, 12, 15, null),
    (uid, r_mon, ex_band,     'superset', 2, 2, 'home',   3, 12, 15, null),
    (uid, r_mon, ex_tricep,   'superset', 3, 1, 'both',   3, 12, 12, null),
    (uid, r_mon, ex_situp,    'superset', 3, 2, 'both',   3, 15, 20, null),
    (uid, r_mon, ex_pushup,   'finisher', 4, 1, 'both',   null, null, null, 'As many as you can with good form (4 min)');

  -- Tuesday: pull focus
  insert into routine_slots
    (user_id, routine_id, exercise_id, block, superset_group, position, location, target_sets, rep_min, rep_max, note)
  values
    (uid, r_tue, ex_kroc,    'superset', 1, 1, 'both', 3, 10, 15, null),
    (uid, r_tue, ex_pushup,  'superset', 1, 2, 'both', 3, null, null, '3 short of failure'),
    (uid, r_tue, ex_shrug,   'superset', 2, 1, 'both', 3, 12, 15, null),
    (uid, r_tue, ex_lateral, 'superset', 2, 2, 'both', 3, 12, 15, null),
    (uid, r_tue, ex_curl,    'superset', 3, 1, 'both', 3, 10, 12, null),
    (uid, r_tue, ex_situp,   'superset', 3, 2, 'both', 3, 15, 20, null),
    (uid, r_tue, ex_kroc,    'finisher', 4, 1, 'both', null, null, null, 'Lighter weight, high reps, alternate arms (4 min)');

  -- Wednesday: full body
  insert into routine_slots
    (user_id, routine_id, exercise_id, block, superset_group, position, location, target_sets, rep_min, rep_max, note)
  values
    (uid, r_wed, ex_lunge,    'superset', 1, 1, 'both',   3, 10, 10, null),
    (uid, r_wed, ex_kroc,     'superset', 1, 2, 'both',   3, 10, 12, null),
    (uid, r_wed, ex_incline,  'superset', 2, 1, 'both',   3, 10, 12, null),
    (uid, r_wed, ex_cable,    'superset', 2, 2, 'office', 3, 12, 15, null),
    (uid, r_wed, ex_band,     'superset', 2, 2, 'home',   3, 12, 15, null),
    (uid, r_wed, ex_standing, 'superset', 3, 1, 'both',   3, 10, 10, null),
    (uid, r_wed, ex_curl,     'superset', 3, 2, 'both',   3, 12, 12, null),
    (uid, r_wed, ex_tricep,   'finisher', 4, 1, 'both',   null, null, null, 'Alternate with sit-ups, no rest (4 min)'),
    (uid, r_wed, ex_situp,    'finisher', 4, 2, 'both',   null, null, null, 'Alternate with tricep extensions, no rest');
end;
$$;

revoke execute on function public.seed_starter_plan() from public, anon;
grant  execute on function public.seed_starter_plan() to authenticated;
