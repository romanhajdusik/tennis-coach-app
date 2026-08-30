-- =============================================================================
-- Odstránenie integrácie s Google Kalendárom
-- =============================================================================
-- Rozhodnuté 2026-08-29 pri príprave GDPR dokumentácie. Dôvod nebol technický:
-- bolo to **jediné miesto v celej appke, kde meno dieťaťa opúšťalo naše
-- systémy** — udalosť sa zakladala v Google účte trénera, kde Google nie je
-- naším sprostredkovateľom, ale samostatným prevádzkovateľom.
--
-- Rozhodlo číslo, nie úvaha: `select count(*) from google_calendar_connections`
-- vrátilo na produkcii **0**. Funkciu nikto nepoužíval, takže odstránením
-- nikto o nič neprišiel.
--
-- ČO SA TÝM ZÍSKALO:
--   1. Meno hráča neopúšťa EÚ ani naše systémy.
--   2. **Nález F4 zaniká nadobro** — appka odteraz nedrží ŽIADNE cudzie
--      prihlasovacie údaje. Doteraz sa riešil odložením na Stripe (mal sa
--      opraviť service_role prístupom); odstránením integrácie prestal
--      existovať predmet nálezu. Viď CLAUDE.md a docs/gdpr-zaznam-cinnosti.md.
--   3. Ubudla najporuchovejšia časť projektu (OAuth tokeny, refresh, Google API).
--
-- ČO SA TÝM STRATILO (vedome): kontrola kolízií s ostatnými udalosťami trénera
-- a pripomienky na telefón. Appka nemá push notifikácie, takže tréner odteraz
-- pripomienku nedostane vôbec — pri nule používateľov to nikoho nezasiahlo,
-- ale pri stavbe notifikácií na to pamätaj.
--
-- POZOR PRI OBNOVENÍ: ak by sa integrácia niekedy vracala, potrebuje okrem kódu
-- aj overenie u Googlu (kalendár je „citlivý" rozsah) a k tomu ZVEREJNENÉ
-- zásady ochrany údajov. To bola pravdepodobne aj príčina tej nuly.
-- =============================================================================

-- Tabuľka OAuth tokenov. Bola prázdna (0 riadkov), takže sa nič nestráca.
drop table if exists public.google_calendar_connections;

-- Väzba tréningu na udalosť v kalendári. Bez integrácie je to mŕtvy stĺpec
-- a mŕtvy stĺpec je presne to, čo zásada minimalizácie údajov nechce —
-- rovnaký prípad ako `players.birth_date` (viď docs/gdpr-mapa-roli.md §5.3).
alter table public.sessions
  drop column if exists google_event_id;
