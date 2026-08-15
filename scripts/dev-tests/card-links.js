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

    section("10) Po zrušení prístup zmizne (rozdiel oproti rodičovi)");
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
  } finally {
    // Upratuje sa podľa DÁT, nie podľa zapamätaných id: keď scenár spadne skôr,
    // než si id prečíta, riadok by ostal a ďalší beh by stroskotal na unikáte.
    await db
      .from("player_links")
      .delete()
      .in("link_code", ["CARDLNK1", "CARDLNK2", "CARDLNK3"]);
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
