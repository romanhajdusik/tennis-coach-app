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
npm run dev          # lokálny vývoj
npm run build        # produkčný build
npm run lint         # lint
npx supabase start   # lokálna Supabase inštancia
npx supabase db push # aplikovanie migrácií
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

### Bezpečnostné pravidlá (povinné)

- **RLS zapnuté na každej tabuľke.** Základná policy: `coach_id = auth.uid()`
- **Archív (neaktívny hráč) je read-only na úrovni DB:** RLS policy blokuje UPDATE/DELETE na sessions a metrics, ak hráč má `is_active = false`. UI kontrola nestačí.
- Všetky zmeny schémy výhradne cez migrácie (Supabase CLI), nikdy manuálne v dashboarde.

## Životný cyklus tréningu

1. **Plánovanie (planned):** vytvorenie zámeru — dátum, čas, zameranie
2. **Aktualizácia (review):** po tréningu tréner doplní reálny čas a poznámky
3. **Archivácia (completed):** uzamknutie záznamu

## Analytika

- Agregované pohľady: **týždenné** (operatíva), **mesačné** (fakturácia, cykly prípravy), **kvartálne** (trendy)
- Všetky analytické dotazy a PostgreSQL Views obsahujú podmienku `WHERE is_active = true` — pri zmene hráča sa dashboardy prirodzene vynulujú
- Vizualizácia: Recharts (odtrénované hodiny, rozdelenie zamerania)

## Archív

- Tréner môže v menu vybrať neaktívneho hráča (`is_active = false`)
- Aplikácia sa prepne do režimu "len na čítanie" — kompletné štatistiky, poznámky a testy viditeľné, ale needitovateľné
- Read-only vynútené v DB (RLS) aj v UI (skryté editačné prvky)

## Roadmapa (fázovanie)

### Fáza 1 — MVP (aktuálna)
- Auth (Supabase — e-mail + heslo)
- Správa hráčov (vytvorenie, deaktivácia, prepínanie)
- Tréningy: celý životný cyklus planned → review → completed
- Analytika a grafy (týždeň/mesiac/kvartál)
- Archív v read-only móde
- Lokálny vývoj, bez deploya

### Fáza 2 — Kalendár a testy
- Google Calendar: najprv jednosmerne (app → kalendár) + kontrola kolízií pri plánovaní
- Neskôr obojsmerná synchronizácia (webhooks, obnova kanálov, riešenie konfliktov — zdroj pravdy je aplikácia)
- Modul kondičných a technických testov (metrics_and_tests)

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

## Pracovné pravidlá pre Claude Code

- Pred väčšou zmenou schémy alebo architektúry navrhni riešenie a počkaj na potvrdenie
- Malé, atomické commity so slovenskými správami
- TypeScript striktne (`strict: true`), žiadne `any` bez zdôvodnenia
- Mobile First: každé UI najprv navrhni pre smartfón
