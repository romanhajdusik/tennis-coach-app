-- =============================================================================
-- Životný cyklus členstva — odobratý tréner ostáva viditeľný
-- =============================================================================
-- Doteraz `status = 'removed'` znamenalo, že riadok zo zoznamu na
-- `/director/team` jednoducho zmizol: šéftréner nevedel, koho kedy odobral,
-- a vrátiť ho späť sa nedalo vôbec.
--
-- Odteraz odobratý tréner ostáva v zozname ako **neaktívny** a šéftréner ho
-- môže buď vrátiť späť, alebo vymazať natrvalo — oboje po kontrolnej otázke.
--
-- Vrátenie späť si nevyžiadalo nič nové: šéftréner má na členstvo UPDATE policy
-- a trigger `enforce_membership_rules` sám postráži, že je voľné sedadlo a že si
-- tréner medzitým nezaložil osobných hráčov (medzi odobratím a návratom je
-- z pohľadu appky samostatný tréner, takže si ich založiť MOHOL).
-- =============================================================================


-- ---------------------------------------------------------------------------
-- A. Šéftréner vidí mená aj NEAKTÍVNYCH členov svojej organizácie
-- ---------------------------------------------------------------------------
-- Zoznam odobratých trénerov by inak bol zoznam pomlčiek: policy
-- `profiles_select_director_org_members` (20260806090000) púšťala len profily
-- AKTÍVNYCH členov. Rozšírenie neodkrýva nič nové — tie mená šéftréner videl,
-- kým tréner v organizácii pracoval, a bez nich sa nedá rozhodnúť, koho vrátiť
-- späť a koho vymazať.
--
-- Nová funkcia namiesto `create or replace` tej starej: názov
-- `is_active_member_of_my_org` by po tejto zmene klamal.
create function public.is_member_of_my_org(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members me
    join public.organization_members them
      on them.organization_id = me.organization_id
    where me.user_id = auth.uid()
      and me.status = 'active'
      and me.role = 'director'
      and them.user_id = p_user_id
  );
$$;

grant execute on function public.is_member_of_my_org(uuid) to authenticated;

drop policy "profiles_select_director_org_members" on public.profiles;

create policy "profiles_select_director_org_members"
  on public.profiles for select
  using ((select public.is_member_of_my_org(id)));

drop function public.is_active_member_of_my_org(uuid);


-- ---------------------------------------------------------------------------
-- B. Trvalé zmazanie člena — RPC, nie vrátený DELETE grant
-- ---------------------------------------------------------------------------
-- `authenticated` prišiel o DELETE na `organization_members` v bezpečnostnom
-- audite (20260809091000, komentár „NIKDY delete"). Vracať ten grant kvôli
-- jednej obrazovke by tú prácu zahodilo, preto rovnaký vzor ako pri
-- `assign_player_to_coach`: úzka `security definer` funkcia, ktorá si všetko
-- overí sama.
--
-- Zmazať sa dá LEN už odobratý riadok (`status = 'removed'`), takže pracujúceho
-- trénera nemožno odstrániť jedným kliknutím — najprv sa musí odobrať. Rola
-- `director` sa nemaže vôbec: organizácia bez šéftrénera je nespravovateľná.
--
-- Hráči sa mazaním členstva NEDOTKNÚ — dáta vlastní organizácia (§5.4), takže
-- ostávajú a v pulte sa objavia v skupine bez trénera, kde ich šéftréner
-- pridelí ďalej.
create function public.delete_organization_member(p_member_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
begin
  select om.organization_id into v_org_id
  from public.organization_members om
  where om.user_id = auth.uid()
    and om.role = 'director'
    and om.status = 'active';

  if v_org_id is null then
    raise exception 'not_director';
  end if;

  delete from public.organization_members om
  where om.id = p_member_id
    and om.organization_id = v_org_id
    and om.role = 'coach'
    and om.status = 'removed';

  if not found then
    raise exception 'member_not_deletable';
  end if;
end;
$$;

grant execute on function public.delete_organization_member(uuid) to authenticated;
