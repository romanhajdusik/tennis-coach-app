# Budúce smery a architektonické návrhy (Claude)

> **Čo to je:** návrhy z plánovacích rozhovorov s používateľom. Okrem **DB základu
> federačnej vrstvy** (§5.9, hotový 2026-08-03) **nie je nič z toho implementované.**
> Tenisová appka (P.L.A.W) sa spúšťa **prvá a samostatne**, bez týchto rozšírení —
> org vrstva je aditívna a samostatného trénera sa nedotýka. Dokument slúži na to,
> aby sa pri ďalšej práci na tenise nerobili rozhodnutia, ktoré by tieto smery
> neskôr zablokovali (napr. natvrdo „tenisové" predpoklady mimo konfiguračnej vrstvy).
>
> Zapísané: **2026-08-01**. Znenie je zámerne ponechané tak, ako to Claude navrhol
> v rozhovore (používateľ chcel vedieť neskôr prečítať návrhy presne v tomto znení).

---

## 1. Multi-šport platforma (tenis → padel, bedminton, pickleball)

**Základná myšlienka:** tenis nie je produkt — je to **inštancia #1**. Padel, bedminton,
pickleball sa líšia len v ~10 % (zamerania/kategórie + drills + pár analytických
pravidiel). Zvyšných ~90 % — **engine** — je zdieľané: účty, životný cyklus tréningu
(planned→review→completed), RLS bezpečnosť, zdieľanie s rodičom/hráčom, kalendár,
Google sync, celý *rámec* analytiky (obdobia, agregácia, grafy), PWA, verejný web.

**Zlaté pravidlo:** *Šport-špecifické = konfigurácia/obsah. Engine = zdieľaný kód.
Engine nikdy neforkovať na šport.* Nový šport = nový konfiguračný súbor, nie nová appka.

**Dobrá správa — appka je na ~80 % pripravená.** Väčšina šport-špecifických vecí už
žije na jednom mieste:
- `lib/drill-options.ts`: `CATEGORY_OPTIONS`, `DRILLS`, `ANALYTICS_FULL_BREAKDOWN_CATEGORIES`,
  `ANALYTICS_GROUPED_CATEGORIES`, `ANALYTICS_HIDE_STROKES_CATEGORIES`, `splitSlotsIntoGroups`…
- `lib/actions/analytics.ts`: `STROKES_PER_MIN`, `BREAK_FACTOR`, `FIXED_STROKES_PER_MIN_CATEGORIES`,
  `ageStrokeFactor`.

Toto **je** de facto tenisová „SportConfig", len ešte nie je pomenovaná ako taká.
Tabuľka `drill_codes` navyše už dnes dovoľuje **každému trénerovi personalizovať drills**
— „iné drills pre padel" je teda len iný predvolený zoznam, mechanizmus existuje.

**Čo dnes ešte „presakuje" ako tenis** (patrí do budúcej SportConfig, nie roztrúsené):
- **Vzorec počtu úderov** a slovo *„strokes"* (tenisové; bedminton/pickleball majú inú
  dynamiku výmen).
- **Zoskupenie serve/return podľa prefixu** (`1st/2nd serve`, `RET-FRH/BKH`) — čisto
  tenisová konvencia.
- **Charakter úderu** (offensive/neutral/defensive) pravdepodobne generalizuje, ale
  sadzby sa líšia.

**Čo urobiť TERAZ (pred launchom):**
- Nestavať multi-šport. Spustiť tenis.
- Držať disciplínu: všetko šport-špecifické patrí do konfig vrstvy; nič nehardcodovať
  „tenisovo" inde (nadpisy, vzorce, zoskupenia).
- *(Lacný krok)* Spraviť **audit** miest, kde tenisové predpoklady presakujú mimo
  `drill-options.ts` — bez prepisu, len zoznam, aby neskoršie „zabalenie do SportConfig"
  bolo triviálne. Najlepšia poistka pred forkom.

**Budúci mechanizmus (rozhodnúť neskôr) — 2 cesty:**

| | A) Jeden repo, šport podľa nasadenia (ODPORÚČANÉ) | B) Jedno nasadenie, šport podľa trénera v DB |
|---|---|---|
| Ako | rovnaký kód, `SPORT=padel` → `padel.app`, `badminton.app`… samostatné domény/branding/predplatné | jedna stránka, tréner si pri registrácii vyberie šport |
| Plus | jeden codebase, čisté oddelené produkty, jednoduché | jeden unifikovaný produkt, všetky športy naraz |
| Mínus | viac nasadení (triviálne) | zložitejšie, mieša branding |

Odporúčané: **A** (sedí k „appky sa predávajú samostatne": rovnaký engine, iná
SportConfig na nasadenie). **Vyvarovať sa:** kopírovať celý repo na každý šport
(oprava bugu × N kópií = údržbové peklo).

---

## 2. Kondičná appka (samostatná doména, 1:N)

**Zámer:** vznikne samostatná appka pre **kondičný tréning**. V tenisovom kalendári
daného hráča sa majú zobraziť aj údaje o jeho kondičnom tréningu.

**Štyri obmedzenia od používateľa (2026-08-01):**
1. Kondička = **viac aktívnych hráčov** (1:N), na rozdiel od tenisu (1:1).
2. Všetky údaje sú **vlastníctvom príslušného trénera** (tenisové → tenisový, kondičné → kondičný).
3. Kondičná appka funguje **aj bez naviazania** na tenisový kalendár.
4. Appky sa dajú **kúpiť samostatne**.

**Čo z toho vyplýva:**
- (1) Kondičné dáta **nemôžu žiť v tenisových tabuľkách** (`players`/`sessions` majú
  tvrdý `one_active_player` index) → kondička má **vlastnú schému/tabuľky** s modelom 1:N.
  (Prekrýva sa s nápadom „manažér/akadémia — viac hráčov" z CLAUDE.md.)
- (2) Integrácia je len **read-only nahliadnutie** so súhlasom; vlastníctvo a zdroj
  pravdy zostáva u toho, kto dáta vytvoril.
- (3) Integrácia musí byť **voliteľná, opt-in**. Bez prepojenia nič neprechádza.
- (4) **„Samostatný predaj" ≠ „samostatná databáza".** Predplatné je vec appky
  (per-app), nie databázy.

**Odporúčaný model:** *jeden Supabase projekt + spoločné Auth, ale dve čisto oddelené
domény (tenis / kondička), prepojené voliteľným connect-code linkom a read-only čítaním.*

Prečo nie dve úplne oddelené databázy (zatiaľ):
- Dve databázy = dva auth systémy → vráti sa **problém identity** (ktorý hráč je ten istý?).
- Cross-read cez RLS by nefungoval → potreboval by si API/webhook vrstvu (kontrakty,
  servisný auth, synchronizácia) — pre solo začiatočníka veľa réžie.
- Spoločné Auth to rieši zadarmo: tenisový kalendár si prečíta kondičku priamo cez RLS.

Všetky 4 obmedzenia pritom ostávajú splnené:

| Obmedzenie | Ako ho model spĺňa |
|---|---|
| 1) viac hráčov v kondičke | vlastná schéma kondičky (1:N), oddelená od tenisu |
| 2) dáta vlastní tréner | oddelené domény + RLS; integrácia je len read-only pohľad |
| 3) kondička bez tenisu | prepojenie je opt-in; bez linku appka beží sama |
| 4) samostatný predaj | predplatné je per-app, nezávislé od zdieľaného backendu |

**Kľúčové princípy:**
- **Oddelené domény** — kondička = vlastné tabuľky, vlastný tréner-vlastník, nič sa
  nemieša do tenisovej schémy.
- **Spoločná identita** — jedno Supabase Auth (jeden účet hráča naprieč oboma). Najcennejšia
  zdieľaná vec.
- **Opt-in most = connect-code** (už existuje v `player_connections`): tenisový hráč ↔
  kondičný hráč sa prepoja len pri obojstrannom súhlase.
- **Read-only cross-read**: tenisový kalendár číta len minimum (dátum, typ, príp. súhrn),
  read-only. Vlastníctvo ostáva u kondičného trénera.

**Kedy ísť do úplného oddelenia (dve DB + API):** až keď appky budú prevádzkovať/vlastniť
rôzne firmy, alebo budú potrebovať nezávislé škálovanie/compliance. Dovtedy je jeden
backend pragmatickejší; prechod na dve DB neskôr je **deployment rozhodnutie, nie prepis**,
ak domény držíš oddelené od začiatku.

---

## 3. Import z Garmin/Polar (už v roadmape od 2026-07-20)

Pripojený hráč (rola `player`) si pripojí/stiahne dáta z **Garmin Connect / Polar**;
zobrazia sa pri konkrétnom tréningu (detail session) + v analytike. Rovnaký tvar problému
ako kondička: „cudzie dáta o tréningu → do session/kalendára", preto navrhovať konzistentne.

Otvorené otázky: ktoré metriky (tep, vzdialenosť, kalórie…), párovanie aktivity so `sessions`
(podľa dátumu/času, ako kolízna kontrola pri Google Calendar) alebo ručný výber, OAuth per
hráč (analogicky ku `google_calendar_connections`, ale na strane hráča), nová tabuľka na
surové/spárované dáta.

---

## 4. Organizačný riadiaci pult pre federácie / kluby / akadémie (B2B)

**Zámer:** federácia/klub/akadémia si objedná **multiprístup** (napr. 10 trénerov) a
**športový riaditeľ / šéftréner** má na „riadiacom pulte" read-only prehľad o spolupráci
každého trénera a jeho zverenca (a v budúcnosti aj kondičného trénera).

**Čo to je:** *organizačná vrstva NAD trénerom* — nová os. Doteraz je model 1:1 (tréner ↔
hráč) a vedľa neho pozorovatelia jedného hráča (rodič/manažér cez `player_connections`).
Federačný pult je entita **nad trénermi**, ktorá kúpi *sedadlá* a dozerá na dvojice
*tréner ↔ zverenec*. Je to **konkrétna, B2B, licencovaná verzia** už zapísaného nápadu
„manažér/športový riaditeľ pre viacerých hráčov" (akadémie/zväzy, 2 mockupy) — **zlúčiť
do jedného konceptu**, nie robiť dva paralelné.

**Rozhodnutia používateľa (2026-08-02):**
1. **Tréner má v appke len hráčov z organizácie** → odpadá per-hráč „org-visible" príznak;
   riaditeľ vidí celý workspace trénera (všetci jeho hráči = org hráči).
2. **Športový riaditeľ je read-only** → žiadne write policies, žiadne prideľovanie/presúvanie
   hráčov vo v1; čistý dohľad + agregáty.
3. **Jedna organizácia = jeden šport** → org viazaná na jednu SportConfig, homogénny roster;
   federácia s viacerými športmi = viac org inštancií (neskôr).

**Dátový model (pridané, nie prepis):**
- `organizations` — federácia/klub/akadémia (`name`, `type`, `seat_limit` napr. 10,
  `subscription_status`).
- `organization_members` — `org_id`, `user_id`, `role` (`director` | `coach` | neskôr
  `conditioning_coach`), `status` (`invited`/`active`/`removed`). Tréner sa pridá cez
  **pozývací kód** (rovnaký vzor ako connect-code v `player_connections`).
- **Rola `director`** (šéftréner) — org-level admin, read-only dohľad.
- Doterajšie tabuľky (`players`, `sessions`, `drill_codes`…) sa nemenia.

**Ako riaditeľ vidí dáta — živý read-only pohľad cez RLS (odporúčané), nie kópie.**
Rodičovské kópie (`parent_session_records`) vznikli, aby rodič neprišiel o históriu pri
zmazaní — to tu neplatí, org je zastrešujúca entita a chce *aktuálny* stav. Pridá sa SELECT
policy: *riaditeľ smie čítať `players`/`sessions`/`session_drills`/analytiku trénerov, ktorí
sú aktívni členovia jeho organizácie.* Read-only, žiadna editácia.

**Súkromie/súhlas:** tréner sa do org pridá dobrovoľne (prijme pozvánku) — federácia nemôže
potichu „vysať" cudzieho trénera. Vďaka rozhodnutiu 1 sú všetci jeho hráči org hráči, takže
členstvo = súhlas s plným dohľadom (žiadny per-hráč flag netreba).

**Znovupoužitie:** pozývací kód = vzor connect-code; detail spolupráce, do ktorého riaditeľ
„vkĺzne" = tie isté read-only stránky ako dnes vidí rodič (`app/parent/` detail + analytika),
len s inou permission/zdrojom; riadiaci pult = roster trénerov → aktívny hráč → drill-in +
agregáty (kto je aktívny, „bez tréningu X dní", záťaž naprieč akadémiou = presne tie 2 mockupy,
reuse analytického a dataviz rámca).

**Fázovanie a biznis:** teraz nestavať (tenis launchuje 1:1 samostatne). Org vrstva je čisto
**aditívna** (nové tabuľky + RLS), bez prepisu jadra. Prirodzene sa páruje so **Stripe (Fáza 3)**:
„sedadlá" = predplatné na N miest. **B2B je najhodnotnejší tier** (akadémia platí za 10 trénerov
naraz) — oplatí sa okolo toho navrhnúť cenník.

---

## 5. Federačný B2B — upresnené rozhodnutia a bezpečnosť (2026-08-02)

> Nadväzuje na §4. Sada rozhodnutí z pracovnej session 2026-08-02. Stále **nič
> neimplementované** (tenis launchuje 1:1 samostatne). Klikacie mockupy sú v repe:
> `docs/mockups/riadiaci-pult.html` (pult šéftrénera), `trener-b2b.html` (trénerova
> appka 1:N), `architektura-b2b.html`, `onboarding-org.html`.

### 5.1 Trénerova appka v B2B = tá istá appka, ale 1:N
- Federačný tréner je zamestnanec s **viacerými aktívnymi hráčmi** (1:N), nie 1:1. Nie je
  to iná appka — je to ten istý coach app + **roster pridelených hráčov** + **prepínač
  aktívneho hráča** naprieč obrazovkami. Denný „domov" = obrazovka *Dnes* (rozvrh naprieč hráčmi).
- Najväčší reálny kus práce: dnes všetko počíta s jedným aktívnym hráčom
  (`one_active_player`, analytika `is_active = true`) → treba **prepínač hráča** a uvoľniť
  index len pre org kontext.
- Šéftréner vidí **tie isté štatistiky ako tréner** (kategórie, kódy, charakter, obdobia,
  odhad úderov) — cez živú SELECT policy, read-only.

### 5.2 Doménový model — multi-tenant, subdoména na organizáciu
- **Každá organizácia = `<slug>.plaw.win`** (nové pole `organizations.slug`, unique).
- Subdomény sa pridávajú **RUČNE per organizácia (NIE wildcard)** — CNAME `<slug>` v zóne
  plaw.win (Websupport) + doména `<slug>.plaw.win` vo Verceli (HTTPS auto). **Výhoda: netreba
  presúvať nameservery na Vercel → MX/mail na plaw.win ostáva nedotknutý**; plná kontrola
  (B2B org je málo, onboardujú sa zámerne).
- **`plaw.win` = samostatný (consumer) produkt 1:1**; `plaw.online` = marketing.
  `proxy.ts` prečíta hostname → slug → organizácia (kontext + branding).
- Onboarding org = 4 kroky: (1) Vercel add domain, (2) Websupport CNAME, (3) HTTPS auto,
  (4) Admin — vytvor org so slugom. Vlastná doména federácie (.sk) = enterprise white-label
  (kupuje federácia), iná liga.

### 5.3 Dve osi (nemiešať)
- **Rola → plocha:** `coach` → appka, `director` → pult, `parent`/`player` → sledovanie.
- **Kontext (subdoména/členstvo) → režim:** `plaw.win` = 1:1 (tréner vlastní),
  `<org>.plaw.win` = 1:N (federácia vlastní).

### 5.4 Vlastníctvo dát — FEDERÁCIA, nie tréner
- V org dáta (hráči, tréningy, `session_drills`, `drill_codes`) vlastní **organizácia**;
  tréner je *priradený zamestnanec*. Model: `organization_id` = vlastník, `coach_id` =
  priradenie (mutable).
- **Offboarding:** odíde tréner → hráči + história **ostávajú organizácii** a dajú sa
  prideliť inému. Kľúčový B2B argument — tréner si klientov neodnesie.
- Toto vysvetľuje, prečo je pri org **živý read-only RLS pohľad** správny (nie kópie ako pri
  rodičovi — org vlastní dáta, pri odchode trénera nič nezmizne).

### 5.5 Kódy cvičení štandardizuje federácia
- `drill_codes` v org patria organizácii (nie per-tréner). Nastavuje **šéftréner (Admin)**;
  tréner ich na `/drill-codes` iba používa (read-only).
- Dôvod: hráči sú podporovaní federáciou → jednotná metodika; a hlavne **jednotné kódy =
  porovnateľná analytika naprieč federáciou** (bez nich sa agregát/rozpad kódov v pulte nedá
  zmysluplne poskladať).

### 5.6 B2B nemá vrstvu sledovania rodič/hráč
- `parent`/`player`/`manager` read-only (dnešné `/parent`, `player_connections`) je funkcia
  **samostatného** produktu na `plaw.win`.
- Vo federačnom svete sú len **director (pult) + coach (1:N appka)**; tréningové dáta sú
  federačne interné, žiadny rodič/hráč login. (Director len technicky *reusuje* read-only
  `app/parent/` stránky ako komponenty pre drill-in — code-reuse, nie parent prístup.)

### 5.7 BEZPEČNOSŤ / RLS (povinné pri implementácii org vrstvy)
- **Dvojrežimová RLS vedľa seba:**
  - *Org riadky* (`organization_id` nie je null): prístup podľa `organization_members` usera.
  - *Osobné riadky* (`organization_id` null): starý model `coach_id = auth.uid()` —
    samostatný tenis nedotknutý.
- **Director (`director`):** SELECT-only nad org riadkami svojej org — žiadny write/delete vo v1.
- **Coach-zamestnanec:** SELECT/INSERT/UPDATE nad org riadkami priradenými jemu, ale **NIE
  DELETE**. Mazanie rezervované pre org-admina, príp. nikoho (trvalý záznam).
- **Tréner v B2B nevie mazať:** DELETE policies pre coach odobrané na `players`/`sessions`/
  `session_drills`. Hard-delete naplánovaného tréningu (`deleteSession`) sa nahradí
  **`sessions.status = 'cancelled'`** (status už v schéme existuje) → úplný audit ostáva.
- **Tenant izolácia:** `proxy.ts` hostname→org musí byť autoritatívny (requesty jednej org
  nesmú vidieť dáta inej). **Supabase Auth cookies per-subdoménu**, NIE zdieľané `.plaw.win` —
  session sa nesmie preniesť medzi organizáciami.
- **Členstvo dobrovoľné:** tréner sa do org pridá cez pozývací kód (vzor connect-code) —
  federácia nemôže potichu „vysať" cudzieho trénera.
- Zachovať existujúce: RLS zapnuté na každej tabuľke; completed/archív read-only cez RLS.

### 5.8 Otvorené otázky (B2B)
- ~~Môže byť tréner súčasne nezávislý **aj** org-zamestnanec?~~ **ROZHODNUTÉ 2026-08-03: NIE
  — účet je buď/alebo.** Jeden používateľ má najviac jedno aktívne členstvo
  (`one_active_membership_per_user`) a kto už vlastní osobných hráčov, do organizácie
  nevstúpi (`has_personal_data`); org účet zase nevie zakladať osobné riadky. Tréner,
  ktorý robí oboje, si založí druhý účet (druhý e-mail). Dôvod: jednoduchšie uvažovanie
  aj UI — netreba prepínač „koša" dát ani vysvetľovať, prečo tie isté obrazovky raz
  patria jemu a raz federácii.
- Kondičný tréner v org (`conditioning_coach`) — neskôr.

### 5.9 Stav implementácie — DB základ HOTOVÝ (2026-08-03)

**Hotové (migrácie `20260803090000_organizations.sql` + `20260803091000_org_rls.sql`):**
- Tabuľky `organizations` (vrátane `slug` = subdoména a `seat_limit` = sedadlá) a
  `organization_members` (rola `director`/`coach`, pozývací kód).
- `organization_id` na `players` / `sessions` / `session_drills` / `metrics_and_tests` /
  `drill_codes` = **vlastník riadku** (`null` = osobný). `coach_id` v org režime = len
  *priradenie*, takže offboarding trénera je zmena priradenia, nie strata dát.
- `one_active_player` je odteraz **čiastočný index** (`... and organization_id is null`) →
  federačný tréner môže mať viac aktívnych hráčov naraz (1:N), samostatný naďalej jedného.
- `claim_organization_invite(p_code)` + trigger `enforce_membership_rules`: pripojenie účtu
  len cez claim (dobrovoľné členstvo), zákaz vstupu s osobnými dátami, kontrola sedadiel.
- **Dvojrežimová RLS podľa §5.7** vrátane: director SELECT-only, tréner bez DELETE, org kódy
  cvičení read-only pre trénera, vypnuté zdieľanie s rodičom pre org trénerov.
- `organization_by_slug(p_slug)` — `security definer` čítanie pre `proxy.ts` ešte pred
  prihlásením (vracia len verejné polia).
- Overené 41 RLS scenármi proti lokálnej inštancii (tenant izolácia, sedadlá, uzamknutý
  tréning, nedotknutý samostatný režim), `tsc` + `lint` + `build` čisté.

**Hotové (2026-08-03, druhá dávka) — multi-tenant routing subdomén:**
- `proxy.ts` rozpozná `<slug>.plaw.win`, načíta organizáciu (`organization_by_slug`) a podá ju
  do appky hlavičkami `x-plaw-org-*`; appka ju číta cez `getOrgContext()`
  (`lib/org/context.ts`, `lib/org/resolve.ts`). Prichádzajúce hlavičky sa zahadzujú → org sa
  nedá podvrhnúť zvonka. Neznámy slug → 307 na `plaw.win`.
- **Stráž členstva:** kto nie je aktívnym členom danej org, skončí na `/login` **tej istej
  subdomény** a session sa mu tam zahodí (zmazaním cookies), takže sa vie prepnúť na správny
  účet. Len pri GET; hranicou dát ostáva RLS. Odhlásený prejde na `/login` — org subdoména
  nemá marketingovú landing. *(Prvá verzia posielala na `plaw.win` a vznikla slepá ulička —
  stráž presmerovala aj `/login`, takže sa na subdoménu už nedalo prihlásiť ani správnym
  účtom; odhalené pri teste naostro 2026-08-04.)*
- **Pozor:** `supabase.auth.signOut()` volá `/logout` na serveri **aj so `scope: "local"`**
  a zruší refresh token danej session — na „zabudni ma na tomto hostname" sa preto NEPOUŽÍVA,
  session sa zahadzuje zmazaním `sb-*auth-token` cookies. Rovnako: Next middleware neprijme
  relatívnu `Location`, a `request.nextUrl` sa v dev serveri neriadi hlavičkou `Host` —
  cieľ presmerovania sa preto skladá z `Host`.
- **Auth cookies sú host-only** (nikde sa nenastavuje `domain`) → session sa neprenáša medzi
  organizáciami ani na `plaw.win`. Požiadavka §5.7 splnená bez zmeny kódu, overené.
- Overené 10 scenármi proti dev serveru (člen, samostatný tréner, člen inej org, podvrhnutá
  hlavička) + 8 hostname scenármi. Pozn.: Node `fetch` zahadzuje hlavičku `Host`, takže
  virtuálne hosty sa testujú cez `curl` alebo `node:http`, nie cez `fetch`.

**Nehotové (ďalšie kroky, v tomto poradí):**
1. Trénerova appka 1:N: roster pridelených hráčov + prepínač aktívneho hráča, obrazovka *Dnes*
   (dnes appka všade počíta s jedným aktívnym hráčom).
2. Riadiaci pult šéftrénera (`/director`) — reuse read-only `app/parent/` stránok a agregátov.
3. Onboarding: admin založí org, šéftréner pozýva trénerov kódom; `/drill-codes` v org režime
   read-only pre trénera, editovateľné pre šéftrénera.
4. Stripe „sedadlá" (`seat_limit` už v schéme).

**Pozor pri nasadení:** migrácie sa na produkciu púšťajú ručne cez Supabase SQL Editor
(DB základ bol takto nasadený 2026-08-03). Organizácia na produkcii vzniká až vložením riadku
do `organizations` — kým tam nie je, appka sa správa presne ako predtým.

---

## Prierezové princípy celého ekosystému

- **Spoločné Supabase Auth** drží celý ekosystém — jeden účet hráča naprieč všetkým
  (raketové športy aj kondička).
- **Raketové športy** (tenis/padel/bedminton/pickleball) = ten istý engine + SportConfig na šport.
- **Kondička** = *naozaj iný model* (1:N, iná doména) — nie ďalšia SportConfig, ale samostatná
  doména napojená cez opt-in link.
- **Opt-in connect-code** a **read-only cross-read** sú jednotný vzor pre všetky integrácie
  (rodič, kondička, prípadne Garmin/Polar) — appka ich už používa (rodičovské kópie, Google Calendar).

---

## Otvorené otázky (rozhodnúť, keď na to príde)

1. **Prevádzka appiek:** obe prevádzkuje používateľ (jeho firma) → jeden backend stačí.
   Ak by kondičnú appku mala vlastniť/prevádzkovať iná firma → zvážiť od začiatku dva backendy.
   *(Toto je jediné rozhodnutie, ktoré mení „jeden backend" vs „dva".)*
2. **Multi-šport mechanizmus:** A (šport podľa nasadenia) vs B (šport podľa trénera v DB).
3. **Garmin/Polar:** metriky, spôsob párovania, OAuth model.
4. ~~**B2B — dvojaká rola trénera**~~ — **rozhodnuté 2026-08-03: účet je buď/alebo**, kto
   robí oboje, má dva účty (viď §5.8, vynútené v DB).
