// RLS scenáre SAMOSTATNÉHO (1:1) režimu — hlavne zdieľanie s rodičom.
//
// Vznikli po bezpečnostnom audite 2026-08-07: policy na `player_connections`
// overovala len `coach_id = auth.uid()`, nie to, či `player_id` patrí
// volajúcemu. Dalo sa tak vyrobiť prepojenie na ĽUBOVOĽNÉHO hráča a prečítať
// si jeho meno aj celú históriu tréningov — a odvolaný rodič si tým vedel
// prístup sám obnoviť. Sekcie 2–4 nižšie sú presne tie útoky; keby niekto
// podmienku z policy odstránil, spadnú.
//
// Ako ostatné sady sa spúšťa proti LOKÁLNEJ Supabase (viď README.md).
const { serviceClient, signIn, createChecks } = require("./helpers");

const { check, section, report } = createChecks();
const db = serviceClient();

const COACH = "demo@plaw.win"; // samostatný tréner s hráčom a históriou
const OUTSIDER = "coach-new@test.local"; // účet bez vzťahu k jeho hráčovi
const PARENT = "parent-test@test.local"; // pripojený rodič

async function main() {
  const { data: users } = await db.auth.admin.listUsers({ perPage: 1000 });
  const byEmail = (email) => users.users.find((user) => user.email === email);
  const coach = byEmail(COACH);
  const outsider = byEmail(OUTSIDER);
  const parent = byEmail(PARENT);

  const { data: player } = await db
    .from("players")
    .select("id, name")
    .eq("coach_id", coach.id)
    .eq("is_active", true)
    .limit(1)
    .single();

  const { data: orgPlayer } = await db
    .from("players")
    .select("id, name")
    .not("organization_id", "is", null)
    .eq("is_active", true)
    .limit(1)
    .single();

  const asCoach = await signIn(COACH);
  const asOutsider = await signIn(OUTSIDER);
  const asParent = await signIn(PARENT);

  // Riadky, ktoré scenáre vyrobia, treba upratať aj pri páde — inak ostane
  // hráčovi visieť prepojenie a ďalší beh sa rozíde.
  const madeConnections = [];

  try {
    section("1) Tréner zdieľa vlastného hráča (legitímna cesta)");
    const own = await asCoach
      .from("player_connections")
      .insert({
        coach_id: coach.id,
        player_id: player.id,
        connect_code: "SOLOTST1",
        status: "pending",
      })
      .select("id");
    if ((own.data ?? []).length) madeConnections.push(own.data[0].id);
    check(
      "prepojenie na vlastného hráča prejde",
      (own.data ?? []).length === 1,
      own.error?.message,
    );
    const { data: seen } = await asCoach
      .from("player_connections")
      .select("id")
      .eq("connect_code", "SOLOTST1");
    check("a tréner ho vidí", (seen ?? []).length === 1);
    const revoked = await asCoach
      .from("player_connections")
      .update({ status: "revoked" })
      .eq("connect_code", "SOLOTST1")
      .select("id");
    check("a vie ho odvolať", (revoked.data ?? []).length === 1);

    section("2) Prepojenie na CUDZIEHO hráča neprejde");
    const forged = await asOutsider
      .from("player_connections")
      .insert({
        coach_id: outsider.id,
        player_id: player.id, // cudzí hráč
        parent_id: outsider.id,
        connect_code: "SOLOTST2",
        status: "active",
      })
      .select("id");
    if ((forged.data ?? []).length) madeConnections.push(forged.data[0].id);
    check(
      "cudzí účet prepojenie nevloží",
      (forged.data ?? []).length === 0,
      forged.error?.code ?? "PRESLO!",
    );
    const { data: leaked } = await asOutsider
      .from("players")
      .select("id")
      .eq("id", player.id);
    check("a hráča nevidí", (leaked ?? []).length === 0);

    section("3) Odvolaný rodič si prístup neobnoví");
    // Rodič UUID hráča pozná — kým bol pripojený, čítal ho bežným selectom.
    const sneaky = await asParent
      .from("player_connections")
      .insert({
        coach_id: parent.id,
        player_id: player.id,
        parent_id: parent.id,
        connect_code: "SOLOTST3",
        status: "pending",
      })
      .select("id");
    if ((sneaky.data ?? []).length) madeConnections.push(sneaky.data[0].id);
    check(
      "rodič si vlastné prepojenie nevyrobí",
      (sneaky.data ?? []).length === 0,
      sneaky.error?.code ?? "PRESLO!",
    );

    section("4) Federačného hráča nezdieľa ani samostatný účet");
    const orgForge = await asOutsider
      .from("player_connections")
      .insert({
        coach_id: outsider.id,
        player_id: orgPlayer.id,
        connect_code: "SOLOTST4",
        status: "pending",
      })
      .select("id");
    if ((orgForge.data ?? []).length) madeConnections.push(orgForge.data[0].id);
    check(
      "prepojenie na org hráča neprejde",
      (orgForge.data ?? []).length === 0,
      orgForge.error?.code ?? "PRESLO!",
    );

    section("5) Rodičovi ostáva jeho vlastné prepojenie čitateľné");
    // Sprísnená policy je trénerova; rodič má vlastnú
    // (`player_connections_select_own_parent`) a claim beží ako security
    // definer, takže sa ho netýka. Bez tohto checku by sa dalo sprísniť tak,
    // že by prestal fungovať rodič.
    const { data: mine } = await asParent
      .from("player_connections")
      .select("id, status")
      .eq("parent_id", parent.id);
    check(
      "rodič vidí svoje prepojenie",
      (mine ?? []).length >= 1,
      `riadkov: ${(mine ?? []).length}`,
    );
    const { data: hisPlayer } = await asParent
      .from("players")
      .select("id, name")
      .eq("id", player.id);
    check(
      "a hráča, ku ktorému je pripojený",
      (hisPlayer ?? []).length === 1,
      (hisPlayer ?? []).map((p) => p.name).join(","),
    );
    const { data: history } = await asParent
      .from("parent_session_records")
      .select("id")
      .eq("parent_id", parent.id);
    check(
      "a svoju kópiu histórie",
      (history ?? []).length > 0,
      `${(history ?? []).length} záznamov`,
    );

    section("6) Cudzí účet nevidí nič z trénerovho sveta");
    for (const [table, column, value] of [
      ["players", "id", player.id],
      ["sessions", "coach_id", coach.id],
      ["session_drills", "coach_id", coach.id],
      ["drill_codes", "coach_id", coach.id],
      ["parent_session_records", "coach_id", coach.id],
    ]) {
      const { data } = await asOutsider.from(table).select("id").eq(column, value);
      check(`${table} ostáva skrytá`, (data ?? []).length === 0, `riadkov: ${(data ?? []).length}`);
    }
  } finally {
    for (const id of madeConnections) {
      await db.from("player_connections").delete().eq("id", id);
    }
    await db
      .from("player_connections")
      .delete()
      .in("connect_code", ["SOLOTST1", "SOLOTST2", "SOLOTST3", "SOLOTST4"]);
  }

  report();
}

main().catch((error) => {
  console.error("CHYBA:", error.message || error);
  process.exit(1);
});
