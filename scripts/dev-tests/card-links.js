// RLS scenáre PREPOJENIA KARIET hráča naprieč disciplínami (krok 4,
// migrácia `20260815100000_player_card_links.sql`, docs §2.0).
//
// Čo sa overuje a prečo práve to:
//
// 1. **Cross-read je len na čítanie.** Tenisový tréner smie kondičný tréning
//    vidieť, ale nie upraviť, dokončiť ani zmazať — inak by mu do dát siahal
//    niekto, komu nepatria.
// 2. **Cudzia KARTA sa nesmie objaviť medzi hráčmi.** To je najdôležitejší
//    scenár sady: keby `players` cudziu kartu vydala, dostala by sa do
//    rosteru, do prepínača hráčov aj do `getSelectedPlayer()` a appka by
//    ponúkala „vybrať" hráča, ktorému nesmie nič zapísať. Presne tejto chybe
//    sme sa vyhli aj pri skupinovom tréningu vo federácii.
// 3. **Po zrušení prepojenia musí prístup zmiznúť.** Toto je celý rozdiel
//    oproti rodičovským kópiám: rodičovi história zostáva, druhému trénerovi
//    nie — nie sú jeho.
//
// Spúšťa sa proti LOKÁLNEJ Supabase (viď README.md), nepotrebuje dev server.
const {
  serviceClient,
  anonClient,
  signIn,
  ensureFitnessCoach,
  FITNESS_COACH_EMAIL,
  createChecks,
} = require("./helpers");

const { check, section, report } = createChecks();
const db = serviceClient();

const TENNIS_COACH = "demo@plaw.win"; // samostatný tenisový tréner (má hráča)
const FITNESS_COACH = FITNESS_COACH_EMAIL; // kondičný tréner (vlastník dát)
const OUTSIDER = "coach-new@test.local"; // účet bez vzťahu k obom

async function main() {
  const { data: users } = await db.auth.admin.listUsers({ perPage: 1000 });
  const byEmail = (email) => users.users.find((user) => user.email === email);
  const tennisCoach = byEmail(TENNIS_COACH);
  const outsider = byEmail(OUTSIDER);

  const { coach: fitnessCoach, player: fitnessPlayer } =
    await ensureFitnessCoach(db);

  const { data: tennisPlayer } = await db
    .from("players")
    .select("id, name")
    .eq("coach_id", tennisCoach.id)
    .eq("is_active", true)
    .is("organization_id", null)
    .limit(1)
    .single();

  // Kondičný tréning, ktorý má tenisový tréner po prepojení uvidieť.
  const { data: fitnessSession } = await db
    .from("sessions")
    .insert({
      coach_id: fitnessCoach.id,
      player_id: fitnessPlayer.id,
      status: "planned",
      discipline: "fitness",
      planned_data: { date: new Date().toISOString(), duration_minutes: 60 },
      notes: "Kondičný blok",
    })
    .select("id")
    .single();

  const { data: fitnessDrill } = await db
    .from("session_drills")
    .insert({
      session_id: fitnessSession.id,
      coach_id: fitnessCoach.id,
      category: "STRENGTH",
      character: null,
      drill_code: "STR-1",
      duration_minutes: 30,
      status: "played",
      sort_order: 1,
    })
    .select("id")
    .single();

  const asTennis = await signIn(TENNIS_COACH);
  const asFitness = await signIn(FITNESS_COACH);
  const asOutsider = await signIn(OUTSIDER);
  const anon = anonClient();

  const madeLinks = [];

  try {
    section("1) Vydanie kódu (legitímna cesta)");
    const issued = await asFitness
      .from("player_links")
      .insert({
        source_player_id: fitnessPlayer.id,
        source_coach_id: fitnessCoach.id,
        source_discipline: "fitness",
        link_code: "CARDLNK1",
        status: "pending",
      })
      .select("id")
      .single();
    check("vlastník dát vydá kód na svoju kartu", !issued.error, issued.error?.message);
    if (issued.data) madeLinks.push(issued.data.id);

    section("2) Kód sa nedá vydať na cudziu kartu");
    const foreign = await asOutsider.from("player_links").insert({
      source_player_id: fitnessPlayer.id,
      source_coach_id: outsider.id,
      source_discipline: "fitness",
      link_code: "CARDLNK2",
      status: "pending",
    });
    check("cudzí účet nevydá kód na cudziu kartu", foreign.error !== null);

    // Rovno aktívny riadok by obišiel súhlas druhej strany.
    const preActivated = await asFitness.from("player_links").insert({
      source_player_id: fitnessPlayer.id,
      source_coach_id: fitnessCoach.id,
      source_discipline: "fitness",
      target_player_id: tennisPlayer.id,
      target_coach_id: tennisCoach.id,
      link_code: "CARDLNK3",
      status: "active",
    });
    check("rovno aktívne prepojenie sa vložiť nedá", preActivated.error !== null);

    section("3) Claim — odmietnutia");
    // Obrana je dvojitá a stačí ktorákoľvek vrstva: `execute` má len
    // `authenticated` (anon teda skončí na „permission denied"), a keby ten
    // grant niekto rozšíril, zastaví ho kontrola `not_authenticated` v tele
    // funkcie — tá vznikla po audite `20260809090000`, keď sa ukázalo, že
    // PostgREST vystavuje RPC aj priamo a `auth.uid()` je tam NULL.
    const unauth = await anon.rpc("claim_player_link", {
      p_code: "CARDLNK1",
      p_player_id: tennisPlayer.id,
      p_discipline: "tennis",
    });
    check(
      "neprihlásený kód nezaklaimuje",
      unauth.error !== null &&
        /not_authenticated|permission denied/.test(unauth.error.message),
      unauth.error?.message,
    );

    const foreignPlayer = await asOutsider.rpc("claim_player_link", {
      p_code: "CARDLNK1",
      p_player_id: tennisPlayer.id,
      p_discipline: "tennis",
    });
    check(
      "kód sa nedá zaklaimovať na cudziu kartu",
      foreignPlayer.error !== null &&
        /not_your_player/.test(foreignPlayer.error.message),
      foreignPlayer.error?.message,
    );

    const sameDiscipline = await asTennis.rpc("claim_player_link", {
      p_code: "CARDLNK1",
      p_player_id: tennisPlayer.id,
      p_discipline: "fitness",
    });
    check(
      "kód z tej istej disciplíny sa odmietne",
      sameDiscipline.error !== null &&
        /same_discipline/.test(sameDiscipline.error.message),
      sameDiscipline.error?.message,
    );

    section("4) Claim — legitímna cesta");
    const claimed = await asTennis.rpc("claim_player_link", {
      p_code: "CARDLNK1",
      p_player_id: tennisPlayer.id,
      p_discipline: "tennis",
    });
    check("druhý tréner kód zaklaimuje", !claimed.error, claimed.error?.message);
    check(
      "claim vráti kartu vlastníka dát",
      claimed.data === fitnessPlayer.id,
      `vrátené: ${claimed.data}`,
    );

    const reused = await asTennis.rpc("claim_player_link", {
      p_code: "CARDLNK1",
      p_player_id: tennisPlayer.id,
      p_discipline: "tennis",
    });
    check(
      "použitý kód sa nedá zaklaimovať znova",
      reused.error !== null && /invalid_code/.test(reused.error.message),
      reused.error?.message,
    );

    section("5) Cross-read — vidí, čo má");
    const seenSessions = await asTennis
      .from("sessions")
      .select("id, discipline, notes")
      .eq("player_id", fitnessPlayer.id);
    check(
      "tenisový tréner vidí kondičný tréning",
      (seenSessions.data ?? []).some((row) => row.id === fitnessSession.id),
      `riadkov: ${(seenSessions.data ?? []).length}`,
    );

    const seenDrills = await asTennis
      .from("session_drills")
      .select("id, category")
      .eq("session_id", fitnessSession.id);
    check(
      "vidí aj cvičenia (user chcel celý detail)",
      (seenDrills.data ?? []).some((row) => row.id === fitnessDrill.id),
      `riadkov: ${(seenDrills.data ?? []).length}`,
    );

    section("6) Cross-read je LEN na čítanie");
    const tryUpdate = await asTennis
      .from("sessions")
      .update({ notes: "prepísané cudzím trénerom" })
      .eq("id", fitnessSession.id)
      .select("id");
    check(
      "cudzí tréning sa nedá upraviť",
      (tryUpdate.data ?? []).length === 0,
      `zmenených: ${(tryUpdate.data ?? []).length}`,
    );

    const tryDelete = await asTennis
      .from("sessions")
      .delete()
      .eq("id", fitnessSession.id)
      .select("id");
    check(
      "cudzí tréning sa nedá zmazať",
      (tryDelete.data ?? []).length === 0,
      `zmazaných: ${(tryDelete.data ?? []).length}`,
    );

    const tryInsertDrill = await asTennis.from("session_drills").insert({
      session_id: fitnessSession.id,
      coach_id: tennisCoach.id,
      category: "Forehand",
      character: "neutral",
      drill_code: "FRH-1",
      duration_minutes: 15,
      status: "played",
      sort_order: 99,
    });
    check("do cudzieho tréningu sa nedá pridať cvičenie", tryInsertDrill.error !== null);

    section("7) Cudzia KARTA sa medzi hráčov nedostane");
    const seenPlayer = await asTennis
      .from("players")
      .select("id, name")
      .eq("id", fitnessPlayer.id);
    check(
      "kondičná karta ostáva skrytá (roster, prepínač, výber hráča)",
      (seenPlayer.data ?? []).length === 0,
      `riadkov: ${(seenPlayer.data ?? []).length}`,
    );

    section("8) Nikto tretí nevidí nič");
    const outsiderSessions = await asOutsider
      .from("sessions")
      .select("id")
      .eq("player_id", fitnessPlayer.id);
    check(
      "cudzí účet nevidí kondičné tréningy",
      (outsiderSessions.data ?? []).length === 0,
      `riadkov: ${(outsiderSessions.data ?? []).length}`,
    );

    const outsiderLinks = await asOutsider
      .from("player_links")
      .select("id")
      .eq("source_player_id", fitnessPlayer.id);
    check(
      "cudzí účet nevidí ani samotné prepojenie",
      (outsiderLinks.data ?? []).length === 0,
      `riadkov: ${(outsiderLinks.data ?? []).length}`,
    );

    section("9) Prepojenie sa nedá prepísať priamym zápisom");
    // Kľúčový dôvod, prečo tabuľka nemá UPDATE grant: policy na UPDATE nevie
    // obmedziť, KTORÝ stĺpec sa mení, takže by si čitateľ prepísal zdrojovú
    // kartu na cudziu a čítal ju.
    const { data: link } = await db
      .from("player_links")
      .select("id")
      .eq("link_code", "CARDLNK1")
      .single();

    const hijack = await asTennis
      .from("player_links")
      .update({ source_player_id: tennisPlayer.id })
      .eq("id", link.id)
      .select("id");
    check(
      "čitateľ neprepíše zdrojovú kartu prepojenia",
      (hijack.data ?? []).length === 0,
      `zmenených: ${(hijack.data ?? []).length}`,
    );

    const foreignRevoke = await asOutsider.rpc("revoke_player_link", {
      p_link_id: link.id,
    });
    check(
      "cudzí účet prepojenie nezruší",
      foreignRevoke.error !== null &&
        /not_your_link/.test(foreignRevoke.error.message),
      foreignRevoke.error?.message,
    );

    // Opačný smer (migrácia `20260824090000`, docs §2.3). Jadro sekcie je
    // ASYMETRIA: tam celý detail, späť len súčty. Preto sa tu nekontroluje len
    // to, či súhrn príde, ale hlavne to, že s ním neprídu kódy cvičení,
    // poznámky ani prístup k tréningom.
    section("10) Súhrn opačným smerom");
    const period = {
      p_player_id: fitnessPlayer.id,
      p_start: new Date(Date.UTC(2020, 0, 1)).toISOString(),
      p_end: new Date(Date.UTC(2100, 0, 1)).toISOString(),
    };

    const beforeOptIn = await asFitness.rpc(
      "linked_player_category_minutes",
      period,
    );
    check(
      "bez súhlasu nevidí vydávajúci nič",
      (beforeOptIn.data ?? []).length === 0,
      `riadkov: ${(beforeOptIn.data ?? []).length}`,
    );

    const sourceToggles = await asFitness.rpc("set_link_summary_sharing", {
      p_link_id: link.id,
      p_enabled: true,
    });
    check(
      "vydávajúci si súhlas sám zapnúť nemôže",
      sourceToggles.error !== null &&
        /not_your_link/.test(sourceToggles.error.message),
      sourceToggles.error?.message,
    );

    const outsiderToggles = await asOutsider.rpc("set_link_summary_sharing", {
      p_link_id: link.id,
      p_enabled: true,
    });
    check(
      "cudzí účet súhlas neprepne",
      outsiderToggles.error !== null &&
        /not_your_link/.test(outsiderToggles.error.message),
      outsiderToggles.error?.message,
    );

    const anonToggles = await anon.rpc("set_link_summary_sharing", {
      p_link_id: link.id,
      p_enabled: true,
    });
    check(
      "neprihlásený súhlas neprepne",
      anonToggles.error !== null &&
        /not_authenticated|permission denied/.test(anonToggles.error.message),
      anonToggles.error?.message,
    );

    const optIn = await asTennis.rpc("set_link_summary_sharing", {
      p_link_id: link.id,
      p_enabled: true,
    });
    check("cieľová strana súhlas zapne", !optIn.error, optIn.error?.message);

    // Kontrolný výpočet cez service_role: čísla musia sedieť s tým, čo si
    // z tých istých riadkov vypočíta appka, inak by graf klamal.
    const { data: ownSessions } = await db
      .from("sessions")
      .select("id")
      .eq("player_id", tennisPlayer.id)
      .eq("discipline", "tennis");
    const { data: ownDrills } = await db
      .from("session_drills")
      .select("category, duration_minutes")
      .in("session_id", (ownSessions ?? []).map((row) => row.id))
      .eq("status", "played");
    const expected = new Map();
    for (const drill of ownDrills ?? []) {
      expected.set(
        drill.category,
        (expected.get(drill.category) ?? 0) + drill.duration_minutes,
      );
    }

    const summary = await asFitness.rpc(
      "linked_player_category_minutes",
      period,
    );
    const got = new Map(
      (summary.data ?? []).map((row) => [row.category, row.duration_minutes]),
    );
    check(
      "so súhlasom vidí vydávajúci súhrn",
      got.size > 0,
      summary.error?.message ?? `riadkov: ${got.size}`,
    );
    check(
      "minúty sedia s vlastným výpočtom",
      got.size === expected.size &&
        [...expected].every(([category, minutes]) => got.get(category) === minutes),
      `dostal ${JSON.stringify([...got])}, čakal ${JSON.stringify([...expected])}`,
    );
    check(
      "súhrn nenesie kódy cvičení ani poznámky",
      (summary.data ?? []).every(
        (row) => Object.keys(row).join(",") === "category,duration_minutes",
      ),
      `stĺpce: ${Object.keys((summary.data ?? [])[0] ?? {}).join(",")}`,
    );

    const stillNoSessions = await asFitness
      .from("sessions")
      .select("id")
      .eq("player_id", tennisPlayer.id);
    check(
      "súhrn NEOTVORÍ tenisové tréningy",
      (stillNoSessions.data ?? []).length === 0,
      `riadkov: ${(stillNoSessions.data ?? []).length}`,
    );

    const stillNoDrills = await asFitness
      .from("session_drills")
      .select("id")
      .in("session_id", (ownSessions ?? []).map((row) => row.id));
    check(
      "súhrn NEOTVORÍ tenisové cvičenia",
      (stillNoDrills.data ?? []).length === 0,
      `riadkov: ${(stillNoDrills.data ?? []).length}`,
    );

    const outsiderSummary = await asOutsider.rpc(
      "linked_player_category_minutes",
      period,
    );
    check(
      "cudzí účet súhrn nedostane",
      (outsiderSummary.data ?? []).length === 0,
      `riadkov: ${(outsiderSummary.data ?? []).length}`,
    );

    const anonSummary = await anon.rpc(
      "linked_player_category_minutes",
      period,
    );
    check(
      "neprihlásený sa k súhrnu nedostane",
      anonSummary.error !== null ||
        (anonSummary.data ?? []).length === 0,
      anonSummary.error?.message,
    );

    // Poistka z časti D migrácie: dvojica kariet smie mať jeden riadok. Druhý,
    // opačný, by z jednosmerného pohľadu spravil obojsmerný PLNÝ detail —
    // presne to, čo sa rozhodlo nedať.
    const backCode = await asTennis
      .from("player_links")
      .insert({
        source_player_id: tennisPlayer.id,
        source_coach_id: tennisCoach.id,
        source_discipline: "tennis",
        link_code: "CARDLNK4",
        status: "pending",
      })
      .select("id")
      .single();
    if (backCode.data) madeLinks.push(backCode.data.id);
    const backClaim = await asFitness.rpc("claim_player_link", {
      p_code: "CARDLNK4",
      p_player_id: fitnessPlayer.id,
      p_discipline: "fitness",
    });
    check(
      "opačné prepojenie tej istej dvojice sa odmietne",
      backClaim.error !== null && /already_linked/.test(backClaim.error.message),
      backClaim.error?.message,
    );

    const optOut = await asTennis.rpc("set_link_summary_sharing", {
      p_link_id: link.id,
      p_enabled: false,
    });
    check("súhlas sa dá vziať späť", !optOut.error, optOut.error?.message);

    const afterOptOut = await asFitness.rpc(
      "linked_player_category_minutes",
      period,
    );
    check(
      "po vypnutí je súhrn preč",
      (afterOptOut.data ?? []).length === 0,
      `riadkov: ${(afterOptOut.data ?? []).length}`,
    );

    // Zapnuté späť, aby ďalšia sekcia overila, že zrušenie prepojenia zhasne aj
    // súhrn — nie iba prístup k tréningom.
    await asTennis.rpc("set_link_summary_sharing", {
      p_link_id: link.id,
      p_enabled: true,
    });

    // Sledujúci (migrácia `20260824100000`, docs §2.3b). Vezie sa na tom istom
    // prepojení, ale je to DRUHÝ, nezávislý súhlas a dáva ho opačná strana:
    // vlastník dát. Preto sa tu overuje hlavne to, že ho cieľová strana
    // prepnúť NEVIE — inak by tenisový tréner rozdával prácu kolegu.
    section("10b) Súhrn pre sledujúceho druhej karty");
    const asParent = await signIn("parent-test@test.local");
    const followerPeriod = {
      p_start: new Date(Date.UTC(2020, 0, 1)).toISOString(),
      p_end: new Date(Date.UTC(2100, 0, 1)).toISOString(),
    };

    const followerBefore = await asParent.rpc(
      "follower_linked_category_minutes",
      followerPeriod,
    );
    check(
      "bez súhlasu vlastníka sledujúci nevidí nič",
      (followerBefore.data ?? []).length === 0,
      `riadkov: ${(followerBefore.data ?? []).length}`,
    );

    const targetToggles = await asTennis.rpc("set_link_follower_sharing", {
      p_link_id: link.id,
      p_enabled: true,
    });
    check(
      "cieľová strana cudziu prácu rodičovi nepustí",
      targetToggles.error !== null &&
        /not_your_link/.test(targetToggles.error.message),
      targetToggles.error?.message,
    );

    const parentToggles = await asParent.rpc("set_link_follower_sharing", {
      p_link_id: link.id,
      p_enabled: true,
    });
    check(
      "sledujúci si súhlas sám nezapne",
      parentToggles.error !== null &&
        /not_your_link/.test(parentToggles.error.message),
      parentToggles.error?.message,
    );

    const ownerOptIn = await asFitness.rpc("set_link_follower_sharing", {
      p_link_id: link.id,
      p_enabled: true,
    });
    check(
      "vlastník dát súhlas zapne",
      !ownerOptIn.error,
      ownerOptIn.error?.message,
    );

    const followerAfter = await asParent.rpc(
      "follower_linked_category_minutes",
      followerPeriod,
    );
    const followerRows = followerAfter.data ?? [];
    check(
      "sledujúci dostane súhrn druhej disciplíny",
      followerRows.some(
        (row) => row.category === "STRENGTH" && row.duration_minutes === 30,
      ),
      JSON.stringify(followerRows),
    );
    check(
      "so súhrnom prišla aj disciplína (sledujúci player_links nečíta)",
      followerRows.every((row) => row.discipline === "fitness"),
      JSON.stringify(followerRows),
    );
    check(
      "súhrn nenesie kódy cvičení ani poznámky",
      followerRows.every(
        (row) =>
          Object.keys(row).join(",") === "discipline,category,duration_minutes",
      ),
      Object.keys(followerRows[0] ?? {}).join(","),
    );

    const parentSessions = await asParent
      .from("sessions")
      .select("id")
      .eq("player_id", fitnessPlayer.id);
    check(
      "sledujúcemu sa tým neotvorili cudzie tréningy",
      (parentSessions.data ?? []).length === 0,
      `riadkov: ${(parentSessions.data ?? []).length}`,
    );

    const parentDrills = await asParent
      .from("session_drills")
      .select("id")
      .eq("session_id", fitnessSession.id);
    check(
      "ani cudzie cvičenia",
      (parentDrills.data ?? []).length === 0,
      `riadkov: ${(parentDrills.data ?? []).length}`,
    );

    const outsiderFollower = await asOutsider.rpc(
      "follower_linked_category_minutes",
      followerPeriod,
    );
    check(
      "účet bez pripojenia súhrn nedostane",
      (outsiderFollower.data ?? []).length === 0,
      `riadkov: ${(outsiderFollower.data ?? []).length}`,
    );

    section("11) Po zrušení prístup zmizne (rozdiel oproti rodičovi)");
    const revoked = await asTennis.rpc("revoke_player_link", {
      p_link_id: link.id,
    });
    check("čitateľ smie prepojenie zrušiť", !revoked.error, revoked.error?.message);

    const afterRevoke = await asTennis
      .from("sessions")
      .select("id")
      .eq("player_id", fitnessPlayer.id);
    check(
      "po zrušení už kondičné tréningy nevidí",
      (afterRevoke.data ?? []).length === 0,
      `riadkov: ${(afterRevoke.data ?? []).length}`,
    );

    const drillsAfterRevoke = await asTennis
      .from("session_drills")
      .select("id")
      .eq("session_id", fitnessSession.id);
    check(
      "po zrušení nevidí ani cvičenia",
      (drillsAfterRevoke.data ?? []).length === 0,
      `riadkov: ${(drillsAfterRevoke.data ?? []).length}`,
    );

    // Zrušené prepojenie nesmie ostať polovične živé: príznak na riadku síce
    // ostane zapnutý, ale funkcia sa pýta aj na `status = 'active'`.
    const summaryAfterRevoke = await asFitness.rpc(
      "linked_player_category_minutes",
      {
        p_player_id: fitnessPlayer.id,
        p_start: new Date(Date.UTC(2020, 0, 1)).toISOString(),
        p_end: new Date(Date.UTC(2100, 0, 1)).toISOString(),
      },
    );
    check(
      "po zrušení zhasne aj súhrn opačným smerom",
      (summaryAfterRevoke.data ?? []).length === 0,
      `riadkov: ${(summaryAfterRevoke.data ?? []).length}`,
    );

    // Sledujúci nie je výnimka: jeho súhrn visí na tom istom prepojení, takže
    // zaniká s ním. Toto je celý rozdiel oproti kópiám, ktoré mu ostávajú.
    const followerAfterRevoke = await asParent.rpc(
      "follower_linked_category_minutes",
      {
        p_start: new Date(Date.UTC(2020, 0, 1)).toISOString(),
        p_end: new Date(Date.UTC(2100, 0, 1)).toISOString(),
      },
    );
    check(
      "po zrušení zhasne aj súhrn sledujúceho",
      (followerAfterRevoke.data ?? []).length === 0,
      `riadkov: ${(followerAfterRevoke.data ?? []).length}`,
    );
  } finally {
    // Upratuje sa podľa DÁT, nie podľa zapamätaných id: keď scenár spadne skôr,
    // než si id prečíta, riadok by ostal a ďalší beh by stroskotal na unikáte.
    await db
      .from("player_links")
      .delete()
      .in("link_code", ["CARDLNK1", "CARDLNK2", "CARDLNK3", "CARDLNK4"]);
    for (const id of madeLinks) {
      await db.from("player_links").delete().eq("id", id);
    }
    await db.from("sessions").delete().eq("id", fitnessSession.id);
  }

  report();
}

main().catch((error) => {
  console.error("CHYBA:", error.message || error);
  process.exit(1);
});
