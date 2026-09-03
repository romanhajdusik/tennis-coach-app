-- Sledujúci (rodič / manažér / hráč) si vie zrušiť VLASTNÉ prepojenie.
--
-- Do 2026-09-02 to vedel výhradne tréner: `revokeConnection` filtruje na
-- `coach_id` a sledujúci má na `player_connections` len SELECT policy
-- (`player_connections_select_own_parent`). Kto chcel prestať dostávať nové
-- záznamy, musel si zmazať celý účet — a tým prišiel aj o doterajšie kópie,
-- čo je presne to, čomu má rodičovská vrstva zabrániť.
--
-- **Prečo `security definer` funkcia a nie UPDATE policy:** policy na UPDATE
-- nevie obmedziť, KTORÝ stĺpec sa mení (v jednej policy sa nedá porovnať starý
-- a nový riadok), takže „sledujúci smie UPDATE na svojom riadku" by mu otvorilo
-- aj `player_id`, `coach_id` a `connect_code`. Rovnaký dôvod a rovnaký vzor ako
-- pri `assign_player_to_coach`, `revoke_player_link` a `delete_organization_member`.
--
-- **Funkcia nemá parameter a je to zámer.** Sledujúci má naraz najviac jedno
-- aktívne prepojenie (`one_active_connection_per_parent`), takže si ho netreba
-- vyberať — a keď si ho nevyberá, nemôže ani ukázať na cudzí riadok. Rovnaký
-- princíp ako `follower_linked_category_minutes`, ktorá si hráča tiež odvodí.
--
-- **Kópie sa NEMAŽÚ.** Zrušením sa len zastaví synchronizácia;
-- `parent_session_records` a `parent_session_drill_records` ostávajú, presne
-- ako keď prepojenie zruší tréner. To je celý zmysel toho, že rodičovská vrstva
-- stojí na kópiách a nie na živom pohľade.

create function public.revoke_my_connection()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- PostgREST vystavuje funkciu aj priamo, nielen cez appku — bez tejto
  -- kontroly by `auth.uid()` bolo NULL a `update` by neurobil nič, čo je síce
  -- neškodné, ale mlčky. Rovnaká stráž ako v `claim_player_connection`
  -- (migrácia 20260809090000).
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  update public.player_connections
  set status = 'revoked'
  where parent_id = auth.uid()
    and status = 'active';
end;
$$;

-- PostgreSQL dáva PUBLIC právo EXECUTE na každej novej funkcii, kým sa to
-- neodvolá (viď migráciu 20260815120000).
--
-- **`from public` NESTAČÍ a overili sme si to na produkcii (2026-09-02).**
-- Odoberie len právo roly PUBLIC, ale predvolené práva schémy dajú novej
-- funkcii aj EXPLICITNÝ grant pre `anon`, `authenticated` a `service_role` —
-- ten `revoke ... from public` nezmaže. Po spustení tejto migrácie mala funkcia
-- v `proacl` aj `anon=X`. Je to presne zásada „`grant` nič neodoberá, over si
-- skutočný stav" z CLAUDE.md. **Pri každej ďalšej `security definer` funkcii
-- odoberaj `anon` výslovne** a stav si potom prečítaj z `pg_proc.proacl`.
revoke all on function public.revoke_my_connection() from public;
revoke all on function public.revoke_my_connection() from anon;
grant execute on function public.revoke_my_connection() to authenticated;
