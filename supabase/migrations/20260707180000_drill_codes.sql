-- Tréner si môže personalizovať kódy cvičení pre každé zameranie —
-- 20 slotov na zameranie, defaulty (dnešný pevný zoznam) sa dopĺňajú
-- na úrovni čítania, kým tréner sám neuloží vlastné.
create table public.drill_codes (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references auth.users (id) on delete cascade,
  category text not null check (category in (
    'Forhand', 'Backhand', 'Volley', 'Return', 'Servis', 'Herné cvičenia', 'POINTS'
  )),
  slot integer not null check (slot between 1 and 20),
  code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (coach_id, category, slot)
);

alter table public.drill_codes enable row level security;

create trigger drill_codes_set_updated_at
  before update on public.drill_codes
  for each row execute function public.set_updated_at();

create policy "drill_codes_all_own"
  on public.drill_codes for all
  using (coach_id = auth.uid())
  with check (coach_id = auth.uid());
