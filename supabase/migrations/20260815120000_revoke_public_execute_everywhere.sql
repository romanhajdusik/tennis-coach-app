-- =============================================================================
-- Audit 2026-08-15, doplnok: PUBLIC nespúšťa NIČ v schéme `public`
-- =============================================================================
-- Migrácia `20260815110000` odvolala PUBLIC `EXECUTE` menným zoznamom, ktorý
-- vznikol z LOKÁLNEJ databázy. Kontrola proti produkcii ukázala, že tam má
-- explicitné PUBLIC ACL viac funkcií — okrem tých istých `security definer`
-- aj triggerové (`handle_new_user`, `enforce_membership_rules`,
-- `assign_new_org_player`, `sync_*`). Lokálne majú `proacl` prázdne, takže sa
-- v mennom zozname nemali ako objaviť.
--
-- Poučenie je to isté ako pri grantoch v `20260809091000`: **menný zoznam
-- zostavený z lokálu na produkciu nesadne.** Preto sa to tu robí CYKLOM cez
-- skutočný obsah schémy — rovnaký postup, akým sa vtedy odoberali granty
-- role `anon`.
--
-- Dopad tých triggerových funkcií bol aj tak nulový: funkcia vracajúca
-- `trigger` sa cez PostgREST zavolať nedá a PostgreSQL ju mimo triggera
-- odmietne spustiť. Ide o to, aby kontrola „koľko funkcií má PUBLIC EXECUTE"
-- dávala do budúcna jednoznačnú odpoveď — nula.
--
-- POZNÁMKA K PRÁVAM: `revoke … from public` neodoberá explicitné granty pre
-- `authenticated` ani `service_role`, tie ostávajú. Funkcie bez akéhokoľvek
-- explicitného grantu (triggerové) tým prídu o volateľnosť rolou používateľa —
-- čo je presne správne, volá ich databáza sama pri zápise.
-- =============================================================================

do $$
declare
  v_function record;
begin
  for v_function in
    select p.oid::regprocedure as signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prokind in ('f', 'p')  -- funkcie a procedúry, nie agregáty
  loop
    execute format('revoke all on function %s from public', v_function.signature);
  end loop;
end $$;

-- Jediná zámerne verejná funkcia: `proxy.ts` ju volá pri každej požiadavke na
-- org subdoménu, teda aj pre neprihláseného. Cyklus vyššie jej PUBLIC vzal,
-- takže sa tu explicitne vracia to, čo potrebuje — a nič viac. Vracia len
-- `id, name, slug, sport`, žiadne sedadlá ani predplatné.
grant execute on function public.organization_by_slug(text) to anon, authenticated;

-- Poistka pre budúce funkcie (v `20260815110000` už je, opakovanie nevadí):
-- PostgreSQL inak dá PUBLIC EXECUTE na každej novo vytvorenej funkcii.
alter default privileges in schema public
  revoke execute on functions from public;
