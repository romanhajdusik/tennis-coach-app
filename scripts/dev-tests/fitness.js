// HTTP scenáre KONDIČNÉHO nasadenia (`NEXT_PUBLIC_PLAW_DISCIPLINE=fitness`).
//
// Kondička je druhé nasadenie toho istého kódu nad tou istou databázou, takže
// sa nedá overiť tými istými sadami — potrebuje vlastný dev server s tou
// premennou. Spusť ho na inom porte, aby tenisový bežal ďalej:
//
//   NEXT_PUBLIC_PLAW_DISCIPLINE=fitness PORT=3001 npm run dev
//   DEV_PORT=3001 node scripts/dev-tests/fitness.js
//
// Sada overuje presne to, čím sa kondička od tenisu líši: zamerania, ponuka
// trvaní, chýbajúci charakter cvičenia, analytika bez odhadu úderov a to, že
// sa na kondičnej doméne nevykreslí tenisový marketing.
const {
  APP_HOST,
  authCookies,
  request,
  textOf,
  serviceClient,
  createChecks,
} = require("./helpers");

const { check, section, report } = createChecks();

const FITNESS_CATEGORIES = [
  "ENDURANCE",
  "STRENGTH",
  "SPEED",
  "FOOTWORK",
  "COORDINATION",
  "MOBILITY",
  "CORE MUSCLES",
  "STRETCHING",
  "YOUR 1",
  "YOUR 2",
];

const TENNIS_CATEGORIES = ["Forehand", "Backhand", "Volley", "Serve", "POINTS"];

async function main() {
  section("0) Beží dev server v kondičnom režime?");
  const probe = await request("/login", { host: APP_HOST });
  if (probe.status !== 200) {
    console.error(
      `\n  Dev server na tomto porte neodpovedá (status ${probe.status}).` +
        `\n  Spusti: NEXT_PUBLIC_PLAW_DISCIPLINE=fitness PORT=3001 npm run dev` +
        `\n  a sadu potom: DEV_PORT=3001 node scripts/dev-tests/fitness.js\n`,
    );
    process.exit(1);
  }
  check("prihlasovacia stránka odpovedá", probe.status === 200);

  section("1) Kondičná doména nevykreslí tenisový marketing");
  // Landing je marketing tenisového produktu (názov, screenshoty z kurtu,
  // cenník) — na kondičnej doméne by bola nepravdivá.
  const home = await request("/", { host: APP_HOST });
  check(
    "odhlásený ide rovno na prihlásenie",
    home.status === 307 && /\/login$/.test(home.headers.location ?? ""),
    `status ${home.status}, location ${home.headers.location}`,
  );

  const cookies = await authCookies("demo@plaw.win");

  section("2) Kódy cvičení = 10 kondičných zameraní");
  const codes = await request("/drill-codes", { host: APP_HOST, cookies });
  const codesText = textOf(codes.body);
  check("stránka sa načíta", codes.status === 200, "status " + codes.status);
  for (const category of FITNESS_CATEGORIES) {
    check(`zameranie ${category}`, codesText.includes(category));
  }
  for (const category of TENNIS_CATEGORIES) {
    check(
      `tenisové ${category} sa NEponúka`,
      !codesText.includes(category),
      category,
    );
  }

  section("3) Analytika pozná kondičné zamerania a nie tenisové");
  const fitnessAnalytics = await request(
    `/analytics/${encodeURIComponent("CORE MUSCLES")}`,
    { host: APP_HOST, cookies },
  );
  check(
    "kondičné zameranie s medzerou sa otvorí",
    fitnessAnalytics.status === 200,
    "status " + fitnessAnalytics.status,
  );

  const tennisAnalytics = await request("/analytics/Forehand", {
    host: APP_HOST,
    cookies,
  });
  check(
    "tenisové zameranie vráti 404",
    tennisAnalytics.status === 404,
    "status " + tennisAnalytics.status,
  );

  const analyticsText = textOf(fitnessAnalytics.body);
  check(
    "v analytike nie je odhad úderov",
    !/strokes/i.test(analyticsText),
    analyticsText.slice(0, 200),
  );

  section("4) Formulár cvičenia: bez charakteru, s trvaním 60");
  const db = serviceClient();
  const { data: coach } = await db.auth.admin.listUsers({ perPage: 1000 });
  const demo = coach.users.find((u) => u.email === "demo@plaw.win");
  const { data: session } = await db
    .from("sessions")
    .select("id, discipline")
    .eq("coach_id", demo.id)
    .eq("status", "planned")
    .limit(1)
    .maybeSingle();

  if (!session) {
    check("existuje naplánovaný tréning demo trénera", false, "žiadny nenájdený");
  } else {
    const detail = await request(`/sessions/${session.id}`, {
      host: APP_HOST,
      cookies,
    });
    const detailText = textOf(detail.body);
    check("tréning sa načíta", detail.status === 200, "status " + detail.status);
    check(
      "pole charakteru cvičenia sa nevykreslilo",
      !/Character/i.test(detailText),
      detailText.slice(0, 200),
    );
    check("ponuka trvaní obsahuje 60 min", /60 min/.test(detailText));
    check(
      "zamerania vo formulári sú kondičné",
      detailText.includes("ENDURANCE") && !detailText.includes("Backhand"),
    );
  }
}

main()
  .then(report)
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
