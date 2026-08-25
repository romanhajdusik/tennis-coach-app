// Bezpečnostné scenáre na HRANICIACH medzi tromi režimami (audit 2026-08-15).
//
// Prečo samostatná sada: `rls-solo.js` overuje samostatný režim, `rls-org.js`
// federačný a `card-links.js` prepojenie kariet — každá zvnútra svojho sveta.
// Diery ale nevznikajú vnútri režimu, ale na prechode medzi nimi: „federačný
// tréner si otvorí plaw.win", „prepojenie kódom siahne na org kartu",
// „neprihlásený zavolá RPC priamo cez PostgREST". Tieto scenáre sú presne tie
// prechody.
//
// Sada zároveň stráži výsledok auditu: **granty musia ostať najmenšie
// potrebné** (migrácia `20260815110000`). Ten nález vznikol tak, že `grant
// select` v migrácii nič neodobral — tabuľka už mala všetko z default
// privileges schémy. Kontroly nižšie to chytia, keby sa to zopakovalo.
//
// Spúšťa sa proti LOKÁLNEJ Supabase, nepotrebuje dev server. **Granty ale
// overuj aj proti produkcii** — lokálna inštancia vznikla s inými
// predvolenými právami (viď README).
const {
  serviceClient,
  anonClient,
  signIn,
  ensureFitnessCoach,
  createChecks,
} = require("./helpers");

const { check, section, report } = createChecks();
const db = serviceClient();

/** Práva, ktoré `authenticated` na tabuľke SMIE mať. Čokoľvek navyše je nález. */
const ALLOWED_GRANTS = {
  player_links: ["INSERT", "SELECT"],
  player_assignments: ["SELECT"],
  metrics_and_tests: ["SELECT"],
  organizations: ["SELECT"],
  profiles: ["SELECT"],
  parent_session_records: ["SELECT"],
  parent_session_drill_records: ["SELECT"],
};

async function main() {
  const { data: users } = await db.auth.admin.listUsers({ perPage: 1000 });
  const byEmail = (email) => users.users.find((user) => user.email === email);

  const solo = byEmail("demo@plaw.win");
  const orgCoach = byEmail("coach-today@test.local");
  const { coach: fitness, player: fitnessPlayer } = await ensureFitnessCoach(db);

  const { data: soloPlayer } = await db
    .from("players")
    .select("id, name")
    .eq("coach_id", solo.id)
    .is("organization_id", null)
    .eq("is_active", true)
    .limit(1)
    .single();

  const { data: orgPlayer } = await db
    .from("players")
    .select("id, name, organization_id")
    .not("organization_id", "is", null)
    .eq("is_active", true)
    .limit(1)
    .single();

  const asSolo = await signIn("demo@plaw.win");
  const asOrgCoach = await signIn("coach-today@test.local");
  const asParent = await signIn("parent-test@test.local");
  const anon = anonClient();

  const cleanup = [];

  try {
    section("1) Granty sú najmenšie potrebné (migrácia 20260815110000)");
    // Overuje sa SPRÁVANÍM, nie čítaním migrácie — presne preto, že `grant`
    // v migrácii nič neodobral a tabuľky mali plné DML z default privileges.
    const linkUpdate = await asSolo
      .from("player_links")
      .update({ status: "revoked" })
      .eq("link_code", "NEEXISTUJE")
      .select("id");
    check(
      "player_links: UPDATE neprejde (grant ani policy)",
      linkUpdate.error !== null || (linkUpdate.data ?? []).length === 0,
      linkUpdate.error?.message,
    );

    const assignInsert = await asOrgCoach.from("player_assignments").insert({
      organization_id: orgPlayer.organization_id,
      player_id: orgPlayer.id,
      coach_id: orgCoach.id,
      discipline: "fitness",
    });
    check(
      "player_assignments: INSERT neprejde — priradenie si tréner nedá sám",
      assignInsert.error !== null,
      assignInsert.error?.message,
    );

    const metricsInsert = await asSolo.from("metrics_and_tests").insert({
      coach_id: solo.id,
      player_id: soloPlayer.id,
      test_type: "audit",
      results: {},
      tested_at: new Date().toISOString().slice(0, 10),
    });
    check(
      "metrics_and_tests: INSERT neprejde (modul testov odložený)",
      metricsInsert.error !== null,
      metricsInsert.error?.message,
    );

    section("2) Neprihlásený proti tabuľkám aj RPC");
    for (const table of Object.keys(ALLOWED_GRANTS)) {
      const read = await anon.from(table).select("*").limit(1);
      check(
        `anon nečíta ${table}`,
        read.error !== null || (read.data ?? []).length === 0,
        read.error?.message,
      );
    }
    // PUBLIC stratil EXECUTE na `security definer` funkciách (audit). Aj keby
    // ho niekto vrátil, funkcie sa bránia samy cez `auth.uid()`.
    for (const fn of [
      ["assign_player_to_coach", { p_player_id: orgPlayer.id, p_coach_id: orgCoach.id }],
      ["delete_organization_member", { p_member_id: orgPlayer.id }],
      ["org_players_for_copy", {}],
    ]) {
      const call = await anon.rpc(fn[0], fn[1]);
      const denied =
        call.error !== null || (call.data ?? []).length === 0;
      check(`anon nespustí ${fn[0]}`, denied, call.error?.message);
    }

    section("3) Prepojenie kariet nesiaha na federačného hráča");
    // Dáta zväzu si dvaja jeho zamestnanci nesprístupňujú kódmi (§5.6).
    const orgAsSource = await asOrgCoach.from("player_links").insert({
      source_player_id: orgPlayer.id,
      source_coach_id: orgCoach.id,
      source_discipline: "tennis",
      link_code: "BOUND001",
      status: "pending",
    });
    check("org tréner nevydá kód na org hráča", orgAsSource.error !== null);

    const { data: link } = await db
      .from("player_links")
      .insert({
        source_player_id: fitnessPlayer.id,
        source_coach_id: fitness.id,
        source_discipline: "fitness",
        link_code: "BOUND002",
        status: "pending",
      })
      .select("id")
      .single();
    cleanup.push(() => db.from("player_links").delete().eq("id", link.id));

    const orgAsTarget = await asOrgCoach.rpc("claim_player_link", {
      p_code: "BOUND002",
      p_player_id: orgPlayer.id,
      p_discipline: "tennis",
    });
    check(
      "org tréner kód nezaklaimuje na org hráča",
      orgAsTarget.error !== null,
      orgAsTarget.error?.message,
    );

    section("4) Čitateľ prepojenia sa nedostane za hranicu čítania");
    await asSolo.rpc("claim_player_link", {
      p_code: "BOUND002",
      p_player_id: soloPlayer.id,
      p_discipline: "tennis",
    });

    const forbidden = [
      ["players", asSolo.from("players").select("id").eq("id", fitnessPlayer.id)],
      ["drill_codes", asSolo.from("drill_codes").select("id").eq("coach_id", fitness.id)],
      ["player_connections", asSolo.from("player_connections").select("id").eq("coach_id", fitness.id)],
      ["profiles", asSolo.from("profiles").select("id").eq("id", fitness.id)],
      ["google_calendar_connections", asSolo.from("google_calendar_connections").select("coach_id").eq("coach_id", fitness.id)],
    ];
    for (const [name, query] of forbidden) {
      const { data } = await query;
      check(`cez prepojenie sa nedostane k ${name}`, (data ?? []).length === 0);
    }

    // Súhrn opačným smerom (migrácia `20260824090000`) je cesta k CUDZÍM
    // súčtom, takže patrí na hranicu režimov: rozhodnúť oň smie výhradne strana,
    // ktorej dáta to sú, a federačný účet sa k nemu nedostane vôbec.
    const orgToggles = await asOrgCoach.rpc("set_link_summary_sharing", {
      p_link_id: link.id,
      p_enabled: true,
    });
    check(
      "org tréner neprepne súhlas cudzieho prepojenia",
      orgToggles.error !== null && /not_your_link/.test(orgToggles.error.message),
      orgToggles.error?.message,
    );

    await asSolo.rpc("set_link_summary_sharing", {
      p_link_id: link.id,
      p_enabled: true,
    });
    const orgSummary = await asOrgCoach.rpc("linked_player_category_minutes", {
      p_player_id: fitnessPlayer.id,
      p_start: new Date(Date.UTC(2020, 0, 1)).toISOString(),
      p_end: new Date(Date.UTC(2100, 0, 1)).toISOString(),
    });
    check(
      "org tréner nedostane súhrn z cudzieho prepojenia",
      (orgSummary.data ?? []).length === 0,
      `riadkov: ${(orgSummary.data ?? []).length}`,
    );

    section("5) Federačný tréner mimo svojej organizácie");
    // RLS sa pýta ČLENSTVA, nie hostname — org tréner teda „na plaw.win"
    // nesmie vidieť ani si založiť osobné dáta.
    const personalPlayers = await asOrgCoach
      .from("players")
      .select("id")
      .is("organization_id", null);
    check(
      "nevidí osobných hráčov nikoho",
      (personalPlayers.data ?? []).length === 0,
      `riadkov: ${(personalPlayers.data ?? []).length}`,
    );

    const personalInsert = await asOrgCoach.from("players").insert({
      coach_id: orgCoach.id,
      name: "Osobný hráč org trénera",
      is_active: true,
    });
    check("nezaloží si osobného hráča", personalInsert.error !== null);

    section("6) Rodič nedosiahne na živé dáta");
    // Rodičovská vrstva stojí na KÓPIÁCH; keby videla `sessions`, stratil by
    // zmysel celý model (kópie prežijú zrušenie prepojenia, živé dáta nie).
    for (const table of ["sessions", "session_drills", "player_links"]) {
      const { data } = await asParent.from(table).select("id").limit(5);
      check(`rodič nečíta ${table}`, (data ?? []).length === 0);
    }
  } finally {
    for (const fn of cleanup.reverse()) await fn();
    await db.from("player_links").delete().in("link_code", ["BOUND001", "BOUND002"]);
  }

  report();
}

main().catch((error) => {
  console.error("CHYBA:", error.message || error);
  process.exit(1);
});
