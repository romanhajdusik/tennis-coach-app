-- Rola "player" (hráč) — hráč sa môže prihlásiť sám za seba rovnakou cestou
-- ako rodič/manažér (/parent/login), zdieľa rovnaký claim_player_connection
-- mechanizmus aj read-only dashboard. Rovnaké oprávnenia ako parent/manager,
-- rola je len UI štítok.
alter table public.profiles
  drop constraint profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check
  check (role in ('coach', 'parent', 'manager', 'player'));
