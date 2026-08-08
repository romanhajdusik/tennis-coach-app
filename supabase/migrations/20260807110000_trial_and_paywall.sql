-- =============================================================================
-- Skúšobná doba a predplatné (Fáza 3 — paywall pred Stripe)
-- =============================================================================
-- Model (rozhodnuté 2026-08-07): nový tréner má 14 dní všetko zadarmo, potom
-- musí zaplatiť. Po uplynutí smie ČÍTAŤ (história, analytika, hráči), ale nie
-- ZAPISOVAŤ — o svoju prácu nepríde, len ju prestane dopĺňať. Rovnaký režim
-- ako archív, len z iného dôvodu.
--
-- `subscription_status` (už existoval, default 'trial') dostáva slovník:
--   trial         — beží skúšobná doba, rozhoduje `trial_ends_at`
--   active        — platí cez Stripe
--   complimentary — prístup zadarmo od nás (skorí používatelia, demo účty)
--   past_due / canceled — Stripe ukončil platenie, zápis sa zastaví
-- CHECK constraint zámerne nepridávam: presný slovník Stripe statusov sa
-- dorieši až pri jeho napojení a meniť ho potom by znamenalo ďalšiu migráciu.
-- =============================================================================

alter table public.profiles
  add column trial_ends_at timestamptz not null default (now() + interval '14 days');


-- ---------------------------------------------------------------------------
-- Existujúce účty nesmie paywall vyhodiť
-- ---------------------------------------------------------------------------
-- Appka je na produkcii a reálne sa používa. Default vyššie by všetkým doterajším
-- účtom naštartoval 14-dňové odpočítavanie, takže by tréner po dvoch týždňoch
-- prestal môcť plánovať — bez toho, aby si niekde niečo objednal. Skorí
-- používatelia preto dostávajú prístup zadarmo; komu ho neskôr zmeniť na platený,
-- je obchodné rozhodnutie, nie vec tejto migrácie.
update public.profiles set subscription_status = 'complimentary';


-- ---------------------------------------------------------------------------
-- Predplatné si používateľ nesmie prepísať sám
-- ---------------------------------------------------------------------------
-- `profiles_update_own` dovoľovala účtu meniť VLASTNÝ riadok — vrátane
-- `subscription_status`. S paywallom by to bola diera: stačil by jeden priamy
-- zápis cez API a účet si sám nastaví „zaplatené".
--
-- Appka do `profiles` nezapisuje vôbec (overené) — meno aj rolu plní trigger
-- `handle_new_user` z metadát pri registrácii, takže sa tým nič nerozbije.
-- Zápis ostáva `service_role` (odtiaľ ho bude robiť Stripe webhook).
--
-- POZOR do budúcna: keby appka mala niekedy dovoliť úpravu vlastného mena,
-- NEVRACAJ sem policy nad celou tabuľkou — daj grant len na konkrétne stĺpce
-- (`grant update (full_name) on public.profiles to authenticated`), inak sa
-- diera otvorí znova.
drop policy "profiles_update_own" on public.profiles;
revoke update on public.profiles from authenticated;
