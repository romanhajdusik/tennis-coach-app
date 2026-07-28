-- Premenovanie zamerania "Forhand" (slovenský pravopis) na správny anglický
-- "Forehand" — existujúce riadky sa migrujú, aby zostali priradené k
-- rovnakému zameraniu. Constraint sa musí zrušiť pred UPDATE, inak by odmietol
-- novú hodnotu "Forehand".
alter table public.drill_codes
  drop constraint drill_codes_category_check;

update public.drill_codes
  set category = 'Forehand'
  where category = 'Forhand';

update public.session_drills
  set category = 'Forehand'
  where category = 'Forhand';

alter table public.drill_codes
  add constraint drill_codes_category_check check (category in (
    'Forehand', 'Backhand', 'Volley', 'Return', 'Serve', 'GAME DRILLS', 'POINTS'
  ));
