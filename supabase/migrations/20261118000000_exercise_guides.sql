-- Exercise guides: short how-to content shown in a pop-up sheet while logging.
-- guide: {summary, setup[], how[], focus[], avoid[]}; animation: key of a drawn animation in the app;
-- setup_note: the person's own machine settings, editable from the sheet.
alter table public.exercises
  add column guide jsonb,
  add column animation text,
  add column setup_note text;
