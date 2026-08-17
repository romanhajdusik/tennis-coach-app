// Promo kódy — registrácia na pozvánku a prístup zadarmo.
//
// Ťažisko je v tom, čo sa NESMIE dať: prečítať si nepoužité kódy, minúť kód
// viac ráz, než dovoľuje, alebo si vymysleným kódom vypýtať prístup zadarmo.
// Kód uplatňuje trigger `handle_new_user`, takže sa všetko overuje cez reálnu
// registráciu (`auth.signUp`), nie cez priamy zápis do `profiles`.
const {
  serviceClient,
  anonClient,
  request,
  APP_HOST,
  ORG_HOST,
  createChecks,
} = require("./helpers");

const { check, section, report } = createChecks();
const db = serviceClient();

const PASSWORD = "PromoTest2026!";
const DAY = 86_400_000;

/** Účty a kódy, ktoré scenár vyrobí — v `finally` idú preč. */
const madeUsers = [];
const madeCodes = [];

async function addCode(code, fields) {
  const { error } = await db.from("promo_codes").insert({ code, ...fields });
  if (error) throw new Error(`${code}: ${error.message}`);
  madeCodes.push(code);
}

async function codeRow(code) {
  const { data } = await db
    .from("promo_codes")
    .select("id, used_count, max_uses")
    .eq("code", code)
    .single();
  return data;
}

/** Registrácia presne tak, ako ju robí appka — cez verejný anon kľúč. */
async function signUp(email, { promo = null, role = "coach" } = {}) {
  const { data, error } = await anonClient().auth.signUp({
    email,
    password: PASSWORD,
    options: { data: { full_name: "Promo Test", role, promo_code: promo } },
  });
  if (error) throw new Error(`${email}: ${error.message}`);
  madeUsers.push(data.user.id);
  return data.user.id;
}

async function profileOf(userId) {
  const { data } = await db
    .from("profiles")
    .select("subscription_status, trial_ends_at, player_limit")
    .eq("id", userId)
    .single();
  return data;
}

/** Koľko dní zadarmo profil dostal (zaokrúhlene na celé dni). */
function freeDays(profile) {
  return Math.round(
    (new Date(profile.trial_ends_at).getTime() - Date.now()) / DAY,
  );
}

async function main() {
  const stamp = Date.now();
  const YEAR = `TESTYEAR${stamp}`;
  const FOREVER = `TESTLIFE${stamp}`;
  const BULK = `TESTBULK${stamp}`;
  const EXPIRED = `TESTOLD${stamp}`;

  await addCode(YEAR, { free_days: 365, player_limit: 3, max_uses: 5 });
  await addCode(FOREVER, { free_days: null, player_limit: 2, max_uses: 5 });
  await addCode(BULK, { free_days: 365, max_uses: 2 });
  await addCode(EXPIRED, {
    free_days: 365,
    max_uses: 5,
    expires_at: new Date(Date.now() - DAY).toISOString(),
  });

  try {
    section("1) Kódy nesmie nikto vidieť ani meniť");
    const anon = anonClient();
    const { data: anonRead, error: anonError } = await anon
      .from("promo_codes")
      .select("code");
    check(
      "neprihlásený si kódy neprečíta",
      !!anonError || (anonRead ?? []).length === 0,
      JSON.stringify(anonRead),
    );

    const { error: anonWrite } = await anon
      .from("promo_codes")
      .update({ used_count: 0 })
      .eq("code", BULK);
    check("ani ich nezresetuje", !!anonWrite, "update prešiel");

    const { data: redemptions, error: redError } = await anon
      .from("promo_code_redemptions")
      .select("user_id");
    check(
      "zoznam uplatnení je tiež neviditeľný",
      !!redError || (redemptions ?? []).length === 0,
    );

    section("2) Overenie kódu pred registráciou");
    const { data: okValid } = await anon.rpc("promo_code_is_valid", {
      p_code: YEAR,
    });
    check("platný kód prejde", okValid === true, String(okValid));

    const { data: lowerValid } = await anon.rpc("promo_code_is_valid", {
      p_code: `  ${YEAR.toLowerCase()} `,
    });
    check(
      "malé písmená a medzery nevadia",
      lowerValid === true,
      String(lowerValid),
    );

    const { data: madeUp } = await anon.rpc("promo_code_is_valid", {
      p_code: "TAKYNEEXISTUJE",
    });
    check("vymyslený kód neprejde", madeUp === false, String(madeUp));

    const { data: expired } = await anon.rpc("promo_code_is_valid", {
      p_code: EXPIRED,
    });
    check("kód po platnosti neprejde", expired === false, String(expired));

    section("3) Rok zadarmo");
    const yearUser = await signUp(`promo-year-${stamp}@test.local`, {
      promo: YEAR,
    });
    const yearProfile = await profileOf(yearUser);
    check(
      "účet má skúšobnú dobu na rok",
      yearProfile.subscription_status === "trial" &&
        Math.abs(freeDays(yearProfile) - 365) <= 1,
      `${yearProfile.subscription_status}, ${freeDays(yearProfile)} dní`,
    );
    check(
      "a hráčov podľa kódu",
      yearProfile.player_limit === 3,
      String(yearProfile.player_limit),
    );
    check("kód sa započítal", (await codeRow(YEAR)).used_count === 1);

    section("4) Doživotne zadarmo");
    const lifeUser = await signUp(`promo-life-${stamp}@test.local`, {
      promo: FOREVER,
    });
    const lifeProfile = await profileOf(lifeUser);
    check(
      "účet je complimentary, teda bez konca",
      lifeProfile.subscription_status === "complimentary",
      lifeProfile.subscription_status,
    );

    section("5) Bez kódu ostáva všetko po starom");
    const plainUser = await signUp(`promo-none-${stamp}@test.local`);
    const plainProfile = await profileOf(plainUser);
    check(
      "14 dní a jeden hráč",
      plainProfile.subscription_status === "trial" &&
        Math.abs(freeDays(plainProfile) - 14) <= 1 &&
        plainProfile.player_limit === 1,
      `${freeDays(plainProfile)} dní, limit ${plainProfile.player_limit}`,
    );

    section("6) Vymyslený kód v metadátach nedá NIČ");
    // Metadáta si píše prehliadač, takže sem si ktokoľvek napíše, čo chce.
    // Rozhoduje výhradne tabuľka.
    const fakeUser = await signUp(`promo-fake-${stamp}@test.local`, {
      promo: "TAKYNEEXISTUJE",
    });
    const fakeProfile = await profileOf(fakeUser);
    check(
      "dostane obyčajných 14 dní",
      fakeProfile.subscription_status === "trial" &&
        Math.abs(freeDays(fakeProfile) - 14) <= 1 &&
        fakeProfile.player_limit === 1,
      `${fakeProfile.subscription_status}, ${freeDays(fakeProfile)} dní`,
    );

    section("7) Hromadný kód sa vyčerpá a viac nepustí");
    await signUp(`promo-bulk1-${stamp}@test.local`, { promo: BULK });
    await signUp(`promo-bulk2-${stamp}@test.local`, { promo: BULK });
    const exhausted = await codeRow(BULK);
    check(
      "dve použitia z dvoch sú minuté",
      exhausted.used_count === 2 && exhausted.max_uses === 2,
      `${exhausted.used_count}/${exhausted.max_uses}`,
    );

    const { data: stillValid } = await anon.rpc("promo_code_is_valid", {
      p_code: BULK,
    });
    check("vyčerpaný kód už neplatí", stillValid === false, String(stillValid));

    const thirdUser = await signUp(`promo-bulk3-${stamp}@test.local`, {
      promo: BULK,
    });
    const thirdProfile = await profileOf(thirdUser);
    check(
      "tretí človek s tým istým kódom rok zadarmo nedostane",
      Math.abs(freeDays(thirdProfile) - 14) <= 1,
      `${freeDays(thirdProfile)} dní`,
    );
    check(
      "a počítadlo nepreliezlo limit",
      (await codeRow(BULK)).used_count === 2,
    );

    section("8) Kód sa míňa len trénerovi");
    const beforeParent = (await codeRow(YEAR)).used_count;
    await signUp(`promo-parent-${stamp}@test.local`, {
      promo: YEAR,
      role: "parent",
    });
    check(
      "registrácia rodiča kód nezožerie",
      (await codeRow(YEAR)).used_count === beforeParent,
      `${beforeParent} → ${(await codeRow(YEAR)).used_count}`,
    );

    section("9) Formulár registrácie");
    const page = await request("/register", { host: APP_HOST });
    check(
      "pýta si pozývací kód",
      /name="promo_code"/.test(page.body),
      `status ${page.status}`,
    );

    // Do federácie sa vstupuje kódom od šéftrénera, nie samoobsluhou —
    // inak by si tam človek vyrobil samostatného trénera bez členstva.
    const orgPage = await request("/register", { host: ORG_HOST });
    check(
      "na subdoméne organizácie vedie registrácia na /join",
      orgPage.status === 307 && /\/join$/.test(orgPage.headers.location ?? ""),
      `${orgPage.status} ${orgPage.headers.location}`,
    );
  } finally {
    for (const id of madeUsers) {
      await db.auth.admin.deleteUser(id);
    }
    for (const code of madeCodes) {
      await db.from("promo_codes").delete().eq("code", code);
    }
  }
}

main()
  .then(report)
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
