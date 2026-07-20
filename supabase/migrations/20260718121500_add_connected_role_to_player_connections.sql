-- Tréner nemá (a nemá mať) RLS prístup k cudziemu profiles riadku, takže rolu
-- pripojenej osoby (rodič/manažér/hráč) si nemôže dočítať cez join. Namiesto
-- toho ju claim_player_connection nasnímne priamo pri zaklaimovaní kódu —
-- rovnaký princíp kopírovania dát, aký appka používa aj pri
-- parent_session_records. Nullable, lebo staršie (pred touto migráciou)
-- zaklaimované prepojenia rolu snapshotnutú nemajú — appka pre ne zobrazí
-- neutrálny fallback.
alter table public.player_connections
  add column connected_role text;

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

  return query select v_player_id, v_coach_id;
end;
$$;
