-- =============================================================================
-- Neprihlásený nemá na verejných tabuľkách čo hľadať
-- =============================================================================
-- Doplnok k `20260809091000_revoke_unused_grants.sql`. Tá vychádzala z LOKÁLNEJ
-- databázy, kde `anon` žiadne DML práva nemal — bralo mu teda len
-- TRUNCATE/REFERENCES/TRIGGER. Na PRODUKCII má `anon` navyše
-- SELECT/INSERT/UPDATE/DELETE na každej tabuľke (zvyšok predvolených práv
-- Supabase `grant all on tables to anon, authenticated`), takže tam to
-- podstatné ostalo nedotknuté.
--
-- **Ponaučenie: lokálne granty sa nerovnajú produkčným.** Lokálna inštancia
-- vznikla neskôr a s inými predvolenými právami. Pri ďalšej práci s grantmi
-- over stav dotazom proti produkcii, nespoliehaj sa na `supabase start`.
--
-- Zneužiteľné to nebolo: RLS je zapnutá na každej tabuľke a všetky policy sa
-- pýtajú na `auth.uid()`, ktoré je pre neprihláseného NULL — porovnanie s NULL
-- nie je nikdy pravdivé, takže SELECT vráti nula riadkov a zápisy RLS zamietne.
-- Je to druhá vrstva, nie záplata.
--
-- `anon` nepotrebuje na verejných tabuľkách nič: verejné stránky (landing,
-- návody, rozcestník) do databázy nechodia, prihlásenie a registrácia idú cez
-- schému `auth`, a organizáciu si `proxy.ts` pred prihlásením číta cez
-- `security definer` funkciu `organization_by_slug` — tá beží s právami
-- vlastníka, takže jej stačí EXECUTE, nie prístup k tabuľke.
-- =============================================================================

do $$
declare
  v_table text;
begin
  for v_table in
    select tablename from pg_tables where schemaname = 'public'
  loop
    execute format('revoke all on public.%I from anon', v_table);
  end loop;
end;
$$;

-- Aj pre tabuľky, ktoré pribudnú neskôr.
alter default privileges in schema public revoke all on tables from anon;
