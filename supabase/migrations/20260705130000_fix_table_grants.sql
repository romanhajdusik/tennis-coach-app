-- Lokálne migrácie bežia ako rola postgres, ktorej default privileges v schéme
-- public neudeľujú authenticated/service_role SELECT/INSERT/UPDATE/DELETE na
-- nových tabuľkách (Supabase štandardne rieši toto cez rolu supabase_admin,
-- ktorá tu nie je vlastníkom tabuliek). RLS policy bez tohto GRANTu nestačí —
-- Postgres kontrolu privilégií vyhodnocuje pred RLS.
grant select, insert, update, delete on public.profiles to authenticated, service_role;
grant select, insert, update, delete on public.players to authenticated, service_role;
grant select, insert, update, delete on public.sessions to authenticated, service_role;
grant select, insert, update, delete on public.metrics_and_tests to authenticated, service_role;

-- Aby ten istý problém nenastal pri tabuľkách z budúcich migrácií
alter default privileges for role postgres in schema public
  grant select, insert, update, delete on tables to authenticated, service_role;
