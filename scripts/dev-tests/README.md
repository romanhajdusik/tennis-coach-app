# Lokálne overovacie skripty

Ručne spúšťané skripty na overenie appky proti **lokálnej** Supabase inštancii
a dev serveru. Nie sú to unit testy a nebežia v CI — sú to scenáre, ktoré
prechádzajú appku tak, ako ňou prejde používateľ (HTTP, RLS, prehliadač).

Vznikli pri stavbe federačnej (B2B) vrstvy, kde sa veľa vecí nedá overiť inak
než naostro: org kontext ide z hostname, prístup stráži RLS a stavy hráčov
závisia od času a časového pásma.

## Príprava

```bash
npx supabase start                    # lokálna DB
npx supabase migration up --local     # schéma
npm run dev                           # dev server na :3000
node scripts/dev-tests/seed.js        # testovacie dáta (--sixth = 6. hráč)
```

`seed.js` je idempotentný — pokojne ho spúšťaj opakovane. Hráčov a tréningy
testovacích trénerov vždy prepíše načisto a zapíše `expect.json` (očakávané
počty pre daný beh, aby testy nezáviseli od hodiny spustenia).

## Sady

| Skript | Čo overuje |
|---|---|
| `http-coach.js` | Nástenka „Dnes", roster so stavmi, nedotknutý samostatný režim |
| `http-director.js` | Smerovanie podľa roly, obsah pultu, drill-in, tenant izolácia |
| `rls-org.js` | RLS federačnej vrstvy: dohľad, read-only director, členstvo, sedadlá, kódy, preradenie hráča, životný cyklus členstva |
| `rls-solo.js` | RLS samostatného (1:1) režimu: zdieľanie smie viesť len na vlastného hráča, odvolanie sa nedá obísť, kód uplatní len prihlásený, rodičovi ostáva jeho prístup |
| `paywall.js` | Skúšobná doba: pruh, čítanie po jej uplynutí, `complimentary`, výnimka pre org trénera, neprepísateľné predplatné |
| `browser-coach.js` | Ťuk na tréning prepne hráča, upozornenie, grafy v analytike, paywall odmietne zápis, cenová hladina počtu hráčov, presun naplánovaného tréningu v oboch režimoch |
| `browser-director.js` | Onboarding end-to-end (kód → pripojenie → člen v pulte), porovnanie, šírky, odchod trénera a prevzatie jeho hráčov, návrat a trvalé zmazanie člena |

```bash
node scripts/dev-tests/http-coach.js      # a ostatné rovnako
```

Klikacie sady potrebujú Playwright, ktorý **nie je závislosťou projektu** —
inštaluje sa dočasne a po dobehnutí sa odinštaluje:

```bash
npm install --no-save playwright && npx playwright install chromium
node scripts/dev-tests/browser-director.js
npm uninstall playwright
```

Screenshoty padajú do `screenshots/` (gitignorované).

## Na čo si dať pozor

Toto sú pasce, ktoré nás pri písaní scenárov reálne pomýlili — sú ošetrené
v `helpers.js`, ale keď budeš pridávať ďalšie, platia rovnako:

- **Federačný režim sa nedá testovať na `localhost`.** Org kontext ide výhradne
  z hostname, takže požiadavky musia niesť `Host: <slug>.plaw.win`. Node `fetch`
  hlavičku `Host` zahadzuje (je „forbidden"), preto `node:http`; v prehliadači
  `--host-resolver-rules=MAP <slug>.plaw.win 127.0.0.1:3000`.
- **`allowedDevOrigins` musí obsahovať `*.plaw.win`** (už je v `next.config.ts`).
  Bez toho Next v dev zablokuje požiadavky z tohto hostname a stránka sa
  **nehydratuje** — tlačidlá závislé od JS ticho nefungujú, kým formuláre
  (server actions) bežia ďalej. Prejaví sa to len lokálne, nie na produkcii.
- **Časové pásmo:** appka renderuje časy v pásme diváka, seed píše časy v pásme
  stroja. Bez cookie `NEXT_TIMEZONE` sa výsledky rozídu o offset pásma.
- **Porovnávaj len vykreslené HTML.** next-intl posiela do stránky všetky
  preklady v `<script>`, takže surový text nájde aj to, čo sa nevykreslilo.
- **Hodnoty `<input>` nie sú v texte stránky** — kódy cvičení čítaj cez
  `inputValue()` / `evaluateAll(node => node.value)`.
- **`waitForURL` po prihlásení je vratké** (reťaz redirectov `/` → `/director`).
  Na cieľ choď priamo cez `goto()`; samotné presmerovanie overuje HTTP sada.
- **Vybraný hráč je stav.** Scenár, ktorý prepne hráča (napr. cez upozornenie),
  ovplyvní všetko ďalšie — analytika sa viaže na vybraného hráča.
- **RLS sa pýta na členstvo, nie na hostname.** `current_org_id()` číta
  `organization_members`, takže federačnému trénerovi vydá jeho org hráčov aj
  na `plaw.win`. Čokoľvek, čo sa mimo org subdomény rozhoduje podľa počtu
  hráčov, musí preto filtrovať `organization_id is null` — inak sa federačnému
  trénerovi zapne nástenka organizácie mimo nej (odhalila to `http-coach.js` §3).
- **Limit hráčov ani paywall sa nedajú overiť cez holé HTTP** — sú v server
  actions, nie v RLS. Formulár sa musí naozaj odoslať v prehliadači
  (`browser-coach.js` §7 a §8), inak scenár testuje len skryté tlačidlo.
- **Formulár zacieľuj cez jeho vlastné pole, nie cez `form button`.** Pri 2+
  aktívnych hráčoch je nad formulárom tréningu **prepínač hráčov**, ktorý má
  tiež formuláre s tlačidlami — `form button[type="button"]`.first() potom
  klikne naň a scenár „prejde" bez odoslania (tréning sa nezapíše, ale ani
  nevznikne chyba, takže to vyzerá ako úspech). Použi
  `form:has(input[name="date"])`. Rovnaká pasca ako pri `/parent`.
- **Na `/parent` je nad formulárom na zadanie kódu aj odhlasovací formulár**,
  takže `form button[type="submit"]` trafí „Log out" — scenár sa ticho odhlási
  a vyzerá to, akoby zlyhal claim. Formulár zacieľ cez jeho vlastné pole:
  `form:has(input[name="code"]) button[type="submit"]`.
- **Trénerov hľadaj podľa e-mailu, nie podľa poradia riadkov.** Dotaz na
  `organization_members` bez `order` vracia poradie podľa vzniku členstva, a to
  sa preklopí, len čo `browser-director.js` trénera odoberie a zase vráti.
  Scenár na preradenie hráča sa prihlasuje konkrétnymi účtami, takže pri
  opačnom poradí kontroloval nesprávneho trénera a padal na troch checkoch.
- **Do `chromiumArgs()` patrí každý host, na ktorý scenár chodí.** Nenamapovaný
  host sa v prehliadači vyrieši cez DNS — teda na **produkciu**, kde by sa test
  prihlásil a zapisoval naostro. Preto sú mapované aj `plaw.win`, aj org
  subdoména; `allowedDevOrigins` v `next.config.ts` musí obsahovať oboje
  (`*.plaw.win` **nezahŕňa** holé `plaw.win`).
- **Natívne `confirm()` Playwright automaticky ZAMIETNE.** Akcie na
  `/director/team` (odobrať, vrátiť späť, vymazať) sa pýtajú kontrolnou otázkou,
  takže pred každým klikom treba `page.once("dialog", d => d.accept())` — inak
  scenár klikne, nič sa nestane a vyzerá to ako chyba appky.
- **Nezvratné akcie skúšaj na účte, ktorý si scenár sám vytvoril.** Trvalé
  zmazanie člena sa v `browser-director.js` §8 robí na `coach-new@test.local`
  z onboardingu (ten sa aj tak na konci maže); na seedovaných trénerov nesiahaj,
  ostatné sady s nimi počítajú.
- **So zmazaným tréningom zmaž aj kópiu u rodiča.** DELETE sa k rodičovi
  zámerne nepropaguje (kópia musí prežiť aj zmazanie trénerovho účtu), takže
  scenár, ktorý si tréning založí a zase zmaže, nechá pri zdieľanom hráčovi
  navyše jeden riadok v `parent_session_records` — a ten sa každým behom
  kopí. V `finally` ho zmaž podľa `source_session_id` (cvičenia idú s ním cez
  `on delete cascade`).
- **Scenáre, ktoré menia členstvo alebo priradenie hráča, musia po sebe upratať
  v `finally`.** `browser-director.js` trénera odoberá a zase vracia; keď taký
  scenár spadne uprostred, ďalší beh sa rozsype už na počte sedadiel. Preto sa
  členstvá seedovaných trénerov navyše obnovujú aj na štarte sady.

## Účty

Heslo `TestPlaw2026!`, okrem `demo@plaw.win`, ktorý má `DemoPlaw2026!`.

| Účet | Rola |
|---|---|
| `director-today@test.local` | šéftréner organizácie `todaytest` |
| `coach-today@test.local` | tréner (5 hráčov v rôznych stavoch) |
| `coach2-today@test.local` | tréner (1 hráč — kvôli zoskupovaniu v pulte) |
| `coach-new@test.local` | bez členstva — na test onboardingu |
| `demo@plaw.win` | samostatný (1:1) tréner, dáta v jún–júl 2026 |
| `parent-test@test.local` | rodič pripojený k hráčovi demo trénera |
