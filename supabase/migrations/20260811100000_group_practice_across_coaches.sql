-- =============================================================================
-- Skupinový tréning naprieč trénermi organizácie
-- =============================================================================
-- Vo federácii je bežné, že na kurte sú spolu hráči viacerých trénerov. Zápis
-- toho istého tréningu ďalšiemu hráčovi (`copySessionToPlayer`) však doteraz
-- fungoval len v rámci vlastných hráčov: tréner cudzieho hráča ani nevidí
-- (`players_org_select` je `coach_id = auth.uid()`) a zapísať mu tréning
-- nemôže (`sessions_org_coach_insert` žiada `p.coach_id = auth.uid()`).
--
-- Riešené dvoma `security definer` funkciami, NIE uvoľnením RLS — rovnaký
-- dôvod a vzor ako pri `assign_player_to_coach`. Keby sa `players_org_select`
-- rozšírila na celú organizáciu, cudzí hráči by trénerovi pribudli VŠADE:
-- v rosteri, v prepínači hráčov aj vo výbere „vybraného hráča", a tým by padlo
-- pravidlo „tréner má v appke len sebe pridelených hráčov" (§5.1). Funkcie
-- preto robia práve dve úzke veci: vydajú zoznam mien na výber a založia jeden
-- tréning.
--
-- **Kópia vzniká pod hráčovým VLASTNÝM trénerom** (`coach_id` = jeho tréner),
-- nie pod tým, kto ju zapísal. Inak by ju hráčov tréner vo svojej appke vôbec
-- nevidel — RLS mu vydá len vlastné riadky — a tréning by skončil u niekoho,
-- kto s tým hráčom ďalej nepracuje. Je to v súlade s modelom: v org režime je
-- `coach_id` priradenie, nie autorstvo (rovnako ako po preradení hráča).
-- Dôsledok: kto tréning reálne viedol, sa naďalej nikde neuchováva — na to by
-- bol potrebný samostatný stĺpec `conducted_by` (vedome odložené).
-- =============================================================================


-- ---------------------------------------------------------------------------
-- Zoznam hráčov organizácie pre výber pri kopírovaní
-- ---------------------------------------------------------------------------
-- Vracia len to, čo výber potrebuje (meno hráča + meno jeho trénera), nie celý
-- riadok hráča. Hráči trénerov, ktorí už nie sú aktívnymi členmi, sa
-- nezobrazujú: tréning by vznikol pod niekým, kto sa doňho nedostane.
create function public.org_players_for_copy()
returns table (id uuid, name text, coach_id uuid, coach_name text)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.name, p.coach_id, coalesce(pr.full_name, '')
  from public.players p
  join public.organization_members om
    on om.organization_id = p.organization_id
   and om.user_id = p.coach_id
   and om.status = 'active'
  left join public.profiles pr on pr.id = p.coach_id
  where p.organization_id = public.current_org_id()
    and p.is_active = true
    -- Šéftréner tréningy nezapisuje (§5.7), takže mu funkcia nevydá nič.
    and public.current_org_role() = 'coach'
  order by p.name;
$$;

grant execute on function public.org_players_for_copy() to authenticated;


-- ---------------------------------------------------------------------------
-- Zápis toho istého tréningu ďalšiemu hráčovi organizácie
-- ---------------------------------------------------------------------------
create function public.copy_session_to_org_player(
  p_session_id uuid,
  p_target_player_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_source public.sessions;
  v_target public.players;
  v_planned_date text;
  v_new_id uuid;
begin
  -- `security definer` obchádza RLS, takže všetky kontroly musia byť tu.
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  select om.organization_id into v_org_id
  from public.organization_members om
  where om.user_id = auth.uid()
    and om.role = 'coach'
    and om.status = 'active';

  if v_org_id is null then
    raise exception 'not_org_coach';
  end if;

  -- Kopírovať sa dá len z VLASTNÉHO tréningu — funkcia nesmie byť cestou, ako
  -- si prečítať cudzí tréning tým, že si ho niekam skopírujem.
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
    from public.organization_members om
    where om.user_id = v_target.coach_id
      and om.organization_id = v_org_id
      and om.role = 'coach'
      and om.status = 'active'
  ) then
    raise exception 'target_coach_inactive';
  end if;

  -- Poistka proti dvojkliku a proti druhému skopírovaniu toho istého
  -- tréningu — inak by hráčovi pribudol duplikát a analytika by mu
  -- zdvojnásobila odohraný čas.
  v_planned_date := v_source.planned_data ->> 'date';

  if v_planned_date is not null and exists (
    select 1
    from public.sessions s
    where s.player_id = v_target.id
      and s.status <> 'cancelled'
      and s.planned_data ->> 'date' = v_planned_date
  ) then
    raise exception 'duplicate_practice';
  end if;

  -- Nikdy nie 'completed': do uzamknutého tréningu sa cvičenia vložiť nedajú
  -- a odomknúť sa už nedá, takže by hráčov tréner nemohol upraviť, čo jeho
  -- zverenec neodohral. `google_event_id` sa zámerne neprenáša — udalosť patrí
  -- do kalendára toho, kto tréning naplánoval.
  insert into public.sessions (
    coach_id, organization_id, player_id, status, planned_data, actual_data, notes
  )
  values (
    v_target.coach_id, v_org_id, v_target.id, 'planned',
    v_source.planned_data, v_source.actual_data, v_source.notes
  )
  returning id into v_new_id;

  -- `replaces_drill_id` sa neprenáša, ukazovalo by na cvičenia cudzieho tréningu.
  insert into public.session_drills (
    session_id, coach_id, organization_id, category, character, drill_code,
    duration_minutes, status, sort_order
  )
  select
    v_new_id, v_target.coach_id, v_org_id, d.category, d.character, d.drill_code,
    d.duration_minutes, d.status, d.sort_order
  from public.session_drills d
  where d.session_id = p_session_id
  order by d.sort_order;

  return v_new_id;
end;
$$;

grant execute on function public.copy_session_to_org_player(uuid, uuid) to authenticated;
