-- Zákaznícke id zo Stripe na profile.
--
-- PREČO: bez neho nevieme trénera pustiť do zákazníckeho portálu Stripe —
-- teda na stránku, kde si sám zmení kartu, prejde na inú hladinu alebo
-- predplatné ZRUŠÍ. Dovtedy mu appka ponúkala len napísať na podporu, čo je
-- pri zrušení predplatného zlá odpoveď: ukončiť zmluvu má byť rovnako
-- jednoduché ako ju uzavrieť.
--
-- Zapisuje to VÝHRADNE Stripe webhook cez `service_role` (`authenticated`
-- nemá na `profiles` UPDATE, a to je zámer — inak by si účet sám nastavil
-- „zaplatené"). Čítať si ho smie vlastník svojho riadku cez existujúcu
-- policy `id = auth.uid()`; nové granty netreba, `select` na tabuľku už je
-- a vzťahuje sa aj na nové stĺpce.
alter table public.profiles
  add column stripe_customer_id text;

comment on column public.profiles.stripe_customer_id is
  'Zákazník v Stripe (cus_…). Plní ho webhook; appka podľa neho otvára zákaznícky portál.';

-- Jeden zákazník Stripe = jeden účet. Čiastočný index, lebo prázdnu hodnotu
-- má drvivá väčšina riadkov a tie sa obmedzovať nemajú.
create unique index profiles_stripe_customer_idx
  on public.profiles (stripe_customer_id)
  where stripe_customer_id is not null;
