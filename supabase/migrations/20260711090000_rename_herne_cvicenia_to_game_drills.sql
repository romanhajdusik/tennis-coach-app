-- Premenovanie zamerania "Herné cvičenia" na "GAME DRILLS" — existujúce
-- riadky sa migrujú, aby zostali priradené k rovnakému zameraniu.
update public.drill_codes
  set category = 'GAME DRILLS'
  where category = 'Herné cvičenia';

update public.session_drills
  set category = 'GAME DRILLS'
  where category = 'Herné cvičenia';

alter table public.drill_codes
  drop constraint drill_codes_category_check;

alter table public.drill_codes
  add constraint drill_codes_category_check check (category in (
    'Forhand', 'Backhand', 'Volley', 'Return', 'Servis', 'GAME DRILLS', 'POINTS'
  ));
