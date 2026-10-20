// FAKTURAČNÉ ÚDAJE — firma, adresa, IČO a DIČ na faktúre (migrácia
// `20261020090000_billing_details.sql`).
//
// Čo sa overuje a prečo práve to:
//
// 1. **Každý vidí a mení len svoj riadok.** Sú to údaje o firme zákazníka;
//    cudzí účet ich nesmie prečítať ani prepísať a neprihlásený už vôbec.
//    DELETE nemá nikto (prázdne políčka = vymazanie, riadok zanikne s účtom).
// 2. **Do Stripe idú ako `custom_fields`, v pevnom poradí a bez prázdnych.**
//    Meno a adresu zákazníka pokladňa Managed Payments prepíše (overené
//    testovacou platbou 2026-10-20), `custom_fields` prežijú — keby sa
//    rozbilo toto, firma z faktúry ticho zmizne.
//
// Nepotrebuje dev server. Časť 2 potrebuje TESTOVACÍ `STRIPE_SECRET_KEY`
// v `.env.local`; bez neho sa preskočí, pri ostrom sa sada odmietne spustiť.
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const {
  serviceClient,
  anonClient,
  signIn,
  createChecks,
} = require("./helpers");

const { check, section, report } = createChecks();

const OWNER = "demo@plaw.win";
const OTHER = "parent-test@test.local";
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

async function userId(db, email) {
  const { data, error } = await db
    .from("profiles")
    .select("id")
    .eq("email", email)
    .single();
  if (error) throw new Error(`${email}: ${error.message}`);
  return data.id;
}

async function rls() {
  section("1) Každý vidí a mení len svoj riadok");
  const db = serviceClient();
  const ownerId = await userId(db, OWNER);
  const otherId = await userId(db, OTHER);
  await db.from("billing_details").delete().in("user_id", [ownerId, otherId]);

  const owner = await signIn(OWNER);
  const other = await signIn(OTHER);

  const insert = await owner.from("billing_details").upsert({
    user_id: ownerId,
    company: "Test Klub s.r.o.",
    company_id: "12345678",
  });
  check("vlastník si údaje uloží", !insert.error, insert.error?.message);

  const update = await owner
    .from("billing_details")
    .upsert({ user_id: ownerId, company: "Test Klub s.r.o.", tax_id: "2023456789" });
  check("vlastník ich prepíše", !update.error, update.error?.message);

  const own = await owner.from("billing_details").select("company, tax_id");
  check(
    "vlastník vidí svoj riadok",
    own.data?.length === 1 && own.data[0].tax_id === "2023456789",
    JSON.stringify(own.data),
  );

  const foreignRead = await other.from("billing_details").select("user_id");
  check(
    "cudzí účet riadok nevidí",
    !foreignRead.data?.some((row) => row.user_id === ownerId),
    JSON.stringify(foreignRead.data),
  );

  const foreignInsert = await other
    .from("billing_details")
    .insert({ user_id: ownerId, company: "Podvrh" });
  check("cudzí účet nezaloží riadok na cudzie meno", Boolean(foreignInsert.error));

  const foreignUpdate = await other
    .from("billing_details")
    .update({ company: "Podvrh" })
    .eq("user_id", ownerId)
    .select("user_id");
  check(
    "cudzí účet cudzí riadok neprepíše",
    !foreignUpdate.data?.length,
    JSON.stringify(foreignUpdate.data),
  );

  const steal = await owner
    .from("billing_details")
    .update({ user_id: otherId })
    .eq("user_id", ownerId)
    .select("user_id");
  check("vlastník riadok neprepíše na cudzí účet", Boolean(steal.error) || !steal.data?.length);

  const remove = await owner.from("billing_details").delete().eq("user_id", ownerId);
  check("DELETE nemá nikto z appky", Boolean(remove.error), "zmazanie prešlo");

  const anon = anonClient();
  const anonRead = await anon.from("billing_details").select("user_id");
  check(
    "neprihlásený nevidí nič",
    Boolean(anonRead.error) || !anonRead.data?.length,
    JSON.stringify(anonRead.data),
  );
  const anonInsert = await anon
    .from("billing_details")
    .insert({ user_id: ownerId, company: "Podvrh" });
  check("neprihlásený nezapíše nič", Boolean(anonInsert.error));

  const after = await db
    .from("billing_details")
    .select("company")
    .eq("user_id", ownerId)
    .single();
  check(
    "riadok vlastníka ostal nedotknutý",
    after.data?.company === "Test Klub s.r.o.",
    JSON.stringify(after.data),
  );

  const tooLong = await owner
    .from("billing_details")
    .upsert({ user_id: ownerId, company: "x".repeat(141) });
  check("hodnotu nad 140 znakov databáza odmietne", Boolean(tooLong.error));

  await db.from("billing_details").delete().in("user_id", [ownerId, otherId]);
}

async function stripe() {
  section("2) Do Stripe idú ako custom_fields");
  const secret = envValue("STRIPE_SECRET_KEY");
  if (!secret) {
    console.log("  -- STRIPE_SECRET_KEY nie je v .env.local, časť preskočená");
    return;
  }
  if (secret.includes("_live_")) {
    throw new Error("OSTRÝ kľúč — sada zakladá zákazníkov, spúšťaj ju len testovacím.");
  }
  process.env.STRIPE_SECRET_KEY = secret;

  const {
    billingCustomFields,
    createCustomerWithBillingDetails,
    updateCustomerBillingDetails,
  } = await import(pathToFileURL(path.join(ROOT, "lib", "stripe.ts")).href);

  const full = {
    company: "Test Klub s.r.o.",
    address: "Hlavná 1, 811 01 Bratislava",
    companyId: "12345678",
    taxId: "2023456789",
  };

  const params = billingCustomFields({ ...full, address: null });
  check(
    "prázdne políčko sa vynechá a poradie sa posunie",
    params["invoice_settings[custom_fields][1][name]"] === "Company ID" &&
      !("invoice_settings[custom_fields][3][name]" in params),
    JSON.stringify(params),
  );
  check(
    "bez údajov sa riadky v Stripe zmažú",
    billingCustomFields(null)["invoice_settings[custom_fields]"] === "",
  );

  async function fields(customerId) {
    const response = await fetch(`https://api.stripe.com/v1/customers/${customerId}`, {
      headers: { Authorization: `Bearer ${secret}` },
    });
    const customer = await response.json();
    return (customer.invoice_settings?.custom_fields ?? []).map(
      (row) => `${row.name}=${row.value}`,
    );
  }

  const customerId = await createCustomerWithBillingDetails({
    email: "plaw-billing-test@example.com",
    userId: "00000000-0000-0000-0000-000000000000",
    details: full,
  });
  try {
    check(
      "nový zákazník má štyri riadky v pevnom poradí",
      JSON.stringify(await fields(customerId)) ===
        JSON.stringify([
          "Company=Test Klub s.r.o.",
          "Address=Hlavná 1, 811 01 Bratislava",
          "Company ID=12345678",
          "Tax ID=2023456789",
        ]),
      JSON.stringify(await fields(customerId)),
    );

    await updateCustomerBillingDetails(customerId, {
      company: "Iná firma",
      address: null,
      companyId: null,
      taxId: null,
    });
    check(
      "úprava riadky prepíše, nepridá",
      JSON.stringify(await fields(customerId)) === JSON.stringify(["Company=Iná firma"]),
      JSON.stringify(await fields(customerId)),
    );

    await updateCustomerBillingDetails(customerId, null);
    check("vymazanie údajov riadky v Stripe zmaže", (await fields(customerId)).length === 0);
  } finally {
    await fetch(`https://api.stripe.com/v1/customers/${customerId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${secret}` },
    });
  }
}

async function main() {
  await rls();
  await stripe();
}

main()
  .then(report)
  .catch((error) => {
    console.error("CHYBA:", error.message || error);
    process.exit(1);
  });
