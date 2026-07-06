-- Dokončený tréning (status = 'completed') je uzamknutý na úrovni DB —
-- rovnaký princíp ako read-only archív pre neaktívneho hráča. UI kontrola
-- nestačí, RLS musí zápis zablokovať aj priamo.

-- ---------------------------------------------------------------------------
-- sessions
-- ---------------------------------------------------------------------------
drop policy "sessions_update_active_player" on public.sessions;

create policy "sessions_update_active_player"
  on public.sessions for update
  using (
    coach_id = auth.uid()
    and status <> 'completed'
    and exists (
      select 1 from public.players p
      where p.id = player_id and p.coach_id = auth.uid() and p.is_active = true
    )
  )
  with check (
    coach_id = auth.uid()
    and exists (
      select 1 from public.players p
      where p.id = player_id and p.coach_id = auth.uid() and p.is_active = true
    )
  );

drop policy "sessions_delete_active_player" on public.sessions;

create policy "sessions_delete_active_player"
  on public.sessions for delete
  using (
    coach_id = auth.uid()
    and status <> 'completed'
    and exists (
      select 1 from public.players p
      where p.id = player_id and p.coach_id = auth.uid() and p.is_active = true
    )
  );

-- ---------------------------------------------------------------------------
-- session_drills
-- ---------------------------------------------------------------------------
drop policy "session_drills_insert_active_player" on public.session_drills;

create policy "session_drills_insert_active_player"
  on public.session_drills for insert
  with check (
    coach_id = auth.uid()
    and exists (
      select 1
      from public.sessions s
      join public.players p on p.id = s.player_id
      where s.id = session_id and s.coach_id = auth.uid() and p.is_active = true
        and s.status <> 'completed'
    )
  );

drop policy "session_drills_update_active_player" on public.session_drills;

create policy "session_drills_update_active_player"
  on public.session_drills for update
  using (
    coach_id = auth.uid()
    and exists (
      select 1
      from public.sessions s
      join public.players p on p.id = s.player_id
      where s.id = session_id and s.coach_id = auth.uid() and p.is_active = true
        and s.status <> 'completed'
    )
  )
  with check (
    coach_id = auth.uid()
    and exists (
      select 1
      from public.sessions s
      join public.players p on p.id = s.player_id
      where s.id = session_id and s.coach_id = auth.uid() and p.is_active = true
        and s.status <> 'completed'
    )
  );

drop policy "session_drills_delete_active_player" on public.session_drills;

create policy "session_drills_delete_active_player"
  on public.session_drills for delete
  using (
    coach_id = auth.uid()
    and exists (
      select 1
      from public.sessions s
      join public.players p on p.id = s.player_id
      where s.id = session_id and s.coach_id = auth.uid() and p.is_active = true
        and s.status <> 'completed'
    )
  );
