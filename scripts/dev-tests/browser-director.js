// Klikacie scenáre pultu: onboarding trénera end-to-end, porovnanie hráčov
// a šírka rozloženia (pult je nástroj pre laptop/tablet).
//
// Vyžaduje dočasný Playwright — viď README.md.
const fs = require("node:fs");
const { chromium } = require("playwright");
const {
  ORG_HOST,
  SCREENSHOT_DIR,
  serviceClient,
  browserLogin,
  browserText,
  chromiumArgs,
  createChecks,
} = require("./helpers");

const { check, section, report } = createChecks();
const BASE = `http://${ORG_HOST}`;
const NEW_COACH = "coach-new@test.local";
const SEEDED_COACHES = ["coach-today@test.local", "coach2-today@test.local"];
const db = serviceClient();

/** Počet stĺpcov = koľko kariet hráčov má rovnaký horný okraj. */
const columnsOf = (page) =>
  page.evaluate(() => {
    const cards = [...document.querySelectorAll("section")].filter((node) =>
      node.querySelector('a[href^="/director/players/"]'),
    );
    if (!cards.length) return 0;
    const top = Math.round(cards[0].getBoundingClientRect().top);
    return cards.filter(
      (card) => Math.round(card.getBoundingClientRect().top) === top,
    ).length;
  });

const overflows = (page) =>
  page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1,
  );

async function main() {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

  // Čistý štart onboardingu: účet bez členstva a bez visiacich pozvánok.
  const { data: users } = await db.auth.admin.listUsers({ perPage: 1000 });
  const fresh = users.users.find((user) => user.email === NEW_COACH);
  if (fresh) await db.from("organization_members").delete().eq("user_id", fresh.id);
  await db.from("organization_members").delete().eq("status", "invited");
  await db.from("drill_codes").delete().eq("code", "FED-TEST");

  // Scenár 7 trénera odoberá a zase vracia. Keby predošlý beh spadol uprostred,
  // ostal by odobratý a ďalšie behy by sa sypali už na počte sedadiel — preto
  // sa členstvá seedovaných trénerov na štarte vždy obnovia.
  const seeded = users.users
    .filter((user) => SEEDED_COACHES.includes(user.email))
    .map((user) => user.id);
  await db
    .from("organization_members")
    .update({ status: "active" })
    .in("user_id", seeded)
    .eq("status", "removed");

  const browser = await chromium.launch({ args: chromiumArgs() });
  const dirContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const director = await dirContext.newPage();
  await browserLogin(director, "director-today@test.local", BASE);

  section("1) Pult na laptope");
  await director.goto(`${BASE}/director`);
  await director.waitForSelector("text=Needs attention", { timeout: 30000 });
  check("pult sa načíta", true);
  check("bez horizontálneho scrollu", !(await overflows(director)));
  const twoColumns = await director.evaluate(() => {
    const sections = [...document.querySelectorAll("section")];
    if (sections.length < 2) return false;
    const [first, second] = sections.map((node) => node.getBoundingClientRect());
    return Math.abs(first.top - second.top) < 40 && first.left !== second.left;
  });
  check("pozornosť a tréneri sú vedľa seba", twoColumns);
  await director.screenshot({ path: `${SCREENSHOT_DIR}/director.png`, fullPage: true });

  section("2) Šéftréner vytvorí pozývací kód");
  await director.goto(`${BASE}/director/team`);
  await director.waitForTimeout(1500);
  check("stránka členstva sa načíta", /Invite a coach/.test(await browserText(director)));
  await director.click("text=Create an invite code");
  await director.waitForTimeout(2000);
  const teamText = await browserText(director);
  const code = (teamText.match(/[A-Z2-9]{4}-[A-Z2-9]{4}/) || [])[0];
  check("kód sa vygeneroval: " + code, !!code, teamText.slice(0, 250));
  await director.screenshot({ path: `${SCREENSHOT_DIR}/team.png`, fullPage: true });

  section("3) Pozvaný tréner zadá kód");
  const coachContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const coach = await coachContext.newPage();
  await browserLogin(coach, NEW_COACH, BASE);
  await coach.waitForTimeout(1500);
  check("účet bez členstva skončí na /join", coach.url().endsWith("/join"), coach.url());
  await coach.fill('input[name="code"]', "XXXX-XXXX");
  await coach.click('button[type="submit"]');
  await coach.waitForTimeout(1500);
  check(
    "neplatný kód je odmietnutý",
    /not valid or has already been used/.test(await browserText(coach)),
  );
  await coach.fill('input[name="code"]', code);
  await coach.click('button[type="submit"]');
  await coach.waitForTimeout(3000);
  await coach.goto(`${BASE}/`);
  await coach.waitForTimeout(1500);
  const coachText = await browserText(coach);
  check("po zadaní kódu je tréner v appke", /Today/.test(coachText), coachText.slice(0, 200));

  section("4) Šéftréner ho vidí v pulte");
  await director.goto(`${BASE}/director/team`);
  await director.waitForTimeout(1500);
  const afterJoin = await browserText(director);
  check("nový tréner je medzi členmi", /Cerstvy Tréner/.test(afterJoin));
  check("sedadlá narástli", /3 of 10 seats used/.test(afterJoin), (afterJoin.match(/\d+ of 10 seats used/) || ["?"])[0]);
  check("použitý kód zmizol z čakajúcich", !afterJoin.includes(code));

  section("5) Kódy cvičení: šéftréner edituje, tréner iba číta");
  await director.goto(`${BASE}/director/drill-codes`);
  await director.waitForTimeout(1500);
  await director.locator('input[name="code"]').first().fill("FED-TEST");
  await director.locator('button[type="submit"]').first().click();
  await director.waitForTimeout(2500);
  const { data: saved } = await db
    .from("drill_codes")
    .select("coach_id, organization_id")
    .eq("code", "FED-TEST")
    .maybeSingle();
  check(
    "štandard sa uložil ako org riadok",
    !!saved && saved.coach_id === null && !!saved.organization_id,
    JSON.stringify(saved),
  );
  await coach.goto(`${BASE}/drill-codes`);
  await coach.waitForTimeout(1500);
  // Hodnoty <input> nie sú v textContent — treba ich čítať ako hodnoty polí.
  const codes = await coach
    .locator('input[name="code"]')
    .evaluateAll((nodes) => nodes.map((node) => node.value));
  check("tréner vidí federačný štandard", codes.includes("FED-TEST"));
  const editable = await coach
    .locator('input[name="code"]:not([readonly]):not([disabled])')
    .count();
  check("tréner ich nemôže meniť", editable === 0, "editovateľných polí: " + editable);

  section("6) Porovnanie hráčov a počet stĺpcov");
  await director.goto(`${BASE}/director/compare`);
  await director.waitForTimeout(2500);
  const compare = await browserText(director);
  check("trojica grafov pre hráča", /Share of total training time/.test(compare));
  check("obe osi zoskupenia", /By coach/.test(compare) && /By year of birth/.test(compare));

  // 14" notebook (1280–1512 px) musí ukázať štyri stĺpce.
  const widths = { 390: 1, 834: 2, 1280: 4, 1600: 5 };
  for (const [width, expected] of Object.entries(widths)) {
    await director.setViewportSize({ width: Number(width), height: 1000 });
    await director.goto(`${BASE}/director/compare`);
    await director.waitForTimeout(1800);
    const columns = await columnsOf(director);
    check(`${width}px → ${columns} stĺpcov (čakané ${expected})`, columns === expected);
    check(`${width}px → bez horizontálneho scrollu`, !(await overflows(director)));
  }
  await director.screenshot({ path: `${SCREENSHOT_DIR}/compare.png`, fullPage: true });

  section("7) Odchod trénera a prevzatie jeho hráčov");
  await director.setViewportSize({ width: 1440, height: 900 });

  const { data: before } = await db
    .from("organization_members")
    .select("id, user_id, role")
    .eq("status", "active")
    .eq("role", "coach");
  const { data: profiles } = await db
    .from("profiles")
    .select("id, full_name")
    .in("id", before.map((member) => member.user_id));
  const boris = before.find(
    (member) =>
      profiles.find((profile) => profile.id === member.user_id)?.full_name ===
      "Boris Druhy",
  );
  const andrea = before.find(
    (member) =>
      profiles.find((profile) => profile.id === member.user_id)?.full_name ===
      "Andrea Prva",
  );
  const { data: orphan } = await db
    .from("players")
    .select("id, name")
    .eq("coach_id", boris.user_id)
    .eq("is_active", true)
    .limit(1)
    .single();
  const { data: orphanSessions } = await db
    .from("sessions")
    .select("id")
    .eq("player_id", orphan.id);
  const orphanSessionIds = (orphanSessions ?? []).map((session) => session.id);

  try {
    // Odobratie ide cez UI (potvrdzuje sa natívnym `confirm`).
    director.once("dialog", (dialog) => dialog.accept());
    await director.goto(`${BASE}/director/team`);
    await director.waitForTimeout(1500);
    await director
      .locator('li:has-text("Boris Druhy") button[type="submit"]')
      .first()
      .click();
    await director.waitForTimeout(2500);
    const { data: removed } = await db
      .from("organization_members")
      .select("status")
      .eq("id", boris.id)
      .single();
    check("tréner je odobratý z organizácie", removed.status === "removed", removed.status);

    await director.goto(`${BASE}/director`);
    await director.waitForTimeout(2000);
    const orphaned = await browserText(director);
    check("jeho hráči ostali federácii", new RegExp(orphan.name).test(orphaned));
    check("sú v skupine po odídenom trénerovi", /No longer in the organization/.test(orphaned));
    const selects = await director.locator('select[name="coachId"]').count();
    check("pri nich je výber nového trénera", selects >= 1, "výberov: " + selects);

    await director
      .locator('select[name="coachId"]')
      .first()
      .selectOption(andrea.user_id);
    await director
      .locator('form:has(select[name="coachId"]) button[type="submit"]')
      .first()
      .click();
    await director.waitForTimeout(3000);

    const { data: reassigned } = await db
      .from("players")
      .select("coach_id")
      .eq("id", orphan.id)
      .single();
    check("hráč prešiel na zvoleného trénera", reassigned.coach_id === andrea.user_id);
    const { count: strandedSessions } = await db
      .from("sessions")
      .select("id", { count: "exact", head: true })
      .eq("player_id", orphan.id)
      .eq("coach_id", boris.user_id);
    check("po hráčovi neostali tréningy pri starom trénerovi", strandedSessions === 0, "zvyšok: " + strandedSessions);

    await director.goto(`${BASE}/director`);
    await director.waitForTimeout(2000);
    const afterAssign = await browserText(director);
    check("skupina po odídenom trénerovi zmizla", !/No longer in the organization/.test(afterAssign));
    check("hráč je stále v pulte", new RegExp(orphan.name).test(afterAssign));
    await director.screenshot({ path: `${SCREENSHOT_DIR}/assign.png`, fullPage: true });

    // Overenie z druhej strany: hráča preberá nový tréner aj v svojej appke.
    const takeover = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const takeoverPage = await takeover.newPage();
    await browserLogin(takeoverPage, "coach-today@test.local", BASE);
    await takeoverPage.goto(`${BASE}/players`);
    await takeoverPage.waitForTimeout(2000);
    check(
      "nový tréner má hráča vo svojom rosteri",
      new RegExp(orphan.name).test(await browserText(takeoverPage)),
    );

  } finally {
    // Návrat do pôvodného stavu aj keď scenár spadne uprostred — inak by ďalší
    // beh začínal s odobratým trénerom a rozpadol by sa už na sedadlách.
    await db.from("organization_members").update({ status: "active" }).eq("id", boris.id);
    await db.from("players").update({ coach_id: boris.user_id }).eq("id", orphan.id);
    await db.from("sessions").update({ coach_id: boris.user_id }).eq("player_id", orphan.id);
    if (orphanSessionIds.length > 0) {
      await db
        .from("session_drills")
        .update({ coach_id: boris.user_id })
        .in("session_id", orphanSessionIds);
    }
  }

  // upratanie, nech seed ostane v pôvodnom stave
  await db.from("drill_codes").delete().eq("code", "FED-TEST");
  if (fresh) await db.from("organization_members").delete().eq("user_id", fresh.id);

  report();
  await browser.close();
}

main().catch((error) => {
  console.error("CHYBA:", error.message || error);
  process.exit(1);
});
