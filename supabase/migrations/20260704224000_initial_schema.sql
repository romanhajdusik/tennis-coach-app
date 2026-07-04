-- Počiatočná schéma: profiles, players, sessions, metrics_and_tests
-- Model 1:1 tréner–aktívny hráč, RLS na každej tabuľke, archív read-only na úrovni DB

-- ---------------------------------------------------------------------------
-- Pomocná funkcia na automatickú aktualizáciu updated_at
-- ---------------------------------------------------------------------------
create function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles — údaje o trénerovi, stav SaaS predplatného
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  email text not null,
  subscription_status text not null default 'trial',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create policy "profiles_select_own"
  on public.profiles for select
  using (id = auth.uid());

create policy "profiles_update_own"
  on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- Automatické vytvorenie profilu po registrácii v auth.users
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- players — všetci spravovaní hráči, vždy len jeden aktívny na trénera
-- ---------------------------------------------------------------------------
create table public.players (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  birth_date date,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index one_active_player on public.players (coach_id) where is_active = true;

alter table public.players enable row level security;

create trigger players_set_updated_at
  before update on public.players
  for each row execute function public.set_updated_at();

create policy "players_all_own"
  on public.players for all
  using (coach_id = auth.uid())
  with check (coach_id = auth.uid());

-- ---------------------------------------------------------------------------
-- sessions — tréningy naviazané na hráča
-- ---------------------------------------------------------------------------
create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references auth.users (id) on delete cascade,
  player_id uuid not null references public.players (id) on delete cascade,
  status text not null default 'planned' check (status in ('planned', 'completed', 'cancelled')),
  planned_data jsonb,
  actual_data jsonb,
  notes text,
  google_event_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.sessions enable row level security;

create trigger sessions_set_updated_at
  before update on public.sessions
  for each row execute function public.set_updated_at();

-- Čítanie je povolené aj pre archivovaného (neaktívneho) hráča
create policy "sessions_select_own"
  on public.sessions for select
  using (coach_id = auth.uid());

-- Zápis/úprava/zmazanie je zablokovaný, ak je hráč archivovaný (is_active = false)
create policy "sessions_insert_active_player"
  on public.sessions for insert
  with check (
    coach_id = auth.uid()
    and exists (
      select 1 from public.players p
      where p.id = player_id and p.coach_id = auth.uid() and p.is_active = true
    )
  );

create policy "sessions_update_active_player"
  on public.sessions for update
  using (
    coach_id = auth.uid()
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

create policy "sessions_delete_active_player"
  on public.sessions for delete
  using (
    coach_id = auth.uid()
    and exists (
      select 1 from public.players p
      where p.id = player_id and p.coach_id = auth.uid() and p.is_active = true
    )
  );

-- ---------------------------------------------------------------------------
-- metrics_and_tests — kondičné a technické testy hráča (fáza 2)
-- ---------------------------------------------------------------------------
create table public.metrics_and_tests (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references auth.users (id) on delete cascade,
  player_id uuid not null references public.players (id) on delete cascade,
  test_type text not null,
  results jsonb,
  tested_at date not null default current_date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.metrics_and_tests enable row level security;

create trigger metrics_and_tests_set_updated_at
  before update on public.metrics_and_tests
  for each row execute function public.set_updated_at();

create policy "metrics_select_own"
  on public.metrics_and_tests for select
  using (coach_id = auth.uid());

create policy "metrics_insert_active_player"
  on public.metrics_and_tests for insert
  with check (
    coach_id = auth.uid()
    and exists (
      select 1 from public.players p
      where p.id = player_id and p.coach_id = auth.uid() and p.is_active = true
    )
  );

create policy "metrics_update_active_player"
  on public.metrics_and_tests for update
  using (
    coach_id = auth.uid()
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

create policy "metrics_delete_active_player"
  on public.metrics_and_tests for delete
  using (
    coach_id = auth.uid()
    and exists (
      select 1 from public.players p
      where p.id = player_id and p.coach_id = auth.uid() and p.is_active = true
    )
  );
