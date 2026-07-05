-- Tréning sa skladá z viacerých cvičení (drill blokov) — každé má kategóriu
-- (zameranie), charakter úderu (offensive/neutral/defensive), konkrétne
-- cvičenie (kód) a trvanie. Celková dĺžka tréningu je súčet trvaní cvičení.
create table public.session_drills (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions (id) on delete cascade,
  coach_id uuid not null references auth.users (id) on delete cascade,
  category text not null,
  character text not null check (character in ('offensive', 'neutral', 'defensive')),
  drill_code text,
  duration_minutes integer not null check (duration_minutes in (5, 10, 15, 20, 30)),
  created_at timestamptz not null default now()
);

alter table public.session_drills enable row level security;

grant select, insert, update, delete on public.session_drills to authenticated, service_role;

-- Čítanie je povolené aj pre archivovaného (neaktívneho) hráča
create policy "session_drills_select_own"
  on public.session_drills for select
  using (coach_id = auth.uid());

-- Zápis/úprava/zmazanie je zablokovaný, ak je hráč danej session archivovaný
create policy "session_drills_insert_active_player"
  on public.session_drills for insert
  with check (
    coach_id = auth.uid()
    and exists (
      select 1
      from public.sessions s
      join public.players p on p.id = s.player_id
      where s.id = session_id and s.coach_id = auth.uid() and p.is_active = true
    )
  );

create policy "session_drills_update_active_player"
  on public.session_drills for update
  using (
    coach_id = auth.uid()
    and exists (
      select 1
      from public.sessions s
      join public.players p on p.id = s.player_id
      where s.id = session_id and s.coach_id = auth.uid() and p.is_active = true
    )
  )
  with check (
    coach_id = auth.uid()
    and exists (
      select 1
      from public.sessions s
      join public.players p on p.id = s.player_id
      where s.id = session_id and s.coach_id = auth.uid() and p.is_active = true
    )
  );

create policy "session_drills_delete_active_player"
  on public.session_drills for delete
  using (
    coach_id = auth.uid()
    and exists (
      select 1
      from public.sessions s
      join public.players p on p.id = s.player_id
      where s.id = session_id and s.coach_id = auth.uid() and p.is_active = true
    )
  );
