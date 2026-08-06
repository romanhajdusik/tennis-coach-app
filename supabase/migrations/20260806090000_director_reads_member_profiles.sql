-- =============================================================================
-- Riadiaci pult šéftrénera — čítanie profilov členov vlastnej organizácie
-- =============================================================================
-- Pult (`/director`) zoskupuje hráčov podľa trénera, takže potrebuje MENÁ
-- trénerov. `organization_members` drží len `user_id`, a `profiles` má dodnes
-- jedinú policy `id = auth.uid()` — šéftréner by teda videl priradenia, ale
-- nie to, komu patria.
--
-- Riešime to úzkou SELECT policy: šéftréner smie čítať profil používateľa,
-- ktorý je AKTÍVNYM členom tej istej organizácie. Nič viac — na cudzie
-- organizácie ani na neaktívnych (odobraných) členov to nedovidí.
--
-- Alternatívou bol snapshot mena do `organization_members` pri claime (vzor
-- `player_connections.connected_role`). Zvolili sme policy: meno je vždy
-- aktuálne a `claim_organization_invite` sa nemusí prepisovať (tá funkcia už
-- raz o kus logiky prišla pri `create or replace`, viď CLAUDE.md).
-- =============================================================================

-- security definer, aby sa policy na `profiles` nemusela dotazovať na
-- `organization_members` cez jej vlastnú RLS (skryté riadky / rekurzia) —
-- rovnaký dôvod ako pri current_org_id() / current_org_role().
create function public.is_active_member_of_my_org(p_user_id uuid)
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
      and them.status = 'active'
  );
$$;

grant execute on function public.is_active_member_of_my_org(uuid) to authenticated;

create policy "profiles_select_director_org_members"
  on public.profiles for select
  using ((select public.is_active_member_of_my_org(id)));
