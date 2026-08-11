// Klikacie scenáre trénerovej appky: ťuk na tréning musí prepnúť hráča,
// upozornenie musí otvoriť plánovanie, a analytika musí kresliť tri grafy.
//
// Vyžaduje dočasný Playwright — viď README.md.
const fs = require("node:fs");
const { chromium } = require("playwright");
const {
  ORG_HOST,
  APP_HOST,
  SCREENSHOT_DIR,
  serviceClient,
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

function toLocalInput(date) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate(),
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * Presun naplánovaného tréningu na iný čas. Podstatné je, že cvičenia presun
 * PREŽIJÚ — bez tejto akcie musel tréner tréning zrušiť a založiť nanovo, čím
 * o ne prišiel (`on delete cascade`). Beží v oboch režimoch: vo federačnom sa
 * navyše nemaže, takže keby presun spadol na RLS, ostal by po ňom `cancelled`.
 *
 * Tréning si scenár zakladá sám cez `service_role` a v `finally` ho maže —
 * seedované tréningy musia ostať nedotknuté ostatným sadám.
 */
async function rescheduleScenario(page, base, db, coach, player) {
  const plannedAt = new Date();
  plannedAt.setDate(plannedAt.getDate() + 60);
  plannedAt.setHours(9, 0, 0, 0);
  const movedTo = new Date(plannedAt);
  movedTo.setDate(movedTo.getDate() + 1);
  movedTo.setHours(18, 30, 0, 0);

  const cancelledCount = async () => {
    const { count } = await db
      .from("sessions")
      .select("id", { count: "exact", head: true })
      .eq("player_id", player.id)
      .eq("status", "cancelled");
    return count ?? 0;
  };
  const cancelledBefore = await cancelledCount();
  let sessionId = null;

  try {
    const { data: created } = await db
      .from("sessions")
      .insert({
        coach_id: coach.id,
        organization_id: player.organization_id,
        player_id: player.id,
        status: "planned",
        planned_data: { date: plannedAt.toISOString(), duration_minutes: 90 },
      })
      .select("id")
      .single();
    sessionId = created.id;

    await db.from("session_drills").insert(
      [
        ["Forehand", "offensive", "FRH-CRS", 15],
        ["Backhand", "neutral", "BKH-DTL", 20],
      ].map(([category, character, drill_code, duration_minutes], index) => ({
        session_id: sessionId,
        coach_id: coach.id,
        organization_id: player.organization_id,
        category,
        character,
        drill_code,
        duration_minutes,
        status: "played",
        sort_order: index + 1,
      })),
    );

    await page.goto(`${base}/sessions/${sessionId}`);
    await page.waitForSelector("text=Reschedule", { timeout: 30000 });
    check("naplánovaný tréning ponúka presun", true);

    await page.getByRole("button", { name: "Reschedule", exact: true }).click();
    await page.fill("#reschedule_date", toLocalInput(movedTo));
    await page.selectOption("#reschedule_duration", "120");
    await page.getByRole("button", { name: "Save new time" }).click();
    await page.waitForTimeout(500);
    await page.getByRole("button", { name: "Yes, move it" }).click();
    await page.waitForTimeout(3000);

    const { data: after } = await db
      .from("sessions")
      .select("status, planned_data")
      .eq("id", sessionId)
      .single();

    check(
      "tréning má nový čas",
      after.planned_data.date === movedTo.toISOString(),
      `${after.planned_data.date} (očakávané ${movedTo.toISOString()})`,
    );
    check(
      "zmenila sa aj plánovaná dĺžka",
      after.planned_data.duration_minutes === 120,
      String(after.planned_data.duration_minutes),
    );
    check(
      "ostal naplánovaný (nevznikol zrušený duplikát)",
      after.status === "planned",
      after.status,
    );
    check(
      "nový čas je vidieť na stránke",
      (await browserText(page)).includes(
        movedTo.toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
        }),
      ),
    );

    const { count: drillsAfter } = await db
      .from("session_drills")
      .select("id", { count: "exact", head: true })
      .eq("session_id", sessionId);
    check("cvičenia presun prežili", drillsAfter === 2, `${drillsAfter} z 2`);

    // Rodič vidí kópiu, nie živé dáta — presun sa k nemu musí dostať cez
    // trigger `sync_session_to_parent`. Org hráči zdieľanie nemajú (§5.6),
    // takže tam kópia neexistuje a kontrola sa preskočí.
    const { data: parentCopy } = await db
      .from("parent_session_records")
      .select("planned_data")
      .eq("source_session_id", sessionId)
      .maybeSingle();
    if (parentCopy) {
      check(
        "rodičovská kópia dostala nový čas",
        parentCopy.planned_data.date === movedTo.toISOString(),
        parentCopy.planned_data.date,
      );
    }

    const cancelledAfter = await cancelledCount();
    check(
      "po presune nepribudol zrušený tréning",
      cancelledAfter === cancelledBefore,
      `${cancelledBefore} → ${cancelledAfter}`,
    );

    // Dokončený tréning je uzamknutý — presun sa preň nesmie ani ponúknuť.
    await db.from("sessions").update({ status: "completed" }).eq("id", sessionId);
    await page.goto(`${base}/sessions/${sessionId}`);
    await page.waitForTimeout(1500);
    check(
      "dokončený tréning presun neponúka",
      !/Reschedule/.test(await browserText(page)),
    );
  } finally {
    if (sessionId) {
      await db.from("sessions").delete().eq("id", sessionId);
      // Kópia u rodiča zmazanie tréningu zámerne NEPREŽÍVA len v appke (§
      // „Zdieľanie s rodičom") — v teste ju treba odpratať ručne, inak by pri
      // hráčovi so zdieľaním pribúdal pri každom behu jeden tréning navyše.
      // Cvičenia idú s ňou cez `on delete cascade`.
      await db
        .from("parent_session_records")
        .delete()
        .eq("source_session_id", sessionId);
    }
  }
}

/**
 * Zrušenie naplánovaného tréningu s väzbou na Google Kalendár.
 *
 * Lokálne nie je pripojený žiadny kalendár, takže sa neoveruje samotné
 * zmazanie udalosti (to by chcelo Google API), ale to podstatnejšie
 * pravidlo: **kalendár nesmie zrušenie zablokovať**. Tréning má preto
 * podvrhnutú väzbu `google_event_id` — appka sa ju pokúsi upratať, zistí,
 * že kalendár pripojený nie je, a zrušenie musí prejsť tak či tak.
 * A keďže je udalosť „stále v kalendári", väzba sa nesmie zahodiť.
 */
async function cancelScenario(page, base, db, coach, player, isOrg) {
  const plannedAt = new Date();
  plannedAt.setDate(plannedAt.getDate() + 61);
  plannedAt.setHours(8, 0, 0, 0);
  const FAKE_EVENT = "fake-google-event-" + Date.now();
  let sessionId = null;

  try {
    const { data: created } = await db
      .from("sessions")
      .insert({
        coach_id: coach.id,
        organization_id: player.organization_id,
        player_id: player.id,
        status: "planned",
        planned_data: { date: plannedAt.toISOString(), duration_minutes: 90 },
        google_event_id: FAKE_EVENT,
      })
      .select("id")
      .single();
    sessionId = created.id;

    await page.goto(`${base}/sessions/${sessionId}`);
    await page.waitForSelector("text=Cancel practice", { timeout: 30000 });
    await page
      .getByRole("button", { name: "Cancel practice", exact: true })
      .click();
    await page.waitForTimeout(500);

    // Otázka musí sľubovať to, čo sa naozaj stane — vo federácii sa nemaže.
    const question = await browserText(page);
    check(
      isOrg
        ? "otázka hovorí, že záznam organizácii ostane"
        : "otázka hovorí, že sa tréning zmaže natrvalo",
      isOrg
        ? /stays in the organisation's records/i.test(question)
        : /permanently deleted/i.test(question),
    );
    check(
      "otázka spomína aj udalosť v kalendári",
      /Google Calendar/i.test(question),
    );

    await page
      .getByRole("button", {
        name: isOrg ? "Yes, cancel it" : "Yes, cancel and delete",
      })
      .click();
    await page.waitForTimeout(3000);

    const { data: after } = await db
      .from("sessions")
      .select("status, google_event_id")
      .eq("id", sessionId)
      .maybeSingle();

    if (isOrg) {
      check(
        "tréning ostal organizácii ako zrušený",
        after?.status === "cancelled",
        after?.status ?? "riadok zmizol",
      );
      check(
        "väzba na kalendár ostala (udalosť sa nezmazala)",
        after?.google_event_id === FAKE_EVENT,
        String(after?.google_event_id),
      );
    } else {
      check("tréning sa zmazal natrvalo", after === null);
    }
  } finally {
    if (sessionId) {
      await db.from("sessions").delete().eq("id", sessionId);
      await db
        .from("parent_session_records")
        .delete()
        .eq("source_session_id", sessionId);
    }
  }
}

/**
 * Skupinový tréning: ten istý záznam sa zapíše aj ďalšiemu hráčovi trénera.
 *
 * Overuje sa kópia z DOKONČENÉHO tréningu — to je hlavný prípad (tréner
 * zisťuje až po tréningu, že detí bolo na kurte viac) a zároveň ten, kde sa
 * najľahšie pokazí: do uzamknutého tréningu sa cvičenia vložiť nedajú, takže
 * kópia musí vzniknúť odomknutá.
 */
async function copyScenario(page, base, db, coach, player, otherPlayer) {
  const plannedAt = new Date();
  plannedAt.setDate(plannedAt.getDate() + 62);
  plannedAt.setHours(7, 30, 0, 0);
  const NOTES = "Group practice note";
  let sourceId = null;
  let copyId = null;

  try {
    const { data: created } = await db
      .from("sessions")
      .insert({
        coach_id: coach.id,
        organization_id: player.organization_id,
        player_id: player.id,
        status: "completed",
        planned_data: { date: plannedAt.toISOString(), duration_minutes: 90 },
        actual_data: { date: plannedAt.toISOString() },
        notes: NOTES,
      })
      .select("id")
      .single();
    sourceId = created.id;

    await db.from("session_drills").insert(
      [
        ["Forehand", "offensive", "FRH-CRS", 15],
        ["Backhand", "neutral", "BKH-DTL", 20],
        ["Serve", "offensive", "SR1-DCE", 10],
      ].map(([category, character, drill_code, duration_minutes], index) => ({
        session_id: sourceId,
        coach_id: coach.id,
        organization_id: player.organization_id,
        category,
        character,
        drill_code,
        duration_minutes,
        status: "played",
        sort_order: index + 1,
      })),
    );

    await page.goto(`${base}/sessions/${sourceId}`);
    await page.waitForSelector("text=Also record for another player", {
      timeout: 30000,
    });
    check("dokončený tréning ponúka zápis ďalšiemu hráčovi", true);

    await page.selectOption("#copy_player", otherPlayer.id);
    await page.getByRole("button", { name: "Copy practice" }).click();
    // Čaká sa na presmerovanie NA INÝ tréning, nie na `/sessions/<čokoľvek>`
    // — tá adresa platí už pre zdrojovú stránku, takže by čakanie prešlo
    // okamžite a kontrola v DB by bežala skôr, než kópia vznikne.
    await page.waitForURL(
      (url) =>
        /\/sessions\/[0-9a-f-]+$/.test(url.pathname) &&
        !url.pathname.endsWith(sourceId),
      { timeout: 30000 },
    );

    const { data: copies } = await db
      .from("sessions")
      .select("id, status, notes, planned_data, actual_data, google_event_id")
      .eq("player_id", otherPlayer.id)
      .eq("coach_id", coach.id)
      .filter("planned_data->>date", "eq", plannedAt.toISOString());
    copyId = copies?.[0]?.id ?? null;

    check("druhý hráč dostal vlastný tréning", copies?.length === 1, `${copies?.length}`);

    if (copyId) {
      const copy = copies[0];
      check(
        "kópia je ODOMKNUTÁ, aby sa dala upraviť",
        copy.status !== "completed",
        copy.status,
      );
      check("reálny čas sa preniesol", Boolean(copy.actual_data?.date));
      check("poznámka sa preniesla", copy.notes === NOTES, String(copy.notes));
      check(
        "kópia nemá vlastnú udalosť v kalendári",
        copy.google_event_id === null,
        String(copy.google_event_id),
      );

      const { data: copiedDrills } = await db
        .from("session_drills")
        .select("drill_code, duration_minutes, sort_order")
        .eq("session_id", copyId)
        .order("sort_order", { ascending: true });
      check(
        "cvičenia sa preniesli aj s poradím",
        copiedDrills?.length === 3 &&
          copiedDrills[0].drill_code === "FRH-CRS" &&
          copiedDrills[2].drill_code === "SR1-DCE",
        (copiedDrills ?? []).map((d) => d.drill_code).join(","),
      );
      check(
        "kópia patrí tam, kam originál",
        (await db
          .from("sessions")
          .select("organization_id")
          .eq("id", copyId)
          .single()
        ).data.organization_id === player.organization_id,
      );
    }

    // Zdroj sa nesmie zmeniť — kópia je nový tréning, nie presun.
    const { data: sourceAfter } = await db
      .from("sessions")
      .select("status, player_id")
      .eq("id", sourceId)
      .single();
    check(
      "pôvodný tréning ostal nedotknutý",
      sourceAfter.status === "completed" && sourceAfter.player_id === player.id,
    );

    // Druhý pokus musí naraziť — inak by hráčovi pribudol duplikát a
    // analytika by mu zdvojnásobila odohraný čas.
    await page.goto(`${base}/sessions/${sourceId}`);
    await page.waitForTimeout(1000);
    await page.selectOption("#copy_player", otherPlayer.id);
    await page.getByRole("button", { name: "Copy practice" }).click();
    await page.waitForTimeout(2500);
    check(
      "druhé skopírovanie sa odmietlo",
      /already has a practice at that time/i.test(await browserText(page)),
    );

    const { count: total } = await db
      .from("sessions")
      .select("id", { count: "exact", head: true })
      .eq("player_id", otherPlayer.id)
      .filter("planned_data->>date", "eq", plannedAt.toISOString());
    check("duplikát naozaj nevznikol", total === 1, `${total}`);
  } finally {
    // Upratuje sa podľa TERMÍNU, nie podľa zapamätaných `id`: keď scenár
    // spadne skôr, než sa mu podarí prečítať id kópie, ostala by v databáze
    // a ďalší beh by na nej stroskotal na kontrole duplikátu.
    const { data: leftovers } = await db
      .from("sessions")
      .select("id")
      .eq("coach_id", coach.id)
      .in("player_id", [player.id, otherPlayer.id])
      .filter("planned_data->>date", "eq", plannedAt.toISOString());

    for (const { id } of leftovers ?? []) {
      await db.from("sessions").delete().eq("id", id);
      await db
        .from("parent_session_records")
        .delete()
        .eq("source_session_id", id);
    }
  }
}

/**
 * To isté, ale cieľom je hráč INÉHO trénera organizácie (vo federácii je
 * spoločný tréning bežný). Iné je na tom všetko podstatné: zápis robí
 * `security definer` RPC, kópia vzniká pod hráčovým vlastným trénerom a
 * zapisujúci sa na ňu **nemôže presmerovať** — RLS mu ju nevydá, takže
 * potvrdenie musí prísť priamo do formulára.
 */
async function copyAcrossCoachesScenario(page, base, db, coach, player, foreignPlayer) {
  const plannedAt = new Date();
  plannedAt.setDate(plannedAt.getDate() + 64);
  plannedAt.setHours(6, 45, 0, 0);
  let sourceId = null;

  try {
    const { data: created } = await db
      .from("sessions")
      .insert({
        coach_id: coach.id,
        organization_id: player.organization_id,
        player_id: player.id,
        status: "completed",
        planned_data: { date: plannedAt.toISOString(), duration_minutes: 90 },
        actual_data: { date: plannedAt.toISOString() },
      })
      .select("id")
      .single();
    sourceId = created.id;

    await db.from("session_drills").insert({
      session_id: sourceId,
      coach_id: coach.id,
      organization_id: player.organization_id,
      category: "Volley",
      character: "neutral",
      drill_code: "VOL-FRH",
      duration_minutes: 15,
      status: "played",
      sort_order: 1,
    });

    await page.goto(`${base}/sessions/${sourceId}`);
    await page.waitForSelector("text=Also record for another player", {
      timeout: 30000,
    });

    const options = await page
      .locator("#copy_player optgroup")
      .evaluateAll((groups) => groups.map((group) => group.label));
    check(
      "ponuka je rozdelená na mojich a cudzích hráčov",
      options.includes("My players") && options.includes("Other coaches' players"),
      options.join(" | "),
    );

    await page.selectOption("#copy_player", foreignPlayer.id);
    await page.getByRole("button", { name: "Copy practice" }).click();
    await page.waitForTimeout(3000);

    check(
      "zapisujúci ostal na svojom tréningu (na cudziu kópiu sa presmerovať nedá)",
      page.url().endsWith(sourceId),
      page.url(),
    );
    check(
      "formulár potvrdí, u koho tréning pristál",
      /it is now in .+'s app/i.test(await browserText(page)),
    );

    const { data: copies } = await db
      .from("sessions")
      .select("id, coach_id, player_id")
      .eq("player_id", foreignPlayer.id)
      .filter("planned_data->>date", "eq", plannedAt.toISOString());
    check("hráč kolegu dostal tréning", copies?.length === 1, `${copies?.length}`);
    check(
      "tréning patrí SVOJMU trénerovi, nie zapisujúcemu",
      copies?.[0]?.coach_id === foreignPlayer.coach_id,
      copies?.[0]?.coach_id === coach.id ? "zapisujúcemu" : "inému",
    );

    const { count: drills } = await db
      .from("session_drills")
      .select("id", { count: "exact", head: true })
      .eq("session_id", copies?.[0]?.id ?? sourceId);
    check("cvičenie sa prenieslo", drills === 1, `${drills}`);
  } finally {
    const { data: leftovers } = await db
      .from("sessions")
      .select("id")
      .in("player_id", [player.id, foreignPlayer.id])
      .filter("planned_data->>date", "eq", plannedAt.toISOString());
    for (const { id } of leftovers ?? []) {
      await db.from("sessions").delete().eq("id", id);
      await db
        .from("parent_session_records")
        .delete()
        .eq("source_session_id", id);
    }
  }
}

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

  section("7) Paywall: po skúšobnej dobe server zápis odmietne");
  // Samostatný (1:1) tréner na plaw.win — federačného sa paywall netýka.
  const db = serviceClient();
  const { data: users } = await db.auth.admin.listUsers({ perPage: 1000 });
  const solo = users.users.find((user) => user.email === "demo@plaw.win");
  const { data: before } = await db
    .from("profiles")
    .select("subscription_status, trial_ends_at")
    .eq("id", solo.id)
    .single();

  const soloContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const soloPage = await soloContext.newPage();

  try {
    await db
      .from("profiles")
      .update({
        subscription_status: "trial",
        trial_ends_at: new Date(Date.now() - 86_400_000).toISOString(),
      })
      .eq("id", solo.id);

    const soloBase = `http://${APP_HOST}`;
    await browserLogin(soloPage, "demo@plaw.win", soloBase);
    await soloPage.goto(`${soloBase}/sessions`);
    await soloPage.waitForTimeout(1500);
    check(
      "pruh o konci skúšobnej doby je vidieť",
      /free trial has ended/i.test(await browserText(soloPage)),
    );

    const { count: sessionsBefore } = await db
      .from("sessions")
      .select("id", { count: "exact", head: true })
      .eq("coach_id", solo.id);

    // Formulár sa odošle naozaj — zamietnuť to musí server, nie skryté tlačidlo.
    // Plánovanie je dvojkrokové: vyplniť termín → potvrdiť.
    await soloPage.fill('input[name="date"]', "2026-09-01T10:00");
    await soloPage.locator('form button[type="button"]').first().click();
    await soloPage.waitForTimeout(500);
    await soloPage.locator('form button[type="submit"]').first().click();
    await soloPage.waitForTimeout(2500);

    const { count: sessionsAfter } = await db
      .from("sessions")
      .select("id", { count: "exact", head: true })
      .eq("coach_id", solo.id);
    check(
      "tréning sa NEZAPÍSAL",
      sessionsBefore === sessionsAfter,
      `${sessionsBefore} → ${sessionsAfter}`,
    );
    // „Renew your subscription" je len v chybe server action, nie v pruhu —
    // inak by check prešiel aj vtedy, keby akcia mlčky zlyhala.
    check(
      "formulár vypíše dôvod zamietnutia",
      /renew your subscription/i.test(await browserText(soloPage)),
    );
  } finally {
    await db
      .from("profiles")
      .update({
        subscription_status: before.subscription_status,
        trial_ends_at: before.trial_ends_at,
      })
      .eq("id", solo.id);
    await soloContext.close();
  }

  section("8) Cenová hladina: koľko hráčov smie mať samostatný tréner");
  // Limit hráčov nie je v RLS, ale v server action (`requirePlayerSlot`), takže
  // sa nedá overiť dotazom do DB ani cez holé HTTP — formulár sa musí naozaj
  // odoslať. Scenár po sebe upratuje v `finally`: inak by ďalšiemu behu ostal
  // navyše založený hráč aj zdvihnutá hladina.
  const limitContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const limitPage = await limitContext.newPage();
  const appBase = `http://${APP_HOST}`;
  const EXTRA_PLAYER = "Limit Test";
  const startedAt = new Date().toISOString();

  const activeCount = async () => {
    const { count } = await db
      .from("players")
      .select("id", { count: "exact", head: true })
      .eq("coach_id", solo.id)
      .eq("is_active", true)
      .is("organization_id", null);
    return count ?? 0;
  };

  try {
    await db.from("profiles").update({ player_limit: 1 }).eq("id", solo.id);

    await browserLogin(limitPage, "demo@plaw.win", appBase);
    await limitPage.goto(`${appBase}/players`);
    await limitPage.waitForTimeout(1500);
    check(
      "hladina je vidieť na stránke",
      /1 of 1 active players/.test(await browserText(limitPage)),
    );

    const playersBefore = await activeCount();

    // Formulár sa odosiela naozaj — zamietnuť to musí server.
    await limitPage.fill('input[name="name"]', EXTRA_PLAYER);
    await limitPage
      .locator('form:has(input[name="name"]) button[type="submit"]')
      .click();
    await limitPage.waitForTimeout(2500);

    const playersBlocked = await activeCount();
    check(
      "druhý hráč sa pri hladine 1 NEZALOŽIL",
      playersBlocked === playersBefore,
      `${playersBefore} → ${playersBlocked}`,
    );
    check(
      "formulár vypíše dôvod zamietnutia",
      /number of active players your plan allows/i.test(
        await browserText(limitPage),
      ),
    );

    // Predaj vyššej hladiny = jeden UPDATE, presne ako sedadlá organizácie.
    await db.from("profiles").update({ player_limit: 3 }).eq("id", solo.id);
    await limitPage.goto(`${appBase}/players`);
    await limitPage.waitForTimeout(1000);
    await limitPage.fill('input[name="name"]', EXTRA_PLAYER);
    await limitPage
      .locator('form:has(input[name="name"]) button[type="submit"]')
      .click();
    await limitPage.waitForTimeout(2500);

    const playersRaised = await activeCount();
    check(
      "po zdvihnutí hladiny hráč pribudol a je AKTÍVNY",
      playersRaised === playersBefore + 1,
      `${playersBefore} → ${playersRaised}`,
    );

    // Druhý hráč zapína dennú nástenku aj mimo federácie — rozcestník s jedným
    // hráčom nemá čo zoraďovať, s dvoma už áno.
    await limitPage.goto(`${appBase}/`);
    await limitPage.waitForTimeout(2000);
    check(
      "nástenka „Dnes\" sa zapla aj samostatnému trénerovi",
      /Today's schedule/.test(await browserText(limitPage)),
    );

    // --- zníženie hladiny pod počet hráčov ---------------------------------
    // Nikoho nearchivuje (appka nesmie vyberať, ktoré deti tréner prestane
    // trénovať), ale zastaví zápis, kým sa tréner sám nevráti pod hladinu.
    await db.from("profiles").update({ player_limit: 1 }).eq("id", solo.id);
    await limitPage.goto(`${appBase}/players`);
    await limitPage.waitForTimeout(1500);
    check(
      "zníženie hladiny nikoho nearchivovalo",
      (await activeCount()) === playersBefore + 1,
    );
    check(
      "pruh povie, koľko hráčov ubrať",
      /Archive 1 player to start planning/i.test(await browserText(limitPage)),
    );

    const { count: sessionsBefore } = await db
      .from("sessions")
      .select("id", { count: "exact", head: true })
      .eq("coach_id", solo.id);

    // Formulár sa zacieľuje cez vlastné pole, nie cez `form button` — pri 2+
    // hráčoch je nad ním prepínač hráčov, ktorý má tiež formulár s tlačidlami,
    // takže `.first()` by klikol naň a scenár by „prešiel" bez odoslania.
    await limitPage.goto(`${appBase}/sessions`);
    await limitPage.waitForTimeout(1500);
    await limitPage.fill('input[name="date"]', "2026-09-02T10:00");
    const blockedForm = limitPage.locator('form:has(input[name="date"])');
    await blockedForm.locator('button[type="button"]').first().click();
    await limitPage.waitForTimeout(500);
    await blockedForm.locator('button[type="submit"]').first().click();
    await limitPage.waitForTimeout(2500);

    const { count: sessionsBlocked } = await db
      .from("sessions")
      .select("id", { count: "exact", head: true })
      .eq("coach_id", solo.id);
    check(
      "nad hladinou sa tréning NEZAPÍSAL",
      sessionsBefore === sessionsBlocked,
      `${sessionsBefore} → ${sessionsBlocked}`,
    );
    check(
      "formulár vypíše, že hráčov je priveľa",
      /more active players than your plan allows/i.test(
        await browserText(limitPage),
      ),
    );

    // --- cesta späť --------------------------------------------------------
    // Archivácia je jediná výnimka z blokovania — bez nej by tréner uviazol
    // natrvalo (zapisovať nesmie, kým neuberie, a ubrať by nemohol).
    await limitPage.goto(`${appBase}/players`);
    await limitPage.waitForTimeout(1500);
    await limitPage
      .locator("li", { hasText: EXTRA_PLAYER })
      .getByRole("button", { name: "Archive" })
      .first()
      .click();
    await limitPage.waitForTimeout(2500);
    check(
      "archivácia funguje aj nad hladinou",
      (await activeCount()) === playersBefore,
      `aktívnych: ${await activeCount()}`,
    );

    await limitPage.goto(`${appBase}/sessions`);
    await limitPage.waitForTimeout(1500);
    await limitPage.fill('input[name="date"]', "2026-09-02T10:00");
    const freedForm = limitPage.locator('form:has(input[name="date"])');
    await freedForm.locator('button[type="button"]').first().click();
    await limitPage.waitForTimeout(500);
    await freedForm.locator('button[type="submit"]').first().click();
    await limitPage.waitForTimeout(2500);

    const { count: sessionsAfter } = await db
      .from("sessions")
      .select("id", { count: "exact", head: true })
      .eq("coach_id", solo.id);
    check(
      "po návrate pod hladinu sa zápis zase podaril",
      sessionsAfter === sessionsBefore + 1,
      `${sessionsBefore} → ${sessionsAfter}`,
    );
  } finally {
    // Tréning založený posledným krokom aj testovací hráč musia zmiznúť —
    // inak by ďalší beh sedel na cudzích dátach. Spolu s tréningom treba
    // zmazať aj kópiu u rodiča: DELETE sa k nemu zámerne nepropaguje (§
    // „Zdieľanie s rodičom"), takže by mu po každom behu pribudol tréning.
    const { data: leftovers } = await db
      .from("sessions")
      .select("id")
      .eq("coach_id", solo.id)
      .gte("created_at", startedAt);
    const leftoverIds = (leftovers ?? []).map((session) => session.id);
    if (leftoverIds.length) {
      await db.from("sessions").delete().in("id", leftoverIds);
      await db
        .from("parent_session_records")
        .delete()
        .in("source_session_id", leftoverIds);
    }
    await db
      .from("players")
      .delete()
      .eq("coach_id", solo.id)
      .eq("name", EXTRA_PLAYER);
    await db.from("profiles").update({ player_limit: 1 }).eq("id", solo.id);
    await limitContext.close();
  }

  section("9) Presun naplánovaného tréningu — federačný režim");
  const orgCoach = users.users.find(
    (user) => user.email === "coach-today@test.local",
  );
  const { data: orgPlayer } = await db
    .from("players")
    .select("id, name, organization_id")
    .eq("coach_id", orgCoach.id)
    .eq("is_active", true)
    .not("organization_id", "is", null)
    .limit(1)
    .single();
  await rescheduleScenario(page, BASE, db, orgCoach, orgPlayer);

  section("9b) Zrušenie tréningu s väzbou na kalendár — federačný režim");
  await cancelScenario(page, BASE, db, orgCoach, orgPlayer, true);

  section("9c) Skupinový tréning: zápis aj ďalšiemu hráčovi");
  const { data: orgPlayers } = await db
    .from("players")
    .select("id, name, organization_id")
    .eq("coach_id", orgCoach.id)
    .eq("is_active", true)
    .not("organization_id", "is", null)
    .order("name", { ascending: true })
    .limit(2);
  await copyScenario(page, BASE, db, orgCoach, orgPlayers[0], orgPlayers[1]);

  section("9d) Skupinový tréning naprieč trénermi organizácie");
  const otherCoach = users.users.find(
    (user) => user.email === "coach2-today@test.local",
  );
  const { data: foreignPlayer } = await db
    .from("players")
    .select("id, name, coach_id, organization_id")
    .eq("coach_id", otherCoach.id)
    .eq("is_active", true)
    .limit(1)
    .single();
  await copyAcrossCoachesScenario(
    page,
    BASE,
    db,
    orgCoach,
    orgPlayers[0],
    foreignPlayer,
  );

  section("10) Presun naplánovaného tréningu — samostatný tréner");
  // Tá istá akcia, iný režim: samostatnému trénerovi platí osobná RLS policy
  // (`sessions_personal_update`) a `organization_id` je null.
  const soloRescheduleContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const soloReschedulePage = await soloRescheduleContext.newPage();
  try {
    const { data: soloPlayer } = await db
      .from("players")
      .select("id, name, organization_id")
      .eq("coach_id", solo.id)
      .eq("is_active", true)
      .is("organization_id", null)
      .limit(1)
      .single();
    const soloBase = `http://${APP_HOST}`;
    await browserLogin(soloReschedulePage, "demo@plaw.win", soloBase);
    await rescheduleScenario(
      soloReschedulePage,
      soloBase,
      db,
      solo,
      soloPlayer,
    );

    section("10b) Zrušenie tréningu s väzbou na kalendár — samostatný tréner");
    await cancelScenario(soloReschedulePage, soloBase, db, solo, soloPlayer, false);

    section("10c) S jediným hráčom sa zápis ďalšiemu hráčovi neponúka");
    // Tréner na hladine 1 nemá koho ponúknuť — prázdny výber by bol mätúci.
    const { data: onlySession } = await db
      .from("sessions")
      .insert({
        coach_id: solo.id,
        organization_id: null,
        player_id: soloPlayer.id,
        status: "planned",
        planned_data: {
          date: new Date(Date.now() + 63 * 86_400_000).toISOString(),
          duration_minutes: 60,
        },
      })
      .select("id")
      .single();
    try {
      await soloReschedulePage.goto(`${soloBase}/sessions/${onlySession.id}`);
      await soloReschedulePage.waitForTimeout(1500);
      check(
        "ponuka sa nevykreslila",
        !/Also record for another player/.test(
          await browserText(soloReschedulePage),
        ),
      );
    } finally {
      await db.from("sessions").delete().eq("id", onlySession.id);
      await db
        .from("parent_session_records")
        .delete()
        .eq("source_session_id", onlySession.id);
    }
  } finally {
    await soloRescheduleContext.close();
  }

  report();
  await browser.close();
}

main().catch((error) => {
  console.error("CHYBA:", error.message || error);
  process.exit(1);
});
