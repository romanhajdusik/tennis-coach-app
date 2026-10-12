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

  // Do organizácie vstupuje len trénerský účet (migrácia 20260916090000).
  // Rodič dostane na /join vysvetlenie a kód ostane voľný pre trénera nižšie.
  section("2b) Rodičovský účet kód neuplatní");
  const parentContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const parent = await parentContext.newPage();
  await browserLogin(parent, "parent-test@test.local", BASE);
  await parent.goto(`${BASE}/join`);
  await parent.waitForTimeout(1500);
  check("rodič bez členstva vidí /join", parent.url().endsWith("/join"), parent.url());
  await parent.fill('input[name="code"]', code);
  await parent.click('button[type="submit"]');
  await parent.waitForTimeout(2000);
  const parentText = await browserText(parent);
  check(
    "rodič dostane vysvetlenie, prečo sa nepripojí",
    /parent, manager or player account, so it cannot join/.test(parentText),
    parentText.slice(0, 250),
  );
  await parentContext.close();
  await director.goto(`${BASE}/director/team`);
  await director.waitForTimeout(1500);
  check("kód po pokuse rodiča stále čaká na trénera", (await browserText(director)).includes(code));

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
    .select("coach_id, organization_id, discipline")
    .eq("code", "FED-TEST")
    .maybeSingle();
  check(
    "štandard sa uložil ako org riadok tenisovej disciplíny",
    !!saved && saved.coach_id === null && !!saved.organization_id && saved.discipline === "tennis",
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
  // Hráč sa hľadá cez PRIRADENIE, nie cez `players.coach_id` — ten je od
  // migrácie 20260815090000 v org režime len autor riadku a prístup určuje
  // `player_assignments` (hráč × tréner × disciplína).
  const { data: borisAssignment } = await db
    .from("player_assignments")
    .select("player_id, discipline, organization_id, players(id, name, is_active)")
    .eq("coach_id", boris.user_id)
    .limit(1)
    .single();
  const orphan = borisAssignment.players;
  const { data: orphanSessions } = await db
    .from("sessions")
    .select("id, status")
    .eq("player_id", orphan.id)
    .eq("coach_id", boris.user_id);
  const orphanSessionIds = (orphanSessions ?? []).map((session) => session.id);
  // Odobratie Borisa od hráča ich zruší — upratanie ich musí vrátiť.
  const borisPlannedIds = (orphanSessions ?? [])
    .filter((session) => session.status === "planned")
    .map((session) => session.id);

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
    check("pri nich je výber trénera", selects >= 1, "výberov: " + selects);

    await director
      .locator('select[name="coachId"]')
      .first()
      .selectOption(andrea.user_id);
    await director
      .locator('form:has(select[name="coachId"]) button[type="submit"]')
      .first()
      .click();
    await director.waitForTimeout(3000);

    // Od 2026-10-12 sa tréner PRIDÁVA (hráč môže mať viac trénerov) a história
    // sa neprepisuje: Borisove tréningy ostávajú podpísané ním.
    const { data: afterAdd } = await db
      .from("player_assignments")
      .select("coach_id")
      .eq("player_id", orphan.id)
      .eq("discipline", borisAssignment.discipline);
    check(
      "zvolený tréner je hráčovi pridaný",
      (afterAdd ?? []).some((row) => row.coach_id === andrea.user_id),
      JSON.stringify(afterAdd),
    );
    const { count: keptSessions } = await db
      .from("sessions")
      .select("id", { count: "exact", head: true })
      .eq("player_id", orphan.id)
      .eq("coach_id", boris.user_id);
    check(
      "história ostala podpísaná pôvodným trénerom",
      keptSessions === orphanSessionIds.length,
      `${keptSessions}/${orphanSessionIds.length}`,
    );

    await director.goto(`${BASE}/director`);
    await director.waitForTimeout(2000);
    const afterAssign = await browserText(director);
    check("skupina po odídenom trénerovi zmizla", !/No longer in the organization/.test(afterAssign));
    check("hráč je stále v pulte", new RegExp(orphan.name).test(afterAssign));
    await director.screenshot({ path: `${SCREENSHOT_DIR}/assign.png`, fullPage: true });

    // Odídeného Borisa šéftréner od hráča odoberie na jeho profile —
    // dvojkrokovo, lebo to zruší Borisove naplánované tréningy s hráčom.
    await director.goto(`${BASE}/director/players/${orphan.id}`);
    await director.waitForTimeout(2000);
    const profileText = await browserText(director);
    check("na profile je odídený tréner označený", /No longer in the organization/.test(profileText));
    await director
      .locator('li:has-text("No longer in the organization") button:has-text("Remove")')
      .first()
      .click();
    await director.waitForTimeout(500);
    check(
      "pred odobratím sa pýta a varuje pred zrušením tréningov",
      /planned practices with this player will be cancelled/.test(await browserText(director)),
    );
    await director.locator('button:has-text("Remove coach")').first().click();
    await director.waitForTimeout(3000);
    const { data: afterRemove } = await db
      .from("player_assignments")
      .select("coach_id")
      .eq("player_id", orphan.id)
      .eq("discipline", borisAssignment.discipline);
    check(
      "odídený tréner je od hráča odobratý",
      (afterRemove ?? []).length === 1 && afterRemove[0].coach_id === andrea.user_id,
      JSON.stringify(afterRemove),
    );
    if (borisPlannedIds.length > 0) {
      const { data: cancelled } = await db
        .from("sessions")
        .select("status")
        .in("id", borisPlannedIds);
      check(
        "jeho naplánované tréningy sa zrušili",
        (cancelled ?? []).every((row) => row.status === "cancelled"),
        JSON.stringify(cancelled),
      );
    }

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
    // POZOR: vrátiť treba aj PRIRADENIE, nie len `coach_id`. Kým sa to
    // nerobilo, ďalší beh našiel hráča podľa `coach_id` pri Borisovi, ale
    // priradený bol stále Andrei — po odobratí Borisa teda nevznikla skupina
    // „No longer in the organization" a scenár padol bez zjavnej príčiny.
    // Od 2026-10-12: hráč smie mať viac trénerov, takže sa Andrein riadok
    // zmaže a Borisov sa vráti (odobratie ho zmazalo).
    await db
      .from("player_assignments")
      .delete()
      .eq("player_id", orphan.id)
      .eq("discipline", borisAssignment.discipline)
      .neq("coach_id", boris.user_id);
    await db.from("player_assignments").upsert(
      {
        organization_id: borisAssignment.organization_id,
        player_id: orphan.id,
        coach_id: boris.user_id,
        discipline: borisAssignment.discipline,
      },
      { onConflict: "player_id,discipline,coach_id", ignoreDuplicates: true },
    );
    if (borisPlannedIds.length > 0) {
      await db.from("sessions").update({ status: "planned" }).in("id", borisPlannedIds);
    }
    await db.from("players").update({ coach_id: boris.user_id }).eq("id", orphan.id);
    await db.from("sessions").update({ coach_id: boris.user_id }).eq("player_id", orphan.id);
    if (orphanSessionIds.length > 0) {
      await db
        .from("session_drills")
        .update({ coach_id: boris.user_id })
        .in("session_id", orphanSessionIds);
    }
  }

  section("8) Odobratý tréner: neaktívny, návrat, trvalé zmazanie");
  // Cieľom je účet z onboardingového scenára — ten sa aj tak na konci maže,
  // takže sa ním dá bez následkov prejsť až po nezvratné zmazanie. Seedovaných
  // trénerov by scenár mazať nesmel, tí musia ďalším sadám ostať.
  if (fresh) {
    const { data: freshProfile } = await db
      .from("profiles")
      .select("full_name, email")
      .eq("id", fresh.id)
      .maybeSingle();
    const freshName =
      freshProfile?.full_name?.trim() || freshProfile?.email || NEW_COACH;

    await director.goto(`${BASE}/director/team`);
    await director.waitForTimeout(1500);

    director.once("dialog", (dialog) => dialog.accept());
    await director
      .locator("li", { hasText: freshName })
      .getByRole("button", { name: "Remove" })
      .first()
      .click();
    await director.waitForTimeout(2500);

    const afterRemove = await browserText(director);
    check(
      "odobratý tréner ostal v zozname ako neaktívny",
      /No longer active/.test(afterRemove) && afterRemove.includes(freshName),
    );

    director.once("dialog", (dialog) => dialog.accept());
    await director
      .locator("li", { hasText: freshName })
      .getByRole("button", { name: "Bring back" })
      .first()
      .click();
    await director.waitForTimeout(2500);

    const { data: backRow } = await db
      .from("organization_members")
      .select("status")
      .eq("user_id", fresh.id)
      .maybeSingle();
    check(
      "vrátenie späť ho spravilo znova aktívnym",
      backRow?.status === "active",
      JSON.stringify(backRow),
    );
    check(
      "zo sekcie neaktívnych zmizol",
      !/No longer active/.test(await browserText(director)),
    );

    // A ešte raz odobrať — tentoraz až po nezvratné zmazanie.
    director.once("dialog", (dialog) => dialog.accept());
    await director
      .locator("li", { hasText: freshName })
      .getByRole("button", { name: "Remove" })
      .first()
      .click();
    await director.waitForTimeout(2500);

    director.once("dialog", (dialog) => dialog.accept());
    await director
      .locator("li", { hasText: freshName })
      .getByRole("button", { name: "Delete" })
      .first()
      .click();
    await director.waitForTimeout(2500);

    const { data: goneRow } = await db
      .from("organization_members")
      .select("id")
      .eq("user_id", fresh.id);
    check(
      "trvalé zmazanie odstránilo riadok",
      (goneRow ?? []).length === 0,
      JSON.stringify(goneRow),
    );
    await director.screenshot({
      path: `${SCREENSHOT_DIR}/team-lifecycle.png`,
      fullPage: true,
    });
  }

  section("9) Prepínač disciplíny v analytike pultu");
  // Šéftréner žiadnu disciplínu „nerobí" a hráč môže mať tréningy oboch, takže
  // sa analytika pultu riadi ZAMERANÍM, nie nasadením. Bez prepínača by sa ku
  // kondičným zameraniam nedostal vôbec — appka by ich odmietla ako neznáme.
  await director.setViewportSize({ width: 1440, height: 900 });
  let fitnessSessionId = null;
  try {
    const { data: orgPlayer } = await db
      .from("players")
      .select("id, organization_id")
      .not("organization_id", "is", null)
      .eq("is_active", true)
      .limit(1)
      .single();

    const { data: orgCoach } = await db
      .from("organization_members")
      .select("user_id")
      .eq("organization_id", orgPlayer.organization_id)
      .eq("role", "coach")
      .eq("status", "active")
      .limit(1)
      .single();

    const noon = new Date();
    noon.setHours(12, 0, 0, 0);

    const { data: fitnessSession } = await db
      .from("sessions")
      .insert({
        coach_id: orgCoach.user_id,
        organization_id: orgPlayer.organization_id,
        player_id: orgPlayer.id,
        status: "completed",
        discipline: "fitness",
        planned_data: { date: noon.toISOString(), duration_minutes: 60 },
      })
      .select("id")
      .single();
    fitnessSessionId = fitnessSession.id;

    await db.from("session_drills").insert({
      session_id: fitnessSession.id,
      coach_id: orgCoach.user_id,
      organization_id: orgPlayer.organization_id,
      category: "ENDURANCE",
      character: null,
      drill_code: "END-1",
      duration_minutes: 30,
      status: "played",
      sort_order: 1,
    });

    const analyticsBase = `${BASE}/director/players/${orgPlayer.id}/analytics`;
    await director.goto(`${analyticsBase}/Forehand`);
    await director.waitForTimeout(2000);
    const tennisView = await browserText(director);
    check("v pulte je prepínač disciplíny", /Tennis/.test(tennisView) && /Fitness/.test(tennisView));
    check("na kurte sú tenisové zamerania", /Backhand/.test(tennisView));

    await director.click("a:has-text('Fitness')");
    await director.waitForURL((url) => /ENDURANCE/.test(url.pathname), {
      timeout: 20000,
    });
    await director.waitForTimeout(2000);
    const fitnessView = await browserText(director);
    check(
      "prepnutie ukáže kondičné zamerania",
      /STRENGTH/.test(fitnessView) && !/Backhand/.test(fitnessView),
    );
    check("a kondičné dáta hráča", /END-1/.test(fitnessView));
    // Disciplína je od 2026-10-05 v adrese, nie odvodená zo zamerania (padel
    // bude mať `Forehand` ako tenis) — každý odkaz ju preto musí niesť ďalej.
    check(
      "adresa nesie zvolenú disciplínu",
      new URL(director.url()).searchParams.get("discipline") === "fitness",
      director.url(),
    );
    await director.click("a:has-text('STRENGTH')");
    await director.waitForURL((url) => /STRENGTH/.test(url.pathname), {
      timeout: 20000,
    });
    await director.waitForTimeout(1500);
    const strengthView = await browserText(director);
    check(
      "ďalšie zameranie ostane v kondičke",
      /ENDURANCE/.test(strengthView) && !/Backhand/.test(strengthView),
    );
    // Kondička odhad úderov nepočíta vôbec — pult sa preto musí pýtať
    // konfigurácie PREZERANEJ disciplíny, nie svojej.
    check(
      "pri kondičke sa nedopočítava odhad úderov",
      !/strokes/i.test(fitnessView),
    );

    await director.screenshot({
      path: `${SCREENSHOT_DIR}/director-fitness-analytics.png`,
      fullPage: true,
    });

    // To isté v porovnaní hráčov.
    await director.goto(`${BASE}/director/compare`);
    await director.waitForTimeout(2200);
    await director.click("a:has-text('Fitness')");
    await director.waitForTimeout(2500);
    const compareFitness = await browserText(director);
    check(
      "porovnanie sa tiež prepne na kondičné zamerania",
      /ENDURANCE/.test(compareFitness) && !/Backhand/.test(compareFitness),
    );
  } finally {
    if (fitnessSessionId) {
      await db.from("sessions").delete().eq("id", fitnessSessionId);
    }
  }

  section("10) Viac trénerov pri hráčovi: hromadné priradenie a kolegov tréning");
  // Od 2026-10-12: skupina trénerov na skupinu hráčov jedným krokom, a tréner
  // vidí tréningy kolegu pri spoločnom hráčovi s jeho menom, len na čítanie.
  const { data: profiles10 } = await db
    .from("profiles")
    .select("id, full_name")
    .in("full_name", ["Andrea Prva", "Boris Druhy"]);
  const { data: members10 } = await db
    .from("organization_members")
    .select("user_id, organization_id")
    .eq("role", "coach")
    .eq("status", "active")
    .in("user_id", (profiles10 ?? []).map((profile) => profile.id));
  const memberByName = (name) => {
    const id = (profiles10 ?? []).find((profile) => profile.full_name === name)?.id;
    return (members10 ?? []).find((member) => member.user_id === id);
  };
  const andrea10 = memberByName("Andrea Prva");
  const boris10 = memberByName("Boris Druhy");
  const { data: andreaPlayers } = await db
    .from("player_assignments")
    .select("player_id, players(name)")
    .eq("coach_id", andrea10.user_id)
    .eq("discipline", "tennis")
    .limit(2);
  const shared = andreaPlayers.map((row) => ({ id: row.player_id, name: row.players.name }));
  let colleagueSessionId = null;
  const colleagueContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  try {
    await director.setViewportSize({ width: 1440, height: 900 });
    await director.goto(`${BASE}/director`);
    await director.waitForTimeout(1500);
    await director.click("a:has-text('Assign coaches')");
    await director.waitForTimeout(2000);
    check("z pultu sa dá prejsť na hromadné priradenie", /\/director\/assign/.test(director.url()));

    for (const player of shared) {
      await director.locator(`label:has-text("${player.name}") input[name="playerId"]`).check();
    }
    await director.locator(`label:has-text("Boris Druhy") input[name="coachId"]`).check();
    await director.click("button:has-text('Assign selected coaches')");
    await director.waitForTimeout(3000);
    check(
      "potvrdí počet nových priradení",
      /2 assignments added/.test(await browserText(director)),
    );
    const { data: afterBulk } = await db
      .from("player_assignments")
      .select("player_id")
      .eq("coach_id", boris10.user_id)
      .in("player_id", shared.map((player) => player.id));
    check("obaja hráči majú teraz aj Borisa", (afterBulk ?? []).length === 2);
    await director.screenshot({ path: `${SCREENSHOT_DIR}/bulk-assign.png`, fullPage: true });

    // Andrea má s prvým spoločným hráčom tréning — Boris ho má vidieť s jej
    // menom a otvoriť len na čítanie.
    const { data: andreaSession } = await db
      .from("sessions")
      .insert({
        coach_id: andrea10.user_id,
        organization_id: andrea10.organization_id,
        player_id: shared[0].id,
        status: "planned",
        planned_data: { date: new Date(Date.now() + 3600_000).toISOString(), duration_minutes: 60 },
        discipline: "tennis",
      })
      .select("id")
      .single();
    colleagueSessionId = andreaSession.id;

    const borisPage = await colleagueContext.newPage();
    await browserLogin(borisPage, "coach2-today@test.local", BASE);
    await borisPage.goto(`${BASE}/`);
    await borisPage.waitForTimeout(2500);
    const borisHome = await browserText(borisPage);
    check(
      "na nástenke je kolegov tréning s jej menom",
      new RegExp(`${shared[0].name}\\s*·\\s*Andrea Prva`).test(borisHome),
      borisHome.slice(0, 300),
    );

    await borisPage.goto(`${BASE}/linked-sessions/${colleagueSessionId}`);
    await borisPage.waitForTimeout(2000);
    const readOnly = await browserText(borisPage);
    check("detail kolegovho tréningu ukáže, kto ho viedol", /Logged by Andrea Prva/.test(readOnly));
    check("a je len na čítanie", (await borisPage.locator("form").count()) === 0 || !/Complete practice/.test(readOnly));

    await borisPage.goto(`${BASE}/sessions/${colleagueSessionId}`);
    await borisPage.waitForTimeout(2000);
    check(
      "editovateľná adresa presmeruje na read-only detail",
      new RegExp(`/linked-sessions/${colleagueSessionId}`).test(borisPage.url()),
      borisPage.url(),
    );
    await borisPage.screenshot({ path: `${SCREENSHOT_DIR}/colleague-session.png`, fullPage: true });

    // Hromadné odobratie bez potvrdenia neprejde, s ním áno.
    await director.goto(`${BASE}/director/assign`);
    await director.waitForTimeout(2000);
    for (const player of shared) {
      await director.locator(`label:has-text("${player.name}") input[name="playerId"]`).check();
    }
    await director.locator(`label:has-text("Boris Druhy") input[name="coachId"]`).check();
    await director.click("button:has-text('Remove selected coaches')");
    await director.waitForTimeout(2500);
    check(
      "odobratie bez potvrdenia neprejde",
      /Confirm that planned practices/.test(await browserText(director)),
    );
    for (const player of shared) {
      await director.locator(`label:has-text("${player.name}") input[name="playerId"]`).check();
    }
    await director.locator(`label:has-text("Boris Druhy") input[name="coachId"]`).check();
    await director.locator('input[name="confirm"]').check();
    await director.click("button:has-text('Remove selected coaches')");
    await director.waitForTimeout(3000);
    check(
      "s potvrdením odoberie",
      /2 assignments removed/.test(await browserText(director)),
    );
    const { data: afterRemove10 } = await db
      .from("player_assignments")
      .select("player_id")
      .eq("coach_id", boris10.user_id)
      .in("player_id", shared.map((player) => player.id));
    check("Boris už hráčov nemá", (afterRemove10 ?? []).length === 0);
    const { data: andreaKept } = await db
      .from("sessions")
      .select("status")
      .eq("id", colleagueSessionId)
      .single();
    check("Andrein naplánovaný tréning sa nezrušil", andreaKept.status === "planned", andreaKept.status);
  } finally {
    await colleagueContext.close();
    if (colleagueSessionId) {
      await db.from("sessions").delete().eq("id", colleagueSessionId);
    }
    await db
      .from("player_assignments")
      .delete()
      .eq("coach_id", boris10.user_id)
      .in("player_id", shared.map((player) => player.id));
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
