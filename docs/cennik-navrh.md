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

## 8. Čo z toho vyplýva pre Stripe

Pri návrhu A vznikne v Stripe **jeden produkt a šesť cien** (3 hladiny × mesačne
a ročne), pri návrhu B štyri ceny. Každá cena má svoje `price_...` ID, ktoré ide
do premenných prostredia appky. **Ceny sa v Stripe nedajú mazať, len
archivovať** — preto ich zakladaj až po rozhodnutí.
