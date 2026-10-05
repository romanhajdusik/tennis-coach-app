// Scenáre NOVÉHO ŠPORTU NA KURTE (padel, bedminton, pickleball — docs §1.1,
// krok 3). Každý je samostatné nasadenie toho istého kódu, takže potrebuje
// vlastný dev server s tou premennou (Next 16 nespustí dva v jednom priečinku —
// tenisový treba zastaviť):
//
//   NEXT_PUBLIC_PLAW_DISCIPLINE=padel PORT=3001 npm run dev
//   DEV_PORT=3001 SPORT=padel node scripts/dev-tests/court-sports.js
//
// Overuje presne to, čím sa nový šport líši: vlastné (zatiaľ dočasné)
// zamerania, charakter cvičenia ÁNO, odhad úderov NIE, stĺpcový generálny
// graf, jeden šport = jeden účet a databázovú kontrolu dvojice (disciplína,
// zameranie) — rovnaký názov zamerania smie mať viac športov naraz.
const {
  APP_HOST,
  authCookies,
  request,
  textOf,
  serviceClient,
  createChecks,
  ensureCourtCoach,
} = require("./helpers");

const { check, section, report } = createChecks();

const SPORT = process.env.SPORT ?? "padel";
const SPORT_LABEL = SPORT[0].toUpperCase() + SPORT.slice(1);
const FOCUS = Array.from({ length: 9 }, (_, index) => `FOCUS ${index + 1}`);
const TENNIS_CATEGORIES = ["Forehand", "Backhand", "Volley", "Serve", "POINTS"];

async function main() {
  section(`0) Beží dev server v režime ${SPORT}?`);
  const probe = await request("/login", { host: APP_HOST });
  if (probe.status !== 200) {
    console.error(
      `\n  Dev server na tomto porte neodpovedá (status ${probe.status}).` +
        `\n  Spusti: NEXT_PUBLIC_PLAW_DISCIPLINE=${SPORT} PORT=3001 npm run dev` +
        `\n  a sadu potom: DEV_PORT=3001 SPORT=${SPORT} node scripts/dev-tests/court-sports.js\n`,
    );
    process.exit(1);
  }
  check("prihlasovacia stránka odpovedá", probe.status === 200);
  check(
    `na <html> je data-app="${SPORT}"`,
    new RegExp(`<html[^>]*data-app="${SPORT}"`).test(probe.body),
    (probe.body.match(/<html[^>]*>/) ?? [""])[0],
  );

  const db = serviceClient();
  const { coach, player, email } = await ensureCourtCoach(db, SPORT);

  section("1) Tenisový účet sa sem nedostane (jeden šport = jeden účet)");
  const tennisCookies = await authCookies("demo@plaw.win");
  const foreign = await request("/", { host: APP_HOST, cookies: tennisCookies });
  check(
    "tenisový účet presmeruje na prihlásenie s odkazom na tenis",
    foreign.status === 307 &&
      /\/login\?account=tennis$/.test(foreign.headers.location ?? ""),
    `${foreign.status} ${foreign.headers.location ?? ""}`,
  );

  const cookies = await authCookies(email);

  section("2) Kódy cvičení = 9 dočasných zameraní športu");
  const codes = await request("/drill-codes", { host: APP_HOST, cookies });
  const codesText = textOf(codes.body);
  check("stránka sa načíta", codes.status === 200, "status " + codes.status);
  check("všetkých 9 zameraní", FOCUS.every((name) => codesText.includes(name)));
  check(
    "tenisové zamerania sa NEponúkajú",
    TENNIS_CATEGORIES.every((name) => !codesText.includes(name)),
  );

  section("3) Analytika: vlastné zamerania, bez odhadu úderov");
  const analytics = await request(`/analytics/${encodeURIComponent("FOCUS 1")}`, {
    host: APP_HOST,
    cookies,
  });
  check("zameranie FOCUS 1 sa otvorí", analytics.status === 200, "status " + analytics.status);
  check(
    "o úderoch analytika mlčí (strokes: null)",
    !/strokes/i.test(textOf(analytics.body)),
  );
  const tennisAnalytics = await request("/analytics/Forehand", { host: APP_HOST, cookies });
  check("tenisové zameranie vráti 404", tennisAnalytics.status === 404, "status " + tennisAnalytics.status);

  section("4) Formulár cvičenia: s charakterom (rozhodol user)");
  const { data: session } = await db
    .from("sessions")
    .insert({
      coach_id: coach.id,
      player_id: player.id,
      status: "planned",
      discipline: SPORT,
      planned_data: {
        date: new Date(Date.now() + 86400000).toISOString(),
        duration_minutes: 60,
      },
    })
    .select("id")
    .single();
  check("naplánovaný tréning sa uložil so športom", !!session);
  if (session) {
    const detail = await request(`/sessions/${session.id}`, { host: APP_HOST, cookies });
    const detailText = textOf(detail.body);
    check("tréning sa načíta", detail.status === 200, "status " + detail.status);
    check("charakter cvičenia sa ponúka", /Offensive/.test(detailText) && /Defensive/.test(detailText));
    check(
      "zamerania vo formulári sú športu",
      detailText.includes("FOCUS 1") && !detailText.includes("Backhand"),
    );
    await db.from("sessions").delete().eq("id", session.id);
  }

  section("5) Prepojenie kariet: šport na kurte kód ZADÁVA");
  const players = textOf((await request("/players", { host: APP_HOST, cookies })).body);
  check(
    "pole na zadanie kódu od kondičného trénera",
    /Enter the code you got/i.test(players),
    players.slice(0, 200),
  );

  section("6) Databáza: zameranie sa overuje v dvojici so športom");
  // Rovnaký názov zamerania smie mať viac športov (padel aj bedminton majú
  // `FOCUS 1`), ale len ten, ktorého katalóg ho pozná.
  const own = await db
    .from("drill_codes")
    .insert({ coach_id: coach.id, discipline: SPORT, category: "FOCUS 1", slot: 20, code: "CS-TEST" })
    .select("id");
  check("kód vlastného zamerania sa uloží", !own.error, own.error?.message);
  const tennisFocus = await db
    .from("drill_codes")
    .insert({ coach_id: coach.id, discipline: "tennis", category: "FOCUS 1", slot: 19, code: "CS-TEST" })
    .select("id");
  check("tenis so zameraním FOCUS 1 DB odmietne", tennisFocus.error !== null);
  const sportForehand = await db
    .from("drill_codes")
    .insert({ coach_id: coach.id, discipline: SPORT, category: "Forehand", slot: 18, code: "CS-TEST" })
    .select("id");
  check(`${SPORT} s tenisovým zameraním DB odmietne`, sportForehand.error !== null);
  await db.from("drill_codes").delete().eq("code", "CS-TEST");

  section("7) Registrácia zapíše šport nasadenia");
  const { data: created, error: createError } = await db.auth.admin.createUser({
    email: `reg-${SPORT}@test.local`,
    password: "TestPlaw2026!",
    email_confirm: true,
    user_metadata: { full_name: "X", role: "coach", discipline: SPORT },
  });
  if (createError) {
    check("testovací účet sa založil", false, createError.message);
  } else {
    const { data: profile } = await db
      .from("profiles")
      .select("discipline")
      .eq("id", created.user.id)
      .single();
    check(`nový účet patrí športu ${SPORT_LABEL}`, profile?.discipline === SPORT, JSON.stringify(profile));
    await db.auth.admin.deleteUser(created.user.id);
  }
}

main()
  .then(report)
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
