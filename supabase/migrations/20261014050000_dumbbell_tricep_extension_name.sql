-- Shorter name for the tricep extension in the starter plan for new accounts.
do $$
declare d text;
begin
  select pg_get_functiondef('public.seed_starter_plan'::regproc) into d;
  d := replace(d, 'Bent Over Dumbbell Tricep Extension', 'Dumbbell Tricep Extension');
  execute d;
end
$$;
