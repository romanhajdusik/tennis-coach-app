-- Oprava: rodičovi sa pri zadaní kódu opäť spätne doplní existujúca história.
--
-- Čo sa stalo: migrácia 20260715100001_parent_session_sync.sql pridala do
-- claim_player_connection jednorazové doplnenie histórie (aby rodič hneď po
-- pripojení videl aj to, čo sa odohralo predtým, nielen budúce zmeny).
-- Migrácia 20260718121500_add_connected_role_to_player_connections.sql však
-- funkciu prepísala cez `create or replace` a vychádzala z PÔVODNEJ verzie
-- (20260715100000) — doplnenie histórie tým ticho vypadlo. Od 2026-07-18 teda
-- rodič po pripojení videl len tréningy, ktoré sa zmenili až potom, hoci
-- CLAUDE.md popisuje spätné doplnenie ako funkčné.
--
-- Táto migrácia zlučuje obe vetvy: snapshot connected_role AJ backfill histórie.
-- Priebežná synchronizácia (triggery sessions_sync_to_parent /
-- session_drills_sync_to_parent) je nedotknutá, tá fungovala celý čas.
--
-- Pozn. pre budúcnosť: claim_player_connection sa už menila dvakrát cez
-- `create or replace` — pri ďalšej zmene VŽDY vychádzaj z aktuálne nasadenej
-- definície (`pg_get_functiondef`), nie zo staršej migrácie, inak sa takto
-- ticho stratí medzitým pridaná logika.

create or replace function public.claim_player_connection(p_code text)
returns table (player_id uuid, coach_id uuid)
language plpgsql
security definer set search_path = public
as $$
declare
  v_connection_id uuid;
  v_player_id uuid;
  v_coach_id uuid;
begin
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
  insert into public.parent_session_records
    (parent_id, source_session_id, coach_id, status, planned_data, actual_data, notes, synced_at)
  select auth.uid(), s.id, s.coach_id, s.status, s.planned_data, s.actual_data, s.notes, now()
  from public.sessions s
  where s.player_id = v_player_id
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
  on conflict (parent_record_id, source_drill_id) do update set
    category = excluded.category,
    character = excluded.character,
    drill_code = excluded.drill_code,
    duration_minutes = excluded.duration_minutes,
    status = excluded.status;

  return query select v_player_id, v_coach_id;
end;
$$;
