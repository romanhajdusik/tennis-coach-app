# CLAUDE.md — Aplikácia pre tenisových trénerov

Tento súbor riadi prácu Claude Code na projekte. Vždy sa ním riaď.

## O projekte

SaaS aplikácia pre tenisových trénerov a rodičov na plánovanie, správu a analýzu tréningov. Model 1:1 — tréner spravuje vždy len jedného aktívneho hráča. Responzívna webová aplikácia (Mobile First, použiteľná na smartfóne priamo na kurte).

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
- **Hosting:** Vercel (deploy až po MVP — zatiaľ len lokálny vývoj)
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
   - `planned_data` (plánovaný čas a zameranie), `actual_data` (reálny čas), `notes`, `status` (`planned` / `completed` / `cancelled`)
   - `google_event_id` (text, nullable) — **pridať už od začiatku**, príprava na kalendárovú synchronizáciu
4. **metrics_and_tests** — kondičné a technické testy hráča (implementácia vo fáze 2, tabuľku možno vytvoriť vopred)
5. **session_drills** — cvičenia v rámci tréningu (kategória/zameranie, charakter úderu, kód cvičenia, trvanie)
   - `status` (`played` / `not_played` / `replaced`) — review označenie, defaultne `played`
   - `replaces_drill_id` — náhradné cvičenie sa viaže na to, ktoré nahrádza; v zozname sa zobrazí hneď za ním
6. **drill_codes** — trénerom personalizované kódy cvičení, 20 slotov na zameranie (`coach_id`, `category`, `slot` 1–20, `code`)
   - Bez uložených riadkov pre danú kategóriu sa použije predvolený zoznam z `lib/drill-options.ts` (`DRILLS`); po prvom uložení je DB autoritatívna
   - Editovateľné na `/drill-codes`
7. **google_calendar_connections** — OAuth tokeny pripojenia trénerovho Google Kalendára (`coach_id` PK, `access_token`, `refresh_token`, `token_expires_at`, `calendar_id`)
   - Jeden riadok na trénera, spravované cez `/settings` (pripojiť/odpojiť), logika v `lib/google/calendar.ts`

### Bezpečnostné pravidlá (povinné)

- **RLS zapnuté na každej tabuľke.** Základná policy: `coach_id = auth.uid()`
- **Archív (neaktívny hráč) je read-only na úrovni DB:** RLS policy blokuje UPDATE/DELETE na sessions a metrics, ak hráč má `is_active = false`. UI kontrola nestačí.
- **Dokončený tréning (`sessions.status = 'completed'`) je tiež read-only na úrovni DB:** RLS blokuje UPDATE/DELETE na `sessions` a `session_drills` (aj INSERT nových cvičení), rovnaký princíp ako archív.
- Všetky zmeny schémy výhradne cez migrácie (Supabase CLI), nikdy manuálne v dashboarde.

## Životný cyklus tréningu

1. **Plánovanie (planned):** vytvorenie zámeru — dátum, čas, zameranie
2. **Aktualizácia (review):** po tréningu tréner doplní reálny čas a poznámky; jednotlivé cvičenia môže označiť ako **neodohrané** alebo **nahradené** (náhrada sa zaradí v zozname hneď za pôvodným cvičením)
3. **Archivácia (completed):** uzamknutie záznamu (vynútené aj cez RLS)

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
- Stripe Checkout + Customer Portal (mesačné/ročné predplatné)
- Landing page (Hero, Features, Pricing, CTA) — v tom istom Next.js projekte
- Deploy na Vercel

**Dôležité:** Neimplementuj funkcie z neskorších fáz, pokiaľ to nie je výslovne požadované. Architektúru však navrhuj tak, aby ich neskoršie pridanie neprekážalo (napr. `google_event_id` v sessions už teraz).

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

## Pracovné pravidlá pre Claude Code

- Pred väčšou zmenou schémy alebo architektúry navrhni riešenie a počkaj na potvrdenie
- Malé, atomické commity so slovenskými správami
- TypeScript striktne (`strict: true`), žiadne `any` bez zdôvodnenia
- Mobile First: každé UI najprv navrhni pre smartfón
