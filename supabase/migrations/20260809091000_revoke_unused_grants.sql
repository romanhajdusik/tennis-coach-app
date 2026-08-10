-- =============================================================================
-- Odobratie práv, ktoré appka nikdy nepoužije
-- =============================================================================
-- Obrana do hĺbky, nie zaplátanie diery: nič z toho dnes zneužiť nejde, lebo
-- RLS aj tak nemá pre tieto operácie žiadnu policy (bez policy = zamietnuté)
-- a TRUNCATE cez PostgREST vôbec nevedie cesta. Ale je to druhá vrstva —
-- keby niekomu neskôr „ušla" permisívna policy, samotný grant už nestačí.
--
-- Ide o zvyšky po predvolených právach Supabase (`grant all on tables to
-- anon, authenticated`) a po plošných `grant select, insert, update, delete`
-- z migrácie `20260705130000_fix_table_grants.sql`.
--
-- Čo appka reálne robí (overené prehľadaním všetkých zápisov v `lib/`):
--   profiles                     — nezapisuje vôbec (meno a rolu plní trigger
--                                  `handle_new_user`, predplatné `service_role`)
--   organizations                — len číta (org zakladá admin cez service_role)
--   organization_members         — insert (pozvánka) + update (removed), NIKDY delete
--   parent_session_* kópie       — píšu do nich len `security definer` triggery
--                                  a `claim_player_connection`, nie appka
-- =============================================================================

revoke insert, delete on public.profiles from authenticated;
revoke insert, update, delete on public.parent_session_records from authenticated;
revoke insert, update, delete on public.parent_session_drill_records from authenticated;
revoke insert, update, delete on public.organizations from authenticated;
revoke delete on public.organization_members from authenticated;


-- ---------------------------------------------------------------------------
-- TRUNCATE / REFERENCES / TRIGGER
-- ---------------------------------------------------------------------------
-- Tieto tri má `anon` aj `authenticated` na KAŽDEJ tabuľke z predvolených práv
-- Supabase. **TRUNCATE nepodlieha RLS** — kto ho dokáže spustiť, vyprázdni
-- tabuľku bez ohľadu na policy. Cez PostgREST sa spustiť nedá (vystavuje len
-- SELECT/INSERT/UPDATE/DELETE a volania funkcií), takže dnes to nie je
-- zneužiteľné; držať také právo pre neprihláseného je však zbytočné riziko do
-- zásoby — stačilo by raz pridať `security invoker` funkciu, ktorá niečo maže.
do $$
declare
  v_table text;
begin
  for v_table in
    select tablename from pg_tables where schemaname = 'public'
  loop
    execute format(
      'revoke truncate, references, trigger on public.%I from anon, authenticated',
      v_table
    );
  end loop;
end;
$$;

-- Aby to isté neplatilo pre tabuľky, ktoré pribudnú neskôr. `service_role`
-- (a `postgres`) ostávajú nedotknuté — odtiaľ beží seed, migrácie aj údržba.
alter default privileges in schema public
  revoke truncate, references, trigger on tables from anon, authenticated;
