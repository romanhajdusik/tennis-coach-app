-- Cvičenie v tréningu môže byť pri review označené ako neodohrané alebo
-- nahradené iným. Náhradné cvičenie sa v zozname zobrazuje hneď za tým,
-- ktoré nahrádza (previazané cez replaces_drill_id).
alter table public.session_drills
  add column status text not null default 'played'
    check (status in ('played', 'not_played', 'replaced')),
  add column replaces_drill_id uuid
    references public.session_drills (id) on delete set null;
