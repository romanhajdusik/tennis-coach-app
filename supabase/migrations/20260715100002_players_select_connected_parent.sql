-- Rodič s aktívnym prepojením potrebuje vedieť aspoň meno pripojeného
-- hráča (napr. embedded select player_connections -> players na
-- /parent dashboarde) — chýbajúca select policy spôsobovala, že meno
-- hráča bolo pre rodiča vždy prázdne.
create policy "players_select_connected_parent"
  on public.players for select
  using (
    exists (
      select 1 from public.player_connections pc
      where pc.player_id = players.id
        and pc.parent_id = auth.uid()
        and pc.status = 'active'
    )
  );
