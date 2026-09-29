# Stripe — postup napojenia platieb

Tento dokument je návod pre **prvé napojenie Stripe** na P.L.A.W: čo urobiť,
v akom poradí a čo sa nesmie pokaziť. Písaný je pre človeka, ktorý Stripe nikdy
nerobil, takže vysvetľuje aj pojmy.

**Stav k 2026-09-28:** rozhodnuté je, že P.L.A.W dostane **vlastný, oddelený
Stripe účet** (rozhodnuté 2026-08-16, potvrdené 2026-09-22). Firma síce už jeden
účet má, ale patrí k inej činnosti; zvažovalo sa jeho premenovanie, keďže cezeň
nebežia žiadne platby, a používateľ sa napriek tomu rozhodol založiť nový.
**Zakladá sa PRED prvou platbou** — transakcie sa medzi účtami presunúť nedajú.

**Upresnené 2026-09-28: je to ÚPLNE NOVÁ REGISTRÁCIA, nie druhý účet pod
existujúcim prihlásením** (rozhodol používateľ). Oddelenosť účtu je v oboch
prípadoch rovnaká — peniaze, platby, výplaty aj overenie firmy sú zvlášť tak či
tak. Líši sa len to, **kto sa doň prihlasuje**: samostatná registrácia znamená
druhé heslo a druhé 2FA bez prepínača účtov v rohu, ale účet nie je priviazaný
na osobné prihlásenie konateľa a dá sa odovzdať bez zásahu do druhej firmy.
Prihlasovací e-mail je **`billing@plawsports.com`** — alias do existujúcej
schránky (viď [`docs/domeny-a-email.md`](domeny-a-email.md) Krok 8), takže pošta
chodí tam, kde je zvyknutý, ale vlastníkom účtu je firemná adresa, nie súkromná.

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

1. **Odhlás sa zo Stripe** (alebo otvor anonymné okno) — inak ponúkne pridať
   účet k existujúcemu prihláseniu, čo je práve to, čo nechceme.
2. Choď na `dashboard.stripe.com/register`.
3. E-mail **`billing@plawsports.com`**, meno konateľa a silné heslo do správcu
   hesiel. **Nie súkromná adresa** — vlastník účtu drží peniaze.
4. **Krajina: Slovensko. Mena: euro.** Krajinu účtu Stripe neskôr nezmení —
   toto je jediné políčko, ktoré treba trafiť na prvý raz. Názov účtu
   (`P.L.A.W`) sa naopak dá zmeniť kedykoľvek.
5. Potvrď e-mail a nastav **2FA** cez aplikáciu v telefóne. **Ulož si záložné
   kódy** — bez nich sa pri strate telefónu do účtu nedostaneš, a je to jediné
   prihlásenie do tohto účtu (nezdieľa sa s existujúcim firemným).
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

### Rozhodnutia, ktoré v tejto etape padli (2026-09-28)

#### MANAGED PAYMENTS = ÁNO. Predávajúcim je Link (Stripe), nie &Go, s.r.o.

Rozhodol používateľ. Vyšlo to najavo tak, že pokladňa sa odmietla založiť:
Managed Payments je na novom účte **zapnutý predvolene** a žiada daňový kód
produktu.

**Čo to je:** Stripe je *merchant of record*. Zákazník kupuje od jeho služby
**Link**, tá mu vystaví doklad, vyberie a odvedie DPH v 80+ krajinách, rieši
spory a reklamácie. Zákazníkovi to hovorí výslovne („Sold through Link").

**Prečo áno:** používateľ predáva **mimo EÚ** (to bolo rozhodujúce — pôvodne
som odporúčal opak, lebo som počítal so slovenskými zákazníkmi). OSS pokrýva
len EÚ; v Británii vzniká povinnosť registrovať sa na VAT **od prvého predaja**
a Nórsko, Švajčiarsko, Austrália, Kanada, Japonsko aj jednotlivé štáty USA majú
každé vlastné pravidlá. To je agenda, ktorá jednočlennú firmu položí.

**Čo to stojí:** **3,5 % z platby navyše** k bežnému poplatku (ten je pri EEA
karte 1,5 % + 0,25 €), teda spolu zhruba 5 % + 0,25 €.

**Čo z toho plynie pre kód a dokumenty:**
- Produkty musia mať **daňový kód** — bez neho Stripe pokladňu nezaloží.
  Tréner `txcd_10103001` (SaaS, business use), sledujúci `txcd_10103000`
  (personal use). Nastavuje ich `scripts/stripe/setup-products.js`.
- Popis produktu **výslovne hovorí, že predávame softvér a nie tréning**.
  Managed Payments je len pre plne automatizovaný digitálny produkt a Stripe
  z neho vylučuje služby s ľudským zásahom, „napríklad živý tréning jeden na
  jedného". **Nás sa to netýka** — tréning robí tréner svojmu hráčovi mimo
  appky —, ale slovo „Coach" v názve sa dá prečítať zle a omyl by znamenal
  spätnú daňovú povinnosť.
- **ČÍNU Managed Payments NEPODPORUJE** (spolu s Ruskom, Iránom, Kubou,
  Severnou Kóreou, Sýriou a Kosovom). **OVERENÉ NAOSTRO v sandboxe
  2026-09-29** — a dopadlo to lepšie, než sme písali:
  - Relácia pokladne sa pre čínsku adresu **založí normálne**; porovnanie CN,
  SK a US ukázalo relácie zhodné pole po poli okrem adresy zákazníka.
  - **Obmedzenie sa ale neprejaví až pri platbe.** Len čo zákazník vyberie
  krajinu, pokladňa **hneď pod formulárom ukáže červené
  „China is not currently supported."** — teda skôr, než čokoľvek zaplatí
  a bez toho, aby mu zlyhala karta. Pôvodná poznámka „prejaví sa až pri
  platbe" bola nepresná; **žiadna stráž v appke na to netreba.**
  - **Čína je v rozbaľovacom zozname krajín prítomná** (rovnako Rusko);
  **Irán v ňom nie je vôbec**. Zoznam má 240 položiek.
- Vlastná doména na platobnej stránke nie je podporovaná.
- Ak sa Stripe do 48 hodín nedovolá pri spore, **môže vrátiť peniaze aj bez
  nášho súhlasu**.
- **PODMIENKY SÚ PREPÍSANÉ (2026-09-29).** Obe — trénerské aj pre sledujúcich,
  v oboch zneniach. Predtým tvrdili, že zmluvu uzatvára zákazník s &Go, s.r.o.
  Zmenené miesta: §1 (veta o predávajúcom), cena „je konečná" namiesto
  „vrátane DPH", **celá sekcia o platbách** (predávajúcim je Link, doklad
  vystavuje Link, portál v Nastaveniach), sekcia o odstúpení (píše sa nám,
  odstúpenie posunieme Stripe) a **celá sekcia o rozhodnom práve**: spor
  o službu → SOI, spor o samotnú platbu → Stripe a podmienky služby Link,
  SOI preň príslušná nie je. **Je to zmena ZNENIA schváleného dokumentu —
  čaká na nové schválenie používateľom.**
- **ČO ZÁKAZNÍK V POKLADNI NAOZAJ VIDÍ — odfotené 2026-09-29, tým sa uzavrela
  posledná pochybnosť o znení §5.** Pod tlačidlom stojí: „By subscribing, you
  agree to Link.s **Terms** and **Privacy Policy** and authorize Link to charge
  you for the described subscription until you cancel. This subscription is
  **provided by** &GO sro in accordance with their terms.", a úplne dole odznak
  **„Sold through Link"**.
  - **Podmienky služby Link SÚ v pokladni klikateľné** — to bola otvorená
  otázka a je zodpovedaná: veta v našich podmienkach („Link.s own terms apply
  to that purchase and are available to you at checkout") je pravdivá.
  - **Stripe sám rozlišuje „sold through Link" od „provided by &Go"** — presne
  to delenie, ktoré sme do §5 napísali (predaj je ich, služba naša).
  - **POZOR NA MENO:** zákazník vidí ako poskytovateľa **názov stripovského
  účtu**, teda „&GO sro" — nie „P.L.A.W". Kupuje si pritom P.L.A.W a &Go nikdy
  nepočul. Zvážiť premenovanie verejného názvu účtu; popis na výpise z karty
  (`PLAWSPORTS`) je nastavený správne.

#### Ceny ostávajú VRÁTANE DANE a v dnešnej výške

Overené naostro na pokladni pre newyorskú adresu: **subtotal 92,90 €, Sales
Tax 7,57 €, celkom 92,90 €** — daň sa z ceny vyčlenila, suma sa nezmenila.
Sedí aj sadzba (8,875 % NYC).

Používateľ zvažoval prechod na ceny bez dane a **rozhodol NEMENIŤ NIČ**.
Dôvody proti zmene: spotrebiteľovi v EÚ sa musí ukázať konečná cena, argument
„pod 10 centov na deň" bez konečnej ceny nefunguje, a príznak `tax_behavior`
je na cene v Stripe **nemenný** — zmena by znamenala založiť ceny nanovo.

**Dôsledok, ktorý treba držať v hlave:** pri cenách vrátane dane sa čistý
výnos líši podľa krajiny. Z ročných 92,90 € po dani aj po poplatku zostane
~80 € (USA), ~79 € (Japonsko, Austrália), ~76 € (JAR), ~72 € (Argentína),
**~71 € (Slovensko)**. Pri mesačných 6,90 € zostane ~5,00 €, teda 72 % —
pevných 25 centov z každej platby je pri malej sume citeľných. **Je to ďalší
dôvod tlačiť do ročnej platby**, čo cenník už robí (ročná je predvolená).

#### Ostatné

- **Hladina hráčov po zaplatení.** Nastavuje ju webhook sám podľa kúpenej
  ceny — číslo je v metadátach produktu (`plaw_player_limit`), nie v tabuľke
  v kóde webhooku.
- **Či sa bod 7 (stráže) robí hneď, alebo až v etape 3** — stále otvorené.

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
