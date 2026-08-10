-- =============================================================================
-- Kód smie uplatniť len prihlásený účet
-- =============================================================================
-- Diera (nájdená auditom 2026-08-07, overená útokom): obe claim funkcie sa
-- pýtali len „existuje taký kód a je nepoužitý?", nie „a kto si ty?".
-- Predpokladali prihláseného volajúceho, lebo cez appku to inak nejde — lenže
-- PostgREST ich vystavuje aj priamo, a tam prihlásený nikto nie je.
-- `auth.uid()` je vtedy NULL a zapíše sa do riadku ako vlastník.
--
-- Nič sa tým nedá PREČÍTAŤ — vzniknutý riadok nemá vlastníka, takže sa naň
-- nedá prihlásiť. Je to škodenie, nie únik:
--
--   `claim_player_connection` — kód sa minie a tréner vidí „✓ Pripojené",
--   hoci pripojený nie je nikto; rodičovi potom appka povie „neplatný kód".
--   Prejde to len pri hráčovi BEZ jediného tréningu: keď nejaký má, backfill
--   nižšie narazí na `parent_session_records.parent_id NOT NULL` a všetko sa
--   odroluje. Tréner sa z toho dostane odvolaním a novým kódom.
--
--   `claim_organization_invite` — HORŠIE. Vznikne aktívne členstvo bez účtu,
--   `invite_code` sa vymaže (kód sa už ani nedá dohľadať) a riadok **zožerie
--   sedadlo**: overené 2 → 3 z 10. Sedadlá sa počítajú podľa
--   `status = 'active' and role = 'coach'`, bez ohľadu na `user_id`, a guard
--   trigger `enforce_membership_rules` svoje kontroly preskočí, lebo tie bežia
--   len `if new.user_id is not null`.
--
-- Obe funkcie preto na začiatku odmietnu neprihláseného volajúceho. Cez appku
-- je to nedosiahnuteľné (server actions robia `redirect("/login")` skôr, než
-- RPC zavolajú), takže je to čisto poistka pre priame volanie.
-- =============================================================================


-- ---------------------------------------------------------------------------
-- Sanácia: čo dierou vzniklo
-- ---------------------------------------------------------------------------
-- Aktívne prepojenie bez rodiča je vždy pozostatok — cez appku taký riadok
-- vzniknúť nevie. Vraciame ho na 'revoked', nie na 'pending': kód sa musel
-- niekde vyzradiť (inak by ho útočník nemal odkiaľ vziať), takže ho nemá zmysel
-- oživovať. Tréner uvidí na `/players` opäť „Generate code" a vydá nový.
update public.player_connections
set status = 'revoked'
where status = 'active' and parent_id is null;

-- Aktívne členstvo bez účtu drží sedadlo, ktoré nikto nepoužíva. Legitímne
-- takto vyzerať nevie: `user_id` je prázdne len pri `status = 'invited'`,
-- a bootstrap šéftrénera cez SQL Editor `user_id` vypĺňa (viď
-- docs/onboarding-organizacie.md). Pozvánka sa už obnoviť nedá — `invite_code`
-- claim vymazal — takže riadok zavrieme a šéftréner vystaví novú pozvánku.
update public.organization_members
set status = 'removed'
where status = 'active' and user_id is null;


-- ---------------------------------------------------------------------------
-- claim_player_connection
-- ---------------------------------------------------------------------------
-- POZOR: definícia vychádza z REÁLNE NASADENEJ verzie (`pg_get_functiondef`),
-- nie zo staršej migrácie. Táto funkcia sa už raz takto pokazila — migrácia
-- `20260718121500` vyšla zo zastaraného znenia a ticho zahodila spätný
-- backfill histórie, čo sa odhalilo až o dva týždne (opravené `20260803093000`).
create or replace function public.claim_player_connection(p_code text)
returns table(player_id uuid, coach_id uuid)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_connection_id uuid;
  v_player_id uuid;
  v_coach_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  select pc.id, pc.player_id, pc.coach_id
    into v_connection_id, v_player_id, v_coach_id
  from public.player_connections pc
  where pc.connect_code = p_code and pc.status = 'pending';

  if v_connection_id is null then
    raise exception 'invalid_or_used_code';
  end if;

  update public.player_connections
  set status = 'revoked'
  where parent_id = auth.uid() and status = 'active';

  update public.player_connections
  set parent_id = auth.uid(),
      status = 'active',
      connected_role = (select role from public.profiles where id = auth.uid())
  where id = v_connection_id;

  -- Spätné doplnenie histórie tréningov daného hráča (rovnaký upsert ako
  -- priebežný trigger, takže opakované pripojenie nič nepokazí).
  --
  -- `s.coach_id = v_coach_id` je poistka, nie zmena správania: hráč patrí vždy
  -- jednému trénerovi, takže dnes neodfiltruje nič. Drží to väzbu „kópie
  -- pochádzajú od trénera, ktorý kód vydal" aj keby sa `sessions.coach_id`
  -- niekedy dalo presúvať (v org režime to `assign_player_to_coach` robí).
  insert into public.parent_session_records
    (parent_id, source_session_id, coach_id, status, planned_data, actual_data, notes, synced_at)
  select auth.uid(), s.id, s.coach_id, s.status, s.planned_data, s.actual_data, s.notes, now()
  from public.sessions s
  where s.player_id = v_player_id
    and s.coach_id = v_coach_id
  on conflict (parent_id, source_session_id) do update set
    status = excluded.status,
    planned_data = excluded.planned_data,
    actual_data = excluded.actual_data,
    notes = excluded.notes,
    synced_at = now();

  -- ...a k nim cvičenia. Obmedzené na hráča z tohto kódu, aby sa nezasahovalo
  -- do skorších kópií od iných trénerov (rodičovi história ostáva naprieč nimi).
  insert into public.parent_session_drill_records
    (parent_record_id, source_drill_id, category, character, drill_code, duration_minutes, status)
  select r.id, d.id, d.category, d.character, d.drill_code, d.duration_minutes, d.status
  from public.session_drills d
  join public.sessions s on s.id = d.session_id
  join public.parent_session_records r
    on r.source_session_id = d.session_id and r.parent_id = auth.uid()
  where s.player_id = v_player_id
    and s.coach_id = v_coach_id
  on conflict (parent_record_id, source_drill_id) do update set
    category = excluded.category,
    character = excluded.character,
    drill_code = excluded.drill_code,
    duration_minutes = excluded.duration_minutes,
    status = excluded.status;

  return query select v_player_id, v_coach_id;
end;
$function$;


-- ---------------------------------------------------------------------------
-- claim_organization_invite
-- ---------------------------------------------------------------------------
-- Rovnako z nasadenej verzie; mení sa iba pridaná kontrola na začiatku.
create or replace function public.claim_organization_invite(p_code text)
returns table(organization_id uuid, organization_slug text, member_role text)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_member_id uuid;
  v_org_id uuid;
  v_role text;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

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
$function$;
