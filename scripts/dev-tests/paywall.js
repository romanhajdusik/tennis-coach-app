// Skúšobná doba a paywall — stavy predplatného a to, čo v nich účet smie.
//
// Zápis (že server odmietne uloženie) overuje klikacia sada `browser-coach.js`,
// sekcia „Paywall" — server action sa cez holé HTTP zavolať nedá.
const {
  serviceClient,
  signIn,
  authCookies,
  request,
  textOf,
  APP_HOST,
  ORG_HOST,
  createChecks,
} = require("./helpers");

const { check, section, report } = createChecks();
const db = serviceClient();

const COACH = "demo@plaw.win"; // samostatný (1:1) tréner
const ORG_COACH = "coach-today@test.local"; // federačný tréner
const DAY = 86_400_000;

/** Nastaví stav predplatného cez service_role — obchádza RLS, to je zámer. */
async function setSubscription(userId, status, trialEndsAt) {
  const { error } = await db
    .from("profiles")
    .update({ subscription_status: status, trial_ends_at: trialEndsAt })
    .eq("id", userId);
  if (error) throw new Error(error.message);
}

async function snapshot(userId) {
  const { data } = await db
    .from("profiles")
    .select("subscription_status, trial_ends_at")
    .eq("id", userId)
    .single();
  return data;
}

async function main() {
  const { data: users } = await db.auth.admin.listUsers({ perPage: 1000 });
  const coach = users.users.find((u) => u.email === COACH);
  const orgCoach = users.users.find((u) => u.email === ORG_COACH);

  const coachBefore = await snapshot(coach.id);
  const orgBefore = await snapshot(orgCoach.id);

  const future = new Date(Date.now() + 10 * DAY).toISOString();
  const soon = new Date(Date.now() + 3 * DAY).toISOString();
  const past = new Date(Date.now() - DAY).toISOString();

  try {
    section("1) Beží skúšobná doba");
    await setSubscription(coach.id, "trial", future);
    let cookies = await authCookies(COACH);
    let home = await request("/", { host: APP_HOST, cookies });
    check("appka funguje", home.status === 200);
    check(
      "pri 10 dňoch pruh zbytočne neotravuje",
      !/free trial/i.test(textOf(home.body)),
    );

    await setSubscription(coach.id, "trial", soon);
    home = await request("/", { host: APP_HOST, cookies });
    check(
      "pri 3 dňoch pruh upozorní",
      /3 days left of your free trial/i.test(textOf(home.body)),
      textOf(home.body).slice(0, 140),
    );

    section("2) Skúšobná doba uplynula — čítanie ostáva");
    await setSubscription(coach.id, "trial", past);
    cookies = await authCookies(COACH);
    home = await request("/", { host: APP_HOST, cookies });
    check("tréner sa do appky dostane", home.status === 200);
    check(
      "pruh oznámi koniec skúšobnej doby",
      /free trial has ended/i.test(textOf(home.body)),
    );
    for (const path of ["/players", "/sessions", "/calendar", "/analytics/Forehand"]) {
      const page = await request(path, { host: APP_HOST, cookies });
      check(`${path} sa stále číta`, page.status === 200, "status " + page.status);
    }

    section("3) Zaplatené alebo prístup od nás");
    await setSubscription(coach.id, "complimentary", past);
    cookies = await authCookies(COACH);
    home = await request("/", { host: APP_HOST, cookies });
    check(
      "complimentary prebije uplynutý trial a pruh mlčí",
      !/free trial/i.test(textOf(home.body)),
    );

    section("4) Federačného trénera sa paywall netýka");
    await setSubscription(orgCoach.id, "trial", past);
    const orgCookies = await authCookies(ORG_COACH);
    const orgHome = await request("/", { host: ORG_HOST, cookies: orgCookies });
    check("dostane sa do appky", orgHome.status === 200);
    check(
      "žiadny pruh — platí faktúra organizácie",
      !/free trial/i.test(textOf(orgHome.body)),
      textOf(orgHome.body).slice(0, 140),
    );

    section("5) Účet si predplatné neprepíše sám");
    await setSubscription(coach.id, "trial", past);
    const asCoach = await signIn(COACH);
    const hack = await asCoach
      .from("profiles")
      .update({ subscription_status: "active" })
      .eq("id", coach.id)
      .select("id");
    check(
      "priamy zápis do profiles neprejde",
      hack.error !== null || (hack.data ?? []).length === 0,
      hack.error?.code ?? "PRESLO!",
    );
    check(
      "v DB ostal pôvodný stav",
      (await snapshot(coach.id)).subscription_status === "trial",
    );
  } finally {
    // Bez obnovenia by ostatné sady narazili na paywall.
    await setSubscription(
      coach.id,
      coachBefore.subscription_status,
      coachBefore.trial_ends_at,
    );
    await setSubscription(
      orgCoach.id,
      orgBefore.subscription_status,
      orgBefore.trial_ends_at,
    );
  }

  report();
}

main().catch((error) => {
  console.error("CHYBA:", error.message || error);
  process.exit(1);
});
