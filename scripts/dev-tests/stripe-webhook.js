// STRIPE WEBHOOK — bezpečnostná hranica platby.
//
// Webhook je jediná verejná adresa v celej appke, ktorá **bez prihlásenia
// zapisuje do databázy**, a robí to `service_role` kľúčom, ktorý obchádza RLS.
// Jediné, čo medzi útočníkom a cudzím účtom stojí, je podpis od Stripe —
// preto ho táto sada skúša nielen správne, ale hlavne NESPRÁVNE.
//
// Čo sa overuje a prečo práve to:
//
// 1. **Bez podpisu, so zlým podpisom, so starou pečiatkou a s prepísaným telom
//    = 400.** Keby prešlo čokoľvek z toho, ktokoľvek si nastaví „zaplatené"
//    jedným `curl`om.
// 2. **Správne podpísaná platba nastaví stav aj hladinu hráčov.** To je celý
//    zmysel webhooku — bez neho zákazník zaplatí a v appke sa nič nestane.
// 3. **Zrušenie hladinu NEZNÍŽI.** Nulová hladina by účet dostala do stavu
//    „prekročená" a po opätovnom zaplatení by mu appka kázala archivovať deti.
// 4. **Cudzie a neúplné udalosti neurobia nič**, ale vrátia 200 — čokoľvek iné
//    si Stripe vyloží ako chybu a bude to skúšať znova dokola.
//
// Stripe CLI NETREBA: udalosti si podpisujeme sami tým istým tajomstvom, aké
// má appka v `.env.local`. Skutočnú platbu tým neoveríme, bránu áno.
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { request, serviceClient, createChecks } = require("./helpers");

const { check, section, report } = createChecks();

const APP = "plaw.win";
const HOOK = "/api/stripe/webhook";
const COACH = "coach-new@test.local";
const ROOT = path.join(__dirname, "..", "..");

function envValue(name) {
  const file = path.join(ROOT, ".env.local");
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = new RegExp(`^${name}=(.*)$`).exec(line.trim());
    if (match) return match[1].trim();
  }
  return undefined;
}

const SECRET = envValue("STRIPE_WEBHOOK_SECRET");

/** Podpis presne tak, ako ho skladá Stripe: `t=…,v1=hmac(t + "." + telo)`. */
function sign(payload, secret, timestamp = Math.floor(Date.now() / 1000)) {
  const mac = crypto
    .createHmac("sha256", secret)
    .update(`${timestamp}.${payload}`)
    .digest("hex");
  return `t=${timestamp},v1=${mac}`;
}

function post(payload, signature) {
  return request(HOOK, {
    host: APP,
    method: "POST",
    body: payload,
    headers: signature ? { "stripe-signature": signature } : {},
  });
}

function event(type, object) {
  return JSON.stringify({
    id: `evt_test_${crypto.randomUUID()}`,
    type,
    data: { object },
  });
}

async function main() {
  if (!SECRET) {
    console.error("\n  STRIPE_WEBHOOK_SECRET nie je v .env.local.\n");
    process.exit(1);
  }

  section("0) Beží dev server?");
  const probe = await request("/login", { host: APP });
  if (probe.status !== 200) {
    console.error(`\n  Dev server neodpovedá (status ${probe.status}).\n`);
    process.exit(1);
  }
  check("appka odpovedá", probe.status === 200);

  const db = serviceClient();
  const { data: account } = await db
    .from("profiles")
    .select("id, subscription_status, trial_ends_at, player_limit")
    .eq("email", COACH)
    .maybeSingle();

  if (!account) {
    check(`účet ${COACH} existuje (spusti seed.js)`, false);
    return;
  }

  const original = {
    subscription_status: account.subscription_status,
    trial_ends_at: account.trial_ends_at,
    player_limit: account.player_limit,
  };

  const paid = event("checkout.session.completed", {
    id: "cs_test_fake",
    payment_status: "paid",
    client_reference_id: account.id,
    metadata: {
      plaw_user_id: account.id,
      plaw_role: "coach",
      plaw_player_limit: "6",
    },
  });

  async function profile() {
    const { data } = await db
      .from("profiles")
      .select("subscription_status, player_limit")
      .eq("id", account.id)
      .maybeSingle();
    return data;
  }

  try {
    section("1) Bez platného podpisu sa nezapíše NIČ");
    await db
      .from("profiles")
      .update({ subscription_status: "trial", player_limit: 1 })
      .eq("id", account.id);

    const noSig = await post(paid, null);
    check("bez hlavičky s podpisom → 400", noSig.status === 400, `status ${noSig.status}`);

    const wrong = await post(paid, sign(paid, "whsec_uplne_ine_tajomstvo"));
    check("so zlým podpisom → 400", wrong.status === 400, `status ${wrong.status}`);

    // Podpis je správny, ale pečiatka je spred hodiny — takto vyzerá
    // zopakovanie odchytenej správy.
    const stale = sign(paid, SECRET, Math.floor(Date.now() / 1000) - 3600);
    const replay = await post(paid, stale);
    check("so starou pečiatkou → 400", replay.status === 400, `status ${replay.status}`);

    // Podpis sedí na PÔVODNÉ telo, ale telo je iné — takto vyzerá pokus
    // prepísať si v už podpísanej správe hladinu alebo cudzie id.
    const tampered = paid.replace('"plaw_player_limit":"6"', '"plaw_player_limit":"12"');
    const changed = await post(tampered, sign(paid, SECRET));
    check("s prepísaným telom → 400", changed.status === 400, `status ${changed.status}`);

    const after = await profile();
    check(
      "po štyroch pokusoch je účet stále neplatiaci",
      after.subscription_status === "trial" && after.player_limit === 1,
      `${after.subscription_status}, limit ${after.player_limit}`,
    );

    section("2) Správne podpísaná platba nastaví stav aj hladinu");
    const ok = await post(paid, sign(paid, SECRET));
    check("→ 200", ok.status === 200, `status ${ok.status}`);
    const activated = await profile();
    check(
      "stav je active",
      activated.subscription_status === "active",
      activated.subscription_status,
    );
    check("hladina je 6 hráčov", activated.player_limit === 6, String(activated.player_limit));

    section("3) Zmena plánu prepíše hladinu podľa CENY, zrušenie ju NEZNÍŽI");
    // Takto vyzerá skutočná zmena plánu v portáli: metadáta predplatného
    // ostanú z pokladne (6), vymení sa len cena. Do 2026-10-03 tu test
    // posielal metadáta s novou hladinou — to Stripe nerobí, takže test
    // prechádzal, hoci appka nechávala trénerovi starú hladinu.
    const withPrice = (lookupKey) => ({
      id: "sub_test_fake",
      status: "active",
      metadata: { plaw_user_id: account.id, plaw_role: "coach", plaw_player_limit: "6" },
      items: { data: [{ price: { id: "price_test_fake", lookup_key: lookupKey } }] },
    });
    const upgraded = event("customer.subscription.updated", withPrice("plaw_coach_12_monthly"));
    await post(upgraded, sign(upgraded, SECRET));
    check(
      "prechod na 12 (metadáta stále hovoria 6) → hladina 12",
      (await profile()).player_limit === 12,
    );

    const downgraded = event("customer.subscription.updated", withPrice("plaw_fitness_coach_3_yearly"));
    await post(downgraded, sign(downgraded, SECRET));
    check(
      "prechod na kondičnú 3 → hladina 3",
      (await profile()).player_limit === 3,
    );

    // Cena, ktorú nepoznáme, hladinu nezmení na nezmysel — platí záloha
    // z metadát.
    const unknown = event("customer.subscription.updated", withPrice("niekto_iny_price"));
    await post(unknown, sign(unknown, SECRET));
    check(
      "neznáma cena → záloha z metadát (6)",
      (await profile()).player_limit === 6,
    );

    const upgradedAgain = event("customer.subscription.updated", withPrice("plaw_coach_12_yearly"));
    await post(upgradedAgain, sign(upgradedAgain, SECRET));

    const canceled = event("customer.subscription.deleted", {
      id: "sub_test_fake",
      status: "canceled",
      metadata: { plaw_user_id: account.id, plaw_role: "coach", plaw_player_limit: "12" },
    });
    await post(canceled, sign(canceled, SECRET));
    const ended = await profile();
    check("stav je canceled", ended.subscription_status === "canceled", ended.subscription_status);
    check("hladina ostala 12, nespadla na nulu", ended.player_limit === 12, String(ended.player_limit));

    section("4) Udalosti, ktorým nerozumieme, nič nepokazia");
    const foreign = event("invoice.created", { id: "in_test_fake" });
    const ignored = await post(foreign, sign(foreign, SECRET));
    check("cudzia udalosť → 200 (inak by ju Stripe posielal dokola)", ignored.status === 200);

    // Udalosť bez nášho id — napríklad platba založená mimo appky.
    const orphan = event("checkout.session.completed", {
      id: "cs_test_orphan",
      payment_status: "paid",
      metadata: {},
    });
    const orphanRes = await post(orphan, sign(orphan, SECRET));
    check("platba bez nášho id → 200 a nič sa nezapíše", orphanRes.status === 200);

    const unchanged = await profile();
    check(
      "účet sa tým nezmenil",
      unchanged.subscription_status === "canceled" && unchanged.player_limit === 12,
    );
  } finally {
    await db.from("profiles").update(original).eq("id", account.id);
  }
}

main()
  .then(report)
  .catch((error) => {
    console.error("CHYBA:", error.message || error);
    process.exit(1);
  });
