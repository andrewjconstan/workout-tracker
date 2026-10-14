-- The flys are chest flys, not bent-over rear-delt flys: rename them and tag them as chest for swap suggestions.
do $$
declare d text;
begin
  select pg_get_functiondef('public.seed_starter_plan'::regproc) into d;
  d := replace(d, 'Bent Over Cable Fly', 'Cable Chest Fly');
  d := replace(d, 'Bent Over Band Fly', 'Band Chest Fly');
  d := replace(d, '''back'', ''office''', '''chest'', ''office''');
  d := replace(d, '''back'', ''home''', '''chest'', ''home''');
  execute d;
end
$$;
