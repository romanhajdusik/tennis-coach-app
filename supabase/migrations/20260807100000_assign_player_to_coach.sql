-- =============================================================================
-- Preradenie hráča inému trénerovi v organizácii (§5.4 — offboarding trénera)
-- =============================================================================
-- Dáta vlastní ORGANIZÁCIA, `coach_id` je v org režime len PRIRADENIE. Doteraz
-- však priradenie nemal kto zmeniť:
--   * tréner vidí (`players_org_select`) aj upravuje (`players_org_coach_update`)
--     len riadky, kde `coach_id = auth.uid()` → hráča odídeného kolegu si
--     prevziať nemôže, dokonca ho ani nevidí,
--   * šéftréner je nad tréningovými dátami SELECT-only (§5.7).
-- Po odobratí trénera na `/director/team` tak hráči aj celá história ostali
-- federácii, ale nikto s nimi už nemohol pracovať — presne to, čomu má org
-- vlastníctvo dát zabrániť.
--
-- Riešenie je `security definer` RPC, nie uvoľnenie RLS: policy na UPDATE nevie
-- obmedziť, KTORÝ stĺpec sa mení (v jednej policy sa nedá porovnať starý a nový
-- riadok), takže „director smie UPDATE na players" by mu otvorilo aj mená a
-- archiváciu. Funkcia robí práve jednu vec — presunie priradenie — a read-only
-- dohľad podľa §5.7 ostáva nedotknutý. Vzor je prevzatý z
-- `claim_organization_invite`: všetky kontroly sú vnútri funkcie, keďže
-- `security definer` obchádza RLS.
--
-- Presúva sa priradenie na VŠETKÝCH riadkoch hráča (players, sessions,
-- session_drills, metrics_and_tests) — inak by nový tréner videl hráča, ale nie
-- jeho históriu (RLS pre trénera je všade `coach_id = auth.uid()`). To je
-- v súlade s modelom: v org režime je `coach_id` priradenie, nie autorstvo.
-- =============================================================================

create function public.assign_player_to_coach(p_player_id uuid, p_coach_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_player_org uuid;
begin
  -- Volajúci musí byť aktívny šéftréner — členstvo je najviac jedno (§5.8).
  select om.organization_id into v_org_id
  from public.organization_members om
  where om.user_id = auth.uid()
    and om.role = 'director'
    and om.status = 'active';

  if v_org_id is null then
    raise exception 'not_director';
  end if;

  -- Hráč musí patriť organizácii volajúceho (tenant izolácia — funkcia beží
  -- s právami vlastníka, takže RLS ju tu nechráni).
  select p.organization_id into v_player_org
  from public.players p
  where p.id = p_player_id;

  if v_player_org is null or v_player_org <> v_org_id then
    raise exception 'player_not_in_org';
  end if;

  -- Cieľ musí byť aktívny TRÉNER tej istej organizácie. Šéftrénerovi hráča
  -- prideliť nejde: nemá trénerskú appku a §5.7 mu zápis nedovoľuje.
  if not exists (
    select 1
    from public.organization_members om
    where om.user_id = p_coach_id
      and om.organization_id = v_org_id
      and om.role = 'coach'
      and om.status = 'active'
  ) then
    raise exception 'target_not_coach';
  end if;

  update public.players
  set coach_id = p_coach_id
  where id = p_player_id;

  update public.sessions
  set coach_id = p_coach_id
  where player_id = p_player_id
    and organization_id = v_org_id;

  update public.session_drills sd
  set coach_id = p_coach_id
  where sd.organization_id = v_org_id
    and exists (
      select 1 from public.sessions s
      where s.id = sd.session_id and s.player_id = p_player_id
    );

  update public.metrics_and_tests
  set coach_id = p_coach_id
  where player_id = p_player_id
    and organization_id = v_org_id;

  -- Pozn.: `sessions.google_event_id` ostáva ukazovať do kalendára pôvodného
  -- trénera (pripojenie je per účet) — nový tréner udalosti nezdedí. Zdieľanie
  -- s rodičom sa nerieši, v org režime je vypnuté (§5.6).
end;
$$;

grant execute on function public.assign_player_to_coach(uuid, uuid) to authenticated;
