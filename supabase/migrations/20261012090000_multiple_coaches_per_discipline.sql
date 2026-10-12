-- ===========================================================================
-- Viac trénerov tej istej disciplíny pri jednom hráčovi (2026-10-12)
-- ===========================================================================
-- Rozhodol user pri tour teamoch: 95 % hráčov na okruhu má dvoch tenisových
-- a dvoch kondičných trénerov, ktorí sa striedajú po mesiacoch (jeden mesiac
-- zapisuje tr1, ďalší tr2) a každý musí vidieť, čo robil kolega. Platí pre
-- KAŽDÚ organizáciu (zväz, klub, akadémia, tour team) — v zväzoch má často
-- skupina 2–3 trénerov na starosti 6–10 hráčov.
--
-- ROZHODNUTIA (user, 2026-10-12):
--   1. Všetci tréneri disciplíny sú pri hráčovi priradení STÁLE a každý smie
--      kedykoľvek zapisovať nové tréningy.
--   2. Dokončený tréning ostáva navždy podpísaný tým, kto ho viedol —
--      priradenie sa už NEPREPISUJE do histórie (dovtedy `assign_player_to_coach`
--      prepísal `coach_id` celej histórie na nového trénera).
--   3. Odobratie trénera od hráča ZRUŠÍ jeho naplánované tréningy s tým
--      hráčom (`status = 'cancelled'`, org nemaže). Nasledujúci tréner si plán
--      zostaví sám podľa histórie.
--   4. Priradenie aj odobratie sa robí HROMADNE (zoznam hráčov × zoznam
--      trénerov) — pomenované skupiny zámerne nie.
--
-- ČO SA NEMENÍ: zápis. `sessions_org_coach_insert`/`update` aj policy nad
-- cvičeniami naďalej žiadajú `coach_id = auth.uid()`, takže tréner upraví len
-- tréning, ktorý sám založil — do kolegovho nezasiahne. Samostatný tréner
-- (`organization_id is null`) tabuľku priradení nepoužíva vôbec.


-- ---------------------------------------------------------------------------
-- A. Unikát: jeden riadok na dvojicu hráč × tréner (v rámci disciplíny)
-- ---------------------------------------------------------------------------
drop index public.player_assignments_one_coach_per_discipline;

create unique index player_assignments_one_row_per_coach
  on public.player_assignments (player_id, discipline, coach_id);

comment on table public.player_assignments is
  'Priradenie hráča trénerovi v organizácii, po disciplínach. Hráč môže mať v disciplíne viac trénerov naraz (od 20261012090000). Nahrádza players.coach_id ako kľúč prístupu v org režime. Osobní hráči tu riadok nemajú.';


-- ---------------------------------------------------------------------------
-- B. Nový hráč — priradenie autorovi (zmenil sa len cieľ ON CONFLICT)
-- ---------------------------------------------------------------------------
create or replace function public.assign_new_org_player()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_discipline text;
  v_sport text;
begin
  if new.organization_id is null then
    return new;
  end if;

  select om.discipline into v_discipline
  from public.organization_members om
  where om.user_id = new.coach_id
    and om.organization_id = new.organization_id
    and om.status = 'active';

  if v_discipline is null then
    select o.sport into v_sport
    from public.organizations o
    where o.id = new.organization_id;

    v_discipline := case
      when v_sport in ('tennis', 'padel', 'badminton', 'pickleball') then v_sport
      else 'tennis'
    end;
  end if;

  insert into public.player_assignments (organization_id, player_id, coach_id, discipline)
  values (new.organization_id, new.id, new.coach_id, v_discipline)
  on conflict (player_id, discipline, coach_id) do nothing;

  return new;
end;
$$;


-- ---------------------------------------------------------------------------
-- C. Čítanie len cez PRIRADENIE
-- ---------------------------------------------------------------------------
-- Doteraz stačilo aj `coach_id = auth.uid()`. Kým preradenie prepisovalo
-- `coach_id`, bolo to jedno; teraz dokončené tréningy ostávajú podpísané
-- trénerom aj po tom, čo ho šéftréner od hráča odoberie — a ten ich už vidieť
-- nemá (patria organizácii, nie jemu). Autor riadku je vždy aj priradený
-- (zápis to vyžaduje), takže pracujúcemu trénerovi sa nič neuberá.
drop policy "sessions_org_select" on public.sessions;

create policy "sessions_org_select"
  on public.sessions for select
  using (
    organization_id = (select public.current_org_id())
    and (
      (select public.current_org_role()) = 'director'
      or public.is_assigned_player(player_id)
    )
  );

drop policy "session_drills_org_select" on public.session_drills;

create policy "session_drills_org_select"
  on public.session_drills for select
  using (
    organization_id = (select public.current_org_id())
    and (
      (select public.current_org_role()) = 'director'
      or exists (
        select 1
        from public.sessions s
        where s.id = session_id
          and public.is_assigned_player(s.player_id)
      )
    )
  );

-- Testy (modul je odložený, tabuľka existuje) — rovnaké pravidlo ako tréningy,
-- aby kolega videl aj ich, keď modul raz príde.
drop policy "metrics_org_select" on public.metrics_and_tests;

create policy "metrics_org_select"
  on public.metrics_and_tests for select
  using (
    organization_id = (select public.current_org_id())
    and (
      (select public.current_org_role()) = 'director'
      or public.is_assigned_player(player_id)
    )
  );


-- ---------------------------------------------------------------------------
-- D. Hromadné priradenie: hráči × tréneri
-- ---------------------------------------------------------------------------
-- Disciplínu priradenia určuje ČLENSTVO trénera (ako doteraz), takže jedným
-- volaním sa dá priradiť tenisového aj kondičného trénera naraz.
-- Existujúce priradenie sa ticho preskočí. Vracia počet NOVÝCH priradení.
create function public.add_player_coaches(p_player_ids uuid[], p_coach_ids uuid[])
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_count integer;
begin
  select om.organization_id into v_org_id
  from public.organization_members om
  where om.user_id = auth.uid()
    and om.role = 'director'
    and om.status = 'active';

  if v_org_id is null then
    raise exception 'not_director';
  end if;

  if coalesce(cardinality(p_player_ids), 0) = 0
     or coalesce(cardinality(p_coach_ids), 0) = 0 then
    raise exception 'nothing_selected';
  end if;

  -- Každý hráč musí patriť tejto organizácii — inak by sa dal cez cudzie id
  -- pripojiť tréner k hráčovi iného zväzu.
  if exists (
    select 1
    from unnest(p_player_ids) as ids(id)
    left join public.players p on p.id = ids.id
    where p.id is null or p.organization_id is distinct from v_org_id
  ) then
    raise exception 'player_not_in_org';
  end if;

  -- Každý cieľ musí byť AKTÍVNY TRÉNER tejto organizácie. Šéftrénerovi hráča
  -- prideliť nejde: nemá trénerskú appku a §5.7 mu zápis nedovoľuje.
  if exists (
    select 1
    from unnest(p_coach_ids) as ids(id)
    where not exists (
      select 1
      from public.organization_members om
      where om.user_id = ids.id
        and om.organization_id = v_org_id
        and om.role = 'coach'
        and om.status = 'active'
    )
  ) then
    raise exception 'target_not_coach';
  end if;

  insert into public.player_assignments (organization_id, player_id, coach_id, discipline)
  select v_org_id, player_ids.id, om.user_id, om.discipline
  from (select distinct unnest(p_player_ids) as id) as player_ids
  cross join (select distinct unnest(p_coach_ids) as id) as coach_ids
  join public.organization_members om
    on om.user_id = coach_ids.id
   and om.organization_id = v_org_id
   and om.role = 'coach'
   and om.status = 'active'
  on conflict (player_id, discipline, coach_id) do nothing;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.add_player_coaches(uuid[], uuid[]) from public;
revoke all on function public.add_player_coaches(uuid[], uuid[]) from anon;
grant execute on function public.add_player_coaches(uuid[], uuid[]) to authenticated;


-- ---------------------------------------------------------------------------
-- E. Hromadné odobratie: hráči × tréneri
-- ---------------------------------------------------------------------------
-- Tréner môže byť aj NEAKTÍVNY člen (odišiel z organizácie, jeho priradenia
-- ostali) — šéftréner ho od hráčov musí vedieť odobrať.
-- Naplánované tréningy toho trénera s tými hráčmi sa ZRUŠIA (rozhodnutie 3).
-- Dokončené ostávajú nedotknuté a podpísané ním. Vracia počet odobratých
-- priradení.
create function public.remove_player_coaches(p_player_ids uuid[], p_coach_ids uuid[])
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_count integer;
begin
  select om.organization_id into v_org_id
  from public.organization_members om
  where om.user_id = auth.uid()
    and om.role = 'director'
    and om.status = 'active';

  if v_org_id is null then
    raise exception 'not_director';
  end if;

  if coalesce(cardinality(p_player_ids), 0) = 0
     or coalesce(cardinality(p_coach_ids), 0) = 0 then
    raise exception 'nothing_selected';
  end if;

  if exists (
    select 1
    from unnest(p_player_ids) as ids(id)
    left join public.players p on p.id = ids.id
    where p.id is null or p.organization_id is distinct from v_org_id
  ) then
    raise exception 'player_not_in_org';
  end if;

  with removed as (
    delete from public.player_assignments pa
    where pa.organization_id = v_org_id
      and pa.player_id = any (p_player_ids)
      and pa.coach_id = any (p_coach_ids)
    returning pa.player_id, pa.coach_id, pa.discipline
  ),
  cancelled as (
    update public.sessions s
    set status = 'cancelled'
    from removed r
    where s.organization_id = v_org_id
      and s.player_id = r.player_id
      and s.coach_id = r.coach_id
      and s.discipline = r.discipline
      and s.status = 'planned'
    returning s.id
  )
  select count(*) into v_count from removed;

  return v_count;
end;
$$;

revoke all on function public.remove_player_coaches(uuid[], uuid[]) from public;
revoke all on function public.remove_player_coaches(uuid[], uuid[]) from anon;
grant execute on function public.remove_player_coaches(uuid[], uuid[]) to authenticated;


-- ---------------------------------------------------------------------------
-- F. Staré preradenie zaniká
-- ---------------------------------------------------------------------------
-- Prepisovalo `coach_id` celej histórie (rozhodnutie 2) a pri viacerých
-- trénerov by nevedelo, koho nahrádza. Výmena trénera = pridať + odobrať.
drop function public.assign_player_to_coach(uuid, uuid);


-- ---------------------------------------------------------------------------
-- G. Skupinový tréning — komu patrí kópia
-- ---------------------------------------------------------------------------
-- Ak je zapisujúci tréner priradený aj cieľovému hráčovi, kópia je JEHO (je to
-- jeho tréning). Inak pripadne najdlhšie priradenému aktívnemu trénerovi tej
-- disciplíny — pri jednom trénerovi presne ako doteraz.
create or replace function public.copy_session_to_org_player(p_session_id uuid, p_target_player_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_discipline text;
  v_source public.sessions;
  v_target public.players;
  v_target_coach uuid;
  v_planned_date text;
  v_new_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  select om.organization_id, om.discipline into v_org_id, v_discipline
  from public.organization_members om
  where om.user_id = auth.uid()
    and om.role = 'coach'
    and om.status = 'active';

  if v_org_id is null then
    raise exception 'not_org_coach';
  end if;

  -- Zdrojom smie byť len VLASTNÝ tréning volajúceho — inak by sa skopírovaním
  -- dal prečítať tréning kolegu u hráča, ktorého volajúci nemá.
  select * into v_source
  from public.sessions s
  where s.id = p_session_id
    and s.organization_id = v_org_id
    and s.coach_id = auth.uid();

  if not found then
    raise exception 'source_not_found';
  end if;

  select * into v_target
  from public.players p
  where p.id = p_target_player_id
    and p.organization_id = v_org_id
    and p.is_active = true;

  if not found then
    raise exception 'target_not_found';
  end if;

  if v_target.id = v_source.player_id then
    raise exception 'same_player';
  end if;

  if not exists (
    select 1
    from public.player_assignments pa
    where pa.player_id = v_target.id
      and pa.discipline = v_source.discipline
  ) then
    raise exception 'target_not_found';
  end if;

  if exists (
    select 1
    from public.player_assignments pa
    where pa.player_id = v_target.id
      and pa.discipline = v_source.discipline
      and pa.coach_id = auth.uid()
  ) then
    v_target_coach := auth.uid();
  else
    select pa.coach_id into v_target_coach
    from public.player_assignments pa
    join public.organization_members om
      on om.user_id = pa.coach_id
     and om.organization_id = v_org_id
     and om.role = 'coach'
     and om.status = 'active'
    where pa.player_id = v_target.id
      and pa.discipline = v_source.discipline
    order by pa.created_at, pa.coach_id
    limit 1;
  end if;

  if v_target_coach is null then
    raise exception 'target_coach_inactive';
  end if;

  v_planned_date := v_source.planned_data ->> 'date';

  if v_planned_date is not null and exists (
    select 1
    from public.sessions s
    where s.player_id = v_target.id
      and s.status <> 'cancelled'
      and s.discipline = v_source.discipline
      and s.planned_data ->> 'date' = v_planned_date
  ) then
    raise exception 'duplicate_practice';
  end if;

  insert into public.sessions (
    coach_id, organization_id, player_id, status, planned_data, actual_data,
    notes, discipline
  )
  values (
    v_target_coach, v_org_id, v_target.id, 'planned',
    v_source.planned_data, v_source.actual_data, v_source.notes,
    v_source.discipline
  )
  returning id into v_new_id;

  insert into public.session_drills (
    session_id, coach_id, organization_id, category, character, drill_code,
    duration_minutes, status, sort_order
  )
  select
    v_new_id, v_target_coach, v_org_id, d.category, d.character, d.drill_code,
    d.duration_minutes, d.status, d.sort_order
  from public.session_drills d
  where d.session_id = p_session_id
  order by d.sort_order;

  return v_new_id;
end;
$$;

-- Ponuka na skopírovanie: JEDEN riadok na hráča (dovtedy riadok na priradenie,
-- s viacerými trénermi by sa hráč v ponuke opakoval). Meno trénera je ten,
-- komu kópia pripadne — teda volajúci, ak hráča má, inak najdlhšie priradený.
create or replace function public.org_players_for_copy()
returns table (id uuid, name text, coach_id uuid, coach_name text)
language sql
stable
security definer
set search_path = public
as $$
  select picked.id, picked.name, picked.coach_id, picked.coach_name
  from (
    select distinct on (p.id)
      p.id,
      p.name,
      pa.coach_id,
      coalesce(pr.full_name, '') as coach_name
    from public.players p
    join public.player_assignments pa
      on pa.player_id = p.id
     and pa.discipline = public.current_org_discipline()
    join public.organization_members om
      on om.organization_id = p.organization_id
     and om.user_id = pa.coach_id
     and om.status = 'active'
    left join public.profiles pr on pr.id = pa.coach_id
    where p.organization_id = public.current_org_id()
      and p.is_active = true
      and public.current_org_role() = 'coach'
    order by p.id, (pa.coach_id = auth.uid()) desc, pa.created_at, pa.coach_id
  ) as picked
  order by picked.name;
$$;


-- ---------------------------------------------------------------------------
-- H. Mená kolegov
-- ---------------------------------------------------------------------------
-- Tréner pri tréningu vidí, kto ho viedol — `profiles` mu však vydá len vlastný
-- riadok. Policy nad `profiles` by otvorila všetky stĺpce (e-mail, predplatné),
-- preto úzka funkcia: LEN meno a LEN členov vlastnej organizácie, aj
-- odídených (podpísali staré tréningy).
create function public.org_member_names()
returns table (user_id uuid, full_name text)
language sql
stable
security definer
set search_path = public
as $$
  select distinct om.user_id, coalesce(pr.full_name, '')
  from public.organization_members om
  join public.profiles pr on pr.id = om.user_id
  where om.organization_id = public.current_org_id()
    and om.user_id is not null;
$$;

revoke all on function public.org_member_names() from public;
revoke all on function public.org_member_names() from anon;
grant execute on function public.org_member_names() to authenticated;
