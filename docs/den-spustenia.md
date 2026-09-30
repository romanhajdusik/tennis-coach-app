# Deň spustenia — 1. októbra 2026

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
uschovávať.

### 3. Overiť jednu premennú, ktorá tam už má byť

V tom istom zozname skontroluj **`SUPABASE_SERVICE_ROLE_KEY`**.

**Bez nej webhook platbu prijme, ale do `profiles` nezapíše** — zákazník
zaplatí a appka ho nepustí. Zvonka sa to zistiť nedá (webhook odmietne
nepodpísanú požiadavku skôr, než na Supabase siahne), preto sa to musí
pozrieť očami.

Po uložení premenných Vercel nasadí znova. **Až týmto sa spúšťa.**

### 4. Overiť naostro

- `www.plaw.win` — v zdroji stránky má byť `<meta name="robots" content="index, follow">`
- `www.plaw.win/register` — formulár **nesmie** pýtať promo kód ako povinný
- `www.plaw.win/podmienky` — má stáť „effective from 1 October 2026" a **nikde**
  veta o registrácii na pozvánku
- `www.plaw.win/login` — musí ostať `noindex` (appka sa neindexuje nikdy)
- **Skúšobná platba naostro** najlacnejšou hladinou (6,90 €), potom v Stripe
  vrátiť peniaze. Overuje sa tým to jediné, čo sa inak overiť nedá: že webhook
  s ostrým podpisovým kľúčom naozaj zapíše predplatné.

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
