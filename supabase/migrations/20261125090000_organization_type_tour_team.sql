-- Typ organizácie `tour_team` (2026-11-25, prvý tour team `teamsiniakova`).
--
-- Tím okolo jedného hráča na okruhu je vlastná organizácia s vlastnou adresou
-- a pultom (stránka /federation ho ponúka ako samostatný blok). Dovtedy
-- databáza poznala len federation/club/academy. Appka typ nikde nečíta ani
-- nezobrazuje — je to evidencia, takže sa kód nemení.

alter table public.organizations drop constraint organizations_type_check;

alter table public.organizations
  add constraint organizations_type_check
  check (type in ('federation', 'club', 'academy', 'tour_team'));
