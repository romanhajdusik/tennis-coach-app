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

### 2.1 Upresnenia (2026-08-10 a 2026-08-12) — toto prebíja text vyššie

**Prvý argument vyššie už NEPLATÍ.** Text hovorí „kondička = 1:N na rozdiel od tenisu 1:1"
a odvodzuje z toho vlastnú schému. Index `one_active_player` medzitým padol (migrácia
`20260810090000`) — tenisový tréner má tiež 1:N a počet hráčov je len cenová hladina.
Kondička je tak bližšie k **inštancii #2 toho istého enginu** než k samostatnej schéme.
Odporúčaný model je preto **spoločné tabuľky + štítok `discipline`**, a ten štítok musí
sedieť **na tréningu**, nie sa odvodzovať od trénera (`assign_player_to_coach` prepisuje
`coach_id` aj spätne, takže by preradenie hráča premenilo staré tenisové tréningy na
kondičné) ani od hráča (viď nižšie).

**Rozsah upresnený userom 2026-08-12:** `plawsports` = **raketové športy** (tenis, padel,
pickleball, bedminton) a pravdepodobne to tak ostane. **Kondiční tréneri v nich pracujú
naprieč športmi naraz a zamerania aj cvičenia sú v kondičke identické.** Dôsledky:

1. **Kondička nemá SportConfig varianty — jeden katalóg, jedna inštancia** pre všetky
   raketové športy. Tenis/padel/bedminton majú každý vlastné nasadenie, kondička nie.
2. **Disciplína sa nesmie odvodzovať zo športu hráča** — kondičný tréner má v jednom
   rosteri tenistu aj bedmintonistu.
3. Vo federácii narazí cezšportový kondičný tréner na `one_active_membership_per_user`
   → pre druhý zväz **druhý účet** (rovnaký vzor ako šéftréner, ktorý aj sám trénuje).

**Doména ROZHODNUTÁ 2026-08-12: `fitness.plawsports.com`.** Kondička je spoločná vrstva
nad raketovými športmi, takže patrí pod zastrešujúcu značku, nie pod `plaw.win` (tenis).
Meno prežije aj rozšírenie mimo raketových športov. **Vybrať doménu bolo treba TERAZ, kým
kondička nemá ani jedného používateľa** — auth cookies sú host-only a org kontext ide
z hostname, takže neskorší presun by odhlásil všetkých a rozbil PWA ikony, presne ako pri
zamietnutom presune tenisovej appky na `app.plawsports.com`. DNS záznam sa zakladá až keď
bude čo nasadiť; pošty `plawsports.com` sa to nedotkne (`A`/`CNAME` vs `MX`/`TXT`), len
platí, že DMARC apexu sa vzťahuje aj na subdomény.

---

## 3. Záťaž z hodiniek: SÚBOR OD HRÁČA (prepracované 2026-08-11)

> **Zmena oproti pôvodnému zneniu (2026-07-20).** Pôvodne sa počítalo s **OAuth
> pripojením na Garmin Connect / Polar Flow** na strane hráča. Používateľ 2026-08-11
> určil inú cestu: **appka prijme zdieľaný súbor od hráča.** Pôvodný odsek je nižšie
> v „Prečo nie OAuth". Používateľ zároveň **odložil na neurčito modul kondičných
> a technických testov** a označil túto funkciu za podstatne dôležitejšiu.

**Zámer:** hráč nosí na tréningu hodinky (Garmin, Polar, Suunto, Coros, Apple Watch).
Appka má vedieť prijať vyexportovaný súbor s aktivitou a ukázať trénerovi, **aká bola
záťaž** — pri konkrétnom tréningu, neskôr aj v čase.

### 3.1 Rozhodnutia používateľa (2026-08-11)

1. **Súbor nahráva TRÉNER, nie hráč.** Hráč mu ho pošle mimo appky (mail, WhatsApp).
   Dôvod: nemení to prístupový model a **funguje to v oboch svetoch naraz** — vo
   federácii hráč ani rodič účet nemajú (§5.6), takže cesta „hráč si nahrá sám" by tam
   neexistovala. Rodičovská vrstva je dnes navyše striktne read-only; upload by bol jej
   úplne prvý zápis. Nahrávanie hráčom je tým odložené, nie zamietnuté — keď príde,
   bude to funkcia samostatného (consumer) produktu, presne ako zdieľanie s rodičom.
2. **Pôvodný súbor sa NEUCHOVÁVA.** Appka ho rozparsuje, uloží vyčítané hodnoty
   a súbor zahodí. Dôvod: appka dnes nepoužíva Supabase Storage vôbec — žiadny bucket,
   žiadne policy nad `storage.objects` — a produkcia beží na Free pláne. Ušetrí to
   novú bezpečnostnú plochu aj platený priestor. **Cena:** pri zmene parsovania sa
   staré súbory už neprepočítajú, tréner by ich musel nahrať znova.
3. **Zatiaľ sa nekóduje**, toto je návrh.

### 3.2 Prečo súbor a nie OAuth

- **Netreba partnerský program.** Garmin Connect Developer Program aj Polar AccessLink
  vyžadujú registráciu aplikácie a schválenie; súbor nepotrebuje nič.
- **Jedno riešenie pre všetky značky.** OAuth by znamenal samostatnú integráciu pre
  Garmin, samostatnú pre Polar, ďalšiu pre Coros… Export do súboru vie každý.
- **Žiadna údržba tokenov.** Odpadá to, čo appku už raz stálo prácu pri Google
  Kalendári: obnova tokenov, odpojenie, a hlavne **uložené cudzie prihlasovacie údaje**
  (dnes vedome prijaté riziko, viď CLAUDE.md, sekcia Google Calendar). Súbor žiadne
  poverenia nezavádza.
- **Nevýhoda, s ktorou treba rátať:** je to ručný krok. Hráč musí súbor vyexportovať
  a poslať, tréner nahrať. Pri dennom používaní to bude otrava — preto to má byť
  postavené tak, aby sa neskôr dalo doplniť automatické pripojenie **bez zmeny
  dátového modelu** (tabuľka nižšie nevie, odkiaľ hodnoty prišli, iba že prišli).

### 3.3 Formáty

| Formát | Kto ho dá | Parsovanie |
|---|---|---|
| `.FIT` | Garmin aj Polar natívne | binárny, **potrebuje knižnicu** (projekt má dnes 6 závislostí a žiadny parser) |
| `.TCX` | Garmin, Polar Flow | XML, obsahuje tep aj po sekundách — zvládne sa bez závislosti |
| `.GPX` | takmer všetko | XML, ale **tep je nepovinné rozšírenie** — na kurte často chýba |

**Odporúčanie: začať `.TCX`** (pokrýva Garmin aj Polar, dá sa spracovať bez novej
závislosti) a `.FIT` doplniť, keď sa ukáže, že hráči posielajú práve ten. `.GPX` je
pre tenis najslabší — je stavaný na trasu, nie na záťaž.

**Zamietnuté: odkaz na zdieľanú aktivitu** (Garmin Connect share URL). Vyzerá pohodlne,
ale znamená sťahovať a rozoberať cudziu stránku — krehké voči každej ich zmene a na
hrane ich podmienok. Súbor je stabilný.

### 3.4 Kam sa to naviaže

**Súbor sa nahráva NA konkrétny tréning** (detail session), takže **párovanie podľa času
odpadá** — to bola pôvodne otvorená otázka a týmto rozhodnutím sa ruší. Tréner vidí, ku
ktorému tréningu súbor pridáva.

**Ale čas sa aj tak musí skontrolovať:** ak sa začiatok aktivity rozchádza s tréningom
o viac než pár hodín, appka to má **oznámiť, nie zablokovať** — presne ako kolízna
kontrola pri Google Kalendári. Tréner môže mať dôvod nahrať aktivitu z iného dňa,
ale mýliaci sa súbor je pravdepodobnejší.

### 3.5 Čo vyčítať a uložiť

Nová tabuľka, jeden riadok na jednu nahranú aktivitu:

```
session_loads
  id, session_id (fk), player_id, coach_id, organization_id   -- dvojrežimové vlastníctvo ako všade
  started_at, duration_seconds
  avg_hr, max_hr, calories, distance_meters
  source            -- 'tcx' | 'fit' | neskôr 'garmin_api'
  raw_summary jsonb -- čo sa vyčítalo navyše, bez schémy
  created_at
```

- **Dvojrežimové vlastníctvo je povinné** (`coach_id` + `organization_id`) — inak sa to
  do federačnej RLS nezmestí. Vzor: `session_drills`.
- **`raw_summary` jsonb** je zámerný ventil: každé hodinky hlásia niečo navyše
  (tréningová záťaž, EPOC, HRV, čas v zónach) a nedá sa to dopredu vymenovať.
- **Zóny tepu potrebujú maximálny tep hráča.** Appka ho nemá, ale **má `players.birth_year`**
  (pridaný 2026-08-01), takže sa dá odhadnúť. Odhad sa nesmie tváriť ako meranie —
  buď to označiť ako odhad, alebo pridať `players.max_hr` a nechať trénera zapísať
  namerané maximum.

### 3.6 Kde sa to zobrazí

1. **Detail tréningu** — panel so záťažou pod cvičeniami. To je v1 celé.
2. **Neskôr analytika záťaže v čase** — priemerný/maximálny tep a trvanie po týždňoch.
   **Nesmie ísť do `CategoryShareChart`** (podiel zamerania na celkovom čase): tá počíta
   percentá z minút cvičení a záťaž by ich ticho prepísala. Rovnaká pasca je zapísaná
   pri kondičnej appke (§2) — je to tá istá trieda chyby.
3. **Federačný pult** — pre zväz je „koľko toho dieťa reálne odmakalo" silnejší údaj než
   počet hodín na kurte. Až po v1.
4. **Rodič/hráč záťaž v1 nevidí** — rodičovská vrstva číta kópie (`parent_session_records`),
   takže by si vyžiadala ďalšiu kópiu. Rovnaký dôvod, pre ktorý ju v1 nedostane ani
   modul testov.

### 3.7 Čo do v1 NEDÁVAŤ

- OAuth pripojenie na Garmin/Polar (celý zmysel tohto prepracovania).
- Nahrávanie hráčom/rodičom (§3.1).
- Uchovávanie súborov v Storage (§3.1).
- Krivku tepu po sekundách. Dá sa vyčítať, ale je to tisíce hodnôt na tréning
  a v1 z nej tréner nič nemá — stačí priemer, maximum a trvanie.

### 3.8 Prierezovo

Záťaž je **disciplinárne neutrálna** — tep je tep v tenise aj v kondičnej príprave.
Patrí teda do **enginu, nie do SportConfig** (§1). A je to ten istý tvar problému ako
kondička (§2): „cudzie dáta o tréningu → do session". Rozdiel je v tom, kto ich vlastní:
kondičné tréningy patria kondičnému trénerovi (živý read-only pohľad cez RLS), kým
nahraný súbor sa stáva **údajom o tréningu**, ktorý vlastní ten istý, kto vlastní tréning.

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

**Hotové (2026-08-04, tretia dávka) — trénerova appka 1:N (jadro):**
- `lib/players/selected.ts` = jediný zdroj pravdy, ktorého hráča appka zobrazuje. Voľba v cookie
  `plaw_selected_player`, vždy overená voči zoznamu z DB (orezanému RLS) → podvrhnutá cookie
  nevyberie cudzieho hráča a výber sa sám zotaví po archivácii.
- Prepínač `components/player-switcher.tsx` (vykreslí sa len pri 2+ aktívnych hráčoch),
  `/players` sa v org režime správa ako roster.
- Opravené 4 miesta, ktoré by v org režime spadli (`.maybeSingle()` nad aktívnym hráčom).
- Zápisy nesú `organization_id` (players, sessions, session_drills); kódy cvičení sa v org čítajú
  podľa organizácie a `/drill-codes` je pre trénera read-only; zdieľanie s rodičom skryté (§5.6).
- **Zrušenie tréningu v org režime → `status = 'cancelled'`** namiesto mazania. Predtým `deleteSession`
  ignoroval výsledok, takže RLS mazanie ticho zamietla a appka tvárila, že tréning zrušila.
- Overené 21 scenármi cez HTTP (prepínanie, izolácia dát medzi hráčmi, podvrhnutá/neplatná cookie,
  kódy federácie, read-only) + regresné sady 37/41/15 zelené. Pozn.: next-intl posiela do HTML
  všetky preklady, takže testy musia porovnávať **vykreslené** HTML (bez `<script>`), inak nájdu
  text aj pre nevykreslené prvky.

**Hotové (2026-08-05, štvrtá dávka) — obrazovka „Dnes" + roster so stavmi:**
- **„Dnes" = denný domov federačného trénera** (`components/today-board.tsx`, vykreslí sa na `/`
  **len na org subdoméne**): rozvrh dňa naprieč všetkými pridelenými hráčmi zoradený podľa času,
  tri dlaždice zhrnutia (tréningy dnes / ešte nasleduje / vyžaduje pozornosť), upozornenie na
  najzanedbanejšieho hráča a sekcia „Zajtra". Samostatný (1:1) rozcestník ostal nedotknutý —
  s jediným hráčom niet čo zoraďovať.
- **Ťuknutie na tréning zároveň prepne vybraného hráča** (`selectPlayerAndOpen` v
  `lib/actions/selected-player.ts`) — bez toho by appka na detaile tréningu ďalej pracovala
  s predtým vybraným hráčom. Upozornenie prepne na zanedbaného hráča a otvorí plánovanie.
- **Roster so stavmi na `/players`** (len pri 2+ aktívnych hráčoch): farebná bodka stavu,
  „Practiced yesterday" / „6 days without a practice" / „No practice in the last 60 days",
  najbližší tréning („Next today at 18:00") a tie isté dlaždice zhrnutia.
- Spoločný dátový základ je `lib/players/roster.ts` (`getRosterOverview`) — dni sa počítajú
  **v pásme toho, kto sa pozerá** (cez `getTimeZone()` z next-intl), nie v pásme servera.
  Prahy: 5 dní = pozornosť, 8 dní = neaktívny; hráč bez záznamu je „vyžaduje pozornosť", len
  ak preňho nič nie je naplánované (čerstvo pridelený hráč s tréningom nie je problém).
  Dotaz na tréningy je **ohraničený oknom 60 dní dozadu** (`PRACTICE_LOOKBACK_DAYS`) a filtruje
  sa priamo v SQL cez `planned_data->>date` — bez toho by sa pri desiatich hráčoch ťahali tisíce
  riadkov a narazilo by sa na `max_rows` PostgRESTu.
- Overené 30 HTTP scenármi (org) + 12 regresnými (samostatný režim nedotknutý) + 6 klikacími cez
  Playwright (prepnutie hráča ťukom, upozornenie, roster). Pozn.: virtuálny host sa v prehliadači
  testuje cez `--host-resolver-rules=MAP <slug>.plaw.win 127.0.0.1:3000`, keďže org kontext sa
  odvodzuje výhradne z hostname.

**Hotové (2026-08-06, piata dávka) — riadiaci pult šéftrénera `/director`:**
- **Pult** (`app/director/page.tsx`): dlaždice (hráči / tréneri / tréningy dnes / vyžaduje
  pozornosť), zoznam „vyžaduje pozornosť" naprieč organizáciou s menom prideleného trénera
  a rozbaliteľné skupiny **tréner → jeho hráči** so stavmi. Šéftréner sa po prihlásení na org
  subdoméne dostane rovno sem (nástenka „Dnes" by mu ukázala prázdny rozvrh — pridelených
  hráčov nemá).
- **Drill-in:** `/director/players/[id]` (profil, pridelený tréner, zoznam tréningov),
  `/director/sessions/[id]` (read-only rozpis cvičení) a `/director/players/[id]/analytics/[category]`
  (obdobia + `CategoryCharts` ako u trénera).
- **Upresnenie k pôvodnému plánu „reuse `app/parent/` stránok":** reusovať sa dá **agregát**
  (`aggregateDrillStats`) a komponent grafov, nie samotné rodičovské stránky — tie čítajú
  *kópie* v `parent_session_records`. Šéftréner má **živý** pohľad cez RLS (org vlastní dáta,
  takže kopírovať netreba, §5.4), preto sú to nové, tenké read-only stránky nad `sessions`/
  `session_drills`. Do analytiky pribudli player-scoped varianty
  (`getPlayerCategoryAnalytics`, `getPlayerSessionIdsInPeriod`) — pult sa pozerá na hráčov,
  ktorých nemá „vybraných".
- **Nová migrácia `20260806090000_director_reads_member_profiles.sql`** (na produkcii treba
  pustiť ručne): `profiles` mala dosiaľ jedinú policy `id = auth.uid()`, takže šéftréner videl
  priradenia, ale nie MENÁ trénerov. Pribudla úzka SELECT policy + `security definer`
  `is_active_member_of_my_org()`. Alternatívny snapshot mena do `organization_members` sme
  zamietli — meno by starlo a `claim_organization_invite` by sa muselo znova prepisovať.
- **Odchod trénera:** hráči priradení niekomu, kto už nie je aktívnym členom, sa v pulte
  zoskupia do samostatnej skupiny „No longer in the organization" — nesmú zmiznúť, kým ich
  niekto neprevezme (to je celý zmysel org vlastníctva).
- Overené 13 RLS scenármi (vidí celú org; **nezaloží, nezmení, nezmaže**; tréner nevidí profily
  kolegov; tenant izolácia), 25 HTTP scenármi (smerovanie podľa roly, pult, drill-in) a 4
  klikacími. Regresné sady 30/12 zelené. Pozn.: testy proti seedu musia posielať cookie
  `NEXT_TIMEZONE` — appka renderuje časy v pásme diváka a bez nej sa rozídu o offset.

**Hotové (2026-08-07, šiesta dávka) — pult pre laptop/tablet + porovnanie hráčov:**
- **Pult je odteraz nástroj pre laptop/tablet** (rozhodnuté používateľom): `max-w-6xl`, dlaždice
  4 vedľa seba, zoznam pozornosti a tréneri v dvoch stĺpcoch, hráči v mriežke. Na mobile sa
  všetko poskladá pod seba — overené na 1440/834/390 px bez horizontálneho scrollu.
- **Porovnanie `/director/compare`:** pre celú skupinu naraz tá istá trojica grafov, akú vidí
  tréner (podiel zameraní → rozpad kódov → charakter). Dve osi: **podľa trénera** aj **podľa
  ročníka**. Dáta ťahá `getPlayersCategoryAnalytics` **dvoma dotazmi pre celú skupinu**
  (nie štyrmi na hráča) — inak by pri desiatich hráčoch stránka poslala 40 dotazov.
- **Generálny graf ide vo všetkých analytikách PRVÝ** (predtým posledný) — najprv „koľko
  z celkového času padlo na toto zameranie", až potom rozpad.

**Hotové (2026-08-07, siedma dávka) — onboarding trénerov do organizácie:**
- **`/director/team`:** šéftréner vytvorí pozývací kód, vidí obsadené sedadlá (počítajú sa len
  tréneri, on sám sedadlo neberie) a môže trénera odobrať — **jeho hráči a tréningy ostávajú
  organizácii** a v pulte sa presunú pod „No longer in the organization".
- **`/join`:** stránka, kde pozvaný zadá kód. **Odhalený blokátor: bez nej sa do federácie
  nedalo vôbec vstúpiť** — stráž členstva v `proxy.ts` vyhodila prihlásený účet bez členstva
  na `/login` a zahodila mu session, takže kód nemal kde zadať. Stráž teraz rozlišuje účet bez
  členstva (→ `/join`, session ostáva) od člena inej organizácie (→ von, session sa zahodí).
- **`/director/drill-codes`:** šéftréner edituje federačný štandard, tréner ho na `/drill-codes`
  naďalej iba číta. Vyžiadalo si to **migráciu `20260807090000_drill_codes_org_upsert.sql`** —
  pôvodný unikát bol čiastočný index, ktorý Postgres pri `ON CONFLICT` neinferuje, takže upsert
  padal. (Na produkcii spustiť ručne.)
- Overené 13 klikacími scenármi end-to-end (kód → pripojenie → člen v pulte → federačný kód
  u trénera) + 11 RLS (pozývať smie len šéftréner, priamy zápis cudzieho účtu zamietnutý, claim
  kontroluje kód/osobné dáta/sedadlá, štandard kódov mení len šéftréner). Regresné sady zelené.
- **Pozn. k lokálnemu vývoju:** do `allowedDevOrigins` pribudlo `*.plaw.win`. Bez toho sa org
  subdoména v dev serveri **nehydratuje** a UI závislé od JS ticho nefunguje.

**Hotové (2026-08-07, ôsma dávka) — preradenie hráča inému trénerovi:**
- **Zavretá diera v offboardingu.** §5.4 aj UI sľubovali, že hráči odídeného trénera
  „ostávajú organizácii a dajú sa prideliť inému trénerovi" — mechanizmus na to však
  neexistoval: tréner vidí aj upravuje len riadky s `coach_id = auth.uid()` (hráča kolegu
  teda ani nevidel) a šéftréner je SELECT-only. Po odobratí trénera boli hráči aj história
  trvalo nedostupné pre prácu, čo je presne to, čomu má org vlastníctvo dát brániť.
- **Riešené `security definer` RPC `assign_player_to_coach`** (migrácia `20260807100000`),
  nie uvoľnením RLS: policy na UPDATE nevie obmedziť, KTORÝ stĺpec sa mení (v jednej policy
  sa nedá porovnať starý a nový riadok), takže „director smie UPDATE na players" by otvorilo
  aj mená a archiváciu. Funkcia robí jednu vec — presunie priradenie — a read-only dohľad
  podľa §5.7 ostáva inak nedotknutý.
- **Presúva sa priradenie na všetkých riadkoch hráča** (players, sessions, session_drills,
  metrics_and_tests). Bez toho by nový tréner videl hráča, ale nie jeho históriu (RLS trénera
  je všade `coach_id = auth.uid()`). Dôsledok, ktorý treba mať na pamäti: **nikde neostáva
  stopa, kto tréning reálne viedol** — ak to federácia bude potrebovať, patrí na to nový
  stĺpec (napr. `conducted_by`), nie návrat k `coach_id` ako autorstvu.
- UI: v pulte pri skupine „No longer in the organization" (odteraz **vždy rozbalenej**)
  a na `/director/players/[id]` aj pre bežné rebalansovanie.
- Overené 12 RLS scenármi (tréner nepreradí, nečlenovi ani šéftrénerovi sa hráč prideliť nedá,
  hráč mimo org neprejde, história prejde celá, nový tréner vidí, starý už nie) a 9 klikacími
  end-to-end (odobratie trénera → skupina bez trénera → prevzatie → hráč v rosteri nového
  trénera). Regresné sady 26/24/10 zelené.

**Sedadlá — ROZHODNUTÉ 2026-08-07: fakturácia MIMO appky, žiadny Stripe pre B2B.**
Federácia dostane faktúru; appka sedadlá len **vynucuje** (trigger
`enforce_membership_rules` pri pripojení trénera) a **zobrazuje** (`/director/team`).
Predaj ďalších sedadiel = jeden `UPDATE organizations set seat_limit`. Appkový kód si to
nevyžiadalo — mechanizmus existoval už od DB základu; chýbal len **runbook na provisioning**,
ktorý je odteraz v [`onboarding-organizacie.md`](onboarding-organizacie.md) (Vercel + DNS +
SQL na organizáciu a šéftrénera, predaj sedadiel, overené pasce).
**`organizations.subscription_status` appka nikde nečíta a nič podľa neho neblokuje** — je to
zatiaľ len administratívna evidencia. Keby sa to malo vynucovať, je to vedomá zmena (a treba
rozhodnúť read-only vs. úplné zamknutie; zamknúť federáciu uprostred sezóny je tvrdé).
Stripe tak ostáva len téma **consumer** produktu na `plaw.win` (Fáza 3 v CLAUDE.md:
Checkout + Customer Portal pre samostatných 1:1 trénerov), nie federačnej vrstvy.

**Federačná vrstva (§5) je tým funkčne kompletná** — subdomény, trénerova appka 1:N,
„Dnes" + roster, pult, porovnanie, onboarding, preradenie hráča, sedadlá.

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
