# CLAUDE.md — P.L.A.W (Plan.Log.Analyze.Win)

Tento súbor riadi prácu Claude Code na projekte. Vždy sa ním riaď.

## O projekte

**P.L.A.W** ("Plan. Log. Analyze. Win.") — SaaS aplikácia pre tenisových trénerov a rodičov na plánovanie, správu a analýzu tréningov. Model 1:1 — tréner spravuje vždy len jedného aktívneho hráča. Responzívna webová aplikácia (Mobile First, použiteľná na smartfóne priamo na kurte).

Názov appky sa v kóde nastavuje cez `Common.appTitle`/`appShortName` v `messages/{sk,en}/common.json` (PWA názov aj titulok stránky) a je hardcodovaný vo wordmarku/tagline v hlavičke `components/landing-page.tsx` — pri prípadnej ďalšej zmene názvu treba upraviť oba miesta. Doména **plaw.win** je kúpená, ale zatiaľ nepripojená na Vercel — appka beží na `*.vercel.app` URL, kým sa doména nepripojí (Vercel dashboard → Settings → Domains + DNS u registrátora).

Jadrom appky sú **kódy cvičení** (`drill_codes`, pozri dátový model nižšie) — tréner si nimi personalizuje vlastné skratky cvičení, ktoré sa potom vyberajú pri zázname tréningu a presne podľa nich sa rozpadá Analytika. Landing page aj návod pre trénerov toto zámerne zdôrazňujú ako prvý krok po pridaní hráča, nie ako voliteľnú drobnosť.

## Jazyk a konvencie

- **UI, texty, dokumentácia:** slovenčina
- **Commit messages:** slovenčina (napr. `Pridaný formulár na plánovanie tréningu`)
- **Kódové komentáre:** slovenčina
- **Názvy premenných, funkcií, tabuliek:** angličtina (štandard)

## Technologický stack

- **Frontend:** Next.js (App Router) + TypeScript
- **Styling:** Tailwind CSS
- **Grafy:** Recharts
- **Backend/DB:** Supabase (PostgreSQL, Auth, Edge Functions)
- **Hosting:** Vercel — appka je nasadená na produkcii, automatický deploy pri pushi do `master` (žiadny `vercel.json`/CI gate). Zmeny sa musia commitnúť a pushnúť, inak sa k trénerovi na telefón nedostanú — lokálny build/test nestačí
- **Platby:** Stripe (fáza 3, zatiaľ neimplementovať)

## Príkazy

```bash
npm run dev                       # lokálny vývoj
npm run build                     # produkčný build
npm run lint                      # lint
npx supabase start                # lokálna Supabase inštancia
npx supabase migration up --local # aplikovanie migrácií lokálne
npx supabase db push              # aplikovanie migrácií na linknutý remote projekt (nie lokálne)
npx supabase gen types typescript --local > lib/database.types.ts # po každej migrácii
```

## Dátový model (PostgreSQL)

### Tabuľky

1. **profiles** — údaje o trénerovi, stav SaaS predplatného (predplatné zatiaľ len ako stĺpec, Stripe logika príde neskôr)
2. **players** — všetci spravovaní hráči
   - `is_active` (boolean) — **vždy len jeden aktívny hráč na trénera**
   - Vynútené na úrovni DB: `CREATE UNIQUE INDEX one_active_player ON players (coach_id) WHERE is_active = true;`
3. **sessions** — tréningy naviazané na hráča
   - `planned_data` (plánovaný čas a zameranie), `actual_data` (reálny čas), `notes`, `status` (`planned` / `completed` / `cancelled` — `cancelled` je v DB kvôli budúcemu použitiu, appka dnes namiesto neho naplánovaný tréning rovno **zmaže**, pozri "Životný cyklus tréningu")
   - `google_event_id` (text, nullable) — **pridať už od začiatku**, príprava na kalendárovú synchronizáciu
4. **metrics_and_tests** — kondičné a technické testy hráča (implementácia vo fáze 2, tabuľku možno vytvoriť vopred)
5. **session_drills** — cvičenia v rámci tréningu (kategória/zameranie, charakter úderu, kód cvičenia, trvanie)
   - `status` (`played` / `not_played` / `replaced`) — review označenie, defaultne `played`
   - `replaces_drill_id` — väzba náhradného cvičenia na to, ktoré nahrádza (len informatívna, na poradie sa už nepoužíva)
   - `sort_order` (integer, not null) — **jediný zdroj poradia v zozname**, tréner ho vie meniť šípkami hore/dole (`lib/actions/session-drills.ts#moveDrill`), len kým je tréning `planned` (RLS zablokuje update pri `completed`). `addDrill` pridáva na koniec, `replaceDrill` vloží nové cvičenie hneď za nahradzované (posunie zvyšok o jedno miesto)
6. **drill_codes** — trénerom personalizované kódy cvičení, **jadro celej appky** (pozri "O projekte" vyššie): 20 slotov na zameranie (`coach_id`, `category`, `slot` 1–20, `code`)
   - Bez uložených riadkov pre danú kategóriu sa použije predvolený zoznam z `lib/drill-options.ts` (`DRILLS`); po prvom uložení je DB autoritatívna. Tréner tak na `/drill-codes` od začiatku vidí kompletný, hneď použiteľný zoznam — nič nemusí nastavovať, ale môže ktorýkoľvek slot premenovať na vlastnú skratku
   - Editovateľné na `/drill-codes`. Presne tieto kódy sa ponúkajú vo výbere pri zázname cvičenia (`session_drills.drill_code`) a presne podľa nich sa rozpadá Analytika (pozri nižšie) — zmena kódu tu sa neprejaví spätne na už zaznamenaných cvičeniach
7. **google_calendar_connections** — OAuth tokeny pripojenia trénerovho Google Kalendára (`coach_id` PK, `access_token`, `refresh_token`, `token_expires_at`, `calendar_id`)
   - Jeden riadok na trénera, spravované cez `/settings` (pripojiť/odpojiť), logika v `lib/google/calendar.ts`
8. **player_connections** — prepojenie rodiča/manažéra/hráča s hráčom u konkrétneho trénera (`coach_id`, `player_id`, `parent_id` nullable kým nie je zaklaimované, `connect_code`, `status` `pending`/`active`/`revoked`, `connected_role` nullable text — snapshot `profiles.role` z momentu zaklaimovania, pozri nižšie prečo)
   - `CREATE UNIQUE INDEX one_active_connection_per_parent ON player_connections (parent_id) WHERE status = 'active'` — jeden rodič/manažér/hráč = jedno aktívne prepojenie naraz, nový kód automaticky nahradí staré
   - RPC `claim_player_connection(p_code)` (`security definer`) — rodič/manažér/hráč zadá kód, funkcia nájde `pending` riadok, zruší predošlé aktívne prepojenie toho istého používateľa, aktivuje nové a zároveň doň nasnímne `connected_role` (trénerova appka nemá RLS prístup k cudziemu `profiles` riadku, aby si rolu dočítala joinom, preto kópia priamo v RPC — rovnaký princíp ako `parent_session_records`)
9. **parent_session_records** / **parent_session_drill_records** — **trvalá kópia** tréningov pre pripojeného rodiča/manažéra/hráča, nie live pohľad (pozri sekciu "Zdieľanie s rodičom/manažérom/hráčom" nižšie prečo)

### Bezpečnostné pravidlá (povinné)

- **RLS zapnuté na každej tabuľke.** Základná policy: `coach_id = auth.uid()`
- **Archív (neaktívny hráč) je read-only na úrovni DB:** RLS policy blokuje UPDATE/DELETE na sessions a metrics, ak hráč má `is_active = false`. UI kontrola nestačí.
- **Dokončený tréning (`sessions.status = 'completed'`) je tiež read-only na úrovni DB:** RLS blokuje UPDATE/DELETE na `sessions` a `session_drills` (aj INSERT nových cvičení), rovnaký princíp ako archív.
- Všetky zmeny schémy výhradne cez migrácie (Supabase CLI), nikdy manuálne v dashboarde.

## Životný cyklus tréningu

1. **Plánovanie (planned):** vytvorenie zámeru — dátum, čas, zameranie. Kým je tréning v tomto stave, dá sa aj **úplne zrušiť** (`lib/actions/sessions.ts#deleteSession` — natrvalo zmaže session aj jej cvičenia cez `on delete cascade`, nie len zmena statusu; potvrdzuje sa dvojkrokovo v UI). Cvičenia sa dajú preusporiadať šípkami hore/dole (`session_drills.sort_order`)
2. **Aktualizácia (review):** po tréningu tréner doplní reálny čas a poznámky; jednotlivé cvičenia môže označiť ako **neodohrané** alebo **nahradené** (náhrada sa zaradí v zozname hneď za pôvodným cvičením)
3. **Archivácia (completed):** uzamknutie záznamu (vynútené aj cez RLS) — od tohto bodu už nejde tréning ani zrušiť, ani cvičenia preusporiadať

## Analytika

- Filtrovanie podľa obdobia: **týždeň**, **mesiac**, **kvartál**, **rok** — s porovnaním voči minulému roku (`/analytics/[category]`)
- Prehľad podľa kódu cvičenia (čas, odhadovaný počet úderov, % využitia) a podľa charakteru cvičenia (offensive/neutral/defensive)
- Dáta sa vždy načítavajú len pre aktívneho hráča (`players.is_active = true`), priamo v server action (`lib/actions/analytics.ts`), nie cez DB views — pri zmene hráča sa dashboardy prirodzene vynulujú
- Vizualizácia: Recharts (donut aj stĺpcový graf)
- **Zameranie-špecifické pravidlá** (`ANALYTICS_FULL_BREAKDOWN_CATEGORIES` v `lib/drill-options.ts`): Forhand, Backhand, Volley a GAME DRILLS zobrazujú vždy úplný rozpad všetkých použitých kódov (žiadne zbaľovanie do "Ostatné") a majú prepínač dizajnu grafu koláč/stĺpce (`app/analytics/[category]/category-charts.tsx`). Return a Serve majú dvojúrovňové skupinové zobrazenie (`ANALYTICS_GROUPED_CATEGORIES`): stĺpcový graf rozdelí kódy podľa prefixu na "Forhand return"/"Backhand return" resp. "1st serve"/"2nd serve", klik na stĺpec zobrazí detail kódov danej skupiny — rovnaké skupiny sa zobrazujú aj pri editácii kódov na `/drill-codes`. POINTS (`ANALYTICS_TOTAL_TIME_ONLY_CATEGORIES`) nemá rozpad podľa kódu ani charakteru — zobrazuje jediný graf: celkový odohraný čas za obdobie ako veľké číslo.
- **Počet úderov** sa štandardne počíta z charakteru cvičenia (offensive/neutral/defensive), ale Return, Serve a GAME DRILLS majú vlastnú fixnú sadzbu úderov/min (`FIXED_STROKES_PER_MIN_CATEGORIES` v `lib/actions/analytics.ts`), keďže majú inú frekvenciu výmen než hra z dna kurtu.

## Google Calendar (jednosmerne, Fáza 2)

- Tréner si pripojí svoj Google účet na `/settings` (`app/api/google/auth` → OAuth consent → `app/api/google/callback` uloží tokeny do `google_calendar_connections`)
- Pri naplánovaní tréningu (`createSession` v `lib/actions/sessions.ts`) appka automaticky vytvorí udalosť v pripojenom Google Kalendári (`lib/google/calendar.ts`, `syncSessionToGoogleCalendar`) a uloží jej ID do `sessions.google_event_id`
- Plánovanie tréningu má teraz aj pole **plánovaná dĺžka** (60/90/120 min, `planned_data.duration_minutes`) — potrebné na určenie konca kalendárovej udalosti
- **Kontrola kolízií** pri plánovaní len upozorní (banner na stránke tréningu cez `?calendarWarning=collision`), neblokuje uloženie
- Ak tréner nemá pripojený kalendár alebo Google API zlyhá, tréning sa vytvorí bez neho — kalendárová synchronizácia nikdy neblokuje základné plánovanie
- **Zatiaľ len jednosmerne** (app → kalendár): úprava/zrušenie tréningu sa do Google Kalendára nepremieta, kým appka nemá UI na editáciu naplánovaného tréningu. Obojsmerná synchronizácia (webhooks) je neskoršia fáza.

## Zdieľanie s rodičom/manažérom/hráčom

- Rola `player` (hráč) sa pridala 2026-07-18 k `parent`/`manager` — **rovnaké oprávnenia ako oni** (rola je len UI štítok, žiadna rozdielna logika), takže hráč sa môže prihlásiť sám za seba a sledovať vlastné tréningy. Všetko nižšie v tejto sekcii platí pre všetky tri role rovnako, pokiaľ nie je uvedené inak.
- Rodič/manažér/hráč má **vlastný, oddelený vstupný bod** appky — `/parent/login` (nie ten istý `/login` ako tréner), aj keď ide o rovnaký Supabase Auth a rovnaký kód/deploy. Po registrácii s rolou `parent`/`manager`/`player` appka presmeruje na `/parent` namiesto `/` (`app/page.tsx` a `register()` v `lib/actions/auth.ts` kontrolujú len `role !== "coach"`, takže pridanie novej neterénerskej roly nevyžadovalo zmenu redirect logiky).
- Tréner vygeneruje kód pre aktívneho hráča na `/players` (sekcia "Zdieľať prístup", `lib/actions/player-connections.ts#generateConnectCode`) a pošle ho rodičovi/manažérovi/hráčovi mimo appky (SMS a pod.). Ten ho raz zadá na `/parent` (`claimConnection` → RPC `claim_player_connection`). Tréner potom na `/players` vidí presnú rolu pripojeného účtu (`share-player-section.tsx`, "Pripojený: Rodič/Manažér/Hráč" — čerpá z `connected_role`, staršie prepojenia bez snapshotu zobrazia neutrálny fallback "Pripojené").
- **Kľúčové architektonické rozhodnutie: appka dáta pre rodiča priebežne KOPÍRUJE, nezobrazuje ich cez live RLS pohľad nad `sessions`/`session_drills`.** Dôvod: keď tréner zmení aktívneho hráča, ukončí spoluprácu, alebo tréning/účet zmaže, rodič **nesmie prísť o doteraz nazbieranú históriu**. `AFTER INSERT OR UPDATE` triggery (`sync_session_to_parent`, `sync_drill_to_parent`) upsertujú zmeny do `parent_session_records`/`parent_session_drill_records`, len ak pre daného hráča existuje aktívne prepojenie — appka o tejto synchronizácii vôbec nemusí vedieť, funguje pre všetky existujúce cesty zápisu (`createSession`, `updateSessionReview`, `completeSession`, `addDrill`, `replaceDrill`, `setDrillPlayed`).
  - **DELETE sa zámerne nepropaguje** (napr. "Zrušiť tréning") — kópia u rodiča ostáva aj po zmazaní pôvodnej session. `parent_session_records.source_session_id` je zámerne **bez foreign key** na `sessions`, aby kópia prežila aj zmazanie celého trénerovho účtu.
  - Pri `claim_player_connection` sa jednorazovo spätne doplní aj existujúca história hráča (nielen budúce zmeny) — rodič po pripojení hneď vidí, čo sa dovtedy odohralo.
  - Zrušenie prepojenia (`revokeConnection`) len nastaví `status = 'revoked'` — synchronizácia sa zastaví, ale doteraz skopírované dáta ostávajú. Nový tréner = nový kód = nové dáta pribúdajú do **toho istého** `parent_id`, takže rodičovi vzniká kontinuálny záznam naprieč viacerými trénermi v čase.
- Rodičovské stránky (`app/parent/`) sú **čisto na čítanie** — kalendár, detail tréningu, analytika, žiadne plánovanie ani editácia. Analytická agregácia je zdieľaná s trénerovou (`aggregateDrillStats` v `lib/actions/analytics.ts`, volaná aj z `lib/actions/parent-data.ts`), len zdroj dát je iný.
- `login`/`logout`/`register` v `lib/actions/auth.ts` berú `redirectTo` ako bindovaný parameter, aby fungovali pre oba vstupné body (`/login` → `/`, `/parent/login` → `/parent`) bez duplikovania auth logiky.
- Platba za rodičovský prístup je zatiaľ nevyriešená (téma Fázy 3/Stripe) — rodič sa zatiaľ registruje zadarmo.

## Internacionalizácia (i18n)

- Appka podporuje slovenčinu a angličtinu (`next-intl`), **bez URL prefixov** (`/en/...` neexistuje) — jazyk sa zisťuje z cookie `NEXT_LOCALE` (`i18n/request.ts`, `getRequestConfig`), predvolená hodnota je `sk`
- Prepínač jazyka (`components/locale-switcher.tsx`) je zobrazený raz globálne v `app/layout.tsx` (fixed pozícia v rohu), nie na každej stránke zvlášť — mení cookie cez `lib/actions/locale.ts` (`setLocale`) a spraví `router.refresh()`
- Preklady sú v `messages/sk/<oblasť>.json` a `messages/en/<oblasť>.json`, jeden súbor na oblasť appky (`common`, `auth`, `home`, `players`, `sessions`, `drill-codes`, `analytics`, `calendar`, `settings`, `parent`) — pri pridaní novej oblasti treba pridať import do `loadMessages` v `i18n/request.ts`
- **Výnimka: landing page (`/`, len pre odhlásených) nejde cez next-intl.** Má vlastnú, appke nezávislú jazykovú vrstvu s 4 jazykmi SK/EN/DE/ES (`lib/landing-locale.ts`, `messages/{sk,en,de,es}/landing.json`, cookie `LANDING_LOCALE` nastavovaná cez `lib/actions/landing-locale.ts`/`components/landing-language-switcher.tsx`) — appka ako celok podporuje len SK/EN. Dôvod: rozšíriť `next-intl` na 4 jazyky by si vyžiadalo preklad všetkých oblastí vyššie, nielen landing page, keďže `loadMessages` v `i18n/request.ts` natiahne všetky súbory naraz pre daný locale
- Server Components používajú `getTranslations()`/`getFormatter()` z `next-intl/server`, Client Components (`"use client"`) používajú `useTranslations()`/`useFormatter()` z `next-intl`. Server actions môžu tiež volať `getTranslations()` (funguje mimo renderovania) pre preklad chybových hlášok
- Formátovanie dátumov ide vždy cez `format.dateTime(date, options)` (nikdy natvrdo `toLocaleString("sk-SK", ...)`), automaticky podľa aktuálneho jazyka
- **Čo sa NEPREKLADÁ**: `lib/drill-options.ts` (kategórie cvičení, kódy cvičení, skupinové názvy ako "Forhand return") — sú to dáta/konvencie trénera, nie UI text. Kódové komentáre a interné diagnostické hlášky (napr. `console.error` v `lib/google/calendar.ts`) ostávajú po slovensky, keďže sa nikdy nezobrazujú používateľovi
- DB enum hodnoty (napr. `sessions.status`) sa prekladajú cez centralizovaný `Common.status.*` namespace, nikdy sa neprekladajú priamo v DB

### Časové pásmo (medzinárodné použitie)

- Appka sa používa medzinárodne (tréneri aj rodičia v rôznych pásmach) — **nie je natvrdo nastavená na Slovensko**. Každé zariadenie si zisťuje vlastné pásmo automaticky (`components/timezone-detector.tsx`, beží raz globálne v `app/layout.tsx` rovnako ako `LocaleSwitcher`) cez `Intl.DateTimeFormat().resolvedOptions().timeZone`, uloží ho do cookie `NEXT_TIMEZONE` (`lib/actions/timezone.ts#setTimeZone`, validované cez `Intl.supportedValuesOf("timeZone")`) a appku obnoví
- `i18n/request.ts` číta `NEXT_TIMEZONE` a posiela ho do next-intl configu — **zobrazovanie** (`format.dateTime`) je tak vždy v pásme toho, kto sa práve pozerá, nie pásme servera ani pásme trénera, ktorý tréning zadal. Bez platnej cookie sa použije `defaultTimeZone` ("Europe/Bratislava")
- **Zadávanie** dátumu/času (`<input type="datetime-local">` v `new-session-form.tsx`, `session-review-form.tsx`) sa naopak zámerne riadi pásmom zariadenia **v momente zápisu** — pred odoslaním sa prevedie na jednoznačný ISO reťazec (`new Date(value).toISOString()`) priamo v prehliadači, takže sa do DB nikdy neukladá "holý" dátum bez pásma. Toto je vedomé rozhodnutie (potvrdené s trénerom): tréning sa fyzicky odohráva tam, kde je zariadenie zadávajúceho, takže interpretácia podľa jeho aktuálneho pásma je správna

## Archív

- Tréner môže v menu vybrať neaktívneho hráča (`is_active = false`)
- Aplikácia sa prepne do režimu "len na čítanie" — kompletné štatistiky, poznámky a testy viditeľné, ale needitovateľné
- Read-only vynútené v DB (RLS) aj v UI (skryté editačné prvky)

## Roadmapa (fázovanie)

### Fáza 1 — MVP (dokončená)
- [x] Auth (Supabase — e-mail + heslo)
- [x] Správa hráčov (vytvorenie, deaktivácia, prepínanie)
- [x] Tréningy: celý životný cyklus planned → review → completed
- [x] Označenie cvičení v review ako neodohrané/nahradené (`session_drills.status`)
- [x] Personalizácia kódov cvičení trénerom (`/drill-codes`, 20 slotov na zameranie)
- [x] Analytika a grafy (týždeň/mesiac/kvartál/rok, `/analytics/[category]`)
- [x] Archív v read-only móde
- [x] Lokálny vývoj, bez deploya

### Fáza 2 — Kalendár a testy (aktuálna)
- [x] Google Calendar: jednosmerne (app → kalendár) + kontrola kolízií pri plánovaní
- [ ] Neskôr obojsmerná synchronizácia (webhooks, obnova kanálov, riešenie konfliktov — zdroj pravdy je aplikácia)
- [ ] Modul kondičných a technických testov (metrics_and_tests)

### Fáza 3 — SaaS predaj
- [x] Deploy na Vercel (produkcia beží, coach appku reálne používa na telefóne)
- [x] Landing page (Hero, Features, Cenník, CTA) — `app/page.tsx` (logika) + `components/landing-page.tsx` (markup), zobrazuje sa na `/` len odhláseným návštevníkom. Vlastná jazyková vrstva SK/EN/DE/ES nezávislá od appky (`lib/landing-locale.ts`, cookie `LANDING_LOCALE`) — appka samotná ostáva len SK/EN (`i18n/request.ts`). Cenník je zatiaľ len "čoskoro" placeholder, keďže Stripe nie je implementovaný
- [x] Názov appky: **P.L.A.W** (2026-07-20, predtým CourtLog, predtým bez mena) — doména `plaw.win` kúpená, zatiaľ nepripojená na Vercel
- [ ] Stripe Checkout + Customer Portal (mesačné/ročné predplatné)

**Dôležité:** Neimplementuj funkcie z neskorších fáz, pokiaľ to nie je výslovne požadované. Architektúru však navrhuj tak, aby ich neskoršie pridanie neprekážalo (napr. `google_event_id` v sessions už teraz).

### Nápady na neskôr (nepotvrdené, nezaradené do fázy)

- **Manažér/športový riaditeľ pre viacerých hráčov naraz** (akadémie, zväzy): dnes má rola `manager` v DB rovnaké obmedzenie ako `parent` — `one_active_connection_per_parent` (`supabase/migrations/20260715100000_player_connections.sql`) dovoľuje len jedno aktívne prepojenie naraz, nový kód automaticky zruší predošlé. Nápad: uvoľniť tento limit len pre rolu `manager` (rodič ostáva 1:1) a postaviť prehľadovú stránku so zoznamom/tabuľkou hráčov zoskupených podľa trénera (`player_connections.coach_id`), s indikátorom "bez tréningu X dní" a agregovanou analytikou naprieč akadémiou. Dva mockupy (mobil aj tablet/laptop s grafmi) boli spravené 2026-07-17, zatiaľ len ako Claude Artifacts na diskusiu, nič nie je implementované. Ide o B2B rozšírenie scope-u (akadémie/zväzy majú iné potreby aj cenotvorbu než 1:1 tréner-hráč) — netreba to robiť mimochodom pri inej úlohe, len ako vedomé rozhodnutie o rozsahu.

## Štruktúra priečinkov

```
/app                 # Next.js App Router (stránky, layouty)
/components          # React komponenty
/components/charts   # Recharts vizualizácie
/lib                 # Supabase klient, utility, typy
/supabase/migrations # SQL migrácie
```

## Testovanie na mobile (lokálna sieť)

- `next.config.ts` má `allowedDevOrigins` s LAN IP adresou trénerovho laptopu — Next.js dev server inak blokuje cross-origin požiadavky z iného zariadenia v sieti (napr. telefónu), čo potichu rozbije celú klientskú interaktivitu (hydratáciu), nielen HMR. Pri zmene siete/IP treba adresu v `allowedDevOrigins` aktualizovať.
- `app/layout.tsx` má `<body className="flex flex-col">`. Každý stránkový root div preto **musí** mať popri `max-w-md` aj `w-full min-w-0`, inak ho širší vnútorný obsah (napr. netransformovateľný riadok záložiek) roztiahne cez celý viewport a spôsobí horizontálne posúvanie na úzkych obrazovkách — over toto ako prvé, ak niekedy nahlásia horizontálny scroll.

## PWA (Add to Home Screen)

- Appka má Web App Manifest (`app/manifest.ts`, lokalizovaný cez `Common.appTitle`/`appShortName`/`appDescription`) a generované ikony (`app/icon.tsx`, `app/apple-icon.tsx`, cez `next/og` `ImageResponse`) — "Add to Home Screen" tak vytvorí plnohodnotnú ikonu (`display: standalone`), nie obyčajnú záložku
- **Viac hráčov na jednom zariadení:** appka je 1:1 (tréner ↔ jeden aktívny hráč), takže tréner s viacerými hráčmi musí použiť dva rôzne účty. Keďže session (cookies) je viazaná na origin appky v danom prehliadači, dva účty naraz na jednom telefóne fungujú len cez **dva rôzne prehliadače** (napr. Safari + Chrome), každý prihlásený do iného účtu a s vlastným "Add to Home Screen" — dve karty v tom istom prehliadači zdieľajú cookies a jedna by odhlásila druhú. Rovnaký princíp platí aj pre rodiča/manažéra a `player_connections`.

## Pracovné pravidlá pre Claude Code

- Pred väčšou zmenou schémy alebo architektúry navrhni riešenie a počkaj na potvrdenie
- Malé, atomické commity so slovenskými správami
- TypeScript striktne (`strict: true`), žiadne `any` bez zdôvodnenia
- Mobile First: každé UI najprv navrhni pre smartfón
