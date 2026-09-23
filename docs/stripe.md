# Stripe — postup napojenia platieb

Tento dokument je návod pre **prvé napojenie Stripe** na P.L.A.W: čo urobiť,
v akom poradí a čo sa nesmie pokaziť. Písaný je pre človeka, ktorý Stripe nikdy
nerobil, takže vysvetľuje aj pojmy.

**Stav k 2026-09-22:** rozhodnuté je, že P.L.A.W dostane **vlastný, oddelený
Stripe účet** (rozhodnuté 2026-08-16, potvrdené 2026-09-22). Firma síce už jeden
účet má, ale patrí k inej činnosti; zvažovalo sa jeho premenovanie, keďže cezeň
nebežia žiadne platby, a používateľ sa napriek tomu rozhodol založiť nový.
**Zakladá sa PRED prvou platbou** — transakcie sa medzi účtami presunúť nedajú.

Ceny sú rozhodnuté a žijú v [`lib/landing-pricing.ts`](../lib/landing-pricing.ts),
odôvodnené sú v [`docs/cennik-navrh.md`](cennik-navrh.md). Pravidlá paywallu sú
v CLAUDE.md, sekcia „Skúšobná doba a predplatné".

---

## Pojmy

- **Testovací a ostrý režim.** Každý Stripe účet má dve oddelené polovice s
  vlastnými kľúčmi aj vlastnými zoznamami platieb. V testovacej sa platí
  vymyslenou kartou (`4242 4242 4242 4242`, ľubovoľný budúci dátum a CVC).
  Nemiešajú sa a prepína sa medzi nimi v rohu obrazovky.
- **Kľúče.** `pk_…` je **publikovateľný** (beží v prehliadači, je verejný),
  `sk_…` je **tajný** (patrí len serveru; kto ho má, ovláda účet). Testovacie
  majú v názve `test`.
- **Webhook.** Adresa v appke, na ktorú Stripe sám zaklope a oznámi, že sa
  zaplatilo. Je to **jediný spoľahlivý zdroj pravdy** — zákazník môže po platbe
  zavrieť prehliadač a appka by sa to inak nedozvedela.
- **Zákaznícky portál.** Hotová stránka Stripe, kde si zákazník sám zmení kartu,
  prejde medzi mesačným a ročným alebo predplatné zruší.

---

## Mapa: štyri etapy

1. **Založenie účtu a overenie firmy** — robí používateľ.
2. **Napojenie v testovacom režime** — robí Claude, používateľ klikne trikrát.
3. **Skúšobné platby a bezpečnostná previerka.**
4. **Deň spustenia** — ostré kľúče, právne stránky, indexovanie.

Etapy 3 a 4 sú tu zatiaľ len v obryse; rozpíšu sa, keď na ne dôjde.

---

## Etapa 1 — založenie účtu (používateľ)

**Priprav si:** údaje firmy (`&Go, s.r.o.`, IČO 46571388, DIČ 2023447976,
IČ DPH SK2023447976, Vnútorná okružná 178/27, 945 01 Komárno; zápis Okresný súd
Nitra, oddiel Sro, vložka č. 31170/N), IBAN firmy, doklad totožnosti konateľa
a telefón s aplikáciou na dvojfaktorové prihlásenie.

1. Prihlás sa na `dashboard.stripe.com` existujúcim firemným účtom.
2. Vľavo hore klikni na názov účtu — je to prepínač účtov.
3. Zvoľ vytvorenie nového účtu („New account"). **Nie je to nová registrácia
   ani nový e-mail** — je to druhý účet pod tým istým prihlásením.
4. Názov účtu: `P.L.A.W`. Dá sa zmeniť kedykoľvek.
5. **Krajina: Slovensko. Mena: euro.** Krajinu účtu Stripe neskôr nezmení —
   toto je jediné políčko, ktoré treba trafiť na prvý raz.
6. Ocitneš sa v prázdnom účte v **testovacom režime**. Ten funguje hneď, aj keď
   firma ešte overená nie je.
7. Spusti overenie firmy („Activate payments" / „Complete your business
   profile"): typ subjektu **spoločnosť**, údaje firmy podľa zoznamu vyššie,
   odbor softvér ako služba (predplatné), web `plaw.win`, opis „mesačné a ročné
   predplatné aplikácie na plánovanie a evidenciu tréningov pre tenisových
   trénerov", údaje a doklad konateľa, IBAN na výplaty a **popis na výpise
   z karty** (`PLAW` alebo `PLAWSPORTS` — krátke, bez bodiek).
8. Odošli. Overenie trvá od hodín po dni a Stripe si môže vypýtať ďalší doklad.

**Čo v tejto etape NEROBIŤ:** nezakladať produkty ani ceny (spravia sa skriptom,
viď etapu 2), nezapínať ďalšie platobné metódy (začína sa kartami), nezakladať
„Payment Link" (appka má vlastnú pokladňu).

---

## Etapa 2 — napojenie v testovacom režime

### Čo robí používateľ

1. **Kľúče (2 minúty).** V testovacom režime otvor **Developers → API keys**.
   Publikovateľný kľúč pošli pokojne v rozhovore; **tajný nie** — vlož ho sám do
   `.env.local` na pripravený riadok. Do gitu sa nedostane (`.gitignore`).
2. **Zákaznícky portál (5 minút).** V nastaveniach Stripe zapni „Customer
   portal" a povoľ v ňom zmenu karty, prechod medzi plánmi a zrušenie.
3. **Kľúče na Vercel**, keď má byť testovacia platba dostupná aj na produkcii
   (inak stačí lokálne).

### Čo robí Claude

4. **Produkty a ceny skriptom, nie ručne.** Osem cien musí sedieť s
   [`lib/landing-pricing.ts`](../lib/landing-pricing.ts) na cent:

   | Čo | Mesačne | Ročne |
   |---|---|---|
   | Tréner, 3 hráči | 6,90 € | 49,90 € |
   | Tréner, 6 hráčov | 12,90 € | 92,90 € |
   | Tréner, 12 hráčov | 24,90 € | 179,90 € |
   | Sledujúci | 5,90 € | 36,00 € |

   Ten istý skript založí v deň spustenia to isté v ostrom režime.
5. **Pokladňa (Checkout).** Tlačidlo „Predplatiť" do
   [`components/trial-banner.tsx`](../components/trial-banner.tsx) (dnes tam
   zámerne nie je, lebo by neviedlo nikam) a napojenie cenníka na pokladňu —
   dnes obe stránky vedú na registráciu.
6. **Webhook.** Zapisuje `profiles.subscription_status` **aj
   `profiles.player_limit`**. Appka tým **prvýkrát drží `service_role` kľúč** —
   inak by si zápis „zaplatené" nemohla dovoliť (`authenticated` nemá na
   `profiles` UPDATE, a to je zámer).
7. **Stráže, ktoré cenník sľubuje.** Web dnes sľubuje viac, než appka vynucuje:
   trénerovi analytiku za predplatným, sledujúcemu kalendár a analytiku a hĺbku
   histórie 6 vs 24 mesiacov. Musí sedieť s poľom `WITHOUT_SUBSCRIPTION`
   v [`components/landing-pricing.tsx`](../components/landing-pricing.tsx) a
   v [`app/cennik-hrac/page.tsx`](../app/cennik-hrac/page.tsx). **Je to najväčší
   kus práce v etape** a dá sa odložiť do etapy 3.
8. **Overenie** miestnymi sadami (`paywall.js`, `browser-coach.js`) plus nové
   scenáre na celú cestu platby.

### Rozhodnutia, ktoré v tejto etape padnú

- **DPH.** Ceny sú vrátane DPH a firma je platiteľ. Stripe vie DPH počítať a
  vykazovať sám (Stripe Tax, za percento z platby), alebo to ostane účtovníkovi.
  **Patrí to účtovníkovi, nie nám** — spýtať sa skôr, než sa čokoľvek zapne.
- **Hladina hráčov po zaplatení.** Odporúčanie: nastavuje ju webhook sám podľa
  kúpenej ceny, bez ručného zásahu.
- **Či sa bod 7 (stráže) robí hneď, alebo až v etape 3.**

---

## Etapa 3 — skúšobné platby a previerka (obrys)

Celá cesta tak, ako ju prejde tréner: registrácia → skúšobná doba → platba →
zmena hladiny → zrušenie → čo sa stane po skončení predplatného. K tomu
bezpečnostná previerka, ktorá sa osobitne pozrie na `service_role` kľúč,
na webhook (verejná adresa bez prihlásenia, ktorá **zapisuje**) a na stráž
čítania pre sledujúceho. Podklad je
[`docs/postup-pri-incidente.md`](postup-pri-incidente.md) a predošlé audity.

---

## Etapa 4 — deň spustenia (obrys)

Naraz, v jeden deň: ostré kľúče, ceny v ostrom režime, **zverejnené právne
stránky** (podmienky a zásady — Stripe ich pri overovaní na webe očakáva),
otvorená registrácia a až **nakoniec indexovanie vo vyhľadávačoch**. Poradie je
zámerné: návštevník z Googlu sa musí vedieť hneď zaregistrovať aj zaplatiť.

---

## Pravidlá, ktoré sa nesmú porušiť

- **Ceny sa menia na dvoch miestach naraz** — `lib/landing-pricing.ts` a Stripe.
  Nikdy nie v texte stránky; ten nesie len slová okolo čísel.
- **Testovacie a ostré kľúče sa nemiešajú.** Ostré patria do produkcie až v deň
  spustenia; dovtedy je ostrý režim prázdny.
- **Migrácia na produkčnú databázu ide PRED pushom kódu.** Platí pre každú
  zmenu schémy (viď CLAUDE.md, „Skúšobná doba a predplatné"): keby sa pushol kód
  pred migráciou, dotaz na produkcii zlyhá a tréner okamžite prestane zapisovať.
- **`service_role` kľúč patrí výhradne serveru webhooku.** Nikdy do klienta,
  nikdy do premennej s prefixom `NEXT_PUBLIC_`.
- **Webhook musí overovať podpis Stripe.** Je to verejná adresa bez prihlásenia,
  ktorá zapisuje do databázy — bez overenia podpisu by si ktokoľvek nastavil
  „zaplatené".
- **Federačného trénera sa Stripe netýka.** Sedadlá sa fakturujú mimo aplikácie
  (viď [`docs/onboarding-organizacie.md`](onboarding-organizacie.md)) a členstvo
  v organizácii prebíja stav profilu.
- **Rodičovský paywall je INÝ než trénerský.** Tréner „číta, ale nezapisuje";
  sledujúci nezapisuje nič, takže jeho stráž musí byť na **čítanie**
  (`app/parent/**`, `lib/actions/parent-data.ts`), nie `requireWriteAccess`.
