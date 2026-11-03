-- Finishers are now 2 minutes. Update the starter plan text, and existing finisher notes that say 4 min.
do $$
declare def text;
begin
  select pg_get_functiondef('public.seed_starter_plan()'::regprocedure) into def;
  def := replace(def, '(4 min)', '(2 min)');
  def := replace(def, 'Warm-up (2 min)', 'Warm-up (4 min)');
  execute def;
end $$;

update public.routine_slots set note = replace(note, '(4 min)', '(2 min)')
where block = 'finisher' and note like '%(4 min)%';
