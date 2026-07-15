-- Trvalá kópia tréningov pre pripojeného rodiča/manažéra. Zámerne NIE je
-- to len "read-only pohľad" cez RLS nad sessions/session_drills — dáta sa
-- priebežne kopírujú do vlastných tabuliek rodiča, takže kópia prežije aj
-- zrušenie prepojenia, zmazanie pôvodnej session trénerom, alebo úplné
-- zmazanie trénerovho účtu. Zápis do týchto tabuliek robí výhradne
-- security definer trigger, nikdy appka priamo.

create table public.parent_session_records (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references auth.users (id) on delete cascade,
  source_session_id uuid not null,
  coach_id uuid not null,
  status text not null,
  planned_data jsonb,
  actual_data jsonb,
  notes text,
  synced_at timestamptz not null default now(),
  unique (parent_id, source_session_id)
);

alter table public.parent_session_records enable row level security;

grant select on public.parent_session_records to authenticated;
grant all on public.parent_session_records to service_role;

create policy "parent_session_records_select_own"
  on public.parent_session_records for select
  using (parent_id = auth.uid());

create table public.parent_session_drill_records (
  id uuid primary key default gen_random_uuid(),
  parent_record_id uuid not null references public.parent_session_records (id) on delete cascade,
  source_drill_id uuid not null,
  category text not null,
  character text not null,
  drill_code text,
  duration_minutes int not null,
  status text not null,
  unique (parent_record_id, source_drill_id)
);

alter table public.parent_session_drill_records enable row level security;

grant select on public.parent_session_drill_records to authenticated;
grant all on public.parent_session_drill_records to service_role;

create policy "parent_session_drill_records_select_own"
  on public.parent_session_drill_records for select
  using (
    exists (
      select 1 from public.parent_session_records r
      where r.id = parent_record_id and r.parent_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- Priebežná synchronizácia — trigger na sessions/session_drills. Pokrýva
-- všetky existujúce cesty zápisu (createSession, updateSessionReview,
-- completeSession, addDrill, replaceDrill, setDrillPlayed) bez toho, aby
-- ich bolo treba upravovať — appka o synchronizácii vôbec nemusí vedieť.
-- Zámerne sa nepropagujú DELETE (napr. "Zrušiť tréning") — raz
-- zapísaná kópia u rodiča ostáva aj po zmazaní pôvodnej session.
-- ---------------------------------------------------------------------------
create function public.sync_session_to_parent()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_parent_id uuid;
begin
  select parent_id into v_parent_id
  from public.player_connections
  where player_id = new.player_id and status = 'active';

  if v_parent_id is not null then
    insert into public.parent_session_records
      (parent_id, source_session_id, coach_id, status, planned_data, actual_data, notes, synced_at)
    values
      (v_parent_id, new.id, new.coach_id, new.status, new.planned_data, new.actual_data, new.notes, now())
    on conflict (parent_id, source_session_id) do update set
      status = excluded.status,
      planned_data = excluded.planned_data,
      actual_data = excluded.actual_data,
      notes = excluded.notes,
      synced_at = now();
  end if;

  return new;
end;
$$;

create trigger sessions_sync_to_parent
  after insert or update on public.sessions
  for each row execute function public.sync_session_to_parent();

create function public.sync_drill_to_parent()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_parent_record_id uuid;
begin
  select id into v_parent_record_id
  from public.parent_session_records
  where source_session_id = new.session_id
  order by synced_at desc
  limit 1;

  if v_parent_record_id is not null then
    insert into public.parent_session_drill_records
      (parent_record_id, source_drill_id, category, character, drill_code, duration_minutes, status)
    values
      (v_parent_record_id, new.id, new.category, new.character, new.drill_code, new.duration_minutes, new.status)
    on conflict (parent_record_id, source_drill_id) do update set
      category = excluded.category,
      character = excluded.character,
      drill_code = excluded.drill_code,
      duration_minutes = excluded.duration_minutes,
      status = excluded.status;
  end if;

  return new;
end;
$$;

create trigger session_drills_sync_to_parent
  after insert or update on public.session_drills
  for each row execute function public.sync_drill_to_parent();

-- ---------------------------------------------------------------------------
-- Rozšírenie claim_player_connection o spätné doplnenie histórie — pri
-- pripojení sa rovnakým upsertom jednorazovo skopírujú všetky doterajšie
-- sessions/session_drills daného hráča, nielen budúce zmeny.
-- ---------------------------------------------------------------------------
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
  set parent_id = auth.uid(), status = 'active'
  where id = v_connection_id;

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

  insert into public.parent_session_drill_records
    (parent_record_id, source_drill_id, category, character, drill_code, duration_minutes, status)
  select r.id, d.id, d.category, d.character, d.drill_code, d.duration_minutes, d.status
  from public.session_drills d
  join public.parent_session_records r
    on r.source_session_id = d.session_id and r.parent_id = auth.uid()
  on conflict (parent_record_id, source_drill_id) do update set
    category = excluded.category,
    character = excluded.character,
    drill_code = excluded.drill_code,
    duration_minutes = excluded.duration_minutes,
    status = excluded.status;

  return query select v_player_id, v_coach_id;
end;
$$;
