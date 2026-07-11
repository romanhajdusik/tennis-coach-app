-- Pripojenie trénerovho Google Kalendára — jeden riadok na trénera,
-- ukladá OAuth tokeny potrebné na vytváranie udalostí a kontrolu kolízií.
create table public.google_calendar_connections (
  coach_id uuid primary key references auth.users (id) on delete cascade,
  access_token text not null,
  refresh_token text not null,
  token_expires_at timestamptz not null,
  calendar_id text not null default 'primary',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.google_calendar_connections enable row level security;

create trigger google_calendar_connections_set_updated_at
  before update on public.google_calendar_connections
  for each row execute function public.set_updated_at();

create policy "google_calendar_connections_all_own"
  on public.google_calendar_connections for all
  using (coach_id = auth.uid())
  with check (coach_id = auth.uid());
