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
2. **Rovnaké ceny pre kondičku?** Je to ten istý engine a tá istá hodnota —
   odporúčam áno. V Stripe to nech sú **samostatné produkty** („P.L.A.W Tenis",
   „P.L.A.W Kondícia"), aby si v prehľade videl, koľko zarobila ktorá appka.
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

### 8.2 Prečo sa im dnes nedá nič predať

Poctivo: **dostávajú presne to, čo appka pre nich vie.** Neexistuje funkcia,
ktorú by sme im mohli zamknúť za platbu bez toho, aby sme im zobrali niečo, čo
už majú. Jediná os, ktorá dnes technicky existuje, je **počet sledovaných
hráčov** — a tá je zaujímavá len pre rodiča s viacerými deťmi a pre manažéra.

**Strategické varovanie:** rodičovská vrstva nie je samostatný produkt, je to
**dôvod, prečo tréner appku chce**. Ukazuje rodičom, že s deťmi pracuje
systematicky. Keď rodič narazí na platobnú stenu, prvý, kto sa o tom dozvie,
je tréner — a jemu appka práve prestala robiť dobré meno. Preto:
**jedno dieťa zadarmo, navždy.**

### 8.3 Návrh

| Hladina | Koho sleduje | Cena | Stav |
|---|---|---|---|
| **Rodič / Hráč** | 1 hráča | **zadarmo** | funguje dnes |
| **Rodina** | až 4 hráčov | ~4,90 €/mes | treba uvoľniť limit prepojení |
| **Manažér** | až 15 hráčov + prehľad | ~19,90 €/mes | **treba postaviť** |
| **Manažér Plus** | až 40 hráčov | ~34,90 €/mes | **treba postaviť** |

**„Rodina"** je súrodenecký prípad: rodič s dvomi–tromi deťmi v akadémii dnes
musí prepínať kódy, čím o predošlé dieťa príde. Je to malá zmena a dá sa
predať.

**„Manažér"** je jediná z týchto hladín, ktorá je naozaj biznis: športový
riaditeľ menšej akadémie sleduje 15 detí naprieč trénermi. **Dnes preňho
appka nemá vôbec nič** — je to nápad z 2026-07-17 (mockupy v `docs/mockups/`),
nie postavená funkcia.

### 8.4 Čo by sa muselo postaviť

1. **Uvoľniť `one_active_connection_per_parent`** (migrácia
   `20260715100000_player_connections.sql`) — dnes je to unikátny index na
   `parent_id`, musel by platiť len po hladinu účtu.
2. **`profiles.connection_limit`** — obdoba `player_limit` pre druhú stranu,
   plus stráž v `claim_player_connection` (dnes tam žiadna nie je, RPC len
   overí kód a prihlásenie).
3. **Prehľadová stránka pre manažéra** — dnešný `/parent` predpokladá **práve
   jedného** pripojeného hráča. Pre 15 hráčov treba roster so stavmi, podobný
   tomu, čo má tréner a pult.
4. **Rozhodnúť, čo manažér NEsmie** — inak si federačný produkt zožerie sám
   seba. Manažér **sleduje** hráčov (kópie, read-only, žiadny dohľad nad
   trénermi); federácia **zamestnáva trénerov**, vlastní dáta a má pult. Manažér
   nesmie dostať `/director`, inak nemá zväz dôvod platiť za sedadlá.

### 8.5 Odporúčanie

**Do prvej verzie Stripe dať LEN trénerské hladiny.** Rodič a hráč ostávajú
zadarmo (tak to aj je), „Rodina" a „Manažér" sú samostatná dávka práce —
a hlavne: kým nemáš prvého platiaceho trénera, nevieš, či o manažérsku
hladinu vôbec niekto stojí. **Manažér bez postavenej prehľadovej stránky sa
predať nedá**, takže by to aj tak nebola otázka cenníka, ale rozvoja.

---

## 9. Čo z toho vyplýva pre Stripe

Pri návrhu A vznikne v Stripe **jeden produkt a šesť cien** (3 hladiny × mesačne
a ročne), pri návrhu B štyri ceny. Každá cena má svoje `price_...` ID, ktoré ide
do premenných prostredia appky. **Ceny sa v Stripe nedajú mazať, len
archivovať** — preto ich zakladaj až po rozhodnutí.
