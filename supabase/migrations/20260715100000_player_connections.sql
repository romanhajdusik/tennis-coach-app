-- Prepojenie rodiča/manažéra s hráčom u konkrétneho trénera. Tréner
-- vygeneruje kód pre hráča, rodič ho raz zadá vo vlastnej (samostatnej)
-- časti appky. Jeden rodič má vždy najviac jedno aktívne prepojenie —
-- zadanie nového kódu automaticky nahradí staré (rovnaký princíp ako
-- one_active_player pri trénerovi).

create table public.player_connections (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references auth.users (id) on delete cascade,
  player_id uuid not null references public.players (id) on delete cascade,
  parent_id uuid references auth.users (id) on delete cascade,
  connect_code text not null unique,
  status text not null default 'pending' check (status in ('pending', 'active', 'revoked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index one_active_connection_per_parent
  on public.player_connections (parent_id) where status = 'active';

alter table public.player_connections enable row level security;

create trigger player_connections_set_updated_at
  before update on public.player_connections
  for each row execute function public.set_updated_at();

grant select, insert, update, delete on public.player_connections to authenticated, service_role;

-- Tréner spravuje vlastné prepojenia (vytvorenie kódu, zrušenie zdieľania)
create policy "player_connections_all_own_coach"
  on public.player_connections for all
  using (coach_id = auth.uid())
  with check (coach_id = auth.uid());

-- Rodič vidí len svoje (už priradené) prepojenia
create policy "player_connections_select_own_parent"
  on public.player_connections for select
  using (parent_id = auth.uid());

-- ---------------------------------------------------------------------------
-- claim_player_connection — "zaklaimovanie" kódu rodičom. Beží ako
-- security definer, aby vedel nájsť pending riadok podľa kódu (rodič
-- naň ešte nemá priamy RLS prístup) a atomicky zároveň zrušiť predošlé
-- aktívne prepojenie toho istého rodiča (aby platilo "len jedno aktívne
-- naraz"). Priame RLS update pravidlo pre "kohokoľvek prihláseného" by
-- sa nedalo v with check ustrážiť pred zmenou coach_id/player_id, preto
-- funkcia namiesto toho.
-- ---------------------------------------------------------------------------
create function public.claim_player_connection(p_code text)
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

  return query select v_player_id, v_coach_id;
end;
$$;

grant execute on function public.claim_player_connection(text) to authenticated;
