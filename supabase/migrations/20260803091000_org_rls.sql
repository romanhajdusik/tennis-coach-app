-- =============================================================================
-- Federačná (B2B) vrstva — DVOJREŽIMOVÁ RLS nad dátovými tabuľkami
-- =============================================================================
-- Záväzné pravidlá: docs/roadmap-buduce-smery.md §5.7.
--
-- Dva režimy vedľa seba na tých istých tabuľkách:
--   • OSOBNÉ riadky (organization_id is null) — pôvodný model samostatného
--     trénera: coach_id = auth.uid(). Správanie sa nemení, len sa policy
--     obmedzí na riadky bez organizácie a na účty bez aktívneho členstva
--     (účet je buď nezávislý, alebo org-zamestnanec — §5.8).
--   • ORG riadky (organization_id = organizácia používateľa):
--       – director  → SELECT-only nad celou organizáciou (dohľad),
--       – coach     → SELECT/INSERT/UPDATE nad hráčmi pridelenými JEMU,
--                     ale ŽIADNY DELETE (dáta vlastní federácia; zrušenie
--                     tréningu sa v B2B robí cez sessions.status = 'cancelled').
--
-- Mazanie org riadkov teda nemá policy pre nikoho — je vyhradené org-adminovi
-- cez service_role. Federácii tak ostáva úplný audit.
-- =============================================================================


-- ---------------------------------------------------------------------------
-- players
-- ---------------------------------------------------------------------------
drop policy "players_all_own" on public.players;

create policy "players_personal_all"
  on public.players for all
  using (
    organization_id is null
    and coach_id = auth.uid()
    and (select public.current_org_id()) is null
  )
  with check (
    organization_id is null
    and coach_id = auth.uid()
    and (select public.current_org_id()) is null
  );

-- Šéftréner vidí celý roster organizácie, tréner len sebe pridelených hráčov
create policy "players_org_select"
  on public.players for select
  using (
    organization_id = (select public.current_org_id())
    and (
      (select public.current_org_role()) = 'director'
      or coach_id = auth.uid()
    )
  );

create policy "players_org_coach_insert"
  on public.players for insert
  with check (
    organization_id = (select public.current_org_id())
    and (select public.current_org_role()) = 'coach'
    and coach_id = auth.uid()
  );

create policy "players_org_coach_update"
  on public.players for update
  using (
    organization_id = (select public.current_org_id())
    and (select public.current_org_role()) = 'coach'
    and coach_id = auth.uid()
  )
  with check (
    organization_id = (select public.current_org_id())
    and (select public.current_org_role()) = 'coach'
    and coach_id = auth.uid()
  );


-- ---------------------------------------------------------------------------
-- sessions
-- ---------------------------------------------------------------------------
drop policy "sessions_select_own" on public.sessions;
drop policy "sessions_insert_active_player" on public.sessions;
drop policy "sessions_update_active_player" on public.sessions;
drop policy "sessions_delete_active_player" on public.sessions;

-- Osobný režim — pôvodné pravidlá (archív aj dokončený tréning read-only)
create policy "sessions_personal_select"
  on public.sessions for select
  using (
    organization_id is null
    and coach_id = auth.uid()
    and (select public.current_org_id()) is null
  );

create policy "sessions_personal_insert"
  on public.sessions for insert
  with check (
    organization_id is null
    and coach_id = auth.uid()
    and (select public.current_org_id()) is null
    and exists (
      select 1 from public.players p
      where p.id = player_id and p.coach_id = auth.uid() and p.is_active = true
    )
  );

create policy "sessions_personal_update"
  on public.sessions for update
  using (
    organization_id is null
    and coach_id = auth.uid()
    and (select public.current_org_id()) is null
    and status <> 'completed'
    and exists (
      select 1 from public.players p
      where p.id = player_id and p.coach_id = auth.uid() and p.is_active = true
    )
  )
  with check (
    organization_id is null
    and coach_id = auth.uid()
    and exists (
      select 1 from public.players p
      where p.id = player_id and p.coach_id = auth.uid() and p.is_active = true
    )
  );

create policy "sessions_personal_delete"
  on public.sessions for delete
  using (
    organization_id is null
    and coach_id = auth.uid()
    and (select public.current_org_id()) is null
    and status <> 'completed'
    and exists (
      select 1 from public.players p
      where p.id = player_id and p.coach_id = auth.uid() and p.is_active = true
    )
  );

-- Org režim — director číta celú organizáciu, tréner svojich hráčov
create policy "sessions_org_select"
  on public.sessions for select
  using (
    organization_id = (select public.current_org_id())
    and (
      (select public.current_org_role()) = 'director'
      or coach_id = auth.uid()
    )
  );

create policy "sessions_org_coach_insert"
  on public.sessions for insert
  with check (
    organization_id = (select public.current_org_id())
    and (select public.current_org_role()) = 'coach'
    and coach_id = auth.uid()
    and exists (
      select 1 from public.players p
      where p.id = player_id
        and p.organization_id = (select public.current_org_id())
        and p.coach_id = auth.uid()
        and p.is_active = true
    )
  );

create policy "sessions_org_coach_update"
  on public.sessions for update
  using (
    organization_id = (select public.current_org_id())
    and (select public.current_org_role()) = 'coach'
    and coach_id = auth.uid()
    and status <> 'completed'
    and exists (
      select 1 from public.players p
      where p.id = player_id
        and p.organization_id = (select public.current_org_id())
        and p.coach_id = auth.uid()
        and p.is_active = true
    )
  )
  with check (
    organization_id = (select public.current_org_id())
    and (select public.current_org_role()) = 'coach'
    and coach_id = auth.uid()
    and exists (
      select 1 from public.players p
      where p.id = player_id
        and p.organization_id = (select public.current_org_id())
        and p.coach_id = auth.uid()
        and p.is_active = true
    )
  );

-- DELETE v org režime zámerne bez policy — tréner nemaže (§5.7), zrušenie
-- naplánovaného tréningu ide cez status = 'cancelled'.


-- ---------------------------------------------------------------------------
-- session_drills
-- ---------------------------------------------------------------------------
drop policy "session_drills_select_own" on public.session_drills;
drop policy "session_drills_insert_active_player" on public.session_drills;
drop policy "session_drills_update_active_player" on public.session_drills;
drop policy "session_drills_delete_active_player" on public.session_drills;

create policy "session_drills_personal_select"
  on public.session_drills for select
  using (
    organization_id is null
    and coach_id = auth.uid()
    and (select public.current_org_id()) is null
  );

create policy "session_drills_personal_insert"
  on public.session_drills for insert
  with check (
    organization_id is null
    and coach_id = auth.uid()
    and (select public.current_org_id()) is null
    and exists (
      select 1
      from public.sessions s
      join public.players p on p.id = s.player_id
      where s.id = session_id and s.coach_id = auth.uid() and p.is_active = true
        and s.status <> 'completed'
    )
  );

create policy "session_drills_personal_update"
  on public.session_drills for update
  using (
    organization_id is null
    and coach_id = auth.uid()
    and (select public.current_org_id()) is null
    and exists (
      select 1
      from public.sessions s
      join public.players p on p.id = s.player_id
      where s.id = session_id and s.coach_id = auth.uid() and p.is_active = true
        and s.status <> 'completed'
    )
  )
  with check (
    organization_id is null
    and coach_id = auth.uid()
    and exists (
      select 1
      from public.sessions s
      join public.players p on p.id = s.player_id
      where s.id = session_id and s.coach_id = auth.uid() and p.is_active = true
        and s.status <> 'completed'
    )
  );

create policy "session_drills_personal_delete"
  on public.session_drills for delete
  using (
    organization_id is null
    and coach_id = auth.uid()
    and (select public.current_org_id()) is null
    and exists (
      select 1
      from public.sessions s
      join public.players p on p.id = s.player_id
      where s.id = session_id and s.coach_id = auth.uid() and p.is_active = true
        and s.status <> 'completed'
    )
  );

create policy "session_drills_org_select"
  on public.session_drills for select
  using (
    organization_id = (select public.current_org_id())
    and (
      (select public.current_org_role()) = 'director'
      or coach_id = auth.uid()
    )
  );

create policy "session_drills_org_coach_insert"
  on public.session_drills for insert
  with check (
    organization_id = (select public.current_org_id())
    and (select public.current_org_role()) = 'coach'
    and coach_id = auth.uid()
    and exists (
      select 1
      from public.sessions s
      join public.players p on p.id = s.player_id
      where s.id = session_id
        and s.organization_id = (select public.current_org_id())
        and s.coach_id = auth.uid()
        and p.is_active = true
        and s.status <> 'completed'
    )
  );

create policy "session_drills_org_coach_update"
  on public.session_drills for update
  using (
    organization_id = (select public.current_org_id())
    and (select public.current_org_role()) = 'coach'
    and coach_id = auth.uid()
    and exists (
      select 1
      from public.sessions s
      join public.players p on p.id = s.player_id
      where s.id = session_id
        and s.organization_id = (select public.current_org_id())
        and s.coach_id = auth.uid()
        and p.is_active = true
        and s.status <> 'completed'
    )
  )
  with check (
    organization_id = (select public.current_org_id())
    and (select public.current_org_role()) = 'coach'
    and coach_id = auth.uid()
    and exists (
      select 1
      from public.sessions s
      join public.players p on p.id = s.player_id
      where s.id = session_id
        and s.organization_id = (select public.current_org_id())
        and s.coach_id = auth.uid()
        and p.is_active = true
        and s.status <> 'completed'
    )
  );


-- ---------------------------------------------------------------------------
-- metrics_and_tests
-- ---------------------------------------------------------------------------
drop policy "metrics_select_own" on public.metrics_and_tests;
drop policy "metrics_insert_active_player" on public.metrics_and_tests;
drop policy "metrics_update_active_player" on public.metrics_and_tests;
drop policy "metrics_delete_active_player" on public.metrics_and_tests;

create policy "metrics_personal_select"
  on public.metrics_and_tests for select
  using (
    organization_id is null
    and coach_id = auth.uid()
    and (select public.current_org_id()) is null
  );

create policy "metrics_personal_insert"
  on public.metrics_and_tests for insert
  with check (
    organization_id is null
    and coach_id = auth.uid()
    and (select public.current_org_id()) is null
    and exists (
      select 1 from public.players p
      where p.id = player_id and p.coach_id = auth.uid() and p.is_active = true
    )
  );

create policy "metrics_personal_update"
  on public.metrics_and_tests for update
  using (
    organization_id is null
    and coach_id = auth.uid()
    and (select public.current_org_id()) is null
    and exists (
      select 1 from public.players p
      where p.id = player_id and p.coach_id = auth.uid() and p.is_active = true
    )
  )
  with check (
    organization_id is null
    and coach_id = auth.uid()
    and exists (
      select 1 from public.players p
      where p.id = player_id and p.coach_id = auth.uid() and p.is_active = true
    )
  );

create policy "metrics_personal_delete"
  on public.metrics_and_tests for delete
  using (
    organization_id is null
    and coach_id = auth.uid()
    and (select public.current_org_id()) is null
    and exists (
      select 1 from public.players p
      where p.id = player_id and p.coach_id = auth.uid() and p.is_active = true
    )
  );

create policy "metrics_org_select"
  on public.metrics_and_tests for select
  using (
    organization_id = (select public.current_org_id())
    and (
      (select public.current_org_role()) = 'director'
      or coach_id = auth.uid()
    )
  );

create policy "metrics_org_coach_insert"
  on public.metrics_and_tests for insert
  with check (
    organization_id = (select public.current_org_id())
    and (select public.current_org_role()) = 'coach'
    and coach_id = auth.uid()
    and exists (
      select 1 from public.players p
      where p.id = player_id
        and p.organization_id = (select public.current_org_id())
        and p.coach_id = auth.uid()
        and p.is_active = true
    )
  );

create policy "metrics_org_coach_update"
  on public.metrics_and_tests for update
  using (
    organization_id = (select public.current_org_id())
    and (select public.current_org_role()) = 'coach'
    and coach_id = auth.uid()
  )
  with check (
    organization_id = (select public.current_org_id())
    and (select public.current_org_role()) = 'coach'
    and coach_id = auth.uid()
    and exists (
      select 1 from public.players p
      where p.id = player_id
        and p.organization_id = (select public.current_org_id())
        and p.coach_id = auth.uid()
        and p.is_active = true
    )
  );


-- ---------------------------------------------------------------------------
-- drill_codes — v organizácii ich vlastní federácia (§5.5)
-- ---------------------------------------------------------------------------
drop policy "drill_codes_all_own" on public.drill_codes;

create policy "drill_codes_personal_all"
  on public.drill_codes for all
  using (
    organization_id is null
    and coach_id = auth.uid()
    and (select public.current_org_id()) is null
  )
  with check (
    organization_id is null
    and coach_id = auth.uid()
    and (select public.current_org_id()) is null
  );

-- Jednotný štandard federácie: tréner ich na /drill-codes iba používa
-- (read-only), aby bola analytika naprieč organizáciou porovnateľná.
create policy "drill_codes_org_select"
  on public.drill_codes for select
  using (organization_id = (select public.current_org_id()));

-- Nastavuje ich šéftréner (Admin) — jediné miesto, kde má director zápis.
create policy "drill_codes_org_director_write"
  on public.drill_codes for all
  using (
    organization_id = (select public.current_org_id())
    and (select public.current_org_role()) = 'director'
  )
  with check (
    organization_id = (select public.current_org_id())
    and (select public.current_org_role()) = 'director'
    and coach_id is null
  );


-- ---------------------------------------------------------------------------
-- player_connections — sledovanie rodičom/hráčom je consumer funkcia (§5.6)
-- ---------------------------------------------------------------------------
-- Vo federačnom svete sú len director a coach; tréningové dáta sú federačne
-- interné, žiadny rodič/hráč login. Org tréner preto nesmie generovať
-- zdieľacie kódy — vynútené aj na úrovni DB, nielen skrytím v UI.
drop policy "player_connections_all_own_coach" on public.player_connections;

create policy "player_connections_all_own_coach"
  on public.player_connections for all
  using (
    coach_id = auth.uid()
    and (select public.current_org_id()) is null
  )
  with check (
    coach_id = auth.uid()
    and (select public.current_org_id()) is null
  );
