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

## 3. Návrh A — tri hladiny (odporúčaný)

| Hladina | Hráčov | Mesačne | Ročne | Komu |
|---|---|---|---|---|
| **Štart** | 3 | 9,90 € | 99 € | tréner s pár zverencami, rodič-tréner |
| **Tréner** | 10 | 19,90 € | 199 € | tréner na plný úväzok |
| **Klub** | 25 | 34,90 € | 349 € | tréner so skupinami v klube |

**Ročne = desať mesiacov za dvanásť.** Ľahko sa to povie jednou vetou a
zákazník to vie prepočítať z hlavy.

**Prečo najnižšia hladina 3 a nie 1:** pri jednom hráčovi sa **vôbec
nezapne** prepínač hráčov, roster ani nástenka „Dnes" — zákazník by za peniaze
dostal okresanú appku a ani by nevedel, že mu niečo chýba. Trojka je najnižšie
číslo, pri ktorom vidí produkt taký, aký je.

**Prečo nie štyri a viac hladín:** každá ďalšia hladina je ďalšie rozhodnutie
pre zákazníka a ďalšie dve položky v Stripe. Pri troch si vyberie za pár
sekúnd.

---

## 4. Návrh B — dve hladiny

| Hladina | Hráčov | Mesačne | Ročne |
|---|---|---|---|
| **Tréner** | 5 | 12,90 € | 129 € |
| **Klub** | 20 | 24,90 € | 249 € |

Jednoduchšie na komunikáciu aj na správu (štyri ceny namiesto šiestich).
Cena: kto má dvoch hráčov, platí za piatich — a kto má osem, skočí rovno na
dvadsať. **Odporúčam vtedy, ak chceš spustiť rýchlo a doladiť neskôr.**

---

## 5. Návrh C — platba za hráča

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

1. **S DPH alebo bez?** Zákazník je spotrebiteľ (tréner-živnostník), takže na
   webe sa bežne uvádza cena **s DPH**. Otázka na účtovníka, nie na appku.
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

| Hladina | Koho sleduje | Ročne | Mesačne (na doriešenie) |
|---|---|---|---|
| **Hráč / Rodič / Manažér** | 1 hráča | **36 €** | ~3,90 € |

Ročná cena je hlavná (tak sa to komunikuje: *„pod 10 centov na deň"*), mesačná
je pohodlnostná voľba a má byť citeľne drahšia, inak si ju vezme každý.

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

**FINÁLNY MODEL (používateľ, 2026-08-16, po dvoch upresneniach): rodič vidí
TRÉNINGY vždy, ANALYTIKA je za platbou.**

| | Zadarmo | Za 36 €/rok |
|---|---|---|
| Kalendár tréningov | ✅ | ✅ |
| Detail tréningu (cvičenia, čas, poznámky) | ✅ | ✅ |
| Uchovanie histórie | ✅ | ✅ |
| **Analytika** (rozbory, %, odhad úderov, porovnanie období) | ❌ | ✅ |

**Prečo je to lepšie než pôvodné „bez platenia nevidí nič":** to, čo robí dobré
meno trénerovi — že rodič vidí systematickú prácu s dieťaťom — ostáva zadarmo,
takže platobná stena nepoškodzuje predajný argument appky. Platí sa za vrstvu,
ktorá je naozaj navyše. **A rozsah práce je menší:** stráž stačí na analytike,
nie na celej rodičovskej časti.

**Čo to znamená v kóde:** ochrániť treba `app/parent/analytics/**` a načítavače
v `lib/actions/parent-data.ts` (`getParentCategoryAnalytics`,
`getParentCategoryMinuteShares`). Kalendár, detail tréningu a zoznam ostávajú
nedotknuté. **Záložku na analytiku neskrývaj — zamkni ju**: kto nevie, čo si
kupuje, si to nekúpi.

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
