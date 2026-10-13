-- Separate finisher sets from working sets, so a lighter finisher (e.g. Kroc rows)
-- never pollutes the working-set history and trends for the same exercise.
alter table public.sets
  add column block text not null default 'superset' check (block in ('superset', 'finisher'));

alter table public.sets drop constraint sets_workout_id_exercise_id_set_number_key;
alter table public.sets
  add constraint sets_workout_exercise_block_set_key unique (workout_id, exercise_id, block, set_number);
