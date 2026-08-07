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
| `rls-org.js` | RLS federačnej vrstvy: dohľad, read-only director, členstvo, sedadlá, kódy |
| `browser-coach.js` | Ťuk na tréning prepne hráča, upozornenie, grafy v analytike |
| `browser-director.js` | Onboarding end-to-end (kód → pripojenie → člen v pulte), porovnanie, šírky |

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
