-- =============================================================================
-- Prepojenie s rodičom smie viesť LEN na vlastného hráča trénera
-- =============================================================================
-- Diera (nájdená a overená útokom 2026-08-07): policy
-- `player_connections_all_own_coach` overovala iba `coach_id = auth.uid()` —
-- teda že si riadok priznávam sám sebe. NEOVEROVALA, či `player_id` patrí
-- mne. Ktokoľvek s účtom si tak vedel vložiť riadok
--   { coach_id: ja, player_id: <cudzie UUID>, parent_id: ja, status: 'active' }
-- a tým si cez policy `players_select_connected_parent` otvoriť cudzieho
-- hráča; `claim_player_connection` (security definer) mu potom do vlastných
-- `parent_session_records` skopírovala celú históriu tréningov aj s poznámkami.
--
-- Najzávažnejší dôsledok: ODVOLANIE PRÍSTUPU SA NEDALO VYNÚTIŤ. Rodič, ktorému
-- tréner prístup zrušil, si ho takto sám obnovil (UUID hráča si zapamätal —
-- kým bol pripojený, čítal ho bežným selectom) a chodili mu ďalej aj NOVÉ
-- tréningy. Dierou sa dalo siahnuť aj na hráčov federácie, hoci org režim
-- zdieľanie s rodičom zámerne nemá (§5.6).
--
-- Ostatné tabuľky túto kontrolu mali od začiatku — `sessions`,
-- `session_drills` aj `metrics_and_tests` majú vo svojich policy
-- `exists (select 1 from players p where p.id = player_id and p.coach_id = auth.uid())`.
-- `player_connections` bola jediná výnimka. Táto migrácia ju zarovnáva.
-- =============================================================================


-- ---------------------------------------------------------------------------
-- Prečo cez funkciu a nie priamym poddotazom na `players`
-- ---------------------------------------------------------------------------
-- Priamy `exists (select 1 from public.players …)` v tejto policy skončí na
-- `ERROR: infinite recursion detected in policy for relation "players"`
-- (overené). Cyklus: policy nad `player_connections` sa pýta na `players` →
-- tam platí `players_select_connected_parent`, ktorá sa pýta na
-- `player_connections` → a sme naspäť. `security definer` funkcia RLS
-- v poddotaze obíde a cyklus preruší.
--
-- Je to ten istý dôvod, pre ktorý cez funkcie chodia aj `current_org_id()`
-- a `is_active_member_of_my_org()` (§5.7).
--
-- Funkcia nič nevyzrádza: vracia len boolean o hráčovi VOLAJÚCEHO, a vlastných
-- hráčov si volajúci vie aj tak vypísať. `organization_id is null` v nej je
-- zámerne — federačného hráča nesmie zdieľať ani samostatný účet.
create or replace function public.owns_personal_player(p_player_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.players p
    where p.id = p_player_id
      and p.coach_id = auth.uid()
      and p.organization_id is null
  );
$$;

revoke all on function public.owns_personal_player(uuid) from public;
grant execute on function public.owns_personal_player(uuid) to authenticated;


-- ---------------------------------------------------------------------------
-- Sanácia: čo dierou vzniklo, zrušiť
-- ---------------------------------------------------------------------------
-- Legitímny riadok vzniká vždy tak, že tréner vygeneruje kód vlastnému
-- osobnému hráčovi — `player_connections.coach_id` sa teda rovná
-- `players.coach_id` a hráč nie je federačný. Čokoľvek iné je buď pozostatok
-- zneužitia, alebo dáta, ktoré by novú policy aj tak neprešli a tréner by ich
-- už nevedel odvolať.
--
-- Zrušíme ich (status = 'revoked'), NEMAŽEME — riadok ostáva ako stopa a
-- zároveň sa tým zastaví priebežná synchronizácia do `parent_session_records`
-- (triggery `sync_session_to_parent`/`sync_drill_to_parent` kopírujú len pri
-- aktívnom prepojení).
--
-- POZOR: už skopírované riadky v `parent_session_records` týmto NEZMIZNÚ —
-- kópie zámerne prežívajú aj zrušenie prepojenia (rodič nesmie prísť
-- o históriu). Ak by sanácia niečo našla, treba kópie posúdiť samostatne;
-- kontrolný dotaz je v CLAUDE.md v sekcii o zdieľaní.
update public.player_connections pc
set status = 'revoked'
from public.players p
where p.id = pc.player_id
  and pc.status <> 'revoked'
  and (pc.coach_id <> p.coach_id or p.organization_id is not null);


-- ---------------------------------------------------------------------------
-- Policy s kontrolou vlastníctva hráča
-- ---------------------------------------------------------------------------
-- `using` aj `with check` musia mať podmienku obe: `using` bráni siahnuť na
-- existujúci riadok, `with check` bráni vyrobiť nový (a prepísať `player_id`
-- na cudzí). Rodičova strana sa nemení — tú rieši samostatná permisívna policy
-- `player_connections_select_own_parent` a claim beží ako `security definer`,
-- takže sa tejto policy netýka.
drop policy "player_connections_all_own_coach" on public.player_connections;

create policy "player_connections_all_own_coach"
  on public.player_connections
  for all
  using (
    coach_id = auth.uid()
    and (select public.current_org_id()) is null
    and (select public.owns_personal_player(player_connections.player_id))
  )
  with check (
    coach_id = auth.uid()
    and (select public.current_org_id()) is null
    and (select public.owns_personal_player(player_connections.player_id))
  );
