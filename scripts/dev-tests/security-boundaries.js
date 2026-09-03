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

// Kontrola z tretieho nálezu (2026-09-02) potrebuje SKUTOČNÝ obsah katalógu,
// nie odpoveď PostgRESTu: `anon` bez práva EXECUTE aj `anon` s právom, ktorému
// sa funkcia ubráni sama cez `auth.uid()`, vyzerajú z klienta skoro rovnako.
// Preto sa `pg_proc` číta priamo — cez `psql` v kontajneri lokálnej Supabase.
const { execFileSync } = require("node:child_process");

// `has_function_privilege` je správna otázka („smie to `anon` spustiť?"), lebo
// počíta aj právo zdedené cez PUBLIC — na rozdiel od surového `proacl`, kde by
// sa PUBLIC grant musel dohľadávať zvlášť.
//
// TEN ISTÝ DOTAZ SA DÁ VLOŽIŤ DO PROD SQL EDITORA a je to jediný spôsob, ako
// stav overiť na produkcii: lokálna inštancia vznikla s inými predvolenými
// právami Supabase (viď README), takže „lokálne je to v poriadku" o produkcii
// nehovorí nič.
const ANON_EXECUTE_SQL = `
  select p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')'
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.prokind in ('f', 'p')
    and has_function_privilege('anon', p.oid, 'execute')
  order by 1
`;

/** Funkcie v schéme `public`, ktoré dnes smie spustiť neprihlásený. */
function anonExecutableFunctions() {
  const containers = execFileSync(
    "docker",
    ["ps", "--filter", "name=supabase_db", "--format", "{{.Names}}"],
    { encoding: "utf8" },
  )
    .trim()
    .split("\n")
    .filter(Boolean);

  if (containers.length === 0) {
    throw new Error(
      "nenašiel sa kontajner `supabase_db_*` — beží `npx supabase start`?",
    );
  }

  return execFileSync(
    "docker",
    ["exec", containers[0], "psql", "-U", "postgres", "-d", "postgres", "-At", "-c", ANON_EXECUTE_SQL],
    { encoding: "utf8" },
  )
    .trim()
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

/**
 * Jediné dve funkcie, ktoré `anon` spúšťať SMIE (migrácia `20260902100000`).
 * Pribudnúť sem smie len funkcia, ktorú naozaj volá neprihlásený — a s tým
 * vedomím, že sa vtedy o ňu opiera celá obrana, lebo `auth.uid()` je NULL.
 */
const ANON_MAY_EXECUTE = [
  "organization_by_slug(p_slug text)",
  "promo_code_is_valid(p_code text)",
];

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

    section("7) `anon` nespustí ani jednu funkciu navyše (nález 2026-09-02)");
    // Prečo je táto sekcia zvlášť a prečo číta katalóg: §2 vyššie overuje, že
    // `anon` z funkcie nič nedostane — lenže to platilo aj VTEDY, keď na ňu
    // EXECUTE mal, pretože si ho každá funkcia odmietla sama cez `auth.uid()`.
    // Nález bol presne v tom rozdiele: obrana bola jednovrstvová a v migrácii
    // to vyzeralo správne (`revoke … from public` explicitný `anon` grant
    // neodoberá). Prvá funkcia, ktorá na `auth.uid()` zabudne, by bola
    // volateľná z internetu. Preto sa tu porovnáva ZOZNAM, nie správanie
    // jednej funkcie — nová funkcia s predvoleným grantom v ňom vyskočí sama.
    const anonExecutable = anonExecutableFunctions();
    const navyse = anonExecutable.filter((fn) => !ANON_MAY_EXECUTE.includes(fn));
    check(
      "žiadna funkcia navyše nad dvoma zámernými výnimkami",
      navyse.length === 0,
      navyse.length ? `navyše: ${navyse.join(", ")}` : `celkom: ${anonExecutable.length}`,
    );

    const chybajuce = ANON_MAY_EXECUTE.filter((fn) => !anonExecutable.includes(fn));
    check(
      "obe zámerné výnimky `anon` naozaj má",
      chybajuce.length === 0,
      chybajuce.join(", "),
    );

    // Druhá strana toho istého: výnimky musia ostať FUNKČNÉ. Keby ich cyklus
    // v migrácii zobral a nevrátil, padli by naraz všetky org subdomény
    // (`proxy.ts`) a registrácia s kódom — a to je horšia porucha než nález.
    const orgBySlug = await anon.rpc("organization_by_slug", { p_slug: "todaytest" });
    check(
      "neprihlásený prečíta organizáciu podľa slugu (org subdomény žijú)",
      orgBySlug.error === null && (orgBySlug.data ?? []).length === 1,
      orgBySlug.error?.message,
    );

    const promoValid = await anon.rpc("promo_code_is_valid", { p_code: "NEEXISTUJE" });
    check(
      "neprihlásený overí promo kód (registrácia žije)",
      promoValid.error === null && promoValid.data === false,
      promoValid.error?.message,
    );

    // A nakoniec dôkaz, že odteraz zamieta GRANT, nie telo funkcie: pri
    // odobratom EXECUTE vráti PostgREST 42501 („permission denied for
    // function"). Keby sa grant vrátil, funkcia by sa ubránila sama a chyba by
    // bola `not_authenticated` — sada by to chytila práve na tomto rozdiele.
    for (const fn of ["revoke_my_connection", "org_players_for_copy"]) {
      const call = await anon.rpc(fn);
      check(
        `anon dostane 42501 na ${fn} (zamieta grant, nie telo funkcie)`,
        call.error?.code === "42501",
        `${call.error?.code ?? "bez chyby"}: ${call.error?.message ?? ""}`,
      );
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
