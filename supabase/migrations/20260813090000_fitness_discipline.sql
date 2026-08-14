-- Kondičná disciplína — schéma prestáva byť výhradne tenisová.
--
-- Kondičná appka je druhé nasadenie toho istého enginu (docs/roadmap-buduce-smery.md
-- §2.1) nad tou istou databázou a tým istým Auth. Táto migrácia otvára schéme
-- to, čo kondičný tréning potrebuje, a NIČ nemení pre tenis: všetky zmeny sú
-- rozšírenia (nový stĺpec s predvolenou hodnotou, uvoľnené NOT NULL, širšie
-- CHECK zoznamy). Žiadny existujúci riadok sa neupravuje.

-- 1) Štítok disciplíny na TRÉNINGU.
--
-- Zámerne nie na trénerovi ani na hráčovi:
--   * `assign_player_to_coach` prepisuje `coach_id` aj na starých tréningoch,
--     takže odvodenie od trénera by po preradení hráča spätne premenilo
--     tenisové tréningy na kondičné,
--   * kondičný tréner má v jednom rosteri tenistu aj bedmintonistu, takže
--     ani šport hráča o disciplíne tréningu nehovorí.
--
-- Predvolená hodnota `tennis` je to, čo drží spätnú kompatibilitu: celá
-- doterajšia história je tenisová a appka na `plaw.win` beží bez zmeny.
alter table public.sessions
  add column discipline text not null default 'tennis'
    check (discipline in ('tennis', 'fitness'));

comment on column public.sessions.discipline is
  'Disciplína tréningu (tennis/fitness). Zapisuje ju appka z konfigurácie nasadenia (lib/discipline.ts), nikdy sa neodvodzuje od trénera ani od hráča.';

-- 2) Charakter cvičenia (offensive/neutral/defensive) je TENISOVÝ SLOVNÍK —
-- kondičnému trénerovi nehovorí nič, takže v kondičke ostáva prázdny.
--
-- CHECK meniť netreba: `character in ('offensive','neutral','defensive')` NULL
-- prepustí (trojhodnotová logika — podmienka sa vyhodnotí ako NULL, nie false).
alter table public.session_drills
  alter column "character" drop not null;

-- Rodičovská KÓPIA cvičenia má vlastný `not null` a bez jeho uvoľnenia by
-- trigger `sync_drill_to_parent` pri prvom kondičnom cvičení spadol a zablokoval
-- zápis celého tréningu. (Kondička rodičovskú vrstvu v1 nepoužíva, ale trigger
-- beží nad tou istou tabuľkou pre všetky disciplíny.)
alter table public.parent_session_drill_records
  alter column "character" drop not null;

-- 3) Trvanie cvičenia — kondičná jednotka býva dlhší súvislý blok, preto 60.
-- Zoznam je zjednotením oboch disciplín; užšiu ponuku (tenis 5–30) drží
-- konfigurácia disciplíny v appke, nie databáza.
alter table public.session_drills
  drop constraint session_drills_duration_minutes_check;

alter table public.session_drills
  add constraint session_drills_duration_minutes_check
    check (duration_minutes in (5, 10, 15, 20, 30, 60));

-- 4) Kondičné zamerania medzi povolené kategórie kódov cvičení.
--
-- `drill_codes.category` je jediné miesto s CHECK-om na zameranie
-- (`session_drills.category` je voľný text). Posledné dve kondičné zamerania
-- majú zámerne pevný názov „YOUR 1"/„YOUR 2" — tréner si do nich dá vlastné
-- cvičenia, ale premenovateľné zameranie by muselo byť dáta, nie konfigurácia.
alter table public.drill_codes
  drop constraint drill_codes_category_check;

alter table public.drill_codes
  add constraint drill_codes_category_check check (category in (
    -- tenis
    'Forehand', 'Backhand', 'Volley', 'Return', 'Serve', 'GAME DRILLS', 'POINTS',
    -- kondička
    'ENDURANCE', 'STRENGTH', 'SPEED', 'FOOTWORK', 'COORDINATION', 'MOBILITY',
    'CORE MUSCLES', 'STRETCHING', 'YOUR 1', 'YOUR 2'
  ));

-- POZNÁMKA k `copy_session_to_org_player` (skupinový tréning naprieč trénermi
-- federácie): funkcia `discipline` neprenáša, takže kópia by dostala predvolený
-- `tennis`. Zámerne sa teraz nemení — je dostupná výhradne členom organizácie
-- a kondička vo federácii do v1 nejde (§2.1). Keď na to príde, prenes v nej
-- `discipline` zo zdrojového tréningu rovnako ako `organization_id`, a vychádzaj
-- z reálne nasadenej definície (`pg_get_functiondef`), nie z tejto migrácie.
