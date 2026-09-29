// Prefotí tri snímky obrazovky pre landing (`public/screenshots/en/`).
//
// Landing ukazuje appku na telefóne — kalendár, detail tréningu a analytiku.
// Snímky z 27. 7. 2026 ukazovali ANTUKOVÝ vzhľad a po redizajne (21. 9.)
// prestali sedieť s tým, čo návštevník v appke naozaj uvidí.
//
// Spúšťa sa RUČNE a potrebuje dočasný Playwright, rovnako ako sady
// v `scripts/dev-tests/` (viď ich README):
//   npm install --no-save playwright
//   npx supabase start && node scripts/dev-tests/seed.js
//   npm run dev
//   node scripts/landing-shots.js
//
// Fotí sa účet `demo@plaw.win` zo seedu — jeden hráč, jedenásť odohraných
// tréningov za posledných deväť týždňov. Analytika sa predvolene pozerá na
// AKTUÁLNY MESIAC, takže v ňom musia byť dáta; seed to drží (offsety -3 až
// -28 dní padnú do tohto mesiaca) — ale ak sa fotí prvého v mesiaci, preseeduj.
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");
const sharp = require("sharp");
const {
  APP_HOST,
  chromiumArgs,
  browserLogin,
  serviceClient,
} = require("./dev-tests/helpers");

const BASE = `http://${APP_HOST}`;
const OUT = path.join(__dirname, "..", "public", "screenshots", "en");
const TMP = path.join(__dirname, "..", ".landing-shots");

// Rozmer zodpovedá rámčeku na landingu (`width={640} height={1385}`), teda
// pomeru telefónu 390 × 844. Fotí sa pri dvojnásobnej hustote a zmenšuje na
// 640 — tak vyzerá ostro aj na retina displeji.
const VIEWPORT = { width: 390, height: 844 };
const SCALE = 2;
const OUT_WIDTH = 640;

async function main() {
  fs.mkdirSync(TMP, { recursive: true });
  fs.mkdirSync(OUT, { recursive: true });

  // Detail sa fotí na konkrétnom tréningu, takže si jeho id treba vypýtať.
  const db = serviceClient();
  const { data: users } = await db.auth.admin.listUsers({ perPage: 1000 });
  const coach = users.users.find((u) => u.email === "demo@plaw.win");
  if (!coach) throw new Error("demo@plaw.win neexistuje — spusti seed.js");
  // Dátum tréningu nie je stĺpec, býva v JSON (`actual_data.date`) — radiť
  // sa teda musí až v pamäti. Berie sa NAJNOVŠÍ dokončený, nech snímka
  // ukazuje čerstvý záznam a nie dva mesiace starý.
  const { data: sessions } = await db
    .from("sessions")
    .select("id, actual_data")
    .eq("coach_id", coach.id)
    .eq("status", "completed");
  if (!sessions?.length) throw new Error("žiadny dokončený tréning — spusti seed.js");
  const sessionId = sessions
    .slice()
    .sort((a, b) =>
      String(b.actual_data?.date ?? "").localeCompare(String(a.actual_data?.date ?? "")),
    )[0].id;

  const browser = await chromium.launch({ args: chromiumArgs() });
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: SCALE,
    isMobile: true,
    hasTouch: true,
  });
  await context.addCookies([
    { name: "NEXT_TIMEZONE", value: "Europe/Bratislava", url: BASE },
  ]);
  const page = await context.newPage();

  // Vývojový odznak Next.js je fixný v rohu a na snímke by ostal.
  await page.addStyleTag({ content: "nextjs-portal{display:none !important}" }).catch(() => {});

  await browserLogin(page, "demo@plaw.win", BASE);

  // Adresy sú zámerne konkrétnejšie, než na aké sa klikne v appke:
  //  - kalendár sa predvolene otvára na TÝŽDEŇ, kde býva pár riadkov;
  //    mesiac ukazuje mriežku s farebnými dňami, čo je to, čo popisok
  //    pod snímkou sľubuje („A clear training calendar");
  //  - `/analytics` samo o sebe NEEXISTUJE, je to `/analytics/[category]`
  //    (spodná lišta doň dopĺňa predvolené zameranie disciplíny) — bez
  //    zamerania sa vyfotí stránka 404.
  const shots = [
    ["calendar", "/calendar?view=month"],
    ["session", `/sessions/${sessionId}`],
    ["analytics", "/analytics/Forehand"],
  ];

  for (const [name, route] of shots) {
    await page.goto(`${BASE}${route}`);
    await page.waitForLoadState("networkidle").catch(() => {});
    // Grafy v analytike sa dokresľujú po hydratácii.
    await page.waitForTimeout(1200);
    await page.addStyleTag({ content: "nextjs-portal{display:none !important}" }).catch(() => {});
    const png = path.join(TMP, `${name}.png`);
    await page.screenshot({ path: png });
    await sharp(png).resize({ width: OUT_WIDTH }).webp({ quality: 82 }).toFile(path.join(OUT, `${name}.webp`));
    console.log("hotovo:", name, route);
  }

  await browser.close();
  console.log("\nsnímky sú v", OUT);
}

main().catch((e) => {
  console.error("CHYBA:", e.message || e);
  process.exit(1);
});
