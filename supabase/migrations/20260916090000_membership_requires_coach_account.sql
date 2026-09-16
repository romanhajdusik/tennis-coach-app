-- Do organizácie sa smie pripojiť len účet zaregistrovaný ako TRÉNER.
--
-- Dovtedy sa `profiles.role` pri vstupe do organizácie nekontrolovala nikde:
-- účet rodiča/manažéra/hráča zadal pozývací kód na `/join` a stal sa členom
-- (obsadil aj sedadlo), hoci ho appka potom posielala do rodičovskej časti.
--
-- Kontrola je v triggeri `enforce_membership_rules`, nie v
-- `claim_organization_invite`, lebo cez trigger idú VŠETKY cesty k aktívnemu
-- členstvu: pozývací kód, návrat odobratého trénera aj administrátorské
-- založenie šéftrénera v SQL Editore.
--
-- Telo funkcie je prevzaté doslovne z `20260815090000_fitness_in_federation.sql`
-- (posledná definícia), pribudol len blok (2a). `create or replace` ponecháva
-- vlastníka aj práva funkcie (`20260815120000`, `20260902100000`).
--
-- PRED SPUSTENÍM NA PRODUKCII over, že žiadne aktívne členstvo nepatrí
-- netrénerskému účtu (ďalšia úprava takého riadku by po migrácii zlyhala):
--
--   select o.slug, om.role as clenstvo, p.email, p.role as ucet
--   from public.organization_members om
--   join public.profiles p on p.id = om.user_id
--   join public.organizations o on o.id = om.organization_id
--   where om.status = 'active' and p.role <> 'coach';

create or replace function public.enforce_membership_rules()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_seat_limit integer;
  v_used_seats integer;
begin
  -- (1) Účet k pozvánke pripája výhradne claim_organization_invite. Ani
  -- šéftréner nesmie priradiť cudzí účet priamym zápisom — členstvo je
  -- dobrovoľné (§5.7). Servisné/administrátorské pripojenie (bez prihláseného
  -- používateľa, napr. založenie prvého šéftrénera pri onboardingu) prechádza.
  if tg_op = 'UPDATE'
     and new.user_id is distinct from old.user_id
     and auth.uid() is not null
     and coalesce(current_setting('app.claiming_invite', true), '') <> 'on'
  then
    raise exception 'membership_requires_claim';
  end if;

  -- (1b) Disciplína je po prijatí pozvánky nemenná (viď komentár vyššie).
  if tg_op = 'UPDATE'
     and new.discipline is distinct from old.discipline
     and old.user_id is not null
  then
    raise exception 'discipline_is_fixed';
  end if;

  if new.status = 'active' and new.user_id is not null then
    -- (2) Buď nezávislý, alebo org-zamestnanec (§5.8): kto už vlastní osobných
    -- hráčov, nemôže sa stať členom organizácie — inak by mu osobné dáta
    -- „zmizli" (osobné RLS policy pre org účty neplatia).
    if exists (
      select 1 from public.players p
      where p.coach_id = new.user_id and p.organization_id is null
    ) then
      raise exception 'has_personal_data';
    end if;

    -- (2a) Do organizácie vstupuje len TRÉNERSKÝ účet (rola z registrácie).
    -- Rodič, manažér ani hráč by sa inak pozývacím kódom pripojil a appka by ho
    -- na `/` poslala do rodičovskej časti — `app/page.tsx` rozhoduje podľa
    -- `profiles.role` skôr než podľa členstva. Platí aj pre šéftrénera: aj on
    -- sa registruje ako tréner (docs/onboarding-organizacie.md, krok 5).
    if not exists (
      select 1 from public.profiles pr
      where pr.id = new.user_id and pr.role = 'coach'
    ) then
      raise exception 'coach_account_required';
    end if;

    -- (3) Sedadlá: proti limitu sa počítajú len tréneri, šéftréner sedadlo neberie.
    -- Kondičný tréner berie sedadlo ako každý iný (§2.2 — nemení sa).
    if new.role = 'coach' then
      select o.seat_limit into v_seat_limit
      from public.organizations o
      where o.id = new.organization_id;

      select count(*) into v_used_seats
      from public.organization_members om
      where om.organization_id = new.organization_id
        and om.status = 'active'
        and om.role = 'coach'
        and om.id <> new.id;

      if v_used_seats >= v_seat_limit then
        raise exception 'seat_limit_reached';
      end if;
    end if;
  end if;

  return new;
end;
$$;
