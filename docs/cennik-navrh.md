# Návrh cenníka (NÁVRH — nič z toho nie je rozhodnuté)

Podklad pre rozhodnutie pred napojením Stripe. Ceny sú **východiskové body na
zváženie, nie odporúčanie postavené na prieskume trhu** — koľko je slovenský
tréner ochotný platiť, vieš ty, nie ja. Zmysel tohto dokumentu je dať tomu
štruktúru: koľko hladín, čo ich odlišuje a kde končí spotrebiteľský produkt.

---

## 1. Čo appka reálne vynucuje

Toto nie je marketing, toto je stav kódu — cenník musí sedieť s tým, čo appka
vie ustrážiť:

- **`profiles.player_limit`** — koľko hráčov smie mať tréner **naraz aktívnych**.
  Jediné číslo, jediná stráž (`requirePlayerSlot` v `lib/subscription.ts`).
- **Archivovaní hráči sa nepočítajú.** História nič nestojí a nikdy sa nemaže —
  to je silný predajný argument, nie technický detail.
- **`subscription_status`** — po skončení predplatného účet **ďalej číta**, len
  prestane zapisovať. Zákazník nikdy nepríde o svoju prácu.
  **Upresnené 2026-08-18: čítanie už nebude úplné.** Trénerovi bez
  predplatného ostane zoznam tréningov (zapísaných aj naplánovaných, s filtrom
  na mesiac), detail, história **a kalendár**; **analytika ide za platbu**,
  rovnako ako zápis. Kalendár zámerne ostáva — tréner musí vidieť, kedy má
  tréningy, inak mu appka prestane byť použiteľná ako denník. Je to zrkadlo
  rodičovského modelu (§8.3) s jedným rozdielom: rodičovi kalendár za platbou
  je, trénerovi nie. **Appka to zatiaľ nevynucuje** — dnes zastavuje len zápis
  (`requireWriteAccess`), stráž na analytiku pribudne so Stripe a musí sedieť
  s poľom `WITHOUT_SUBSCRIPTION` v `components/landing-pricing.tsx`.
- **Skúšobná doba 14 dní** beží už dnes, bez karty.
- **Rodič/hráč/manažér platí nič.** Je to funkcia, ktorá drží trénera pri
  appke, nie samostatný produkt.

**Dôsledok:** jediná os, na ktorej sa dá cena stupňovať, je **počet hráčov**.
Nič iné appka neobmedzuje — každý platiaci tréner má všetky funkcie.

---

## 2. Kde končí tento produkt a začína federačný

Nezamieňať si to s počtom hráčov. Hranica je **počet trénerov a dohľad nad
nimi**:

| | Samostatný tréner (Stripe) | Federácia / klub (faktúra) |
|---|---|---|
| Koho platí | seba | svojich trénerov (sedadlá) |
| Kto vlastní dáta | tréner | organizácia |
| Riadiaci pult | nie | áno (`/director`) |
| Adresa | `plaw.win` | `<slug>.plaw.win` |

Tréner s 25 hráčmi je stále **jeden tréner** — patrí do spotrebiteľského
cenníka. Klub s tromi trénermi patrí do federačného, aj keby mal hráčov menej.

---

## 3. ROZHODNUTÉ — trénerské hladiny (2026-08-16)

**Platí rovnako pre tenis aj pre kondičku.**

| Hladina | Hráčov | Mesačne | Ročne | Za hráča/mes |
|---|---|---|---|---|
| 1. | 3 | **6,90 €** | **49,90 €** | 2,30 € |
| 2. | 6 | **12,90 €** | **92,90 €** | 2,15 € |
| 3. | 12 | **24,90 €** | **179,90 €** | 2,08 € |

**Ročná cena = mesačná × 12 − 40 %** (rozhodnuté 2026-08-16, nahradilo pôvodné
pravidlo „desať mesiacov za dvanásť"). Ročný zákazník teda platí ako za **7,2
mesiaca**. Presný prepočet pred zaokrúhlením: 49,68 / 92,88 / 179,28.

Je to výrazne štedrejšia zľava než býva zvykom (−16 % pri „dvoch mesiacoch
zadarmo") a je to zámer: ročná platba znamená hotovosť dopredu a podstatne
menší odchod zákazníkov počas sezóny.

**Cena za hráča so stúpajúcou hladinou klesá** — to je zámer. Prvý nástrel mal
najvyššiu hladinu na 10 hráčov za 24,90, čím cena za hráča naopak rástla
(2,49 €); kto si to prepočíta, vidí opak toho, čo od vyššej hladiny čaká.
Posun na 12 hráčov to otočil bez zmeny ceny.

**Koľko to je na deň a na hráča** (podklad pre texty na webe):

| Hladina | Ročná platba | Mesačná platba |
|---|---|---|
| 3 hráči | **4,6 centa** | 7,6 centa |
| 6 hráčov | **4,2 centa** | 7,1 centa |
| 12 hráčov | **4,1 centa** | 6,8 centa |

Veta na web: **„Od 4 centov na deň za hráča"** — platí pri každej hladine, nie
len pri najvyššej.

**POZOR pri písaní cenníka:** tréner tak platí za hráča **menej než rodič**
(4,1–4,6 vs. 9,9 centa denne). Dáva to zmysel, lebo platí za viacerých naraz,
ale vedľa seba v jednej tabuľke by to vyzeralo divne — rodič má menej funkcií
a platil by viac. **Cenník pre trénera a pre rodiča preto patrí na dve
samostatné stránky.** Sú to aj tak dve rôzne otázky: „koľko ma to stojí pri
mojom počte detí" a „oplatí sa mi vidieť, čo moje dieťa trénuje".

**Prečo najnižšia hladina 3 a nie 1:** pri jednom hráčovi sa **vôbec
nezapne** prepínač hráčov, roster ani nástenka „Dnes" — zákazník by za peniaze
dostal okresanú appku a ani by nevedel, že mu niečo chýba. Trojka je najnižšie
číslo, pri ktorom vidí produkt taký, aký je.

**Prečo nie štyri a viac hladín:** každá ďalšia hladina je ďalšie rozhodnutie
pre zákazníka a ďalšie dve položky v Stripe. Pri troch si vyberie za pár
sekúnd.

**OTVORENÉ: strop je 12 hráčov.** Tréner, ktorý vedie skupiny v klube, ich má
bežne 15–25 a **federačný produkt preňho nie je** (ten je pre organizácie
s viacerými trénermi a pultom). Buď pribudne štvrtá hladina, alebo — lacnejšie
a poučnejšie — štvrtá dlaždica v cenníku **„Viac hráčov? Napíšte nám"**
s adresou. Tá nič nestojí a rovno ukáže, či taký dopyt existuje.

---

## 4. Zvažované a neprijaté: dve hladiny

| Hladina | Hráčov | Mesačne | Ročne |
|---|---|---|---|
| **Tréner** | 5 | 12,90 € | 129 € |
| **Klub** | 20 | 24,90 € | 249 € |

Jednoduchšie na komunikáciu aj na správu (štyri ceny namiesto šiestich).
Cena: kto má dvoch hráčov, platí za piatich — a kto má osem, skočí rovno na
dvadsať. **Odporúčam vtedy, ak chceš spustiť rýchlo a doladiť neskôr.**

---

## 5. Zvažované a neprijaté (zatiaľ): platba za hráča

`2,50 € / hráč / mesiac`, minimum 3 hráči (teda od 7,50 €).

**Prečo to sem patrí:** appka drží počet hráčov ako **jedno číslo**, takže sa
to na Stripe mapuje priamo — v predplatnom je množstvo (quantity) a webhook ho
zapíše ako `player_limit`. Technicky je to najčistejšie riešenie zo všetkých
troch a je úplne spravodlivé.

**Prečo ho napriek tomu neodporúčam ako prvé:** na landing page sa horšie
komunikuje (namiesto troch dlaždíc je tam kalkulačka), zákazník nevie na prvý
pohľad, koľko zaplatí, a pri zmene počtu hráčov mu Stripe dopočítava pomerné
čiastky. Je to dobrá **druhá** verzia cenníka, keď už budeš vedieť, koľko
hráčov ľudia reálne majú.

---

## 6. Čo treba rozhodnúť okrem čísel

1. **S DPH alebo bez? ROZHODNUTÉ 2026-08-17: ceny na webe sú VRÁTANE DPH** —
   pri cenníku trénera aj pri cenníku pre hráča/rodiča/manažéra je to napísané
   (kľúče `pricingVat` / `vat`). Čísla sa tým nemenili, len text okolo nich.
   Ako to nakoniec vyzerá účtovne, je otázka na účtovníka, nie na appku.
2. **Kondička má ROVNAKÉ hladiny ako tenis** (rozhodnuté 2026-08-16). Je to ten
   istý engine a tá istá hodnota, takže niet dôvodu rozlišovať. **V Stripe to
   aj tak nech sú samostatné produkty** („P.L.A.W Tenis", „P.L.A.W Kondícia")
   s rovnakými cenami — ceny sa tým nekomplikujú a v prehľade uvidíš, koľko
   zarobila ktorá appka. **V appke to nič nestojí:** `player_limit` aj
   `subscription_status` sú na `profiles`, ktoré sú spoločné pre obe nasadenia,
   takže kondičný tréner sa spravuje presne ako tenisový.
3. **Skúšobná doba ostáva 14 dní bez karty?** Odporúčam áno — appka to už vie
   a „vyskúšaj bez karty" je najsilnejšia veta na celom cenníku.
4. **Čo po roku zadarmo testerom?** Stripe má na to zľavové kupóny — testerovi
   sa dá dať trvalá zľava (napr. −50 %) bez zásahu do kódu.
5. **Zľava pri ročnej platbe** — v návrhu A a B sú to dva mesiace zadarmo.

---

## 7. Jedna pasca, ktorú appka už rieši

Keď si zákazník **zníži hladinu** (z 10 na 3) a má osem aktívnych hráčov,
appka **zastaví zápis**, kým sa sám nevráti pod hladinu — nikoho
nearchivuje sama, lebo by musela vybrať, ktoré deti tréner prestane trénovať.
Pruh mu pritom povie **presne koľko hráčov ubrať** (`components/trial-banner.tsx`).

Je to správanie postavené vedome (viď CLAUDE.md, „Vybraný hráč"), ale pri
cenníku na to mysli: **prechod nadol nie je bezbolestný a má to tak byť.**

---

## 8. Hráč, rodič a manažér — druhá strana appky

### 8.1 Čo majú dnes

Všetci traja (`parent` / `player` / `manager`) sú v DB **tá istá rola s tými
istými právami** — rozdiel je len štítok. Pripoja sa kódom od trénera a vidia
**čítaním** kalendár, detail tréningu a analytiku. Dáta sú **kópie**
(`parent_session_records`), takže im história ostane, aj keď spolupráca
s trénerom skončí.

**Platia nič.** A hlavne: **`one_active_connection_per_parent` im dovolí
jediné aktívne prepojenie naraz** — nový kód automaticky zruší predošlé.

### 8.2 ROZHODNUTIE (používateľ, 2026-08-16): platia aj oni

**Hráč, rodič aj manažér platia — vždy na úrovni jedného hráča, 36 € ročne**
(teda pod 10 centov na deň). Rozhodnutie padlo po tom, čo som odporúčal nechať
rodičovskú vrstvu zadarmo; **odporúčanie bolo prebité vedome**, argument proti
je zapísaný nižšie, aby sa nemusel objavovať znova.

| Hladina | Koho sleduje | Ročne | Mesačne |
|---|---|---|---|
| **Hráč / Rodič / Manažér** | 1 hráča | **36 €** | **5,90 €** |

Ročná cena je hlavná a tak sa aj komunikuje: *„pod 10 centov na deň."*
Mesačná vychádza na 70,80 € ročne, čiže **ročná platba ušetrí takmer polovicu**
— je to zámerne veľký rozdiel. Mesačná voľba tu nie je preto, aby ju niekto
bral, ale aby bola ročná zjavne výhodná a aby mal kam siahnuť ten, kto sa na
rok zaviazať nechce.

**Rodičovská cena je vedomá výnimka z pravidla −40 %** (rozhodnuté 2026-08-16).
To pravidlo by dalo 42,48 €, čím by padla veta „pod 10 centov na deň" (vyšlo by
11,8 centa). Používateľ si zvolil ponechať **36 €**, čo je zľava −49 %. Veta je
tu dôležitejšia než jednotnosť pravidla — 36 € vychádza na **9,86 centa denne**.
Zvažovaná bola aj cesta cez zníženie mesačnej ceny na 4,90 € (dá 35,90 € a
pravidlo by platilo všade), ale mesačná ostala na 5,90 €.

**Argument, ktorý bol prebitý** (nechávam ho tu ako riziko na sledovanie, nie
ako námietku): rodičovská vrstva je zároveň dôvod, prečo tréner appku chce —
ukazuje rodičom, že pracuje systematicky. Keď rodič narazí na platobnú stenu,
tréner sa o tom dozvie ako prvý. **Čo sledovať v prevádzke:** koľko % rodičov
po pripojení kódom naozaj zaplatí a či to tréneri komentujú.

### 8.3 POZOR: je to ÚPLNE INÝ paywall než trénerský

Toto je najdôležitejšia veta celej sekcie. Celá appka dnes stojí na pravidle
**„nezaplatené = ČÍTAJ, ale nezapisuj"** (`requireWriteAccess`, 15 miest).

**Rodič ale nič nezapisuje — čítanie je všetko, čo má.** Trénerský model
paywallu sa naňho teda nedá použiť: buď mu zastavíme čítanie, alebo neplatí
nič. Znamená to postaviť **druhý druh stráže**, ktorý appka zatiaľ nemá.

**Ako to spraviť, aby to nebola krádež:** dáta rodičovi **ostávajú** (kópie
v `parent_session_records` sa nemažú nikdy, ani po zrušení prepojenia). Po
uplynutí predplatného sa mu **pozastaví prístup**, nie zmažú záznamy — a to mu
tá obrazovka musí povedať doslova: *„Tvoje záznamy tu sú, predplatným ich
znova sprístupníš."* Rovnaká slušnosť, akú má trénerská vetva.

**FINÁLNY MODEL (používateľ, 2026-08-16 a 2026-08-17, po troch upresneniach):
rodič vidí ZOZNAM tréningov a ich detail vždy; KALENDÁR a ANALYTIKA sú za
platbou.**

| | Zadarmo | Za 36 €/rok |
|---|---|---|
| Zoznam tréningov (od najnovšieho) | ✅ | ✅ |
| Filter zoznamu na mesiac | ✅ | ✅ |
| Detail tréningu (cvičenia, čas, poznámky) | ✅ | ✅ |
| Uchovanie histórie | ✅ | ✅ |
| **Kalendár** (týždenný aj mesačný pohľad) | ❌ | ✅ |
| **Analytika** (rozbory, %, odhad úderov, porovnanie období) | ❌ | ✅ |

**Zadarmo ostáva odpoveď na otázku „čo dieťa trénovalo", za platbu ide POHODLIE
a PREHĽAD.** Rodič si aj bez predplatného nájde ktorýkoľvek tréning podľa
mesiaca a prečíta si ho celý — len sa musí prehrabať zoznamom namiesto mriežky.

**Prečo je to lepšie než pôvodné „bez platenia nevidí nič":** to, čo robí dobré
meno trénerovi — že rodič vidí systematickú prácu s dieťaťom — ostáva zadarmo,
takže platobná stena nepoškodzuje predajný argument appky.

**Filter na mesiac musí byť zadarmo, a to je dôležité:** bez neho je bezplatná
verzia po dvoch rokoch histórie zoznam 200+ položiek, v ktorom sa nedá nič
nájsť — a to už nie je okresaná verzia, ale trest. Zoznam má byť použiteľný;
kalendár sa predáva prehľadom, nie tým, že alternatíva je nepoužiteľná.

**Čo to znamená v kóde** (menej, než to vyzerá — nová stránka netreba,
`app/parent/page.tsx` už dnes JE ten zoznam):

1. Stráž na `app/parent/calendar` a `app/parent/analytics/**` + na načítavače
   v `lib/actions/parent-data.ts` (`getParentCategoryAnalytics`,
   `getParentCategoryMinuteShares`).
2. **Filter na mesiac do `app/parent/page.tsx`** — dnes tam žiadny nie je.
3. **Strop alebo stránkovanie v tom istom dotaze** — dnes ťahá všetky záznamy
   bez obmedzenia a pri dlhej histórii narazí na `max_rows` PostgRESTu.
   Rovnaká pasca, akú kalendár aj roster už riešia oknom.
4. **Odkazy na kalendár a analytiku neskrývaj — zamkni ich**: kto nevie, čo si
   kupuje, si to nekúpi.

**Naplánované tréningy ostávajú v bezplatnom zozname** (dnes tam sú). Rodič si
tak aj zadarmo odpovie, kedy má dieťa ďalší tréning — a to je zámer: rodič,
ktorý to nevie, otravuje trénera, a tomu má appka predchádzať. Kalendár sa
predáva prehľadom týždňa, nie zamknutím tejto informácie.

Ďalej platia dve veci, ktoré treba dodržať:

1. **Kopírovanie beží ďalej aj počas neplatenia.** Triggery
   `sync_session_to_parent` / `sync_drill_to_parent` sa pýtajú len na to, či
   je prepojenie aktívne — o predplatnom nevedia a **vedieť nemajú**. Rodič,
   ktorý sa vráti po pol roku, teda uvidí aj to, čo sa dialo medzitým.
   **Nezavádzaj im kontrolu predplatného** — tým by sa tá história stratila
   nenávratne a `uchovanie dát` by prestalo platiť.
2. **Bez predplatného musia ostať prístupné dve veci:** zadanie kódu od
   trénera (`/parent` bez pripojenia) a samotné predplatenie. Inak sa novo
   pripojený rodič nedostane ani k tomu, aby mohol zaplatiť.

### 8.4 Čo sa musí postaviť

1. **Stráž na ČÍTANIE** — nová vec (§8.3). Rodičovské stránky (`app/parent/**`)
   a `lib/actions/parent-data.ts` musia pred vydaním dát overiť predplatné.
   Ide o **server komponenty**, nie server actions, takže sa nedá použiť
   `requireWriteAccess` — treba obdobu, napr. `requireViewAccess()`.
2. **Skúšobná doba už existuje aj pre nich** — `profiles.trial_ends_at` má
   default `now() + 14 dní` pre **každý** účet bez rozdielu roly, takže nový
   rodič má 14 dní automaticky a netreba na to nič robiť.
3. **Kde sa dá zaplatiť** — dnešný `components/trial-banner.tsx` je v layoute
   nad celou appkou, takže pruh uvidí aj rodič; tlačidlo „Predplatiť" ho ale
   musí viesť na **jeho** cenu, nie na trénerské hladiny.
4. **Manažér s viacerými hráčmi** — dnes to nejde vôbec:
   `one_active_connection_per_parent` (migrácia `20260715100000`) dovolí jedno
   aktívne prepojenie a nový kód automaticky zruší predošlé. Ak sa má manažér
   (alebo rodič dvoch detí) pozerať na viacerých naraz, treba uvoľniť index,
   pridať obdobu `player_limit` pre druhú stranu a postaviť prehľadovú
   stránku — `/parent` dnes predpokladá **práve jedného** hráča.
5. **Čo manažér NESMIE** — inak si federačný produkt zožerie sám seba. Manažér
   **sleduje** hráčov (kópie, read-only); federácia **zamestnáva trénerov**,
   vlastní dáta a má pult. Manažér nikdy nesmie dostať `/director`, inak nemá
   zväz dôvod platiť za sedadlá.

### 8.5 Poradie prác

**Do prvej verzie Stripe patrí trénerský cenník AJ hladina hráč/rodič/manažér**
— sú to dva produkty v Stripe a jedna nová stráž v appke (§8.3, bod 1).

**Sledovanie viacerých hráčov naraz (bod 4) je samostatná dávka** a do prvej
verzie nemusí: 36 € je cena za jedného sledovaného hráča, čo dnešný model
(jedno aktívne prepojenie) presne pokrýva. Rodič s dvomi deťmi bude vtedy
potrebovať dva účty — **to treba vedieť dopredu**, lebo to je prvá vec, na
ktorú sa taký rodič spýta.

---

## 9. Čo z toho vyplýva pre Stripe

Pri návrhu A vznikne v Stripe **jeden produkt a šesť cien** (3 hladiny × mesačne
a ročne), pri návrhu B štyri ceny. Každá cena má svoje `price_...` ID, ktoré ide
do premenných prostredia appky. **Ceny sa v Stripe nedajú mazať, len
archivovať** — preto ich zakladaj až po rozhodnutí.

---

## 10. Kde tieto čísla žijú na webe (hotové 2026-08-17)

Rozhodnuté ceny sú od 2026-08-17 na verejnom webe. **V kóde majú jediný
výskyt — `lib/landing-pricing.ts`** (`COACH_TIERS`, `FOLLOWER_PRICE`,
`CONTACT_EMAIL`); deväť jazykových súborov nesie len text okolo čísel, takže
zmena ceny je zmena jedného súboru (a Stripe), nie deviatich prekladov.

| Kde | Čo tam je |
|---|---|
| Landing `/` (sekcia „Cenník") | tri hladiny, prepínač mesačne/ročne, dlaždica „Viac hráčov?", tabuľka „Čo dostaneš" (bez predplatného vs. s predplatným) |
| `/cennik-hrac` | cena za sledovanie jedného hráča + tabuľka bez predplatného vs. s predplatným (päť riadkov podľa §8.3) |
| `/federacie` | naďalej „čoskoro" — sedadlá sa fakturujú mimo appky |

**Čo sa pritom rozhodlo (a nebolo v tomto dokumente):**

- **Predvolené obdobie v prepínači je ROČNE.** Pri ňom platí veta „od 4 centov
  na deň" a je vidieť zľavu −40 %; mesačná cena je jeden klik vedľa.
- **Zvýraznená je stredná hladina (6 hráčov)** štítkom „Odporúčame" — nie
  „najpredávanejšie", to by dnes nebola pravda (zákazníkov ešte niet).
- **Štvrtá hladina nevznikla**, je tam dlaždica „Viac hráčov? Napíšte nám"
  s `info@plawsports.com` — presne podľa §3.
- **Centy na deň sa dopočítavajú z ceny**, neopisujú sa odtiaľto. Tabuľka v §3
  a text na webe sa tak nemôžu rozísť.
- **Ceny sú uvádzané vrátane DPH** (§6, bod 1).
- **Na webe nie je nič „zadarmo" (rozhodnuté 2026-08-17).** Vypadli aj
  „Vyskúšať zadarmo", „Zaregistrovať sa zadarmo" a „14 dní zadarmo, bez
  karty"; ostalo len **„14 dní na skúšku, potom sa platí"**. Dôvod: dnu sa
  ide **na pozvánku** (promo kód) a prístup zadarmo má len ten, komu sa kód
  vydá — plošný sľub na webe by bol nepravdivý. Rodičovský stĺpec sa preto
  volá **„Bez predplatného"**, nie „Zadarmo".

**Čo zatiaľ NIE JE pravda a treba to vedieť:** tabuľka na `/cennik-hrac`
sľubuje, že analytika je za platbou. **Appka to ešte nevynucuje** — stráž na
čítanie (`requireViewAccess`, §8.4 bod 1) sa postaví so Stripe. Dovtedy
stránka opisuje cieľový stav. Rovnako nikde nie je tlačidlo „Predplatiť":
obe stránky vedú na registráciu, lebo pokladňa neexistuje.
