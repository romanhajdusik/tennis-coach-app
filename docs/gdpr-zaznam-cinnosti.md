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

### A3 — Kópie tréningov pre sledujúceho

> **POTVRDENÉ 2026-08-28 ([mapa rolí §4](gdpr-mapa-roli.md)): prevádzkovateľom
> kópií sme my**, takže tento bod patrí do Časti A a nie do Časti B. Zvažovaná
> alternatíva (ponechať prevádzkovateľstvo trénerovi) bola zamietnutá — po zmazaní
> jeho účtu by práva dotknutej osoby nemal kto vykonať.
>
> **Slovo „trvalé" z názvu vypadlo 2026-08-29** — od zavedenia okna 6/24 mesiacov
> už kópie trvalé nie sú.

| | |
|---|---|
| **Účel** | poskytnúť rodičovi/manažérovi/hráčovi záznam o tréningu, ktorý prežije zrušenie prepojenia aj zánik trénerovho účtu — **v rozsahu okna uvedeného nižšie** (od 2026-08-27 už nie „trvalý") |
| **Právny základ** | čl. 6 ods. 1 písm. b — zmluva so sledujúcim |
| **Dotknuté osoby** | **deti (hráči)**, sledujúci |
| **Kategórie údajov** | `parent_session_records` (stav, plánovaný a skutočný čas, **poznámky trénera**), `parent_session_drill_records` (zameranie, charakter, kód cvičenia, trvanie, stav) |
| **Príjemcovia** | Supabase, Vercel |
| **Lehota** | **klzavé okno počítané od dnešného dňa: 6 mesiacov bez predplatného, 24 mesiacov s ním** (potvrdené 2026-08-27). Po skončení platby 30 dní odklad, potom sa okno stiahne. Staršie kópie sa **mažú, neskrývajú**, a upgrade ich nevráti |
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
| **Lehota** | podľa zmluvy s organizáciou, **predvolene 2 roky od skončenia členstva hráča** (potvrdené 2026-08-29). **Trénerské lehoty sa tu neuplatňujú** |

### B3 — Prepojenia a zdieľanie (kódy)

| | |
|---|---|
| **Prevádzkovateľ** | tréner, ktorý kód vydáva |
| **Kategórie spracúvania** | vygenerovanie kódu, uplatnenie, sprístupnenie údajov druhej strane, odvolanie |
| **Kategórie údajov** | `player_connections` (kód, stav, rola pripojeného), `player_links` (prepojenie kariet, príznaky `target_shares_summary`, `source_shares_with_follower`) |
| **Osobitosť** | prepojenie kariet je **sprístupnenie údajov o dieťati inému prevádzkovateľovi** — základ pre to musí mať vydávajúci tréner |

> **B4 — Zápis tréningu do Google Kalendára — ČINNOSŤ ZRUŠENÁ 2026-08-29.**
> Bola to jediná činnosť, pri ktorej meno dieťaťa opúšťalo naše systémy. Integrácia
> bola odstránená celá (migrácia `20260829090000`) po zistení, že ju na produkcii
> nemal pripojenú ani jeden tréner. **Riadok tu ostáva zámerne** — záznam
> o činnostiach má ukazovať aj to, čo sa spracúvať prestalo, a kedy.

---

## ČASŤ C — inventár údajov po tabuľkách

| Tabuľka | Osobné údaje | Dotknutá osoba | Prevádzkovateľ | Lehota (návrh) |
|---|---|---|---|---|
| `auth.users` | e-mail, hash hesla, IP, metadáta registrácie | používateľ | P.L.A.W | do zmazania účtu |
| `profiles` | meno, e-mail, rola, stav predplatného, limit hráčov | používateľ | P.L.A.W | do zmazania účtu |
| `players` | **meno dieťaťa**, dátum a rok narodenia, aktívnosť | hráč | tréner / organizácia | tréner: **rok od posledného tréningu** · organizácia: **predvolene 2 roky** od skončenia členstva |
| `sessions` | čas, stav, disciplína, **voľné poznámky**, id google udalosti | hráč | tréner / organizácia | ako `players`, a navyše **jednotlivý tréning najviac 4 roky** |
| `session_drills` | zameranie, charakter, kód, trvanie, stav | hráč | tréner / organizácia | ako `sessions` |
| `metrics_and_tests` | výsledky testov, poznámky — **potenciálne údaje o zdraví** | hráč | tréner / organizácia | rozhodnúť pri prvom použití |
| `drill_codes` | metodika trénera (nie osobný údaj, ale know-how) | — | tréner / organizácia | do zmazania |
| `player_connections` | prepojovací kód, id sledujúceho, rola | sledujúci, hráč | tréner | do zrušenia prepojenia; **lehota po zrušení nerozhodnutá** — zosúladiť s oknom sledujúceho alebo viazať na zmazanie jeho účtu |
| `parent_session_records` | kópia tréningu vrátane poznámok | hráč, sledujúci | **P.L.A.W** (potvrdené 2026-08-28) | klzavé okno **6 / 24 mesiacov** (viď A3) |
| `parent_session_drill_records` | kópia cvičení | hráč | **P.L.A.W** | ako vyššie |
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

- **F4 — ZANIKOL 2026-08-29.** Šlo o to, že tréner si vedel cez anon kľúč prečítať
  **vlastný** Google token (cudzí nie). Oprava mala prísť so Stripe cez
  `service_role`; namiesto toho **zanikol predmet nálezu** — integrácia
  s kalendárom bola odstránená a **appka odteraz nedrží žiadne cudzie
  prihlasovacie údaje.** Otvorený bezpečnostný nález teda nemáme žiadny.

**Otvorené riziko, ktoré nie je porušením GDPR, ale patrí sem**

- **Oba projekty bežia na Vercel Hobby pláne** (tím `romi`, zistené 2026-08-26).
  Hobby je podľa podmienok Vercelu určený na **nekomerčné použitie**, pričom
  služba sa už speňažuje. Riziko je dvojaké: pozastavenie účtu a s ním výpadok
  dostupnosti, ktorá je súčasťou bezpečnosti podľa čl. 32. **Pred prvou platiacou
  federáciou preto patrí projekt na Pro.**

**Čo v tejto časti zatiaľ chýba**

- **Postup pri incidente — neexistuje.** Od 2026-08-30 to nie je len chýbajúci
  papier: zmluva podľa čl. 28 zaväzuje oznámiť incident zväzu **do 48 hodín**
  (§8.1 v [gdpr-zmluva-cl28.md](gdpr-zmluva-cl28.md)), zväz má potom svojich
  72 hodín voči úradu. **Bez napísaného postupu je 48 hodín číslo bez obsahu** —
  toto je najvážnejší otvorený bod pred podpisom prvého zväzu.
- **Overený stav záloh a vyskúšaná obnova** — prod beží na Free pláne, treba
  zistiť, aké zálohy reálne má. **Číslo z toho ide priamo do §9.5 zmluvy** (dnes
  `[X]` dní), takže sa nedá vymyslieť.
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

**Žiadna analytika, žiadny marketingový ani sledovací skript** — overené na
závislostiach aj na kóde. **Z toho plynie, že súhlas s cookies (a teda ani cookie
lišta) sa nevyžaduje** a stačí informácia v zásadách.

Je to zároveň konkurenčná výhoda, ktorú netreba zahodiť: **ak niekedy pribudne
analytika, cookie lišta pribudne s ňou** a bude to prvá vec, ktorú nový návštevník
uvidí. Stojí za to zvážiť analytiku bez cookies, ktorá povinnosť nespustí.
