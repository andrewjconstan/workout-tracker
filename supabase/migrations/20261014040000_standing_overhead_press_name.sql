-- Rename the standing press in the starter plan for new accounts.
do $$
declare d text;
begin
  select pg_get_functiondef('public.seed_starter_plan'::regproc) into d;
  d := replace(d, 'Standing Dumbbell Press', 'Standing Overhead Dumbbell Press');
  execute d;
end
$$;
