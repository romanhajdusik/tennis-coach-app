-- Hráčsky denník má vždy JEDNU kartu — seba (docs/roadmap-buduce-smery.md §6).
--
-- Hladinu zapisuje webhook podľa ceny, ktorá sa platí (`playerLimitOfLookupKey`).
-- Hráčsky denník má vlastný portál bez trénerských plánov
-- (`STRIPE_PORTAL_SELF_CONFIGURATION`), ale keby sa k trénerskej cene dostal
-- inak (chýbajúca premenná, ručná zmena v dashboarde), dostal by miesto pre
-- ďalších hráčov. Trigger to zrazí na 1 ticho — CHECK by zápis webhooku
-- odmietol, webhook by vrátil 500 a Stripe by udalosť opakoval donekonečna,
-- takže by sa nezapísal ani stav predplatného.
--
-- Ide na prod v SQL Editore spolu s `20261006090000_self_diary` (PRED pushom).

create or replace function public.self_diary_single_player()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.self_diary then
    new.player_limit := 1;
  end if;
  return new;
end;
$$;

-- Funkcia je len pre trigger; nikto ju nemá volať priamo (§7 security-boundaries:
-- `anon` ani `authenticated` nemajú EXECUTE na funkciách, ktoré nepotrebujú).
revoke execute on function public.self_diary_single_player() from public, anon, authenticated;

create trigger profiles_self_diary_single_player
  before insert or update of player_limit, self_diary on public.profiles
  for each row execute function public.self_diary_single_player();
