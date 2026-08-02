# Budúce smery a architektonické návrhy (Claude)

> **Čo to je:** návrhy z plánovacích rozhovorov s používateľom. **Nič z toho nie je
> implementované.** Tenisová appka (P.L.A.W) sa spúšťa **prvá a samostatne**, bez
> týchto rozšírení. Dokument slúži na to, aby sa pri ďalšej práci na tenise nerobili
> rozhodnutia, ktoré by tieto smery neskôr zablokovali (napr. natvrdo „tenisové"
> predpoklady mimo konfiguračnej vrstvy).
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
