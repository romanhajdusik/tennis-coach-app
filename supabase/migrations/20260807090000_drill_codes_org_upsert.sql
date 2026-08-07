-- =============================================================================
-- Kódy cvičení organizácie — unikát použiteľný pre ON CONFLICT
-- =============================================================================
-- Šéftréner ukladá federačný štandard naraz (20 slotov v zameraní), takže
-- appka potrebuje upsert. Doterajší unikát bol ale ČIASTOČNÝ index
-- (`where organization_id is not null`) a taký Postgres pri `ON CONFLICT`
-- neinferuje — upsert padal na „no unique or exclusion constraint matching
-- the ON CONFLICT specification".
--
-- Nahrádzame ho plnohodnotným unikátom nad tou istou trojicou. Správanie sa
-- nemení: osobné kódy trénera majú `organization_id` NULL a NULL hodnoty sú
-- v unikáte navzájom odlišné, takže si tie riadky naďalej nekolidujú (ich
-- vlastný unikát `(coach_id, category, slot)` platí ďalej).
-- =============================================================================

drop index if exists drill_codes_organization_slot;

alter table public.drill_codes
  add constraint drill_codes_organization_slot
  unique (organization_id, category, slot);
