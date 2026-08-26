# Záznam o spracovateľských činnostiach (čl. 30 GDPR)

> **Stav: PRACOVNÝ PODKLAD, 2026-08-25.** Formálny záznam, ktorý sa na požiadanie
> predkladá Úradu na ochranu osobných údajov. Vychádza z [mapy rolí](gdpr-mapa-roli.md) —
> **najprv sa mení mapa, potom tento záznam.**
>
> Vedie sa v slovenčine, lebo adresátom je slovenský dozorný orgán.
>
> **Pri každej novej tabuľke alebo integrácii sem pribudne riadok.** To je jediná
> údržba, ktorú tento dokument potrebuje — a bez nej je bezcenný.

**Prevádzkovateľ:** P.L.A.W s.r.o. — *obchodné meno, IČO, sídlo, e-mail: doplniť*
**Zodpovedná osoba (DPO):** neurčená. *Posúdenie: čl. 37 ju vyžaduje pri rozsiahlom
spracúvaní osobitných kategórií alebo pravidelnom systematickom monitorovaní. Pri
dnešnom rozsahu (desiatky trénerov) povinnosť nevzniká; **prehodnotiť pri nasadení
záťaže z hodiniek a pri prvých federáciách**.*

---

## ČASŤ A — činnosti, kde je P.L.A.W s.r.o. PREVÁDZKOVATEĽ (čl. 30 ods. 1)

### A1 — Účty, prihlasovanie a správa prístupu

| | |
|---|---|
| **Účel** | umožniť registráciu, prihlásenie, obnovu hesla a rozlíšenie roly (tréner / šéftréner / sledujúci) |
| **Právny základ** | čl. 6 ods. 1 písm. b — plnenie zmluvy o poskytovaní služby |
| **Dotknuté osoby** | tréneri, šéftréneri, rodičia, manažéri, hráči so sledujúcim účtom |
| **Kategórie údajov** | e-mail, meno (`profiles.full_name`), heslo v podobe hashu, rola, potvrdenie e-mailu, čas posledného prihlásenia, IP adresa pri prihlásení (`auth.users`, `profiles`) |
| **Príjemcovia** | Supabase (Auth + DB), Vercel (hosting), Resend (odosielanie e-mailov) |
| **Prenos do tretej krajiny** | úložisko nie (Supabase Frankfurt, EÚ); pri Verceli a Resende viď Časť D |
| **Lehota** | do zmazania účtu; pri nečinnosti 24 mesiacov výzva a zmazanie (návrh) |
| **Bezpečnosť** | Časť E |

### A2 — Predplatné, skúšobná doba a promo kódy

| | |
|---|---|
| **Účel** | rozlíšiť, kto službu smie používať a v akom rozsahu; evidovať uplatnenie kódu |
| **Právny základ** | čl. 6 ods. 1 písm. b (zmluva); pri kódoch aj čl. 6 ods. 1 písm. f — oprávnený záujem zabrániť opakovanému uplatneniu |
| **Dotknuté osoby** | tréneri |
| **Kategórie údajov** | `profiles.subscription_status`, `trial_ends_at`, `player_limit`; `promo_code_redemptions` (user_id, čas uplatnenia) |
| **Príjemcovia** | Supabase, Vercel; **po napojení Stripe aj Stripe** |
| **Lehota** | počas trvania účtu; účtovné doklady 10 rokov podľa zákona o účtovníctve |
| **Poznámka** | do `profiles` appka nezapisuje vôbec, zápis patrí `service_role` — tým je vylúčené, aby si účet sám prepísal stav predplatného |

### A3 — Trvalé kópie tréningov pre sledujúceho

> **Podmienené rozhodnutím v [mape rolí §4](gdpr-mapa-roli.md).** Ak sa
> prevádzkovateľstvo kópií neprevezme, tento bod sa presunie do Časti B.

| | |
|---|---|
| **Účel** | poskytnúť rodičovi/manažérovi/hráčovi trvalý záznam o tréningu, ktorý prežije zrušenie prepojenia aj zánik trénerovho účtu |
| **Právny základ** | čl. 6 ods. 1 písm. b — zmluva so sledujúcim |
| **Dotknuté osoby** | **deti (hráči)**, sledujúci |
| **Kategórie údajov** | `parent_session_records` (stav, plánovaný a skutočný čas, **poznámky trénera**), `parent_session_drill_records` (zameranie, charakter, kód cvičenia, trvanie, stav) |
| **Príjemcovia** | Supabase, Vercel |
| **Lehota** | 3 roky od zrušenia prepojenia (návrh) |
| **Osobitosť** | zapisuje výhradne `security definer` trigger, appka nikdy priamo; DELETE sa zámerne nepropaguje |

### A4 — Transakčné e-maily

| | |
|---|---|
| **Účel** | potvrdenie registrácie, obnova hesla, prevádzkové oznámenia |
| **Právny základ** | čl. 6 ods. 1 písm. b |
| **Dotknuté osoby** | všetci držitelia účtu |
| **Kategórie údajov** | e-mail, meno, jednorazový odkaz |
| **Príjemcovia** | Resend (odosielacia subdoména `mail.plawsports.com`) — *overiť, či je custom SMTP na produkcii zapnutý; ak nie, je príjemcom vstavaný mailer Supabase* |
| **Lehota** | podľa logov poskytovateľa, cieľ do 30 dní |

### A5 — Prevádzka, bezpečnosť a logy

| | |
|---|---|
| **Účel** | dostupnosť služby, odhaľovanie chýb a zneužitia |
| **Právny základ** | čl. 6 ods. 1 písm. f — oprávnený záujem na bezpečnej prevádzke |
| **Dotknuté osoby** | všetci používatelia a návštevníci webu |
| **Kategórie údajov** | IP adresa, user-agent, čas a cieľ požiadavky, chybové výpisy servera |
| **Príjemcovia** | Vercel, Supabase |
| **Lehota** | podľa nastavenia poskytovateľa — **overiť a doplniť skutočnú hodnotu**, cieľ do 30 dní |

### A6 — Komunikácia a podpora

| | |
|---|---|
| **Účel** | odpovedať na správy poslané na `info@` / `support@` / `office@` |
| **Právny základ** | čl. 6 ods. 1 písm. b alebo f podľa obsahu |
| **Kategórie údajov** | e-mail, meno, obsah správy |
| **Príjemcovia** | Google Workspace |
| **Lehota** | 2 roky od poslednej správy (návrh) |

---

## ČASŤ B — činnosti, kde je P.L.A.W s.r.o. SPROSTREDKOVATEĽ (čl. 30 ods. 2)

Spoločné pre celú časť B: **spracúvame výhradne na pokyn prevádzkovateľa**, na
vlastný účel nič — žiadny profiling, žiadne trénovanie modelov, žiadne štatistiky
nad rámec anonymizovaných agregátov. Ďalší sprostredkovatelia sú v Časti D.

### B1 — Vedenie tréningovej dokumentácie pre samostatného trénera

| | |
|---|---|
| **Prevádzkovateľ** | jednotlivý tréner (zákazník) |
| **Kategórie spracúvania** | ukladanie, zobrazovanie, agregácia do analytiky, zálohovanie |
| **Dotknuté osoby** | **hráči — spravidla maloletí**, sledujúci |
| **Kategórie údajov** | meno hráča, dátum/rok narodenia, aktívnosť, tréningy (plán, skutočnosť, **voľné poznámky**), cvičenia, kódy cvičení, testy a merania |
| **Lehota** | podľa pokynu trénera; predvolene do zmazania hráča alebo účtu |

### B2 — Vedenie tréningovej dokumentácie pre organizáciu

| | |
|---|---|
| **Prevádzkovateľ** | organizácia (zväz / klub / akadémia) |
| **Kategórie spracúvania** | ako B1 + dohľad šéftrénera, porovnávanie hráčov, priraďovanie trénerom |
| **Dotknuté osoby** | hráči organizácie (maloletí), tréneri-zamestnanci |
| **Kategórie údajov** | ako B1 + členstvo, rola, disciplína, priradenia hráčov, pozvánky |
| **Osobitosť** | org riadky **nemá právo zmazať nikto z appky** (DELETE nemá policy) — mazanie je vyhradené `service_role`, teda výmaz sa vykonáva na pokyn organizácie |
| **Lehota** | podľa zmluvy s organizáciou |

### B3 — Prepojenia a zdieľanie (kódy)

| | |
|---|---|
| **Prevádzkovateľ** | tréner, ktorý kód vydáva |
| **Kategórie spracúvania** | vygenerovanie kódu, uplatnenie, sprístupnenie údajov druhej strane, odvolanie |
| **Kategórie údajov** | `player_connections` (kód, stav, rola pripojeného), `player_links` (prepojenie kariet, príznaky `target_shares_summary`, `source_shares_with_follower`) |
| **Osobitosť** | prepojenie kariet je **sprístupnenie údajov o dieťati inému prevádzkovateľovi** — základ pre to musí mať vydávajúci tréner |

### B4 — Zápis tréningu do Google Kalendára trénera

| | |
|---|---|
| **Prevádzkovateľ** | tréner |
| **Kategórie spracúvania** | vytvorenie, úprava a zmazanie udalosti; kontrola kolízií |
| **Kategórie údajov** | **meno hráča v názve udalosti**, čas začiatku a konca |
| **Príjemca** | Google — na účte trénera. Pri súkromnom účte Google **nekoná ako náš sprostredkovateľ**, ale ako samostatný prevádzkovateľ podľa vlastných podmienok |
| **Uložené u nás** | `google_calendar_connections`: prístupový a obnovovací token, platnosť, id kalendára |

---

## ČASŤ C — inventár údajov po tabuľkách

| Tabuľka | Osobné údaje | Dotknutá osoba | Prevádzkovateľ | Lehota (návrh) |
|---|---|---|---|---|
| `auth.users` | e-mail, hash hesla, IP, metadáta registrácie | používateľ | P.L.A.W | do zmazania účtu |
| `profiles` | meno, e-mail, rola, stav predplatného, limit hráčov | používateľ | P.L.A.W | do zmazania účtu |
| `players` | **meno dieťaťa**, dátum a rok narodenia, aktívnosť | hráč | tréner / organizácia | 3 roky od archivácie |
| `sessions` | čas, stav, disciplína, **voľné poznámky**, id google udalosti | hráč | tréner / organizácia | ako `players` |
| `session_drills` | zameranie, charakter, kód, trvanie, stav | hráč | tréner / organizácia | ako `sessions` |
| `metrics_and_tests` | výsledky testov, poznámky — **potenciálne údaje o zdraví** | hráč | tréner / organizácia | rozhodnúť pri prvom použití |
| `drill_codes` | metodika trénera (nie osobný údaj, ale know-how) | — | tréner / organizácia | do zmazania |
| `google_calendar_connections` | **OAuth tokeny v čitateľnej podobe** | tréner | P.L.A.W | do odpojenia |
| `player_connections` | prepojovací kód, id sledujúceho, rola | sledujúci, hráč | tréner | do odvolania + 3 roky |
| `parent_session_records` | kópia tréningu vrátane poznámok | hráč, sledujúci | *podľa mapy §4* | 3 roky od zrušenia |
| `parent_session_drill_records` | kópia cvičení | hráč | *podľa mapy §4* | ako vyššie |
| `organizations` | názov, slug, typ, šport, sedadlá | — (právnická osoba) | P.L.A.W | trvanie zmluvy |
| `organization_members` | id používateľa, rola, disciplína, pozývací kód | tréner | organizácia + P.L.A.W | do ukončenia členstva |
| `player_assignments` | priradenie hráč × tréner × disciplína | hráč, tréner | organizácia | do ukončenia členstva |
| `player_links` | prepojenie kariet, príznaky zdieľania | hráč | trénery na oboch stranách | do odvolania |
| `promo_codes` | poznámka k vydaniu kódu | — | P.L.A.W | do expirácie |
| `promo_code_redemptions` | id používateľa, čas uplatnenia | tréner | P.L.A.W | do zmazania účtu |

**Dve miesta, ktoré si zaslúžia pozornosť pri každej revízii:** voľné poznámky
(`sessions.notes`, `metrics_and_tests.notes`) — tam sa dostane čokoľvek vrátane
údajov o zdraví; a `google_calendar_connections` — jediné cudzie prihlasovacie
údaje, ktoré appka drží.

---

## ČASŤ D — ďalší sprostredkovatelia a prenosy do tretích krajín

| Poskytovateľ | Na čo | Postavenie | Región | DPA odklikané? |
|---|---|---|---|---|
| **Supabase** | databáza, autentifikácia, zálohy | sprostredkovateľ | **EÚ — Frankfurt** (overené 2026-08-25) | *doplniť* |
| **Vercel** | hosting, edge, logy | sprostredkovateľ | **EÚ — Frankfurt `fra1`** pre `tennis-coach-app` aj `plaw-fitness` (overené 2026-08-26) | DPA je súčasťou obchodných podmienok |
| **Resend** | transakčné e-maily | sprostredkovateľ | *doplniť* | *doplniť* |
| **Google (Workspace)** | firemná pošta | sprostredkovateľ | EU/US | *doplniť* |
| **Google (Calendar API)** | zápis udalostí na účte trénera | **samostatný prevádzkovateľ** | US | neaplikuje sa |
| **Websupport** | domény a DNS | k osobným údajom sa nedostáva | SK | — |
| **Stripe** (fáza 3) | platby | sprostredkovateľ + vlastný prevádzkovateľ pre platobné údaje | IE/US | pri napojení |

**Kde ležia dáta (overené 2026-08-25):** databáza, autentifikácia aj zálohy sú
v **Supabase Frankfurt**, teda v EÚ. **Všetky údaje o hráčoch, tréningoch,
poznámkach aj účtoch sú uložené v Únii a pri hlavnom úložisku k prenosu do tretej
krajiny nedochádza.** Je to najsilnejšia veta celej tejto časti — v zásadách aj
v zmluve pre federácie patrí na viditeľné miesto.

**Čo z EÚ predsa len vystupuje alebo môže vystúpiť:**

- **Vercel** — funkcie oboch projektov bežia vo **Frankfurte (`fra1`)**, overené
  2026-08-26 v Project Settings → Functions. Vercel je však americká spoločnosť
  a `proxy.ts` beží ako edge middleware **globálne** (nastaviť sa to nedá) — číta
  hlavičky a cookies, nič neukladá. Opierame sa preto o štandardné zmluvné doložky
  a rámec EU–US DPF.
- **Google Calendar** — meno hráča odchádza na účet trénera u Googlu (Časť B4).
- **Resend** — e-mailová adresa a obsah transakčného mailu.
- **Stripe** (fáza 3) — platobné údaje trénera, nie údaje o hráčoch.

---

## ČASŤ E — technické a organizačné opatrenia (čl. 32)

Toto je najsilnejšia časť dokumentácie, lebo nie je písaná dopredu — je to popis
stavu, ktorý bol dvakrát overený útokom proti živej databáze.

**Riadenie prístupu**

- RLS na **každej** tabuľke; hranicou prístupu je databáza, nie UI.
- `anon` nemá na verejných tabuľkách **žiadne právo** (audit 2026-08-09).
- `PUBLIC` nemá `EXECUTE` na žiadnej funkcii okrem `organization_by_slug`, ktorá
  vracia len verejné polia organizácie (audit 2026-08-15).
- Predvolené práva schémy `public` zúžené tak, že nová tabuľka dostane len `SELECT`.
- Appka **nedrží `service_role` kľúč** — únik prostredia neodhalí celú databázu.
- Dvojrežimová RLS (osobná vs organizačná) sa pýta na členstvo, nie na hostname.

**Nemennosť a integrita**

- Dokončený tréning aj archivovaný hráč sú read-only **na úrovni databázy**
  (`USING` aj `WITH CHECK`), nie len skrytím tlačidla.
- Schéma sa mení výhradne migráciami, nikdy ručne v dashboarde.

**Autentifikácia a relácie**

- Heslá spravuje Supabase Auth (nikdy sa u nás neobjavia v čitateľnej podobe).
- Všade `getUser()`, nikde `getSession()` — token sa overuje serverom.
- Google OAuth chránený state cookie (CSRF).
- Auth cookies sú **per-doménu**, nie zdieľané naprieč subdoménami.

**Sieťová vrstva**

- HTTPS s HSTS; hlavičky X-Frame-Options, CSP `frame-ancestors`, `nosniff`, Referrer-Policy.
- Kanonizácia adries: každá verejná stránka má práve jednu adresu.

**Overovanie**

- 10 sád scenárov v `scripts/dev-tests/`, z toho `security-boundaries.js`
  a `rls-solo`/`rls-org` sú výhradne bezpečnostné.
- Dva úplné audity: 1:1 režim (2026-08-07) a celý ekosystém (2026-08-15), obidva
  proti živému stavu databázy, každý nález overený útokom.

**Známe a vedome prijaté riziko**

- **F4:** tréner si vie cez anon kľúč prečítať **vlastný** Google token. Cudzí nie.
  Oprava vyžaduje `service_role`, čo dnes vymieňa malé riziko za väčšie; rieši sa
  spolu so Stripe. *Pre GDPR to nie je porušenie — je to prijaté a odôvodnené
  reziduálne riziko, a presne takto sa má zapísať.*

**Otvorené riziko, ktoré nie je porušením GDPR, ale patrí sem**

- **Oba projekty bežia na Vercel Hobby pláne** (tím `romi`, zistené 2026-08-26).
  Hobby je podľa podmienok Vercelu určený na **nekomerčné použitie**, pričom
  služba sa už speňažuje. Riziko je dvojaké: pozastavenie účtu a s ním výpadok
  dostupnosti, ktorá je súčasťou bezpečnosti podľa čl. 32. **Pred prvou platiacou
  federáciou preto patrí projekt na Pro.**

**Čo v tejto časti zatiaľ chýba**

- Postup pri incidente (72 h) — neexistuje.
- Overený stav záloh a vyskúšaná obnova — prod beží na Free pláne, treba zistiť,
  aké zálohy reálne má.
- Šifrovanie tokenov v pokoji (súvisí s F4).
- Evidencia žiadostí dotknutých osôb.

---

## ČASŤ F — cookies a úložisko v prehliadači

| Cookie | Na čo | Trvanie | Typ |
|---|---|---|---|
| `sb-*` (Supabase Auth) | prihlásenie | podľa relácie | nevyhnutná |
| `plaw_selected_player` | vybraný hráč (httpOnly) | 1 rok | nevyhnutná |
| `NEXT_TIMEZONE` | časové pásmo návštevníka | 1 rok | nevyhnutná |
| `LANDING_LOCALE` | jazyk verejného webu | 1 rok | nevyhnutná |
| `google_oauth_state` | ochrana pred CSRF pri pripájaní kalendára | 10 minút | nevyhnutná |

**Žiadna analytika, žiadny marketingový ani sledovací skript** — overené na
závislostiach aj na kóde. **Z toho plynie, že súhlas s cookies (a teda ani cookie
lišta) sa nevyžaduje** a stačí informácia v zásadách.

Je to zároveň konkurenčná výhoda, ktorú netreba zahodiť: **ak niekedy pribudne
analytika, cookie lišta pribudne s ňou** a bude to prvá vec, ktorú nový návštevník
uvidí. Stojí za to zvážiť analytiku bez cookies, ktorá povinnosť nespustí.
