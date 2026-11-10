-- Least privilege. Row-level security already hides every row from anon, but anon should not hold
-- table privileges at all, and signed-in users never need TRUNCATE / REFERENCES / TRIGGER.
revoke all on public.exercises, public.routines, public.routine_slots, public.workouts,
              public.sets, public.workout_exercise_notes from anon;
revoke truncate, references, trigger on public.exercises, public.routines, public.routine_slots,
              public.workouts, public.sets, public.workout_exercise_notes from authenticated;
