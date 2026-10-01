# Deň spustenia — 1. októbra 2026

> **VYKONANÉ 1. 10. 2026.** P.L.A.W je spustený: premenné sú na Verceli,
> nasadenie prebehlo, všetkých päť kontrol prešlo a **prvá ostrá platba
> naozaj zapísala predplatné do databázy**. Dokument ostáva ako záznam
> a ako predloha pre spustenie ďalších disciplín. Čo sa v deň spustenia
> ukázalo inak, než tu stálo, je dopísané pri príslušných krokoch.

Krátky postup na spustenie consumer produktu (`plaw.win` + `plaw.click`).
**Federácia sa nespúšťa** — zmluvy a zásady pre organizácie čakajú na prvý
zväz a spustenie neblokujú.

Všetko, čo sa dalo pripraviť dopredu, je pripravené k 30. 9. 2026. Tento
dokument je zoznam toho, čo sa musí stať v samotný deň — nič viac.

---

## Čo je už hotové (nerobiť znova)

- **Stripe je aktívny.** Overenie firmy prešlo 30. 9.
- **Produkty a ceny sú v ostrom režime** — osem cien, eurá, vrátane dane,
  limity 3/6/12 v metadátach. Zakladal ich `scripts/stripe/setup-products.js`.
- **Zákaznícky portál** je nastavený: zmena karty, zmena hladiny medzi tromi
  trénerskými produktmi, zrušenie **na konci zaplateného obdobia**.
- **Webhook** `P.L.A.W app` je `Active` na `https://www.plaw.win/api/stripe/webhook`,
  počúva tri udalosti, payload **Snapshot**.
- **Verejný názov účtu** je `P.L.A.W Sports`, popis na výpise `PLAWSPORTS`.
- **Podmienky sú úplné a NA PRODUKCII** — dátum účinnosti doplnený, veta
  o pozvánke vypustená, žiadne žlté miesto. Pushnuté 30. 9. (`d2d617d`),
  čitateľské stránky ich čítajú priamo z `docs/podmienky-*.md`, takže sa
  znenie nemá ako rozísť.
- **Stráže, ktoré cenník sľubuje**, sú hotové okrem hĺbky histórie (`d2d617d`):
  trénerovi je analytika za predplatným, sledujúcemu kalendár aj analytika.

---

## Postup (asi 10 minút — krok 1 je už hotový)

### 1. Pushnúť pripravený commit — HOTOVÉ 30. 9. 2026

Všetko pripravené je už na produkcii (`a6538d3..d2d617d`, päť commitov,
vrátane podmienok). Dalo sa to spraviť o deň skôr práve preto, že **web je
stále `noindex` a registrácia je zatvorená** — navonok sa tým nezmenilo nič.

Keby medzitým pribudol ďalší commit, platí pôvodné pravidlo: ide von **PRVÝ**,
pred premennými nižšie.

```bash
git push origin master
```

Vercel nasadí sám, do minúty.

### 2. Štyri premenné na Verceli

Projekt `tennis-coach-app` → Settings → Environment Variables, **Production**:

| Premenná | Hodnota |
|---|---|
| `STRIPE_SECRET_KEY` | **`rk_live_…`** — obmedzený kľúč „P.L.A.W app" |
| `STRIPE_WEBHOOK_SECRET` | `whsec_…` (Stripe → Webhooks → P.L.A.W app → **Reveal secret**) |
| `PLAW_INDEXING` | `true` |
| `REGISTRATION_ENABLED` | `true` |

**Tajný kľúč nie je `sk_live_`, ale `rk_live_`** — je to zámer, obmedzený kľúč
nesmie hýbať peniazmi z účtu.

**Publikovateľný kľúč (`pk_live_…`) sem NEPATRÍ** — appka ho nikde nečíta
(overené 2026-09-30, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` nie je v kóde ani
raz). Pokladňa je serverové presmerovanie na Stripe Checkout, v prehliadači
žiadny Stripe.js nebeží. Do tabuľky sa dostal omylom; nastaviť ho nič nepokazí,
len to nič nerobí.

**Podpisový kľúč webhooku sa dá zobraziť opakovane**, nemusel sa nikde
uschovávať. Je v detaile cieľa „P.L.A.W app" pod **Signing secret → Reveal**.

**OBMEDZENÝ KĽÚČ SA ZOBRAZIŤ NEDÁ (zistené 1. 10. 2026).** Stripe ukáže
hodnotu tajného kľúča jediný raz, pri vytvorení; v ponuke `…` pri ňom je
„Copy key ID", čo je identifikátor, nie kľúč. Rieši to **Rotate key** v tej
istej ponuke: vyrobí novú hodnotu toho istého kľúča (meno aj práva ostanú)
a tú ukáže. Starému nastav expiráciu **Now** — pred spustením nie je nikde
nasadený. **Novú hodnotu ulož do Vercelu skôr, než okno zatvoríš.**

### 3. Overiť jednu premennú, ktorá tam už má byť

V tom istom zozname skontroluj **`SUPABASE_SERVICE_ROLE_KEY`**.

**Bez nej webhook platbu prijme, ale do `profiles` nezapíše** — zákazník
zaplatí a appka ho nepustí. Zvonka sa to zistiť nedá (webhook odmietne
nepodpísanú požiadavku skôr, než na Supabase siahne), preto sa to musí
pozrieť očami.

**POZOR, TOTO BOLO V NÁVODE ZLE (opravené 1. 10. 2026): Vercel po uložení
premenných NENASADÍ sám.** Premenné sa priložia až k novému nasadeniu, staré
beží ďalej s tým, čo malo pri builde — Vercel to aj sám hlási hláškou „A new
deployment is needed for changes to take effect". Nasadiť treba ručne:

**Deployments** → posledné produkčné nasadenie → `…` → **Redeploy** →
**odškrtnúť „Use existing Build Cache"** (niektoré stránky sa vyrábajú pri
builde a z cache by prišli ešte spred premenných) → potvrdiť.

**Až týmto sa spúšťa.** Nasadzuj jediný raz, keď je hotových všetkých päť
premenných — inak sa appka spustí do polovice (platby žijú, registrácia
zatvorená).

### 4. Overiť naostro

- `www.plaw.win` — v zdroji stránky má byť `<meta name="robots" content="index, follow">`
- `www.plaw.win/register` — formulár **nesmie** pýtať promo kód ako povinný
- `www.plaw.win/podmienky` — má stáť „effective from 1 October 2026" a **nikde**
  veta o registrácii na pozvánku
- **`/zasady`, `/zasady-hrac` aj `/zasady-organizacia`** — dátum účinnosti.
  **Pribudlo 1. 10. 2026:** dátum sa v septembri doplnil len do podmienok a na
  zásady sa zabudlo, takže na nich v deň spustenia stálo žltým „effective from
  [date]". Opravené commitom `d4269a8`. **Pozeraj VŠETKÝCH PÄŤ právnych
  stránok, nie dve** — žlté miesto je čokoľvek v hranatých zátvorkách, viď
  `lib/legal-docs.ts`.
- `www.plaw.win/login` — musí ostať `noindex` (appka sa neindexuje nikdy)
- **Platba naostro.** Overuje sa tým to jediné, čo sa inak overiť nedá: že
  webhook s ostrým podpisovým kľúčom naozaj zapíše predplatné. Appka to
  potvrdí sama — keď na `/subscribe` po návrate z pokladne ukáže „máš
  predplatné", znamená to, že stav v databáze zmenil webhook.

  **Ako sa to spravilo 1. 10. 2026: user si predplatné kúpil normálne, na
  vlastný účet, a nechal si ho.** Pôvodný plán („zaplatiť najlacnejšiu hladinu
  a vrátiť peniaze") je horší — vrátenie peňazí samo predplatné nezruší, a keď
  sa zruší, účet spadne do stavu „zrušené" a prestane zapisovať. Testovací účet
  je druhá možnosť, ale nákup naostro overí to isté a nič sa po ňom neupratuje.

  **Hladinu vyber podľa počtu AKTÍVNYCH hráčov.** Webhook zapíše `player_limit`
  podľa kúpenej ceny a prepíše tým, čo účet mal. Účet nad svojou hladinou
  **nezapisuje vôbec**, nielen že nepridá hráča.

---

## Čo sa v ten deň NEROBÍ

- **Nespúšťa sa `setup-products.js`** — ceny v ostrom režime už sú. Spustiť ho
  znova nič nepokazí (je idempotentný), ale netreba to.
- **Nemenia sa ceny ani meny.** USD sa dá doplniť kedykoľvek neskôr, viď
  `docs/stripe.md`.
- **Nespúšťa sa federácia.**

---

## Čo ostáva po spustení (neblokuje)

- Čitateľské stránky podmienok (artefakty) a Google Docs nesú staré znenie —
  prestavať a nahrať znova.
- Prihlásenie v novom štýle z redizajnu.
- **Hĺbka histórie sledujúceho 6 vs 24 mesiacov** (posledný zvyšok bodu 7
  v `docs/stripe.md`). Ostatné stráže, ktoré cenník sľubuje, sú od 2026-09-30
  hotové. Neblokuje: prvý záznam vypadne z okna až okolo januára 2027.
