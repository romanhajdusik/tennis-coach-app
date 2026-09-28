// POKLADŇA STRIPE — kto sa k nej dostane, s akou cenou a kedy sa ponúkne.
//
// Čo sa overuje a prečo práve to:
//
// 1. **Sumy na `/subscribe` sedia s cenníkom.** Stránka aj verejný web čítajú
//    `lib/landing-pricing.ts`, ale keby sa to niekedy rozišlo, tréner uvidí
//    inú cenu, než akú zaplatí. Kontroluje sa proti tomu istému zdroju.
// 2. **Kto platiť NEMÁ, sa tam nedostane** — sledujúci má vlastnú cenu
//    a za federačného trénera platí organizácia faktúrou (§5.9).
// 3. **Tlačidlo sa ukáže, až keď má kam viesť.** Bez kľúčov (stav produkcie)
//    stránka neexistuje a v pruhu nie je odkaz.
// 4. **Cena v Stripe naozaj existuje a má správnu sumu.** Appka ju hľadá
//    podľa `lookup_key`, nie podľa `price_…` v kóde — identifikátory sú
//    v testovacej a ostrej polovici účtu iné.
//
// Potrebuje bežiaci dev server a `STRIPE_SECRET_KEY` v `.env.local`
// (testovací!). Pri ostrom kľúči sa sada odmietne spustiť.
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const {
  request,
  textOf,
  authCookies,
  serviceClient,
  createChecks,
} = require("./helpers");

const { check, section, report } = createChecks();

const APP = "plaw.win";
const SOLO_COACH = "demo@plaw.win";
const NEW_COACH = "coach-new@test.local";
const FOLLOWER = "parent-test@test.local";
const ORG_COACH = "coach-today@test.local";

const ROOT = path.join(__dirname, "..", "..");

function envValue(name) {
  const file = path.join(ROOT, ".env.local");
  if (!fs.existsSync(file)) return undefined;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = new RegExp(`^${name}=(.*)$`).exec(line.trim());
    if (match) return match[1].trim();
  }
  return undefined;
}

async function main() {
  const secret = envValue("STRIPE_SECRET_KEY");
  if (!secret) {
    console.error("\n  STRIPE_SECRET_KEY nie je v .env.local — sada preskočená.\n");
    process.exit(1);
  }
  if (secret.startsWith("sk_live_")) {
    console.error("\n  OSTRÝ kľúč. Sada zakladá platby — spúšťaj ju len testovacím.\n");
    process.exit(1);
  }

  section("0) Beží dev server?");
  const probe = await request("/login", { host: APP });
  if (probe.status !== 200) {
    console.error(`\n  Dev server neodpovedá (status ${probe.status}).\n`);
    process.exit(1);
  }
  check("appka odpovedá", probe.status === 200);

  const { COACH_TIERS, formatEur } = await import(
    pathToFileURL(path.join(ROOT, "lib", "landing-pricing.ts")).href
  );
  const { coachProductId, priceLookupKey } = await import(
    pathToFileURL(path.join(ROOT, "lib", "stripe-plans.ts")).href
  );

  section("1) /subscribe ukazuje hladiny a sumy z cenníka");
  const coachCookies = await authCookies(SOLO_COACH);
  const page = await request("/subscribe", { host: APP, cookies: coachCookies });
  const text = textOf(page.body);
  check("tréner stránku dostane", page.status === 200, `status ${page.status}`);

  for (const tier of COACH_TIERS) {
    check(
      `hladina ${tier.players} hráčov je v ponuke`,
      text.includes(`${tier.players} players`),
    );
    // Obe sumy musia byť v HTML naraz — prepínač mesačne/ročne je klientský,
    // takže server posiela obe a rozhoduje sa až v prehliadači.
    check(
      `${tier.players}: mesačná ${formatEur(tier.monthly)} sedí s cenníkom`,
      page.body.includes(formatEur(tier.monthly)),
    );
    check(
      `${tier.players}: ročná ${formatEur(tier.yearly)} sedí s cenníkom`,
      page.body.includes(formatEur(tier.yearly)),
    );
  }

  section("1b) Kto už platí, ponuku znova nevidí");
  // Zistené pri prvej skutočnej testovacej platbe: stránka po zaplatení
  // vyzerala rovnako ako pred ním, takže to pôsobilo, akoby sa platba
  // nestala. Server action druhý nákup odmietne tak či tak, ale ponúkať
  // tlačidlo, ktoré skončí chybou, je horšie než ho neponúkať.
  const db0 = serviceClient();
  const { data: payer } = await db0
    .from("profiles")
    .select("id, subscription_status")
    .eq("email", SOLO_COACH)
    .maybeSingle();
  const wasStatus = payer?.subscription_status;
  try {
    await db0
      .from("profiles")
      .update({ subscription_status: "active" })
      .eq("id", payer.id);
    const paidPage = await request("/subscribe", {
      host: APP,
      cookies: await authCookies(SOLO_COACH),
    });
    const paidText = textOf(paidPage.body);
    check(
      "povie, že predplatné už má",
      paidText.includes("You already have a subscription"),
      paidText.slice(0, 120),
    );
    check(
      "hladiny už neponúka",
      !COACH_TIERS.some((tier) => paidPage.body.includes(formatEur(tier.yearly))),
    );
  } finally {
    await db0
      .from("profiles")
      .update({ subscription_status: wasStatus })
      .eq("id", payer.id);
  }

  section("1c) Predplatné si tréner spravuje SÁM");
  // Zrušiť zmluvu má byť rovnako jednoduché ako ju uzavrieť, takže
  // v nastaveniach musí byť tlačidlo do zákazníckeho portálu, nie e-mail
  // na podporu. Vidí ho len ten, kto cez Stripe naozaj platil — inak by
  // skončilo chybou.
  const db1 = serviceClient();
  const { data: solo } = await db1
    .from("profiles")
    .select("id, stripe_customer_id")
    .eq("email", SOLO_COACH)
    .maybeSingle();
  const hadCustomer = solo?.stripe_customer_id ?? null;
  try {
    await db1
      .from("profiles")
      .update({ stripe_customer_id: "cus_test_sada" })
      .eq("id", solo.id);
    const withPortal = await request("/settings", {
      host: APP,
      cookies: await authCookies(SOLO_COACH),
    });
    check(
      "kto platil, má v nastaveniach tlačidlo do portálu",
      textOf(withPortal.body).includes("Manage subscription"),
    );

    await db1
      .from("profiles")
      .update({ stripe_customer_id: null })
      .eq("id", solo.id);
    const without = await request("/settings", {
      host: APP,
      cookies: await authCookies(SOLO_COACH),
    });
    check(
      "kto cez Stripe neplatil, tlačidlo nevidí",
      !textOf(without.body).includes("Manage subscription"),
    );

    // Sledujúci má vlastnú cenu a vlastnú stráž; portál trénera mu do
    // nastavení nepatrí.
    const follower = await request("/settings", {
      host: APP,
      cookies: await authCookies(FOLLOWER),
    });
    check(
      "sledujúci tlačidlo nevidí",
      !textOf(follower.body).includes("Manage subscription"),
    );
  } finally {
    await db1
      .from("profiles")
      .update({ stripe_customer_id: hadCustomer })
      .eq("id", solo.id);
  }
  section("2) Kto platiť nemá, sa k pokladni nedostane");
  const followerPage = await request("/subscribe", {
    host: APP,
    cookies: await authCookies(FOLLOWER),
  });
  check(
    "sledujúci ide preč (má vlastnú cenu)",
    followerPage.status === 307 || followerPage.status === 302,
    `status ${followerPage.status}`,
  );

  // Za federačného trénera platí organizácia faktúrou mimo appky — osobné
  // predplatné by znamenalo, že platí dvakrát za to isté.
  const orgPage = await request("/subscribe", {
    host: APP,
    cookies: await authCookies(ORG_COACH),
  });
  check(
    "federačný tréner ide preč (platí zaň organizácia)",
    orgPage.status === 307 || orgPage.status === 302,
    `status ${orgPage.status}`,
  );

  const anonPage = await request("/subscribe", { host: APP });
  check(
    "neprihlásený ide na prihlásenie",
    anonPage.status === 307 || anonPage.status === 302,
    `status ${anonPage.status}`,
  );

  section("3) Pruh ponúkne predplatné, až keď sa blíži koniec skúšobnej doby");
  const db = serviceClient();
  const { data: account } = await db
    .from("profiles")
    .select("id, subscription_status, trial_ends_at")
    .eq("email", NEW_COACH)
    .maybeSingle();

  if (!account) {
    check(`účet ${NEW_COACH} existuje (spusti seed.js)`, false);
  } else {
    const original = {
      subscription_status: account.subscription_status,
      trial_ends_at: account.trial_ends_at,
    };
    try {
      // Skúšobná doba na tri dni — pruh mlčí, kým ostáva viac než týždeň.
      await db
        .from("profiles")
        .update({
          subscription_status: "trial",
          trial_ends_at: new Date(Date.now() + 3 * 86_400_000).toISOString(),
        })
        .eq("id", account.id);

      const home = await request("/", {
        host: APP,
        cookies: await authCookies(NEW_COACH),
      });
      check(
        "pri troch dňoch je v pruhu odkaz na pokladňu",
        home.body.includes('href="/subscribe"'),
      );

      // Po skončení skúšobnej doby je pruh červený a odkaz tam musí ostať —
      // práve vtedy ho tréner potrebuje najviac.
      await db
        .from("profiles")
        .update({ trial_ends_at: new Date(Date.now() - 86_400_000).toISOString() })
        .eq("id", account.id);

      const expired = await request("/", {
        host: APP,
        cookies: await authCookies(NEW_COACH),
      });
      check(
        "po skončení skúšobnej doby odkaz ostáva",
        expired.body.includes('href="/subscribe"'),
      );
    } finally {
      await db.from("profiles").update(original).eq("id", account.id);
    }
  }

  section("4) Ceny v Stripe existujú a sedia na cent");
  for (const tier of COACH_TIERS) {
    for (const [interval, eur] of [
      ["month", tier.monthly],
      ["year", tier.yearly],
    ]) {
      const key = priceLookupKey(coachProductId(tier.players), interval);
      const found = await (
        await fetch(
          `https://api.stripe.com/v1/prices?lookup_keys[]=${key}&limit=1&active=true`,
          { headers: { Authorization: `Bearer ${secret}` } },
        )
      ).json();
      const price = found.data?.[0];
      check(
        `${key} = ${eur} €`,
        price?.unit_amount === Math.round(eur * 100) &&
          price?.currency === "eur" &&
          price?.recurring?.interval === interval,
        price ? `${price.unit_amount} ${price.currency}` : "cena neexistuje",
      );
    }
  }

  section("5) Pokladňa naozaj vznikne");
  // Server action sa cez holé HTTP zavolať nedá, takže sa volá tá istá
  // funkcia, ktorú používa — overuje sa spojenie so Stripe a suma na
  // pokladni, nie stráže nad ňou (tie overuje §2).
  const { createCheckoutSession, findPriceIdByLookupKey } = await import(
    pathToFileURL(path.join(ROOT, "lib", "stripe.ts")).href
  );
  process.env.STRIPE_SECRET_KEY = secret;

  const topTier = COACH_TIERS[COACH_TIERS.length - 1];
  const lookupKey = priceLookupKey(coachProductId(topTier.players), "year");
  const priceId = await findPriceIdByLookupKey(lookupKey);
  check(`cena ${lookupKey} sa nájde podľa lookup_key`, Boolean(priceId));

  const url = await createCheckoutSession({
    priceId,
    userId: "00000000-0000-0000-0000-000000000000",
    customerEmail: SOLO_COACH,
    successUrl: "http://localhost:3000/subscribe?paid=1",
    cancelUrl: "http://localhost:3000/subscribe",
  });
  check(
    "vznikla adresa pokladne na Stripe",
    typeof url === "string" && url.startsWith("https://checkout.stripe.com/"),
    url,
  );
}

main()
  .then(report)
  .catch((error) => {
    console.error("CHYBA:", error.message || error);
    process.exit(1);
  });
