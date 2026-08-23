-- Premenovanie dvoch rezervných kondičných zameraní (návrh testerov, 2026-08-22):
--
--   „YOUR 1" → „WARM UP - COOL DOWN"
--   „YOUR 2" → „REGENERATION"
--
-- Rezervné sloty vznikli ako miesto, kam si tréner dá čokoľvek vlastné, ale
-- testerom sa v praxi zaplnili práve rozcvičkou/vyklusaním a regeneráciou.
-- Zameranie ostáva KONFIGURÁCIA s pevným názvom (premenovateľné zameranie by
-- muselo byť dáta) — mení sa teda názov v konfigurácii aj v už zapísaných
-- riadkoch, nie model.
--
-- POZOR NA POMLČKU: v názve je zámerne spojovník, NIE lomka. Zameranie ide do
-- adresy analytiky (`/analytics/[category]`, `encodeURIComponent`), takže lomka
-- v názve by v ceste skončila ako `%2F` a rozbila by segment routy.
--
-- Poradie je dané: CHECK sa musí zrušiť pred UPDATE, inak odmietne novú
-- hodnotu. Rovnaký postup ako pri `20260728120000_rename_forhand_to_forehand`.

alter table public.drill_codes
  drop constraint drill_codes_category_check;

update public.drill_codes
  set category = 'WARM UP - COOL DOWN'
  where category = 'YOUR 1';

update public.drill_codes
  set category = 'REGENERATION'
  where category = 'YOUR 2';

update public.session_drills
  set category = 'WARM UP - COOL DOWN'
  where category = 'YOUR 1';

update public.session_drills
  set category = 'REGENERATION'
  where category = 'YOUR 2';

-- Rodičovské KÓPIE sa musia premenovať tiež, inak by sledujúcemu ostali
-- tréningy visieť pod zameraním, ktoré už neexistuje, a v jeho analytike by
-- vypadli z rozpadu. Predošlá premenovacia migrácia (Forhand → Forehand) na to
-- zabudla — vtedy kondička ešte nebola, ale rodičovské kópie už áno.
update public.parent_session_drill_records
  set category = 'WARM UP - COOL DOWN'
  where category = 'YOUR 1';

update public.parent_session_drill_records
  set category = 'REGENERATION'
  where category = 'YOUR 2';

alter table public.drill_codes
  add constraint drill_codes_category_check check (category in (
    -- tenis
    'Forehand', 'Backhand', 'Volley', 'Return', 'Serve', 'GAME DRILLS', 'POINTS',
    -- kondička
    'ENDURANCE', 'STRENGTH', 'SPEED', 'FOOTWORK', 'COORDINATION', 'MOBILITY',
    'CORE MUSCLES', 'STRETCHING', 'WARM UP - COOL DOWN', 'REGENERATION'
  ));
