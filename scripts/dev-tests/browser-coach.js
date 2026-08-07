// Klikacie scenáre trénerovej appky: ťuk na tréning musí prepnúť hráča,
// upozornenie musí otvoriť plánovanie, a analytika musí kresliť tri grafy.
//
// Vyžaduje dočasný Playwright — viď README.md.
const fs = require("node:fs");
const { chromium } = require("playwright");
const {
  ORG_HOST,
  SCREENSHOT_DIR,
  browserLogin,
  browserText,
  chromiumArgs,
  createChecks,
} = require("./helpers");

const { check, section, report } = createChecks();
const BASE = `http://${ORG_HOST}`;
const SECTIONS = [
  "Share of total training time",
  "By drill code",
  "By shot character",
];

async function main() {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  const browser = await chromium.launch({ args: chromiumArgs() });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();

  await browserLogin(page, "coach-today@test.local", BASE);

  section("1) Nástenka „Dnes\"");
  await page.goto(`${BASE}/`);
  await page.waitForSelector("text=Today's schedule", { timeout: 30000 });
  check("rozvrh dňa sa vykreslil", true);
  await page.screenshot({ path: `${SCREENSHOT_DIR}/today.png`, fullPage: true });

  section("2) Ťuk na tréning prepne hráča a otvorí ho");
  await page.click('button[aria-label="Open the practice with Adam Kovac"]');
  await page.waitForURL(/\/sessions\/[0-9a-f-]+$/, { timeout: 30000 });
  check("otvoril sa detail tréningu", /\/sessions\//.test(page.url()), page.url());
  await page.goto(`${BASE}/sessions`);
  check(
    "appka sa prepla na Adama",
    /Active player: Adam Kovac/.test(await browserText(page)),
  );

  section("3) Upozornenie na zanedbaného hráča");
  await page.goto(`${BASE}/`);
  await page.click('button[aria-label="Schedule a practice for Nina Bakova"]');
  await page.waitForURL(`${BASE}/sessions`, { timeout: 30000 });
  check(
    "prepne na Ninu a otvorí plánovanie",
    /Active player: Nina Bakova/.test(await browserText(page)),
  );

  section("4) Roster so stavmi");
  await page.goto(`${BASE}/players`);
  await page.waitForSelector("text=My players", { timeout: 30000 });
  const roster = await browserText(page);
  check("stavy hráčov", /without a practice/.test(roster) && /Practiced/.test(roster));
  check("najbližšie tréningy", /Next (today|tomorrow) at/.test(roster));
  await page.screenshot({ path: `${SCREENSHOT_DIR}/roster.png`, fullPage: true });

  section("5) Analytika: tri grafy, generálny prvý");
  // Krok 3 prepol vybraného hráča na Ninu (tá nemá žiadny tréning), takže sa
  // musíme vrátiť k hráčovi s dátami — analytika sa viaže na vybraného.
  await page.goto(`${BASE}/`);
  await page.click('button[aria-label="Switch to Adam Kovac"]');
  await page.waitForTimeout(1500);
  await page.goto(`${BASE}/analytics/Forehand`);
  await page.waitForTimeout(2500);
  const analytics = await browserText(page);
  const found = SECTIONS.filter((title) => analytics.includes(title));
  check("všetky tri sekcie grafov: " + found.join(" | "), found.length === 3);
  check(
    "generálny graf je prvý",
    analytics.indexOf(SECTIONS[0]) < analytics.indexOf(SECTIONS[1]),
  );

  section("6) Zameranie bez záznamu má v generálnom grafe nulu");
  await page.goto(`${BASE}/analytics/Volley`);
  await page.waitForTimeout(2000);
  const volley = await browserText(page);
  check("generálny graf sa vykreslil", volley.includes(SECTIONS[0]));
  check(
    "Volley je uvedené s nulou",
    /Volley\s*—\s*0\s*min\s*·\s*0\s*%/.test(volley),
    (volley.match(/Volley\s*—[^A-Z]{0,30}/) || ["nenájdené"])[0],
  );

  report();
  await browser.close();
}

main().catch((error) => {
  console.error("CHYBA:", error.message || error);
  process.exit(1);
});
