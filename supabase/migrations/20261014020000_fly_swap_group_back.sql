-- The bent-over flys train rear delts and upper back, so they swap with rows, not pressing exercises.
do $$
declare d text;
begin
  select pg_get_functiondef('public.seed_starter_plan'::regproc) into d;
  d := replace(d, '''chest'', ''office''', '''back'', ''office''');
  d := replace(d, '''chest'', ''home''', '''back'', ''home''');
  execute d;
end
$$;
