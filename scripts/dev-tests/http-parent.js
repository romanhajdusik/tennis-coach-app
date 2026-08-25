// HTTP scenáre RODIČOVSKEJ vrstvy (sledujúci = rodič, manažér alebo hráč).
//
// Vznikla so súhrnom druhej disciplíny (migrácia `20260824100000`, docs §2.3b),
// lebo dovtedy nevykresľovala rodičovskú stránku ani jedna sada — a je to
// jediné miesto v celej tej vrstve, ktoré nečíta kópie, ale živý agregát.
//
// Čo sa overuje a prečo práve to:
//
// 1. **Bez súhlasu vlastníka dát tam blok nesmie byť.** Súhlas s tenisovým
//    kolegom nie je súhlas s rodičom — sú to dva nezávislé príznaky.
// 2. **So súhlasom sú v ňom SÚČTY a nič viac.** Kódy cvičení sú trénerovo
//    know-how; keby sa objavili tu, celý zmysel užšieho rozsahu padá.
// 3. **Cudzie minúty ostávajú POD čiarou.** Keby sa dostali medzi tenisové
//    podiely, ticho by prepísali percentá všetkých zameraní naraz.
//
// Potrebuje bežiaci dev server v tenisovom režime (viď README.md).
const {
  APP_HOST,
  authCookies,
  request,
  textOf,
  serviceClient,
  ensureFitnessCoach,
  createChecks,
} = require("./helpers");

const { check, section, report } = createChecks();
const db = serviceClient();

const PARENT = "parent-test@test.local";
const LINK_CODE = "PARLINK1";

async function main() {
  section("0) Beží dev server?");
  const probe = await request("/parent/login", { host: APP_HOST });
  if (probe.status !== 200) {
    console.error(`\n  Dev server neodpovedá (status ${probe.status}).\n`);
    process.exit(1);
  }
  check("prihlásenie pre sledujúceho sa vykreslí", probe.status === 200);

  const { coach: fitnessCoach, player: fitnessPlayer } =
    await ensureFitnessCoach(db);
  const { data: users } = await db.auth.admin.listUsers({ perPage: 1000 });
  const demo = users.users.find((user) => user.email === "demo@plaw.win");
  const { data: tennisPlayer } = await db
    .from("players")
    .select("id")
    .eq("coach_id", demo.id)
    .eq("is_active", true)
    .is("organization_id", null)
    .limit(1)
    .single();

  // Kondičný tréning kotvený na poludnie — beh tesne pred polnocou by ho inak
  // posunul mimo okna, ktoré analytika práve ukazuje.
  const noon = new Date();
  noon.setHours(12, 0, 0, 0);

  let sessionId = null;
  try {
    const { data: session } = await db
      .from("sessions")
      .insert({
        coach_id: fitnessCoach.id,
        player_id: fitnessPlayer.id,
        status: "planned",
        discipline: "fitness",
        planned_data: { date: noon.toISOString(), duration_minutes: 60 },
        notes: "Kondičný blok pre rodiča",
      })
      .select("id")
      .single();
    sessionId = session.id;

    // POZOR na trvanie: `session_drills` má CHECK na 5/10/15/20/30/60 (je to
    // zjednotenie disciplín). Iná hodnota sa ticho nevloží a sada potom padá na
    // tom, že blok „nie je vykreslený" — pritom nie je čo sčítať. Preto sa
    // chyba zápisu kontroluje, nezahadzuje.
    const { error: drillError } = await db.from("session_drills").insert({
      session_id: session.id,
      coach_id: fitnessCoach.id,
      category: "STRENGTH",
      character: null,
      drill_code: "STR-PARENT",
      duration_minutes: 30,
      status: "played",
      sort_order: 1,
    });
    if (drillError) {
      throw new Error(`príprava cvičenia zlyhala: ${drillError.message}`);
    }

    await db.from("player_links").delete().eq("link_code", LINK_CODE);
    await db.from("player_links").insert({
      source_player_id: fitnessPlayer.id,
      source_coach_id: fitnessCoach.id,
      source_discipline: "fitness",
      target_player_id: tennisPlayer.id,
      target_coach_id: demo.id,
      link_code: LINK_CODE,
      status: "active",
      source_shares_with_follower: false,
    });

    const cookies = await authCookies(PARENT);
    const path = "/parent/analytics/Forehand";

    section("1) Bez súhlasu vlastníka dát blok nie je");
    const before = await request(path, { host: APP_HOST, cookies });
    const beforeText = textOf(before.body);
    check("stránka sa vykreslí", before.status === 200, `status ${before.status}`);
    check(
      "kondičný blok tam nie je",
      !/Fitness in the same period/.test(beforeText),
    );
    check("ani kondičné zameranie", !/STRENGTH/.test(beforeText));

    section("2) So súhlasom vidí sledujúci SÚČTY a nič viac");
    await db
      .from("player_links")
      .update({ source_shares_with_follower: true })
      .eq("link_code", LINK_CODE);

    const after = await request(path, { host: APP_HOST, cookies });
    const afterText = textOf(after.body);
    const [above, below] = afterText.split("Fitness in the same period");

    check(
      "blok sa objavil",
      below !== undefined,
      afterText.slice(0, 200),
    );
    check("je v ňom kondičné zameranie", /STRENGTH/.test(below ?? ""));
    check(
      "kondičné minúty ostali POD čiarou, nie medzi tenisovými podielmi",
      !/STRENGTH/.test(above),
    );
    check(
      "kód cvičenia kondičného trénera v ňom NIE JE",
      !/STR-PARENT/.test(afterText),
    );
    check(
      "poznámka z jeho tréningu v ňom NIE JE",
      !/Kondičný blok pre rodiča/.test(afterText),
    );
    check(
      "je napísané, že sa to nepočíta do čísel nad tým",
      /not part of the numbers above/i.test(below ?? ""),
    );

    section("3) Po zrušení prepojenia blok zmizne");
    // Nie sú to jeho dáta, len mu ich niekto dočasne ukazoval — na rozdiel od
    // kópií, ktoré mu ostávajú aj po konci spolupráce.
    await db
      .from("player_links")
      .update({ status: "revoked" })
      .eq("link_code", LINK_CODE);

    const revoked = await request(path, { host: APP_HOST, cookies });
    check(
      "blok je preč",
      !/Fitness in the same period/.test(textOf(revoked.body)),
    );
  } finally {
    await db.from("player_links").delete().eq("link_code", LINK_CODE);
    if (sessionId) {
      await db.from("sessions").delete().eq("id", sessionId);
    }
  }
}

main()
  .then(report)
  .catch((error) => {
    console.error("CHYBA:", error.message || error);
    process.exit(1);
  });
