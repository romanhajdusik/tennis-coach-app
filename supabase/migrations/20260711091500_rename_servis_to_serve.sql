-- Premenovanie zamerania "Servis" na "Serve" — existujúce riadky sa
-- migrujú, aby zostali priradené k rovnakému zameraniu. Constraint sa
-- musí zrušiť pred UPDATE, inak by odmietol novú hodnotu "Serve".
alter table public.drill_codes
  drop constraint drill_codes_category_check;

update public.drill_codes
  set category = 'Serve'
  where category = 'Servis';

update public.session_drills
  set category = 'Serve'
  where category = 'Servis';

alter table public.drill_codes
  add constraint drill_codes_category_check check (category in (
    'Forhand', 'Backhand', 'Volley', 'Return', 'Serve', 'GAME DRILLS', 'POINTS'
  ));
