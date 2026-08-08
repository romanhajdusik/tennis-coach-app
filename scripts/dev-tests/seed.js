// Naseeduje lokálnu Supabase pre overovacie skripty: testovaciu organizáciu
// so šéftrénerom a dvoma trénermi, hráčov v rôznych stavoch, cvičenia
// v dokončených tréningoch a pripojeného rodiča.
//
// Spúšťa sa opakovane (je idempotentný) — hráčov a tréningy testovacích
// trénerov vždy prepíše načisto. Použitie: `node scripts/dev-tests/seed.js`
// (voliteľne `--sixth` pridá šiesteho hráča na test počtu stĺpcov).
const fs = require("node:fs");
const path = require("node:path");
const { createClient } = require("@supabase/supabase-js");
const {
  SUPABASE_URL,
  ANON_KEY,
  ORG_SLUG,
  PASSWORD,
  serviceClient,
} = require("./helpers");

const db = serviceClient();

const DIRECTOR = "director-today@test.local";
const COACH = "coach-today@test.local";
const COACH2 = "coach2-today@test.local";
/** Účet bez členstva — slúži na test onboardingu (zadanie pozývacieho kódu). */
const NEW_COACH = "coach-new@test.local";
const PARENT = "parent-test@test.local";
const SIXTH_PLAYER = "Lukas Siesty";

/**
 * Dnešné tréningy sa kotvia na okraje dňa, nie relatívne k „teraz" — inak pri
 * behu tesne pred/po polnoci spadne „dnes −3 h" na iný deň a scenár sa rozsype.
 * Znamienko určuje len to, či je tréning v minulosti alebo v budúcnosti.
 */
function at(dayOffset, direction) {
  const date = new Date();
  if (dayOffset === 0) {
    if (direction < 0) date.setHours(0, 5, 0, 0);
    else date.setHours(23, 55, 0, 0);
  } else {
    date.setDate(date.getDate() + dayOffset);
    date.setHours(15, 0, 0, 0);
  }
  return date.toISOString();
}

async function ensureUser(email, fullName) {
  const { data: users } = await db.auth.admin.listUsers({ perPage: 1000 });
  let user = users.users.find((account) => account.email === email);

  if (!user) {
    const { data, error } = await db.auth.admin.createUser({
      email,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { role: "coach" },
    });
    if (error) throw error;
    user = data.user;
  }

  await db.from("profiles").upsert({
    id: user.id,
    role: fullName === "Rodic Testovaci" ? "parent" : "coach",
    email,
    full_name: fullName,
  });
  return user;
}

/**
 * Členstvo sa zakladá cez pozvánku + claim, nie priamym zápisom `user_id` —
 * trigger `enforce_membership_rules` iný spôsob nedovolí (členstvo je
 * dobrovoľné).
 */
async function ensureMembership(organizationId, user, role) {
  const { data: existing } = await db
    .from("organization_members")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (existing) return;

  const code = "SEED-" + Math.random().toString(36).slice(2, 8).toUpperCase();
  const { error } = await db.from("organization_members").insert({
    organization_id: organizationId,
    role,
    status: "invited",
    invite_code: code,
  });
  if (error) throw error;

  const asUser = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false },
  });
  const { error: signInError } = await asUser.auth.signInWithPassword({
    email: user.email,
    password: PASSWORD,
  });
  if (signInError) throw signInError;

  const { error: claimError } = await asUser.rpc("claim_organization_invite", {
    p_code: code,
  });
  if (claimError) throw claimError;
}

async function main() {
  const withSixth = process.argv.includes("--sixth");

  // --- organizácia ---------------------------------------------------------
  let { data: org } = await db
    .from("organizations")
    .select("id")
    .eq("slug", ORG_SLUG)
    .maybeSingle();

  if (!org) {
    const { data, error } = await db
      .from("organizations")
      .insert({
        name: "Today Test Academy",
        slug: ORG_SLUG,
        type: "academy",
        sport: "tennis",
        seat_limit: 10,
      })
      .select("id")
      .single();
    if (error) throw error;
    org = data;
  }

  // --- účty a členstvo -----------------------------------------------------
  const director = await ensureUser(DIRECTOR, "Diana Riaditelova");
  const coach = await ensureUser(COACH, "Andrea Prva");
  const coach2 = await ensureUser(COACH2, "Boris Druhy");
  await ensureUser(NEW_COACH, "Cerstvy Tréner");

  await ensureMembership(org.id, director, "director");
  await ensureMembership(org.id, coach, "coach");
  await ensureMembership(org.id, coach2, "coach");

  // --- hráči a tréningy ----------------------------------------------------
  for (const account of [coach, coach2]) {
    await db.from("sessions").delete().eq("coach_id", account.id);
    await db.from("players").delete().eq("coach_id", account.id);
  }

  // meno, [dayOffset, smer (len pre dnešok), stav]
  const roster = [
    ["Adam Kovac", [[-1, 0, "completed"], [0, 1, "planned"]]],
    ["Ema Horvathova", [[0, -1, "completed"], [1, 0, "planned"]]],
    ["Sofia Molnarova", [[-6, 0, "completed"], [1, 0, "planned"]]],
    ["Jakub Simon", [[-12, 0, "completed"]]],
    ["Nina Bakova", []],
  ];
  if (withSixth) {
    roster.push([SIXTH_PLAYER, [[-3, 0, "completed"]]]);
  }

  const created = [];
  for (const [name, plan] of roster) {
    const { data: player, error } = await db
      .from("players")
      .insert({
        coach_id: coach.id,
        organization_id: org.id,
        name,
        birth_year: 2012,
        is_active: true,
      })
      .select("id")
      .single();
    if (error) throw error;

    for (const [dayOffset, direction, status] of plan) {
      const date = at(dayOffset, direction);
      const { error: sessionError } = await db.from("sessions").insert({
        coach_id: coach.id,
        organization_id: org.id,
        player_id: player.id,
        status,
        planned_data: { date, duration_minutes: 90 },
        actual_data: status === "completed" ? { date } : null,
      });
      if (sessionError) throw sessionError;
    }
    created.push(name);
  }

  // Druhý tréner s jedným hráčom — pult musí vedieť zoskupovať podľa trénera.
  const { data: otherPlayer, error: otherError } = await db
    .from("players")
    .insert({
      coach_id: coach2.id,
      organization_id: org.id,
      name: "Tomas Novy",
      birth_year: 2013,
      is_active: true,
    })
    .select("id")
    .single();
  if (otherError) throw otherError;

  const otherDate = at(-2, 0);
  await db.from("sessions").insert({
    coach_id: coach2.id,
    organization_id: org.id,
    player_id: otherPlayer.id,
    status: "completed",
    planned_data: { date: otherDate, duration_minutes: 60 },
    actual_data: { date: otherDate },
  });

  // --- cvičenia v dokončených tréningoch (aby mala analytika čo kresliť) ---
  const drillPlan = [
    ["Forehand", "offensive", "FRH-CC", 30],
    ["Forehand", "neutral", "FRH-DL", 15],
    ["Backhand", "defensive", "BKH-CC", 20],
    ["Serve", "offensive", "SR1-T", 15],
    ["GAME DRILLS", "neutral", "GD-2v1", 15],
  ];

  const { data: completed } = await db
    .from("sessions")
    .select("id, coach_id")
    .eq("organization_id", org.id)
    .eq("status", "completed");

  let drillCount = 0;
  for (const session of completed ?? []) {
    const { count } = await db
      .from("session_drills")
      .select("id", { count: "exact", head: true })
      .eq("session_id", session.id);
    if (count) continue;

    const rows = drillPlan.map(
      ([category, character, drill_code, duration_minutes], index) => ({
        session_id: session.id,
        coach_id: session.coach_id,
        organization_id: org.id,
        category,
        character,
        drill_code,
        duration_minutes,
        status: "played",
        sort_order: index + 1,
      }),
    );
    const { error } = await db.from("session_drills").insert(rows);
    if (error) throw error;
    drillCount += rows.length;
  }

  // --- rodič pripojený k hráčovi samostatného trénera ----------------------
  const { data: users } = await db.auth.admin.listUsers({ perPage: 1000 });
  const demoCoach = users.users.find((u) => u.email === "demo@plaw.win");
  let parentNote = "preskočené (demo@plaw.win neexistuje)";

  if (demoCoach) {
    const parent = await ensureUser(PARENT, "Rodic Testovaci");
    const { data: demoPlayer } = await db
      .from("players")
      .select("id")
      .eq("coach_id", demoCoach.id)
      .eq("is_active", true)
      .maybeSingle();

    if (demoPlayer) {
      // Prepojenie sa robí VŽDY nanovo, aj keď rodič už pripojený je.
      // Claim je jediné miesto, kde sa dopĺňa spätná história do
      // `parent_session_records` — keby sa seed pri existujúcom prepojení
      // preskočil (tak to bolo pôvodne), rodič by po zmazaní kópií ostal
      // natrvalo bez histórie a `rls-solo.js` by padala na stave dát, nie na
      // chybe appky.
      await db.from("player_connections").delete().eq("parent_id", parent.id);
      const code = "PAR-" + Math.random().toString(36).slice(2, 8).toUpperCase();
      await db.from("player_connections").insert({
        coach_id: demoCoach.id,
        player_id: demoPlayer.id,
        connect_code: code,
        status: "pending",
      });
      const asParent = createClient(SUPABASE_URL, ANON_KEY, {
        auth: { persistSession: false },
      });
      await asParent.auth.signInWithPassword({
        email: PARENT,
        password: PASSWORD,
      });
      await asParent.rpc("claim_player_connection", { p_code: code });
      const { count } = await db
        .from("parent_session_records")
        .select("id", { count: "exact", head: true })
        .eq("parent_id", parent.id);
      parentNote = `pripojený (${count} tréningov v kópii)`;
    }
  }

  // --- očakávania pre testy ------------------------------------------------
  // Seed zapíše, čo má appka zobraziť: testy sa tak nerozbijú, keď sa spustia
  // v inú hodinu (dnešný tréning môže byť už odohraný alebo ešte len príde).
  const { data: seeded } = await db
    .from("sessions")
    .select("status, planned_data, actual_data")
    .eq("coach_id", coach.id);

  const now = new Date();
  const dayKey = (date) =>
    new Intl.DateTimeFormat("en-CA", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(date);
  const todayKey = dayKey(now);
  const dated = (seeded ?? []).map((row) => ({
    status: row.status,
    date: new Date(row.actual_data?.date ?? row.planned_data.date),
  }));

  const expectations = {
    activePlayers: created.length,
    sessionsToday: dated.filter((s) => dayKey(s.date) === todayKey).length,
    stillAhead: dated.filter(
      (s) => dayKey(s.date) === todayKey && s.status === "planned" && s.date > now,
    ).length,
  };
  fs.writeFileSync(
    path.join(__dirname, "expect.json"),
    JSON.stringify(expectations, null, 2),
  );

  console.log("organizácia:", ORG_SLUG);
  console.log("hráči trénera Andrea:", created.join(", "));
  console.log("cvičenia doplnené:", drillCount);
  console.log("rodič:", parentNote);
  console.log("očakávania:", JSON.stringify(expectations));
}

main().catch((error) => {
  console.error("CHYBA:", error.message || error);
  process.exit(1);
});
