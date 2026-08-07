# CLAUDE.md — P.L.A.W (Plan.Log.Analyze.Win)

Tento súbor riadi prácu Claude Code na projekte. Vždy sa ním riaď.

## O projekte

**P.L.A.W** ("Plan. Log. Analyze. Win.") — SaaS aplikácia pre tenisových trénerov a rodičov na plánovanie, správu a analýzu tréningov. Model 1:1 — tréner spravuje vždy len jedného aktívneho hráča. Responzívna webová aplikácia (Mobile First, použiteľná na smartfóne priamo na kurte).

Názov appky sa v kóde nastavuje cez `Common.appTitle`/`appShortName` v `messages/{sk,en}/common.json` (PWA názov aj titulok stránky) a je hardcodovaný vo wordmarku/tagline v hlavičke `components/landing-page.tsx` — pri prípadnej ďalšej zmene názvu treba upraviť oba miesta. Doména **plaw.win** je od 2026-07-23 pripojená na Vercel a funguje (`plaw.win`/`www.plaw.win`, DNS spravovaný cez Websupport.sk). Appka beží súbežne aj na `*.vercel.app` URL. Landing page má zámerne `robots: noindex` (viď nižšie) — appka je teda funkčná, ale zatiaľ mimo vyhľadávačov, kým nebude pripravená na verejné spustenie.

**Druhá doména plaw.online = samostatná verejná tvár (od 2026-07-27).** Ten istý Vercel projekt, ale `proxy.ts` (Next 16 ekvivalent middleware — POZOR, v Next 16 sa `middleware.ts` premenoval na `proxy.ts`, projekt už `proxy.ts` má na Supabase session cez `updateSession`) rozdeľuje obsah podľa hostname: na `plaw.online`/`www.plaw.online` sa zobrazia LEN verejné cesty (`/` landing, `/navod`, `/navod-hrac`), všetko ostatné (appkové cesty, login, API) sa 307 presmeruje na rovnakú cestu na `plaw.win`. Cookies sú per-doména, takže na plaw.online je návštevník vždy odhlásený → `/` prirodzene ukáže landing. Doménu plaw.online treba pripojiť vo Verceli (Settings → Domains) + nastaviť DNS (A `@` a CNAME `www` na hodnoty z Vercelu), rovnako ako pri plaw.win.

**Tretí druh domény: `<slug>.plaw.win` = subdoména organizácie (federačný B2B režim, od 2026-08-03).** `proxy.ts` rozpozná org subdoménu (`lib/org/resolve.ts#orgSlugFromHost`, rezervované sú `www`, `app`, `api`, `admin`, mailové a NS mená), načíta organizáciu cez `security definer` funkciu `organization_by_slug` (funguje aj bez prihlásenia, vracia len verejné polia) a podá ju do appky hlavičkami `x-plaw-org-*`. Appka ju číta **výhradne** cez `getOrgContext()` (`lib/org/context.ts`) — proxy tie hlavičky z prichádzajúcej požiadavky vždy najprv odstráni, aby sa nedala organizácia podvrhnúť zvonka. Neznámy slug → 307 na `plaw.win`. **Stráž členstva:** prihlásený, ktorý nie je aktívnym členom danej organizácie (samostatný tréner alebo člen inej org), sa dnu nedostane — presmeruje sa na `/login` **tej istej subdomény** a zároveň sa mu tam zahodí session (zmazaním `sb-*auth-token` cookies), takže sa môže prepnúť na správny účet. Pôvodne to posielalo na `plaw.win`, čím vznikla slepá ulička: stráž presmerovala aj `/login`, takže sa na subdoménu už nedalo prihlásiť ani správnym účtom. **Session sa zahadzuje zmazaním cookies, NIE cez `supabase.auth.signOut()`** — tá aj so `scope: "local"` volá `/logout` na serveri a zruší refresh token danej session (viď `_signOut` v `@supabase/auth-js`). Kontroluje sa len pri GET (307 na server action by preposlal telo na iný host) a skutočnou hranicou prístupu k dátam je aj tak RLS. Cieľ presmerovania sa skladá z hlavičky `Host`, nie z `request.nextUrl` (ten sa v dev serveri Hostom neriadi); relatívna cesta v `Location` nejde — Next middleware vyžaduje absolútnu URL. Odhlásený prejde (potrebuje `/login`) a na org subdoméne sa mu na `/` **nezobrazí marketingová landing, ale rovno prihlásenie**. Session cookies sú host-only (nikde sa nenastavuje `domain`), takže prihlásenie sa neprenáša medzi organizáciami ani na `plaw.win`. Subdomény sa pridávajú **ručne per organizácia** (Vercel + CNAME), kód sa pritom nemení — pribudne len riadok v `organizations`.

Jadrom appky sú **kódy cvičení** (`drill_codes`, pozri dátový model nižšie) — tréner si nimi personalizuje vlastné skratky cvičení, ktoré sa potom vyberajú pri zázname tréningu a presne podľa nich sa rozpadá Analytika. Landing page aj návod pre trénerov toto zámerne zdôrazňujú ako prvý krok po pridaní hráča, nie ako voliteľnú drobnosť.

## Jazyk a konvencie

- **UI produktu (appka):** výhradne **angličtina** (od 2026-07-28). Appka nemá prepínač jazyka ani slovenské preklady — nové UI texty sa píšu rovno po anglicky. Pozri sekciu i18n.
- **Verejný web (landing + návody):** **viacjazyčný** (vlastná vrstva `LANDING_LOCALE`, 9 jazykov, predvolená angličtina) — oddelený od appky. Pozri i18n.
- **Dokumentácia (CLAUDE.md, poznámky), kódové komentáre, commit messages:** **slovenčina** (napr. `Pridaný formulár na plánovanie tréningu`) — je to naša interná pracovná/administratívna reč, nie súčasť produktu.
- **Názvy premenných, funkcií, tabuliek:** angličtina (štandard)

## Technologický stack

- **Frontend:** Next.js (App Router) + TypeScript
- **Styling:** Tailwind CSS
- **Grafy:** Recharts
- **Backend/DB:** Supabase (PostgreSQL, Auth, Edge Functions)
- **Hosting:** Vercel — appka je nasadená na produkcii, automatický deploy pri pushi do `master` (žiadny `vercel.json`/CI gate). Zmeny sa musia commitnúť a pushnúť, inak sa k trénerovi na telefón nedostanú — lokálny build/test nestačí
- **Platby:** Stripe (fáza 3, zatiaľ neimplementovať)

## Dizajn a farby

Appka má **jednotnú tmavosivú tému, žiadny svetlý režim** (`color-scheme: dark`). Farby sú **sémantické tokeny** v `app/globals.css` cez Tailwind v4 `@theme` — odtieň sa mení na jednom mieste, komponenty ho nikdy nemajú natvrdo:

- **Plochy:** `bg-background` (#1e1e21), `bg-surface` (#27262b — karty/panely), `bg-input` (#191819 — polia), `border-border` (#3a383f)
- **Text:** `text-foreground` (#ededee), `text-muted` (#a3a2aa)
- **Primárna = antuková tehlová:** `bg-primary` (#a24236), `hover:bg-primary-hover` (#b64e40), text na nej `text-primary-foreground` (#fdeee9) — tlačidlá, aktívne záložky, chart-type toggle

**Pravidlá:**
- Používaj tokenové triedy (`bg-primary`, `bg-surface`, `text-foreground`, `text-muted`, `border-border`, `bg-input`, `text-primary-foreground`). **Nepridávaj** späť natvrdo `bg-zinc-*`/`text-zinc-*`/`dark:*` triedy ani svetlý režim.
- Stavové/chybové farby (červená = dokončený/chyba/deštrukcia, emerald = naplánovaný/potvrdené, green = úspech v nastaveniach, amber = kolízia kalendára, yellow = nahradené) ostávajú ako jednohodnotové tmavé triedy (napr. `bg-red-950 text-red-300`), zámerne odlíšené od brandovej antukovej. Kalendárové štítky dní (mriežka): `bg-emerald-500 text-emerald-950` / `bg-red-500 text-red-950`. Karty tréningov v zozname pod kalendárom majú navyše farebný **rámček** podľa stavu — `border-emerald-500` (naplánovaný) / `border-red-500` (dokončený), inak `border-border` (`CARD_BORDER_CLASSES` v `app/calendar/page.tsx` aj `app/parent/calendar/page.tsx`). Žltá sa okrem stavu „nahradené" používa aj na **zvýraznenie boxu s celkovým časom** na stránke tréningu (`app/sessions/[id]/page.tsx`): `border-yellow-500 bg-yellow-950/40`, číslo minút veľké a hrubé (`text-2xl font-bold text-yellow-300`, cez `t.rich` na `Sessions.detail.totalDuration`).
- Paleta grafov (`.viz-root` v `globals.css`) je tiež len tmavá sada; `--surface` = #27262b, aby splynula s kartou.
- **Landing page (`components/landing-page.tsx`) aj návody (`app/navod/page.tsx` pre trénera, `app/navod-hrac/page.tsx` pre hráča/rodiča/manažéra) používajú rovnaké antukové tmavé tokeny ako appka** (prefarbené 2026-07-27), takže verejný web ladí s produktom. Na landingu sú v hero dve „surface" tlačidlá odkazujúce na tieto dva návody. Majú však vlastnú 9-jazyčnú jazykovú vrstvu (`LANDING_LOCALE`: EN/DE/ES/RU/FR/ZH/IT/JA/SK, default EN), oddelenú od EN-only appky. Pozor: antuka `#a24236` je tmavá — funguje ako **výplň** (`bg-primary` + `text-primary-foreground`), nie ako farba textu na tmavom pozadí; na akcenty textu použi `text-foreground`, antuku len na tlačidlá/odznaky/ikony/CTA pruhy.

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
   - `is_active` (boolean) — **v samostatnom (1:1) režime vždy len jeden aktívny hráč na trénera**
   - Vynútené na úrovni DB: `CREATE UNIQUE INDEX one_active_player ON players (coach_id) WHERE is_active = true AND organization_id IS NULL;` — od 2026-08-03 je index **čiastočný**, takže federačný tréner (org riadky) môže mať viac aktívnych hráčov naraz (1:N), samostatný tréner naďalej len jedného
   - `organization_id` (nullable) — **vlastník riadku**: `null` = osobný hráč samostatného trénera, inak hráč patrí organizácii a `coach_id` je len *priradenie* (pozri org vrstvu nižšie)
3. **sessions** — tréningy naviazané na hráča
   - `planned_data` (plánovaný čas a zameranie), `actual_data` (reálny čas), `notes`, `status` (`planned` / `completed` / `cancelled` — `cancelled` je v DB kvôli budúcemu použitiu, appka dnes namiesto neho naplánovaný tréning rovno **zmaže**, pozri "Životný cyklus tréningu")
   - `google_event_id` (text, nullable) — **pridať už od začiatku**, príprava na kalendárovú synchronizáciu
4. **metrics_and_tests** — kondičné a technické testy hráča (implementácia vo fáze 2, tabuľku možno vytvoriť vopred)
5. **session_drills** — cvičenia v rámci tréningu (kategória/zameranie, charakter úderu, kód cvičenia, trvanie)
   - `status` (`played` / `not_played` / `replaced`) — review označenie, defaultne `played`
   - `replaces_drill_id` — väzba náhradného cvičenia na to, ktoré nahrádza (len informatívna, na poradie sa už nepoužíva)
   - `sort_order` (integer, not null) — **jediný zdroj poradia v zozname**, tréner ho vie meniť šípkami hore/dole (`lib/actions/session-drills.ts#moveDrill`), len kým je tréning `planned` (RLS zablokuje update pri `completed`). `addDrill` pridáva na koniec, `replaceDrill` vloží nové cvičenie hneď za nahradzované (posunie zvyšok o jedno miesto)
6. **drill_codes** — trénerom personalizované kódy cvičení, **jadro celej appky** (pozri "O projekte" vyššie): 20 slotov na zameranie (`coach_id`, `category`, `slot` 1–20, `code`)
   - Vlastníka určuje dvojica `coach_id` / `organization_id` — práve jeden z nich je vyplnený (`drill_codes_single_owner`). Osobný kód = `coach_id`, federačný štandard = `organization_id` (nastavuje šéftréner, tréner ho len používa)
   - Bez uložených riadkov pre danú kategóriu sa použije predvolený zoznam z `lib/drill-options.ts` (`DRILLS`); po prvom uložení je DB autoritatívna. Tréner tak na `/drill-codes` od začiatku vidí kompletný, hneď použiteľný zoznam — nič nemusí nastavovať, ale môže ktorýkoľvek slot premenovať na vlastnú skratku
   - Editovateľné na `/drill-codes`. Presne tieto kódy sa ponúkajú vo výbere pri zázname cvičenia (`session_drills.drill_code`) a presne podľa nich sa rozpadá Analytika (pozri nižšie) — zmena kódu tu sa neprejaví spätne na už zaznamenaných cvičeniach
7. **google_calendar_connections** — OAuth tokeny pripojenia trénerovho Google Kalendára (`coach_id` PK, `access_token`, `refresh_token`, `token_expires_at`, `calendar_id`)
   - Jeden riadok na trénera, spravované cez `/settings` (pripojiť/odpojiť), logika v `lib/google/calendar.ts`
8. **player_connections** — prepojenie rodiča/manažéra/hráča s hráčom u konkrétneho trénera (`coach_id`, `player_id`, `parent_id` nullable kým nie je zaklaimované, `connect_code`, `status` `pending`/`active`/`revoked`, `connected_role` nullable text — snapshot `profiles.role` z momentu zaklaimovania, pozri nižšie prečo)
   - `CREATE UNIQUE INDEX one_active_connection_per_parent ON player_connections (parent_id) WHERE status = 'active'` — jeden rodič/manažér/hráč = jedno aktívne prepojenie naraz, nový kód automaticky nahradí staré
   - RPC `claim_player_connection(p_code)` (`security definer`) — rodič/manažér/hráč zadá kód, funkcia nájde `pending` riadok, zruší predošlé aktívne prepojenie toho istého používateľa, aktivuje nové a zároveň doň nasnímne `connected_role` (trénerova appka nemá RLS prístup k cudziemu `profiles` riadku, aby si rolu dočítala joinom, preto kópia priamo v RPC — rovnaký princíp ako `parent_session_records`)
9. **parent_session_records** / **parent_session_drill_records** — **trvalá kópia** tréningov pre pripojeného rodiča/manažéra/hráča, nie live pohľad (pozri sekciu "Zdieľanie s rodičom/manažérom/hráčom" nižšie prečo)
10. **organizations** — federácia/klub/akadémia pre B2B režim (`name`, `slug` unique = subdoména `<slug>.plaw.win`, `type` `federation`/`club`/`academy`, `sport`, `seat_limit`, `subscription_status`)
    - Organizáciu zakladá admin cez `service_role` (onboarding krok 4, `docs/mockups/onboarding-org.html`) — appka ju smie len čítať. `proxy.ts` si ju pred prihlásením prečíta cez `security definer` funkciu `organization_by_slug(p_slug)`, ktorá vracia len verejné polia (nie predplatné ani sedadlá)
11. **organization_members** — členstvo v organizácii (`organization_id`, `user_id` nullable kým nie je pozvánka prijatá, `role` `director`/`coach`, `status` `invited`/`active`/`removed`, `invite_code`)
    - `CREATE UNIQUE INDEX one_active_membership_per_user ON organization_members (user_id) WHERE status = 'active'` — **účet je buď nezávislý, alebo org-zamestnanec** (rozhodnuté 2026-08-03), nikdy oboje naraz
    - RPC `claim_organization_invite(p_code)` (`security definer`) — pozvaný zadá kód a tým sa sám pripojí; vzor prevzatý z `claim_player_connection`. Trigger `enforce_membership_rules` drží tri invarianty: (1) účet k pozvánke pripojí **len** claim (šéftréner nesmie priradiť cudzí účet priamym zápisom — členstvo je dobrovoľné), (2) kto vlastní osobných hráčov, nemôže vstúpiť do organizácie (`has_personal_data`), (3) **sedadlá** — proti `seat_limit` sa počítajú len tréneri, šéftréner sedadlo neberie (`seat_limit_reached`)
    - Šéftréner spravuje **členstvo** vlastnej organizácie (vytvorí pozvánku, odoberie trénera) — read-only dohľad podľa §5.7 sa týka *tréningových dát*, nie organizačnej administratívy

### Bezpečnostné pravidlá (povinné)

- **RLS zapnuté na každej tabuľke.** Základná policy: `coach_id = auth.uid()`
- **Archív (neaktívny hráč) je read-only na úrovni DB:** RLS policy blokuje UPDATE/DELETE na sessions a metrics, ak hráč má `is_active = false`. UI kontrola nestačí.
- **Dokončený tréning (`sessions.status = 'completed'`) je tiež read-only na úrovni DB:** RLS blokuje UPDATE/DELETE na `sessions` a `session_drills` (aj INSERT nových cvičení), rovnaký princíp ako archív.
- Všetky zmeny schémy výhradne cez migrácie (Supabase CLI), nikdy manuálne v dashboarde.
- **Dvojrežimová RLS org/B2B vrstvy (DB časť hotová 2026-08-03, migrácie `20260803090000_organizations.sql` + `20260803091000_org_rls.sql`).** Na tých istých tabuľkách bežia dva režimy vedľa seba:
  - *Osobné riadky* (`organization_id IS NULL`) — pôvodný model `coach_id = auth.uid()`, správanie samostatného trénera nezmenené. Policy navyše platí len pre účty **bez** aktívneho členstva (`current_org_id() IS NULL`), čím sa drží pravidlo „buď nezávislý, alebo zamestnanec".
  - *Org riadky* — **director SELECT-only** nad celou organizáciou; **tréner-zamestnanec** SELECT/INSERT/UPDATE nad hráčmi pridelenými jemu, ale **bez DELETE** (mazanie org riadkov nemá policy pre nikoho, je vyhradené `service_role`). Zrušenie naplánovaného tréningu sa v B2B robí cez `sessions.status = 'cancelled'`, nie hard-delete → federácii ostáva úplný audit.
  - Policy sa pýtajú na členstvo cez `security definer` funkcie `current_org_id()` / `current_org_role()` — priamy poddotaz na `organization_members` by narazil na jej vlastnú RLS.
  - **Kódy cvičení** v org vlastní federácia: tréner ich len číta, zapisuje ich šéftréner (jediné miesto, kde má director write). **Zdieľanie s rodičom/hráčom je vypnuté** pre org trénerov aj na úrovni DB — je to funkcia samostatného produktu (§5.6).
  - Ešte **nehotové** (pri stavbe UI vrstvy záväzné): **tenant izolácia** v `proxy.ts` (hostname→org autoritatívne) + **Auth cookies per-subdoménu**, nie zdieľané `.plaw.win`.
  - Detaily a odôvodnenie v [`docs/roadmap-buduce-smery.md`](docs/roadmap-buduce-smery.md) §5.7 a §5.9.

## Vybraný hráč (1:1 vs 1:N)

Appka vždy zobrazuje dáta **jedného** hráča — kalendár, plánovanie, záznam aj analytika sa viažu naňho. Kto to je, určuje **jediný zdroj pravdy** `getSelectedPlayer()` v [`lib/players/selected.ts`](lib/players/selected.ts); **nikdy nedotazuj aktívneho hráča priamo** (starý vzor `.eq("is_active", true).maybeSingle()` v org režime spadne, keď je aktívnych viac).

- **Samostatný režim (plaw.win):** tréner má najviac jedného aktívneho hráča (index `one_active_player`), takže „vybraný" = ten jediný. Správanie ako predtým, prepínač sa vôbec nevykreslí.
- **Federačný režim (`<slug>.plaw.win`):** tréner je zamestnanec s viacerými pridelenými hráčmi naraz (1:N). Voľba sa pamätá v cookie `plaw_selected_player` (vec zariadenia, ako jazyk a časové pásmo — nie stav v DB), prepína ju server action `selectPlayer` a zobrazuje komponent [`components/player-switcher.tsx`](components/player-switcher.tsx) (vykreslí sa len pri 2+ aktívnych hráčoch).
- **Cookie je len návrh, nie oprávnenie:** voľba sa vždy overuje voči zoznamu hráčov z databázy (ten je orezaný RLS), takže podvrhnutá cookie nevie vybrať cudzieho hráča — ignoruje sa a použije sa prvý v poradí. Rovnako sa výber sám zotaví, keď sa vybraný hráč archivuje.
- **Zápisy musia v org režime niesť `organization_id`** (`players`, `sessions`, `session_drills`) — vlastníkom je organizácia, inak RLS zápis zamietne. Berie sa z `getOrgContext()`.
- **Kódy cvičení** sa v org režime čítajú podľa `organization_id` (federačný štandard, §5.5), nie podľa `coach_id` — inak by tréner videl predvolený zoznam namiesto štandardu federácie. `/drill-codes` je pre neho read-only.
- **Zrušenie tréningu:** v org režime `deleteSession` nastaví `status = 'cancelled'` (dáta vlastní federácia, tréner nemaže). V samostatnom režime maže ako doteraz. Bez tejto vetvy RLS mazanie ticho zamietne a appka by tvárila, že tréning zrušila.
- **Zdieľanie s rodičom/hráčom** je funkcia samostatného produktu — v org režime je skryté v UI aj zablokované v RLS (§5.6).

### Obrazovka „Dnes" a roster so stavmi (federačný režim, od 2026-08-05)

Na org subdoméne je domovská stránka `/` **denný domov „Dnes"** ([`components/today-board.tsx`](components/today-board.tsx)): rozvrh dňa naprieč všetkými pridelenými hráčmi podľa času, dlaždice zhrnutia, upozornenie na najzanedbanejšieho hráča a sekcia „Zajtra". Na `plaw.win` (samostatný 1:1 tréner) sa **nevykreslí** — pôvodný rozcestník ostáva.

- Spoločný dátový základ je [`lib/players/roster.ts`](lib/players/roster.ts) — `getRosterOverview()` vráti pre každého aktívneho hráča počet dní od posledného tréningu, stav pozornosti a najbližší naplánovaný tréning, plus rozvrh na dnes a zajtra. To isté používa aj roster na `/players` (zobrazí sa len pri 2+ aktívnych hráčoch).
- **Dni sa počítajú v pásme toho, kto sa pozerá** (`getTimeZone()` z next-intl, rovnaký zdroj ako `format.dateTime`), nie v pásme servera — „dnes" musí sedieť trénerovi na kurte.
- **Prahy pozornosti:** 5 dní bez tréningu = *warning*, 8 dní = *critical*. Hráč bez akéhokoľvek záznamu je *critical*, len ak preňho nič nie je naplánované — čerstvo pridelený hráč s tréningom v kalendári nie je zanedbaný.
- **Dotaz na tréningy je ohraničený oknom 60 dní dozadu** (`PRACTICE_LOOKBACK_DAYS`), filtrované priamo v SQL cez `planned_data->>date`. Neruš to na „načítaj všetko": pri desiatich hráčoch a rokoch histórie to narazí na `max_rows` PostgRESTu.
- **Ťuknutie na tréning v rozvrhu zároveň prepne vybraného hráča** (`selectPlayerAndOpen` v [`lib/actions/selected-player.ts`](lib/actions/selected-player.ts)) — inak by detail tréningu patril jednému hráčovi, ale zvyšok appky ukazoval iného.

### Onboarding do organizácie (od 2026-08-07)

Tréner sa do federácie pridá **sám, pozývacím kódom** — šéftréner mu cudzí účet priradiť nemôže (členstvo je dobrovoľné, drží to trigger `enforce_membership_rules`).

- **`/director/team`** — šéftréner vytvorí kód (`createInvite`), pošle ho mimo appky, vidí obsadené sedadlá a môže trénera odobrať. **Odobratie nemaže dáta:** hráči aj tréningy ostávajú organizácii a v pulte sa objavia pod „No longer in the organization", kým ich niekto neprevezme. Proti `seat_limit` sa počítajú **len tréneri** — šéftréner sedadlo neberie.
- **`/join`** — jediná cesta dnu pre pozvaného. **Bez tejto stránky bol onboarding zacyklený:** stráž členstva v `proxy.ts` vyhodila prihlásený účet bez členstva na `/login` a zahodila mu session, takže kód nemal kde zadať. Stráž teraz rozlišuje: účet **bez akéhokoľvek členstva** → `/join` (session ostáva, aby mal claim koho pripojiť), účet **inej organizácie** → naďalej von + zahodenie session (tenanty sa nemiešajú).
- **`/director/drill-codes`** — jediné miesto, kde má šéftréner zápis (§5.5); tréner tie isté kódy na `/drill-codes` iba číta. Ukladá `saveOrgDrillCodes` (org riadok = `coach_id` null). **Pozor:** upsert potreboval nečiastočný unikát — migrácia `20260807090000_drill_codes_org_upsert.sql` nahradila pôvodný čiastočný index (`where organization_id is not null`), lebo taký Postgres pri `ON CONFLICT` neinferuje.

### Riadiaci pult šéftrénera `/director` (federačný režim, od 2026-08-06)

Šéftréner (rola `director`) má na org subdoméne **read-only pult** nad celou organizáciou — po prihlásení naň `/` rovno presmeruje (pridelených hráčov nemá, nástenka „Dnes" by bola prázdna). Vstup stráži [`app/director/guard.ts`](app/director/guard.ts) (`requireDirector`): mimo org subdomény a pre rolu `coach` presmeruje na `/`. **Je to smerovanie, nie bezpečnostná hranica — tou ostáva RLS** (§5.7: director SELECT-only).

- Stránky: `/director` (dlaždice, „vyžaduje pozornosť" naprieč org, tréner → jeho hráči), `/director/players/[id]`, `/director/sessions/[id]`, `/director/players/[id]/analytics/[category]`. Všetky bez jediného editačného formulára.
- **Dáta číta živo cez RLS, nie cez kópie.** Rodičovské stránky (`app/parent/`) sa reusovať nedajú — tie čítajú `parent_session_records`. Reusuje sa **agregát** `aggregateDrillStats` a komponent `CategoryCharts`, takže čísla v pulte a v trénerovej appke sa nemôžu rozísť. Player-scoped varianty analytiky sú `getPlayerCategoryAnalytics` / `getPlayerSessionIdsInPeriod` v [`lib/actions/analytics.ts`](lib/actions/analytics.ts).
- Stavy hráčov počíta ten istý `getRosterOverview` ako trénerova nástenka „Dnes" ([`lib/org/director.ts`](lib/org/director.ts) mu len podá všetkých hráčov organizácie).
- **Mená trénerov:** `profiles` má policy `id = auth.uid()`, takže pribudla úzka SELECT policy pre šéftrénera nad profilmi **aktívnych členov jeho organizácie** (migrácia `20260806090000_director_reads_member_profiles.sql`, `security definer` `is_active_member_of_my_org()`). Tréner naďalej vidí len seba.
- **Hráči po odchode trénera** (priradení niekomu, kto už nie je aktívnym členom) sa zoskupia pod „No longer in the organization" — z pultu nesmú zmiznúť, kým ich niekto neprevezme.
- **Pult je stavaný na laptop/tablet**, nie na telefón (na rozdiel od trénerovej appky, ktorá sa používa na kurte) — stránky majú `max-w-6xl`/`max-w-5xl` a viacstĺpcové rozloženie na `sm`/`lg`/`xl`, na mobile sa poskladajú pod seba. **Mobile-first pravidlo z tejto sekcie nevypadáva** — úzka šírka musí ostať použiteľná a bez horizontálneho scrollu.
- **Porovnanie hráčov `/director/compare`:** tá istá trojica grafov, akú vidí tréner, vedľa seba pre celú skupinu. **Počet stĺpcov sleduje počet hráčov (až 6)**, ale každý ďalší sa otvorí až od šírky, kde stĺpec neklesne pod ~300 px — pri nej sa koláč aj legenda ešte čítajú (`COLUMN_CLASSES` v tom súbore). **14" notebook (v CSS 1280–1512 px) dostane štyri stĺpce**, 5 od 1600, 6 od 1900; dvaja hráči nikdy nestoja v šiestich stĺpcoch. **Prahy musia byť zapísané rovnakým druhom variantu (`min-[…]`)**: pri miešaní s pomenovanými (`2xl:`) sa CSS pravidlá nezoradia podľa šírky a širší prah prebije užší (1920 px vracalo 4 stĺpce namiesto 5). Dve osi zoskupenia — **podľa trénera** a **podľa ročníka** (`birth_year`), prepínajú sa v URL (`?by=coach|year&group=…`). Dáta ťahá `getPlayersCategoryAnalytics` ([`lib/actions/analytics.ts`](lib/actions/analytics.ts)) — **dvoma dotazmi pre celú skupinu, nie štyrmi na hráča**; pri desiatich hráčoch by inak stránka poslala 40 dotazov. Neprepisuj to na volanie `getPlayerCategoryAnalytics` v cykle.

**Poradie grafov v analytike (platí všade):** generálny graf (`CategoryShareChart`, podiel zamerania na celkovom čase) ide **PRVÝ**, až za ním rozpad podľa kódov a charakteru (`CategoryCharts`). Platí pre trénerovu analytiku, rodičovskú/hráčsku (`getParentCategoryMinuteShares` nad kópiami), pult aj porovnanie — **kto tréningy sleduje, vidí to isté rozloženie ako ten, kto ich zapísal.**

## Životný cyklus tréningu

1. **Plánovanie (planned):** vytvorenie zámeru — dátum, čas, zameranie. Kým je tréning v tomto stave, dá sa aj **úplne zrušiť** (`lib/actions/sessions.ts#deleteSession` — natrvalo zmaže session aj jej cvičenia cez `on delete cascade`, nie len zmena statusu; potvrdzuje sa dvojkrokovo v UI). Cvičenia sa dajú preusporiadať šípkami hore/dole (`session_drills.sort_order`)
2. **Aktualizácia (review):** po tréningu tréner doplní reálny čas a poznámky; jednotlivé cvičenia môže označiť ako **neodohrané** alebo **nahradené** (náhrada sa zaradí v zozname hneď za pôvodným cvičením)
3. **Archivácia (completed):** uzamknutie záznamu (vynútené aj cez RLS) — od tohto bodu už nejde tréning ani zrušiť, ani cvičenia preusporiadať

## Analytika

- Filtrovanie podľa obdobia: **týždeň**, **mesiac**, **kvartál**, **rok** — s porovnaním voči minulému roku (`/analytics/[category]`)
- Prehľad podľa kódu cvičenia (čas, odhadovaný počet úderov, % využitia) a podľa charakteru cvičenia (offensive/neutral/defensive)
- Dáta sa vždy načítavajú len pre aktívneho hráča (`players.is_active = true`), priamo v server action (`lib/actions/analytics.ts`), nie cez DB views — pri zmene hráča sa dashboardy prirodzene vynulujú
- Vizualizácia: Recharts (donut aj stĺpcový graf)
- **Zameranie-špecifické pravidlá** (`ANALYTICS_FULL_BREAKDOWN_CATEGORIES` v `lib/drill-options.ts`): Forehand, Backhand, Volley a GAME DRILLS zobrazujú vždy úplný rozpad všetkých použitých kódov (žiadne zbaľovanie do "Ostatné") a majú prepínač dizajnu grafu koláč/stĺpce (`app/analytics/[category]/category-charts.tsx`). Return a Serve majú dvojúrovňové skupinové zobrazenie (`ANALYTICS_GROUPED_CATEGORIES`): stĺpcový graf rozdelí kódy podľa prefixu na "Forehand return"/"Backhand return" resp. "1st serve"/"2nd serve", klik na stĺpec zobrazí detail kódov danej skupiny — rovnaké skupiny sa zobrazujú aj pri editácii kódov na `/drill-codes`. POINTS (`ANALYTICS_MATCH_SPLIT_CATEGORIES`) zobrazuje koláčový graf rozdeľujúci odohraný čas na **MATCH** (zápasové body, kódy s prefixom `MATCH`) vs **ostatné cvičenia** — minutáž a percento pre obe, plus celkový čas (`app/analytics/[category]/points-chart.tsx`).
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
  - **Pozor pri úprave `claim_player_connection`:** funkcia sa už menila viackrát cez `create or replace` a raz sa tým ticho stratil práve tento backfill (migrácia `20260718121500` vychádzala zo staršej verzie a prepísala novšiu; opravené až `20260803093000`, dovtedy rodič históriu spätne nedostal). **Pri ďalšej zmene vždy vychádzaj z reálne nasadenej definície** (`select pg_get_functiondef(oid) from pg_proc where proname = '...'`), nie z niektorej staršej migrácie.
  - Zrušenie prepojenia (`revokeConnection`) len nastaví `status = 'revoked'` — synchronizácia sa zastaví, ale doteraz skopírované dáta ostávajú. Nový tréner = nový kód = nové dáta pribúdajú do **toho istého** `parent_id`, takže rodičovi vzniká kontinuálny záznam naprieč viacerými trénermi v čase.
- Rodičovské stránky (`app/parent/`) sú **čisto na čítanie** — kalendár, detail tréningu, analytika, žiadne plánovanie ani editácia. Analytická agregácia je zdieľaná s trénerovou (`aggregateDrillStats` v `lib/actions/analytics.ts`, volaná aj z `lib/actions/parent-data.ts`), len zdroj dát je iný.
- `login`/`logout`/`register` v `lib/actions/auth.ts` berú `redirectTo` ako bindovaný parameter, aby fungovali pre oba vstupné body (`/login` → `/`, `/parent/login` → `/parent`) bez duplikovania auth logiky.
- Platba za rodičovský prístup je zatiaľ nevyriešená (téma Fázy 3/Stripe) — rodič sa zatiaľ registruje zadarmo.

## Internacionalizácia (i18n)

- **Appka (produkt) je od 2026-07-28 výhradne anglická** (`next-intl`, `i18n/request.ts` — `locales = ["en"]`, `defaultLocale = "en"`, `getRequestConfig` vždy vráti `"en"`). Už **nemá prepínač jazyka ani slovenské preklady**: `components/locale-switcher.tsx` aj `lib/actions/locale.ts` boli odstránené, cookie `NEXT_LOCALE` sa už nečíta a appkové `messages/sk/*.json` boli zmazané. Slovenčina zostáva len na verejnom webe (landing/návody, vlastná vrstva nižšie) a v kóde/dokumentácii/commitoch — nie v produkte.
- Appkové preklady sú len v `messages/en/<oblasť>.json`, jeden súbor na oblasť appky (`common`, `auth`, `home`, `players`, `sessions`, `drill-codes`, `analytics`, `calendar`, `settings`, `parent`) — pri pridaní novej oblasti treba pridať import do `loadMessages` v `i18n/request.ts`. **Nové UI texty sa píšu rovno po anglicky, žiadny SK ekvivalent sa nedopĺňa.**
- **Výnimka: verejné stránky (landing `/` + návody `/navod` pre trénera a `/navod-hrac` pre hráča/rodiča/manažéra, všetky len pre odhlásených) nejdú cez next-intl.** Majú vlastnú, appke nezávislú jazykovú vrstvu s **9 jazykmi** EN/DE/ES/RU/FR/ZH/IT/JA/SK (`lib/landing-locale.ts` — loadery `loadLandingMessages`/`loadNavodMessages`/`loadNavodHracMessages`, `messages/{sk,en,de,es,ru,fr,zh,it,ja}/{landing,navod,navod-hrac}.json`, cookie `LANDING_LOCALE` nastavovaná cez `lib/actions/landing-locale.ts`/`components/landing-language-switcher.tsx`; zh = zjednodušená čínština, it = taliančina, ja = japončina, pridané 2026-07-28) — kým samotná appka je len anglická (viď vyššie), verejný web je viacjazyčný. **Predvolený jazyk verejného webu je EN** (`defaultLandingLocale = "en"`, prvý v poli); v prepínači jazykov je **SK zámerne posledné**. Screenshoty v showcase sekcii landingu existujú len pre SK/EN, takže všetky ostatné jazyky (vrátane ZH/IT/JA) dostávajú anglické zábery (`shotLocale = locale === "sk" ? "sk" : "en"`). Dôvod oddelenia od `next-intl`: appka je EN-only, no verejný web má osloviť medzinárodné publikum vo viacerých jazykoch — vlastná vrstva to umožňuje bez toho, aby sa museli prekladať všetky appkové oblasti
- Server Components používajú `getTranslations()`/`getFormatter()` z `next-intl/server`, Client Components (`"use client"`) používajú `useTranslations()`/`useFormatter()` z `next-intl`. Server actions môžu tiež volať `getTranslations()` (funguje mimo renderovania) pre preklad chybových hlášok
- Formátovanie dátumov ide vždy cez `format.dateTime(date, options)` (nikdy natvrdo `toLocaleString("sk-SK", ...)`), automaticky podľa aktuálneho jazyka
- **Čo sa NEPREKLADÁ**: `lib/drill-options.ts` (kategórie cvičení, kódy cvičení, skupinové názvy ako "Forehand return") — sú to dáta/konvencie trénera, nie UI text. Kódové komentáre a interné diagnostické hlášky (napr. `console.error` v `lib/google/calendar.ts`) ostávajú po slovensky, keďže sa nikdy nezobrazujú používateľovi
- DB enum hodnoty (napr. `sessions.status`) sa prekladajú cez centralizovaný `Common.status.*` namespace, nikdy sa neprekladajú priamo v DB

### Časové pásmo (medzinárodné použitie)

- Appka sa používa medzinárodne (tréneri aj rodičia v rôznych pásmach) — **nie je natvrdo nastavená na Slovensko**. Každé zariadenie si zisťuje vlastné pásmo automaticky (`components/timezone-detector.tsx`, beží raz globálne v `app/layout.tsx`) cez `Intl.DateTimeFormat().resolvedOptions().timeZone`, uloží ho do cookie `NEXT_TIMEZONE` (`lib/actions/timezone.ts#setTimeZone`, validované cez `Intl.supportedValuesOf("timeZone")`) a appku obnoví
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
- [x] Landing page (Hero, Features, Cenník, CTA) — `app/page.tsx` (logika) + `components/landing-page.tsx` (markup), zobrazuje sa na `/` len odhláseným návštevníkom. Vlastná jazyková vrstva s 9 jazykmi EN/DE/ES/RU/FR/ZH/IT/JA/SK (default EN) nezávislá od appky (`lib/landing-locale.ts`, cookie `LANDING_LOCALE`) — appka samotná je len anglická (`i18n/request.ts`). Cenník je zatiaľ len "čoskoro" placeholder, keďže Stripe nie je implementovaný
- [x] Názov appky: **P.L.A.W** (2026-07-20, predtým CourtLog, predtým bez mena) — doména `plaw.win` kúpená a od 2026-07-23 pripojená na Vercel (funguje popri `*.vercel.app`), zatiaľ zámerne mimo vyhľadávačov (`robots: noindex` na landing page, kým appka nie je pripravená na verejný launch)
- [ ] Stripe Checkout + Customer Portal (mesačné/ročné predplatné)

**Dôležité:** Neimplementuj funkcie z neskorších fáz, pokiaľ to nie je výslovne požadované. Architektúru však navrhuj tak, aby ich neskoršie pridanie neprekážalo (napr. `google_event_id` v sessions už teraz).

### Nápady na neskôr (nepotvrdené, nezaradené do fázy)

> Podrobné architektonické návrhy (multi-šport platforma + kondičná appka + Garmin/Polar,
> vrátane odporúčaných modelov a otvorených otázok) sú vo verbatim znení v
> [`docs/roadmap-buduce-smery.md`](docs/roadmap-buduce-smery.md). Nižšie len stručné body.

- **Multi-šport platforma (tenis → padel, bedminton, pickleball)** (2026-08-01): tenisová
  appka je „inštancia #1" spoločného enginu; športy sa líšia len v ~10 % (zamerania + drills
  + pár analytických pravidiel). Zlaté pravidlo: **šport-špecifické = konfigurácia (SportConfig),
  engine = zdieľaný kód, engine nikdy neforkovať na šport.** Appka je na ~80 % pripravená —
  šport-špecifiká už žijú prevažne v `lib/drill-options.ts` + analytických konštantách
  `lib/actions/analytics.ts`. Pri ďalšej práci na tenise nič nehardcodovať „tenisovo" mimo
  konfig vrstvy (vzorec/slovo „strokes", serve/return prefix zoskupenie, sadzby charakteru).
  Budúci mechanizmus: **A) jeden repo, šport podľa nasadenia (`SPORT=padel`) — odporúčané**,
  nie kopírovať repo na každý šport. Detaily + audit-plán v docs dokumente.
- **Kondičná appka (samostatná doména, 1:N)** (2026-08-01): samostatná appka pre kondičný
  tréning; v tenisovom kalendári hráča sa majú zobraziť aj kondičné tréningy. Obmedzenia:
  viac aktívnych hráčov (1:N), dáta vlastní príslušný tréner, funguje aj bez tenisu (opt-in),
  predáva sa samostatne. Odporúčaný model: **jeden Supabase projekt + spoločné Auth, dve
  oddelené domény, prepojenie voliteľným connect-code linkom, read-only cross-read.**
  „Samostatný predaj ≠ samostatná databáza" (predplatné je per-app). Jediné rozhodnutie,
  čo mení „jeden backend vs dva": či obe appky prevádzkuje používateľ, alebo neskôr iná firma.
  Detaily v docs dokumente.
- **Organizačný riadiaci pult pre federácie/kluby/akadémie (B2B)** (2026-08-02): federácia
  si objedná multiprístup (napr. 10 trénerov), **športový riaditeľ** má read-only „riadiaci
  pult" s prehľadom spolupráce každého trénera a jeho zverenca (v budúcnosti aj kondičného
  trénera). Nová os *nad* trénermi (nie vedľa hráča ako `player_connections`). Rozhodnutia:
  (1) tréner má v appke len hráčov z organizácie → žiadny per-hráč „org-visible" flag;
  (2) riaditeľ read-only; (3) jedna org = jeden šport. Model: nové tabuľky `organizations` +
  `organization_members` (rola `director`, pozývací kód ako connect-code), **živý read-only
  pohľad cez RLS** (nie kópie), reuse `app/parent/` read-only stránok + agregátov. Aditívne
  k jadru, páruje sa so Stripe („sedadlá" = predplatné na N miest, najhodnotnejší B2B tier).
  **Toto je konkrétna licencovaná verzia nižšieho bodu „Manažér/športový riaditeľ" — zlúčiť.**
  Detaily verbatim v [`docs/roadmap-buduce-smery.md`](docs/roadmap-buduce-smery.md) §4.
  **Upresnené 2026-08-02 (§5 v tom istom dokumente):** multi-tenant — **každá org = `<slug>.plaw.win`**
  (subdomény pridávané ručne, bez wildcard, cez CNAME → NS/MX nedotknuté); `plaw.win` = samostatný
  1:1 produkt, `proxy.ts` mapuje hostname → `organizations.slug` → org. **Dáta vlastní federácia**
  (tréner = zamestnanec; `organization_id` vlastník, `coach_id` priradenie; pri odchode ostávajú org).
  **Kódy cvičení štandardizuje federácia** (org-owned, tréner read-only) → porovnateľná analytika.
  **Tréner v B2B nemaže** (hard-delete → `sessions.status='cancelled'`, audit). **B2B nemá parent/player
  sledovanie** (to je consumer feature na `plaw.win`). Trénerova appka v B2B = **1:N** (roster + prepínač
  hráča). Bezpečnostné/RLS pravidlá org vrstvy sú v §5.7. Klikacie mockupy: `docs/mockups/`.
- **Manažér/športový riaditeľ pre viacerých hráčov naraz** (akadémie, zväzy): dnes má rola `manager` v DB rovnaké obmedzenie ako `parent` — `one_active_connection_per_parent` (`supabase/migrations/20260715100000_player_connections.sql`) dovoľuje len jedno aktívne prepojenie naraz, nový kód automaticky zruší predošlé. Nápad: uvoľniť tento limit len pre rolu `manager` (rodič ostáva 1:1) a postaviť prehľadovú stránku so zoznamom/tabuľkou hráčov zoskupených podľa trénera (`player_connections.coach_id`), s indikátorom "bez tréningu X dní" a agregovanou analytikou naprieč akadémiou. Dva mockupy (mobil aj tablet/laptop s grafmi) boli spravené 2026-07-17, zatiaľ len ako Claude Artifacts na diskusiu, nič nie je implementované. Ide o B2B rozšírenie scope-u (akadémie/zväzy majú iné potreby aj cenotvorbu než 1:1 tréner-hráč) — netreba to robiť mimochodom pri inej úlohe, len ako vedomé rozhodnutie o rozsahu.
- **Import dát z Garminu/Polaru** (pripomenuté 2026-07-20, zatiaľ len nápad): hráč (rola `player`, zaklaimovaná cez `player_connections`) by si mal vedieť pripojiť/stiahnuť dáta zo svojich fitness hodiniek (Garmin Connect / Polar). Dáta sa majú zobraziť pri konkrétnom tréningu (asi treba spárovať aktivitu s `sessions` podľa dátumu/času, podobne ako kolízna kontrola pri Google Calendar) aj v analytike (`lib/actions/analytics.ts`). Zatiaľ nerozhodnuté: ktoré metriky (tep, vzdialenosť, kalórie...), OAuth pripojenie per hráč (analogicky k `google_calendar_connections`, ale na strane hráča/rodičovskej appky, nie trénera), nová tabuľka na surové/spárované dáta. Nezačínaj implementovať bez ďalšieho spresnenia zadania.

## Štruktúra priečinkov

```
/app                 # Next.js App Router (stránky, layouty)
/components          # React komponenty
/components/charts   # Recharts vizualizácie
/lib                 # Supabase klient, utility, typy
/supabase/migrations # SQL migrácie
```

## Testovanie na mobile (lokálna sieť)

- **Lokálny vývoj federačného režimu:** org kontext sa odvodzuje výhradne z hostname, takže sa musí testovať cez subdoménu namapovanú na dev server (v prehliadači napr. `chromium.launch({ args: ["--host-resolver-rules=MAP <slug>.plaw.win 127.0.0.1:3000"] })`). Preto je v `allowedDevOrigins` aj `*.plaw.win` — **bez toho Next zablokuje dev požiadavky z toho hostname a stránka sa nehydratuje**, takže všetko závislé od JS ticho nefunguje (klik na tlačidlo nespraví nič). Prejaví sa to len v dev, nie na produkcii.
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
