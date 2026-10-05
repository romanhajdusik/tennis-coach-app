-- =============================================================================
-- Kódy cvičení dostávajú disciplínu (docs/roadmap-buduce-smery.md §1.1, krok 1)
-- =============================================================================
-- Doteraz názov zamerania jednoznačne určoval disciplínu: katalógy tenisu
-- a kondičky sú disjunktné, takže `drill_codes` disciplínu nepotrebovali
-- a unikát bol `(vlastník, zameranie, slot)`.
--
-- S padelom, bedmintonom a pickleballom to prestane platiť — padel bude mať
-- `Forehand` ako tenis. Šéftréner, ktorý nastavuje štandard pre dve kurtové
-- disciplíny, by si tenisový a padelový `Forehand` prepisoval navzájom.
-- Názov zamerania sa preto NEprefixuje (`padel-forehand` by sa dostal do
-- adries aj grafov), rozlišuje ho tento stĺpec.
--
-- Táto migrácia žiadnu novú disciplínu nepridáva — len odstraňuje predpoklad,
-- že sa názvy zameraní neopakujú. Zoznam disciplín sa rozširuje v kroku 2.
--
-- Stĺpec je ZÁMERNE BEZ predvolenej hodnoty (na rozdiel od
-- `sessions.discipline`): zápis, ktorý by disciplínu zabudol, má spadnúť, nie
-- ticho uložiť tenis.
-- =============================================================================

alter table public.drill_codes
  add column discipline text;

-- Backfill: dnešné katalógy sú disjunktné, takže zameranie disciplínu určuje
-- jednoznačne. CHECK nižšie zaručuje, že nič iné v tabuľke byť nemôže.
update public.drill_codes
  set discipline = case
    when category in (
      'ENDURANCE', 'STRENGTH', 'SPEED', 'FOOTWORK', 'COORDINATION', 'MOBILITY',
      'CORE MUSCLES', 'STRETCHING', 'WARM UP - COOL DOWN', 'REGENERATION'
    ) then 'fitness'
    else 'tennis'
  end;

alter table public.drill_codes
  alter column discipline set not null;

comment on column public.drill_codes.discipline is
  'Disciplína, do ktorej katalógu zameranie patrí (tennis/fitness). Bez predvolenej hodnoty — zapisuje ju appka z konfigurácie disciplíny. Názov zamerania sa medzi disciplínami môže opakovať (padel aj tenis majú Forehand), preto je súčasťou unikátov.';

-- Kontrola zamerania sa mení z jedného zoznamu na DVOJICU (disciplína,
-- zameranie): rovnaký názov smie byť vo viacerých disciplínach, ale len
-- v tej, ktorej katalóg ho pozná. Musí sedieť s `lib/disciplines/*.ts`.
alter table public.drill_codes
  drop constraint drill_codes_category_check;

alter table public.drill_codes
  add constraint drill_codes_category_check check (
    (discipline = 'tennis' and category in (
      'Forehand', 'Backhand', 'Volley', 'Return', 'Serve', 'GAME DRILLS', 'POINTS'
    ))
    or (discipline = 'fitness' and category in (
      'ENDURANCE', 'STRENGTH', 'SPEED', 'FOOTWORK', 'COORDINATION', 'MOBILITY',
      'CORE MUSCLES', 'STRETCHING', 'WARM UP - COOL DOWN', 'REGENERATION'
    ))
  );

-- Unikáty dostávajú disciplínu. Obe sú plnohodnotné constrainty (nie čiastočné
-- indexy), lebo appka cez ne robí upsert — viď `20260807090000`.
alter table public.drill_codes
  drop constraint drill_codes_coach_id_category_slot_key;

alter table public.drill_codes
  add constraint drill_codes_coach_slot
  unique (coach_id, discipline, category, slot);

alter table public.drill_codes
  drop constraint drill_codes_organization_slot;

alter table public.drill_codes
  add constraint drill_codes_organization_slot
  unique (organization_id, discipline, category, slot);
