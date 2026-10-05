// Založí v Stripe produkty a ceny P.L.A.W — spúšťa sa ručne cez `node`.
//
// PREČO SKRIPT A NIE KLIKANIE (docs/stripe.md, etapa 2):
//  1. Ceny sa čítajú priamo z `lib/landing-pricing.ts`, teda z toho istého
//     miesta, z ktorého ich berie verejný web. Ručne prepísané číslo je
//     najľahší spôsob, ako rozísť cenu na stránke s cenou v pokladni.
//  2. Dá sa spustiť znova bez toho, aby vznikli duplikáty (viď nižšie).
//  3. V deň spustenia založí ten istý skript to isté v ostrom režime.
//
// IDEMPOTENCIA stojí na dvoch veciach:
//  - produkt má **vlastné id** (`plaw_coach_3`), takže sa dá najprv prečítať
//    a založiť, len keď nie je;
//  - cena vlastné id mať nemôže, ale má **`lookup_key`**, ktorý je v rámci
//    účtu unikátny — hľadá sa podľa neho.
// Ceny sú v Stripe NEMENNÉ: pri zmene sumy vznikne nová cena a stará sa
// archivuje (`--refresh`), nikdy sa neprepisuje existujúca.
//
// Spustenie:
//   node scripts/stripe/setup-products.js            # výpis, nič nezapíše
//   node scripts/stripe/setup-products.js --apply    # zapíše
//   node scripts/stripe/setup-products.js --apply --refresh
//        # navyše archivuje ceny, ktorých suma už nesedí s cenníkom
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const ROOT = path.join(__dirname, "..", "..");
const APPLY = process.argv.includes("--apply");
const REFRESH = process.argv.includes("--refresh");

/**
 * Prečíta `.env.local` bez ďalšej závislosti. Súbor je mimo gitu a drží tajný
 * kľúč — do výpisu sa preto nedostane žiadna jeho hodnota.
 */
function loadEnv() {
  const file = path.join(ROOT, ".env.local");
  if (!fs.existsSync(file)) throw new Error(".env.local neexistuje");
  const env = {};
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (match) env[match[1]] = match[2].trim();
  }
  return env;
}

const KEY = loadEnv().STRIPE_SECRET_KEY;
if (!KEY) throw new Error("STRIPE_SECRET_KEY chýba v .env.local");

// Ostrý kľúč znamená skutočné peniaze. Skript je ten istý pre obe polovice
// účtu (to je zámer), ale do ostrej sa nesmie dostať omylom — preto zámok.
//
// POZNAVA SA PODLA `_live_`, NIE PODLA `sk_live_`. Ked sa klucu neudelia
// plne prava (a nemaju sa - nas nesmie hybat peniazmi), Stripe vyda
// OBMEDZENY kluc, ktory zacina `rk_live_`. Povodna podmienka ho
// nezachytila, takze zamok by sa vobec nezapol a skript by do ostreho
// uctu zapisoval bez potvrdenia (2026-09-30).
const LIVE = KEY.includes("_live_");
if (LIVE && process.env.PLAW_STRIPE_LIVE !== "ano") {
  throw new Error(
    "OSTRÝ kľúč. Ak to je naozaj deň spustenia, spusti s PLAW_STRIPE_LIVE=ano",
  );
}

/** Ploché form-encoded telo — Stripe API neberie JSON. */
function encodeForm(params) {
  return Object.entries(params)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join("&");
}

async function stripe(method, endpoint, params) {
  const url = `https://api.stripe.com/v1${endpoint}`;
  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
      // Bez verzie by sa správanie skriptu mohlo zmeniť pod rukami, keď
      // Stripe vydá novú. Zdvihni ju vedome, nie náhodou.
      "Stripe-Version": "2025-08-27.basil",
    },
    body: params ? encodeForm(params) : undefined,
  });
  const body = await response.json();
  if (!response.ok) {
    const detail = body?.error?.message ?? JSON.stringify(body);
    throw new Error(`${method} ${endpoint} → ${response.status}: ${detail}`);
  }
  return body;
}

/** `null` namiesto výnimky, keď objekt neexistuje — inak by 404 zhodila skript. */
async function stripeOrNull(endpoint) {
  try {
    return await stripe("GET", endpoint);
  } catch (error) {
    if (/→ 404/.test(error.message)) return null;
    throw error;
  }
}

/** Suma v eurách → centy. Stripe počíta výhradne v najmenšej jednotke. */
function cents(eur) {
  return Math.round(eur * 100);
}

async function main() {
  // Ceny sa NEOPISUJÚ — čítajú sa z toho istého súboru, z ktorého ich berie
  // verejný web (`lib/landing-pricing.ts`). Node vie `.ts` spustiť priamo.
  // `pathToFileURL` je povinné: na Windows by absolútna cesta `C:\…` skončila
  // na ESM loaderi ako neznáma schéma „c:".
  const { COACH_TIERS, FOLLOWER_PRICE } = await import(
    pathToFileURL(path.join(ROOT, "lib", "landing-pricing.ts")).href
  );

  // ID produktu skladá TÁ ISTÁ funkcia, ktorou ho hľadá pokladňa — inak by
  // sa pri ďalšej disciplíne rozišli a pokladňa by hľadala neexistujúcu cenu.
  const { coachProductId, SOLD_DISCIPLINES } = await import(
    pathToFileURL(path.join(ROOT, "lib", "stripe-plans.ts")).href
  );

  // Každá disciplína má vlastné produkty s rovnakými cenami (docs
  // `cennik-navrh.md` §6 bod 2): v Stripe je tak vidno, koľko zarobila ktorá
  // appka, a zákazník v pokladni vidí, za čo platí. Šport preto nesie aj
  // NÁZOV — ten sa v Stripe dá meniť kedykoľvek, ID nie.
  const disciplines = [
    { id: "tennis", label: "Tennis", coach: "a tennis coach" },
    { id: "padel", label: "Padel", coach: "a padel coach" },
    { id: "badminton", label: "Badminton", coach: "a badminton coach" },
    { id: "pickleball", label: "Pickleball", coach: "a pickleball coach" },
    { id: "fitness", label: "Fitness", coach: "a fitness coach" },
  ];

  // Zoznam predávaných disciplín žije v `lib/stripe-plans.ts` (číta ho aj
  // webhook); názvy sú tu, lebo appka ich nepotrebuje. Keby sa zoznamy
  // rozišli, šport by v pokladni hľadal produkt, ktorý skript nezaložil.
  const ids = disciplines.map((discipline) => discipline.id).sort().join(",");
  if (ids !== [...SOLD_DISCIPLINES].sort().join(",")) {
    throw new Error(
      `Disciplíny v skripte (${ids}) nesedia so SOLD_DISCIPLINES v lib/stripe-plans.ts`,
    );
  }

  const plans = [
    ...disciplines.flatMap((discipline) => COACH_TIERS.map((tier) => ({
      id: coachProductId(tier.players, discipline.id),
      name: `P.L.A.W ${discipline.label} — Coach, ${tier.players} players`,
      // Popis hovorí VÝSLOVNE, že predávame softvér a nie tréning. Managed
      // Payments je len pre plne automatizovaný digitálny produkt a Stripe
      // z neho vylučuje služby s ľudským zásahom, „napríklad živý tréning
      // jeden na jedného". Nás sa to netýka — tréning robí tréner svojmu
      // hráčovi mimo appky —, ale názov „Coach" sa dá pri rýchlom čítaní
      // pochopiť inak, a mýlka by znamenala spätnú daňovú povinnosť.
      description: `Software subscription (SaaS) for ${discipline.coach} — plan, log and analyse practices for up to ${tier.players} active players. Coaching services are not included.`,
      // Tréner je podnikateľ, sledujúci spotrebiteľ. Rozdiel medzi „business"
      // a „personal use" má význam len pri predaji do USA, ale zaradenie má
      // byť pravdivé.
      taxCode: "txcd_10103001",
      // Hladinu číta pri platbe webhook a zapisuje ju do `profiles.player_limit`
      // (docs/stripe.md). Preto patrí k cene, nie do tabuľky v kóde webhooku —
      // inak by sa pri pridaní hladiny museli meniť dve miesta.
      metadata: {
        plaw_player_limit: String(tier.players),
        plaw_role: "coach",
        plaw_discipline: discipline.id,
      },
      monthly: tier.monthly,
      yearly: tier.yearly,
    }))),
    {
      id: "plaw_follower",
      name: "P.L.A.W — Player, parent or manager",
      description:
        "Software subscription (SaaS) for a player, parent or manager — follow one player's practice history, calendar and analytics. Coaching services are not included.",
      taxCode: "txcd_10103000",
      metadata: { plaw_role: "follower" },
      monthly: FOLLOWER_PRICE.monthly,
      yearly: FOLLOWER_PRICE.yearly,
    },
  ];

  console.log(
    `\nStripe: ${LIVE ? "OSTRÝ REŽIM" : "testovací režim"}, ${APPLY ? "ZAPISUJEM" : "len výpis (pridaj --apply)"}\n`,
  );

  for (const plan of plans) {
    const fields = {
      name: plan.name,
      description: plan.description,
      tax_code: plan.taxCode,
      ...Object.fromEntries(
        Object.entries(plan.metadata).map(([k, v]) => [`metadata[${k}]`, v]),
      ),
    };

    const existing = await stripeOrNull(`/products/${plan.id}`);
    if (!existing) {
      if (APPLY) {
        await stripe("POST", "/products", { id: plan.id, ...fields });
      }
      console.log(`  ${APPLY ? "založený" : "chýba  "} produkt  ${plan.id}`);
    } else {
      // Produkt sa na rozdiel od ceny meniť DÁ, takže sa opravuje na mieste —
      // inak by sa oprava popisu alebo daňového kódu musela robiť ručne
      // v dashboarde a v ostrom režime by sa na ňu zabudlo.
      const stale =
        existing.name !== plan.name ||
        existing.description !== plan.description ||
        existing.tax_code !== plan.taxCode;

      if (stale && APPLY) {
        await stripe("POST", `/products/${plan.id}`, fields);
      }
      console.log(
        `  ${stale ? (APPLY ? "upravený" : "líši sa") : "je     "} produkt  ${plan.id}`,
      );
    }

    for (const [interval, eur] of [
      ["month", plan.monthly],
      ["year", plan.yearly],
    ]) {
      const lookupKey = `${plan.id}_${interval}ly`;
      // `active=true` je POVINNÉ, nie kozmetika: archivovaná cena si môže
      // `lookup_key` PODRŽAŤ (stane sa to vždy, keď niekto archivuje cenu
      // ručne v dashboarde — tento skript ho pri archivácii uvoľňuje sám).
      // Bez tohto filtra by sa taká cena našla, skript by ohlásil „je"
      // a cenu by NEZALOŽIL — v katalógu by potom chýbala a pokladňa by sa
      // pre tú hladinu nedala otvoriť. Overené v sandboxe 2026-09-30.
      const found = await stripe(
        "GET",
        `/prices?lookup_keys[]=${encodeURIComponent(lookupKey)}&active=true&limit=1`,
      );
      const price = found.data[0];
      const amount = cents(eur);

      if (price && price.unit_amount === amount) {
        console.log(`  je      cena     ${lookupKey}  ${eur} €`);
        continue;
      }

      if (price && price.unit_amount !== amount) {
        // Cena v Stripe je nemenná. Pri zmene cenníka teda vzniká nová a stará
        // sa archivuje — existujúcim predplatiteľom beží ďalej tá ich, čo je
        // správne: cenu im nemeníme bez oznámenia.
        const stara = (price.unit_amount / 100).toFixed(2);
        if (!REFRESH) {
          console.log(
            `  POZOR   cena     ${lookupKey}  v Stripe ${stara} €, v cenníku ${eur} € — spusti s --refresh`,
          );
          continue;
        }
        if (APPLY) {
          await stripe("POST", `/prices/${price.id}`, {
            active: "false",
            lookup_key: "",
          });
        }
        console.log(`  archív  cena     ${lookupKey}  ${stara} €`);
      }

      if (APPLY) {
        await stripe("POST", "/prices", {
          product: plan.id,
          currency: "eur",
          unit_amount: String(amount),
          "recurring[interval]": interval,
          lookup_key: lookupKey,
          // Ceny na webe sú uvádzané VRÁTANE DPH (rozhodnuté 2026-08-17),
          // takže to musí vedieť aj Stripe. Pole je po nastavení nemenné.
          tax_behavior: "inclusive",
        });
      }
      console.log(`  ${APPLY ? "založená" : "chýba   "} cena     ${lookupKey}  ${eur} €`);
    }
  }

  console.log("");
}

main().catch((error) => {
  console.error(`\nCHYBA: ${error.message}\n`);
  process.exit(1);
});
