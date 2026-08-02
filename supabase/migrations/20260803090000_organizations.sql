-- =============================================================================
-- Federačná (B2B) vrstva — SCHÉMA: organizácia NAD trénermi
-- =============================================================================
-- Federácia/klub/akadémia si kúpi N sedadiel; šéftréner (director) má read-only
-- dohľad nad tréningovými dátami, tréneri sú priradení zamestnanci s viacerými
-- hráčmi (1:N). Dáta vlastní ORGANIZÁCIA, nie tréner — pri odchode trénera
-- ostávajú hráči aj história organizácii a dajú sa prideliť inému trénerovi.
--
-- Rozhodnutia a kontext: docs/roadmap-buduce-smery.md §4 a §5 (§5.7 = záväzné
-- bezpečnostné pravidlá tejto vrstvy). Dvojrežimová RLS nad dátovými tabuľkami
-- je v nasledujúcej migrácii (20260803091000_org_rls.sql) — táto pridáva len
-- schému, takže sama o sebe nemení správanie appky.
--
-- Migrácia je čisto ADITÍVNA — samostatný (1:1) tenis na plaw.win funguje
-- presne ako doteraz: jeho riadky majú organization_id = null a platí pre ne
-- pôvodný model coach_id = auth.uid().
--
-- Účet je BUĎ nezávislý ALEBO org-zamestnanec (rozhodnutie 2026-08-03, §5.8) —
-- jeden používateľ nemôže mať súčasne osobných aj organizačných hráčov.
-- =============================================================================


-- ---------------------------------------------------------------------------
-- A. organizations — federácia / klub / akadémia
-- ---------------------------------------------------------------------------
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  -- slug = subdoména <slug>.plaw.win (multi-tenant, §5.2). Subdomény sa
  -- pridávajú RUČNE per organizácia (CNAME + doména vo Verceli), nie wildcard,
  -- aby sa nemuseli presúvať nameservery plaw.win (MX/mail ostáva nedotknutý).
  slug text not null unique check (slug ~ '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$'),
  type text not null default 'academy' check (type in ('federation', 'club', 'academy')),
  -- Jedna organizácia = jeden šport (§4, rozhodnutie 3) — pripravené na SportConfig
  sport text not null default 'tennis',
  -- Sedadlá = trénerské licencie, páruje sa so Stripe predplatným (§4)
  seat_limit integer not null default 10 check (seat_limit > 0),
  subscription_status text not null default 'trial',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.organizations enable row level security;

create trigger organizations_set_updated_at
  before update on public.organizations
  for each row execute function public.set_updated_at();

grant select, insert, update, delete on public.organizations to authenticated, service_role;


-- ---------------------------------------------------------------------------
-- B. organization_members — členstvo (šéftréner / tréner)
-- ---------------------------------------------------------------------------
-- Tréner sa do organizácie pridá cez pozývací kód — rovnaký vzor ako
-- connect-code v player_connections. Členstvo je dobrovoľné: federácia nesmie
-- potichu „vysať" cudzieho trénera (§5.7), preto sa účet k pozvánke pripája
-- výhradne cez claim_organization_invite (viď guard trigger nižšie).
create table public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  -- null, kým pozvánku niekto neprijme (ako player_connections.parent_id)
  user_id uuid references auth.users (id) on delete cascade,
  role text not null check (role in ('director', 'coach')),
  status text not null default 'invited' check (status in ('invited', 'active', 'removed')),
  invite_code text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Účet je buď nezávislý, alebo org-zamestnanec (§5.8) → najviac jedno aktívne
-- členstvo na používateľa. Rovnaký princíp ako one_active_connection_per_parent.
create unique index one_active_membership_per_user
  on public.organization_members (user_id) where status = 'active';

create index organization_members_organization_idx
  on public.organization_members (organization_id);

alter table public.organization_members enable row level security;

create trigger organization_members_set_updated_at
  before update on public.organization_members
  for each row execute function public.set_updated_at();

grant select, insert, update, delete on public.organization_members to authenticated, service_role;


-- ---------------------------------------------------------------------------
-- C. Vlastníctvo dát — organization_id na dátových tabuľkách
-- ---------------------------------------------------------------------------
-- organization_id = VLASTNÍK riadku (null = osobný riadok samostatného trénera),
-- coach_id = PRIRADENIE (v org režime mutable — pri odchode trénera sa hráč
-- pridelí inému, dáta ostávajú organizácii, §5.4).
--
-- on delete restrict zámerne: zmazanie organizácie nesmie tichom zmazať celú
-- históriu federácie — najprv sa musia vyriešiť dáta.
alter table public.players
  add column organization_id uuid references public.organizations (id) on delete restrict;

alter table public.sessions
  add column organization_id uuid references public.organizations (id) on delete restrict;

alter table public.session_drills
  add column organization_id uuid references public.organizations (id) on delete restrict;

alter table public.metrics_and_tests
  add column organization_id uuid references public.organizations (id) on delete restrict;

alter table public.drill_codes
  add column organization_id uuid references public.organizations (id) on delete restrict;

create index players_organization_idx on public.players (organization_id);
create index sessions_organization_idx on public.sessions (organization_id);
create index session_drills_organization_idx on public.session_drills (organization_id);
create index metrics_and_tests_organization_idx on public.metrics_and_tests (organization_id);

-- Model 1:1 (jeden aktívny hráč) platí len pre samostatného trénera. Federačný
-- tréner je zamestnanec s viacerými pridelenými hráčmi naraz (1:N, §5.1).
drop index public.one_active_player;

create unique index one_active_player on public.players (coach_id)
  where is_active = true and organization_id is null;

-- Kódy cvičení v organizácii štandardizuje federácia (§5.5): patria organizácii,
-- nie trénerovi — nastavuje ich šéftréner, tréner ich len používa. Preto má
-- org riadok coach_id = null a vlastníka určuje organization_id.
alter table public.drill_codes
  alter column coach_id drop not null;

alter table public.drill_codes
  add constraint drill_codes_single_owner
  check (num_nonnulls(coach_id, organization_id) = 1);

create unique index drill_codes_organization_slot
  on public.drill_codes (organization_id, category, slot)
  where organization_id is not null;


-- ---------------------------------------------------------------------------
-- D. Pomocné funkcie pre RLS
-- ---------------------------------------------------------------------------
-- security definer, aby sa policy na dátových tabuľkách nemusela dotazovať na
-- organization_members cez RLS (skryté riadky / rekurzia). Vracia najviac jednu
-- hodnotu — aktívne členstvo je práve jedno (viď unique index vyššie).
create function public.current_org_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select om.organization_id
  from public.organization_members om
  where om.user_id = auth.uid() and om.status = 'active'
  limit 1;
$$;

create function public.current_org_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select om.role
  from public.organization_members om
  where om.user_id = auth.uid() and om.status = 'active'
  limit 1;
$$;

grant execute on function public.current_org_id() to authenticated;
grant execute on function public.current_org_role() to authenticated;

-- proxy.ts mapuje hostname → slug → organizácia ešte PRED prihlásením
-- (tenant kontext + branding), preto sa číta cez security definer funkciu,
-- ktorá vracia len verejné polia — nie predplatné ani počet sedadiel.
create function public.organization_by_slug(p_slug text)
returns table (id uuid, name text, slug text, sport text)
language sql
stable
security definer
set search_path = public
as $$
  select o.id, o.name, o.slug, o.sport
  from public.organizations o
  where o.slug = lower(p_slug);
$$;

grant execute on function public.organization_by_slug(text) to anon, authenticated;


-- ---------------------------------------------------------------------------
-- E. Invarianty členstva (jeden trigger pre všetky cesty zápisu)
-- ---------------------------------------------------------------------------
create function public.enforce_membership_rules()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_seat_limit integer;
  v_used_seats integer;
begin
  -- (1) Účet k pozvánke pripája výhradne claim_organization_invite. Ani
  -- šéftréner nesmie priradiť cudzí účet priamym zápisom — členstvo je
  -- dobrovoľné (§5.7). Servisné/administrátorské pripojenie (bez prihláseného
  -- používateľa, napr. založenie prvého šéftrénera pri onboardingu) prechádza.
  if tg_op = 'UPDATE'
     and new.user_id is distinct from old.user_id
     and auth.uid() is not null
     and coalesce(current_setting('app.claiming_invite', true), '') <> 'on'
  then
    raise exception 'membership_requires_claim';
  end if;

  if new.status = 'active' and new.user_id is not null then
    -- (2) Buď nezávislý, alebo org-zamestnanec (§5.8): kto už vlastní osobných
    -- hráčov, nemôže sa stať členom organizácie — inak by mu osobné dáta
    -- „zmizli" (osobné RLS policy pre org účty neplatia).
    if exists (
      select 1 from public.players p
      where p.coach_id = new.user_id and p.organization_id is null
    ) then
      raise exception 'has_personal_data';
    end if;

    -- (3) Sedadlá: proti limitu sa počítajú len tréneri, šéftréner sedadlo neberie.
    if new.role = 'coach' then
      select o.seat_limit into v_seat_limit
      from public.organizations o
      where o.id = new.organization_id;

      select count(*) into v_used_seats
      from public.organization_members om
      where om.organization_id = new.organization_id
        and om.status = 'active'
        and om.role = 'coach'
        and om.id <> new.id;

      if v_used_seats >= v_seat_limit then
        raise exception 'seat_limit_reached';
      end if;
    end if;
  end if;

  return new;
end;
$$;

create trigger organization_members_enforce_rules
  before insert or update on public.organization_members
  for each row execute function public.enforce_membership_rules();


-- ---------------------------------------------------------------------------
-- F. claim_organization_invite — pozvaný prijme pozvánku kódom
-- ---------------------------------------------------------------------------
-- Vzor prevzatý z claim_player_connection: security definer, aby funkcia našla
-- pending riadok podľa kódu (pozvaný naň ešte nemá RLS prístup) a atomicky ho
-- priradila prihlásenému účtu.
create function public.claim_organization_invite(p_code text)
returns table (organization_id uuid, organization_slug text, member_role text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member_id uuid;
  v_org_id uuid;
  v_role text;
begin
  if exists (
    select 1 from public.organization_members om
    where om.user_id = auth.uid() and om.status = 'active'
  ) then
    raise exception 'already_member';
  end if;

  select om.id, om.organization_id, om.role
    into v_member_id, v_org_id, v_role
  from public.organization_members om
  where om.invite_code = p_code and om.status = 'invited' and om.user_id is null;

  if v_member_id is null then
    raise exception 'invalid_or_used_code';
  end if;

  -- Povolenie pre guard trigger — priradenie účtu smie prebehnúť len tadeto.
  perform set_config('app.claiming_invite', 'on', true);

  -- Ostatné invarianty (osobné dáta, sedadlá) kontroluje guard trigger.
  update public.organization_members
  set user_id = auth.uid(), status = 'active', invite_code = null
  where id = v_member_id;

  return query
    select o.id, o.slug, v_role
    from public.organizations o
    where o.id = v_org_id;
end;
$$;

grant execute on function public.claim_organization_invite(text) to authenticated;


-- ---------------------------------------------------------------------------
-- G. RLS — organizations a organization_members
-- ---------------------------------------------------------------------------
-- Organizáciu zakladá admin mimo appky (onboarding krok 4, docs/mockups/
-- onboarding-org.html) — cez service_role. Bežný účet ju smie len čítať.
create policy "organizations_select_own_member"
  on public.organizations for select
  using (id = (select public.current_org_id()));

create policy "organization_members_select_own"
  on public.organization_members for select
  using (user_id = auth.uid());

-- Šéftréner spravuje ČLENSTVO svojej organizácie (vytvorí pozvánku, odoberie
-- trénera). Read-only dohľad podľa §5.7 sa týka tréningových dát — členstvo je
-- organizačná administratíva. Účet k pozvánke ale pripojí až sám pozvaný
-- (guard trigger vyššie).
create policy "organization_members_select_director"
  on public.organization_members for select
  using (
    organization_id = (select public.current_org_id())
    and (select public.current_org_role()) = 'director'
  );

create policy "organization_members_insert_director"
  on public.organization_members for insert
  with check (
    organization_id = (select public.current_org_id())
    and (select public.current_org_role()) = 'director'
    and user_id is null
    and status = 'invited'
  );

create policy "organization_members_update_director"
  on public.organization_members for update
  using (
    organization_id = (select public.current_org_id())
    and (select public.current_org_role()) = 'director'
  )
  with check (
    organization_id = (select public.current_org_id())
    and (select public.current_org_role()) = 'director'
  );
