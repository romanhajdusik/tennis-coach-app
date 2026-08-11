// RLS scenáre federačnej vrstvy — overujú sa priamo proti databáze cez
// reálne prihlásené session, nie cez appku: appka je len UI, hranicou dát
// je RLS (§5.7).
const {
  serviceClient,
  anonClient,
  signIn,
  ORG_SLUG,
  createChecks,
} = require("./helpers");

const { check, section, report } = createChecks();
const db = serviceClient();

async function main() {
  const { data: org } = await db
    .from("organizations")
    .select("id, seat_limit")
    .eq("slug", ORG_SLUG)
    .single();

  const director = await signIn("director-today@test.local");
  const coach = await signIn("coach-today@test.local");

  section("1) Šéftréner vidí celú organizáciu");
  const { data: players } = await director
    .from("players")
    .select("id, coach_id")
    .eq("is_active", true);
  check("vidí hráčov oboch trénerov", (players ?? []).length === 6, "počet: " + (players ?? []).length);
  const { data: sessions } = await director.from("sessions").select("id");
  check("vidí tréningy organizácie", (sessions ?? []).length >= 8, "počet: " + (sessions ?? []).length);

  section("2) Mená členov (policy profiles_select_director_org_members)");
  const { data: profiles } = await director.from("profiles").select("full_name");
  const names = (profiles ?? []).map((profile) => profile.full_name);
  check("vidí profily svojich trénerov", names.includes("Andrea Prva") && names.includes("Boris Druhy"), JSON.stringify(names));
  const { data: coachProfiles } = await coach.from("profiles").select("id");
  check("tréner vidí len seba", (coachProfiles ?? []).length === 1, "počet: " + (coachProfiles ?? []).length);

  section("3) Šéftréner je read-only nad tréningovými dátami");
  const insert = await director
    .from("players")
    .insert({ coach_id: players[0].coach_id, organization_id: org.id, name: "Podvrh", is_active: true });
  check("nesmie zakladať hráča", insert.error !== null, insert.error?.code ?? "PRESLO!");
  const update = await director.from("players").update({ name: "Prepisany" }).eq("id", players[0].id).select("id");
  check("nesmie meniť hráča", (update.data ?? []).length === 0);
  const remove = await director.from("sessions").delete().eq("id", sessions[0].id).select("id");
  check("nesmie mazať tréning", (remove.data ?? []).length === 0);

  section("4) Členstvo a pozvánky");
  const dirInvite = await director
    .from("organization_members")
    .insert({ organization_id: org.id, role: "coach", status: "invited", invite_code: "RLS-TEST1" })
    .select("id");
  check("šéftréner vytvorí pozvánku", (dirInvite.data ?? []).length === 1, dirInvite.error?.message);
  const coachInvite = await coach
    .from("organization_members")
    .insert({ organization_id: org.id, role: "coach", status: "invited", invite_code: "RLS-TEST2" })
    .select("id");
  check("tréner pozvánku nevytvorí", coachInvite.error !== null, coachInvite.error?.code ?? "PRESLO!");

  const { data: users } = await db.auth.admin.listUsers({ perPage: 1000 });
  const outsider = users.users.find((user) => user.email === "coach-new@test.local");
  const forced = await director
    .from("organization_members")
    .update({ user_id: outsider.id, status: "active" })
    .eq("invite_code", "RLS-TEST1")
    .select("id");
  check(
    "cudzí účet sa nedá priradiť priamym zápisom (členstvo je dobrovoľné)",
    forced.error !== null || (forced.data ?? []).length === 0,
  );

  section("5) Claim overuje kód aj stav účtu");
  const bad = await coach.rpc("claim_organization_invite", { p_code: "NEEXISTUJE" });
  check("neplatný kód neprejde", bad.error !== null);
  const already = await coach.rpc("claim_organization_invite", { p_code: "RLS-TEST1" });
  check("kto už je členom, sa nepripojí znova", /already_member/.test(already.error?.message ?? ""));

  const { data: demo } = await db
    .from("players")
    .select("id")
    .is("organization_id", null)
    .limit(1)
    .maybeSingle();
  if (demo) {
    const standalone = await signIn("demo@plaw.win");
    const withData = await standalone.rpc("claim_organization_invite", { p_code: "RLS-TEST1" });
    check(
      "účet s vlastnými hráčmi nevstúpi do org",
      /has_personal_data/.test(withData.error?.message ?? ""),
      withData.error?.message,
    );
  }

  // Neprihlásený volajúci má `auth.uid()` NULL. Kým to claim nekontroloval,
  // zapísal NULL ako `user_id`: vzniklo aktívne členstvo bez účtu, `invite_code`
  // sa vymazal (pozvánka sa už nedala ani dohľadať) a riadok ZOŽRAL SEDADLO —
  // guard trigger svoje kontroly preskočí, lebo bežia len `if user_id is not null`.
  const { data: seatEater } = await db
    .from("organization_members")
    .insert({
      organization_id: org.id,
      role: "coach",
      status: "invited",
      invite_code: "RLS-ANON1",
    })
    .select("id")
    .single();
  const anonClaim = await anonClient().rpc("claim_organization_invite", {
    p_code: "RLS-ANON1",
  });
  check(
    "neprihlásený pozvánku nezaklaimuje",
    /not_authenticated/.test(anonClaim.error?.message ?? ""),
    anonClaim.error?.message ?? "PRESLO!",
  );
  const { data: inviteAfter } = await db
    .from("organization_members")
    .select("status, user_id, invite_code")
    .eq("id", seatEater.id)
    .single();
  check(
    "pozvánka ostala nedotknutá aj s kódom",
    inviteAfter.status === "invited" && inviteAfter.invite_code === "RLS-ANON1",
    JSON.stringify(inviteAfter),
  );
  await db.from("organization_members").delete().eq("id", seatEater.id);

  section("6) Sedadlá");
  const { count: coaches } = await db
    .from("organization_members")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", org.id)
    .eq("status", "active")
    .eq("role", "coach");
  check(`tréneri (${coaches}) sa počítajú proti limitu ${org.seat_limit}`, coaches <= org.seat_limit);
  const { count: directors } = await db
    .from("organization_members")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", org.id)
    .eq("status", "active")
    .eq("role", "director");
  check("šéftréner sedadlo neberie", directors === 1);

  section("7) Kódy cvičení: štandard mení len šéftréner");
  const dirCode = await director
    .from("drill_codes")
    .upsert(
      { organization_id: org.id, coach_id: null, category: "Volley", slot: 1, code: "RLS-VOL" },
      { onConflict: "organization_id,category,slot" },
    )
    .select("id");
  check("šéftréner uloží federačný kód", (dirCode.data ?? []).length === 1, dirCode.error?.message);
  const coachCode = await coach
    .from("drill_codes")
    .upsert(
      { organization_id: org.id, coach_id: null, category: "Volley", slot: 1, code: "HACK" },
      { onConflict: "organization_id,category,slot" },
    )
    .select("id");
  check("tréner federačný kód nezmení", coachCode.error !== null || (coachCode.data ?? []).length === 0);
  const { data: stored } = await db
    .from("drill_codes")
    .select("code")
    .eq("organization_id", org.id)
    .eq("category", "Volley")
    .eq("slot", 1)
    .maybeSingle();
  check("v DB ostal kód od šéftrénera", stored?.code === "RLS-VOL", JSON.stringify(stored));

  section("8) Tenant izolácia");
  const { data: otherOrg } = await db
    .from("organizations")
    .select("id, slug")
    .neq("slug", ORG_SLUG)
    .limit(1)
    .maybeSingle();
  if (otherOrg) {
    const { data: foreign } = await director.from("players").select("id").eq("organization_id", otherOrg.id);
    check(`nevidí hráčov cudzej org (${otherOrg.slug})`, (foreign ?? []).length === 0);
  }
  const { data: orgs } = await director.from("organizations").select("id");
  check("vidí len vlastnú organizáciu", (orgs ?? []).length === 1);

  section("9) Preradenie hráča (assign_player_to_coach)");
  const { data: coachUsers } = await db
    .from("organization_members")
    .select("user_id, role")
    .eq("organization_id", org.id)
    .eq("status", "active");
  const activeIds = new Set((coachUsers ?? []).map((m) => m.user_id));
  const directorId = (coachUsers ?? []).find((m) => m.role === "director").user_id;

  // **Trénerov ber podľa e-mailu, nie podľa poradia riadkov.** Dotaz vyššie je
  // bez `order`, takže poradie závisí od toho, kedy ktoré členstvo vzniklo —
  // a `browser-director.js` jedného trénera odoberá a zase vracia, čím sa
  // poradie preklopí. Scenár nižšie sa prihlasuje konkrétnymi účtami, takže
  // pri opačnom poradí kontroloval nesprávneho trénera a padal.
  const emailToId = (email) => users.users.find((user) => user.email === email).id;
  const coachA = emailToId("coach-today@test.local");
  const coachB = emailToId("coach2-today@test.local");
  check(
    "obaja tréneri sú aktívni členovia",
    activeIds.has(coachA) && activeIds.has(coachB),
  );

  const { data: moved } = await db
    .from("players")
    .select("id, name")
    .eq("coach_id", coachA)
    .eq("is_active", true)
    .order("name")
    .limit(1)
    .single();

  // Koľko riadkov histórie hráč má — po preradení sa musí presunúť všetko,
  // inak nový tréner uvidí hráča, ale nie jeho tréningy.
  const { data: hisSessions } = await db.from("sessions").select("id").eq("player_id", moved.id);
  const sessionIds = (hisSessions ?? []).map((s) => s.id);
  const { count: drillCount } = await db
    .from("session_drills")
    .select("id", { count: "exact", head: true })
    .in("session_id", sessionIds.length ? sessionIds : ["00000000-0000-0000-0000-000000000000"]);

  const byCoach = await coach.rpc("assign_player_to_coach", { p_player_id: moved.id, p_coach_id: coachB });
  check("tréner preradiť nemôže", /not_director/.test(byCoach.error?.message ?? ""), byCoach.error?.message ?? "PRESLO!");

  const toOutsider = await director.rpc("assign_player_to_coach", { p_player_id: moved.id, p_coach_id: outsider.id });
  check("nečlenovi sa hráč prideliť nedá", /target_not_coach/.test(toOutsider.error?.message ?? ""), toOutsider.error?.message ?? "PRESLO!");

  const toDirector = await director.rpc("assign_player_to_coach", { p_player_id: moved.id, p_coach_id: directorId });
  check("šéftrénerovi samému sa hráč prideliť nedá", /target_not_coach/.test(toDirector.error?.message ?? ""), toDirector.error?.message ?? "PRESLO!");

  const { data: personal } = await db
    .from("players")
    .select("id")
    .is("organization_id", null)
    .limit(1)
    .maybeSingle();
  if (personal) {
    const foreignPlayer = await director.rpc("assign_player_to_coach", { p_player_id: personal.id, p_coach_id: coachB });
    check("hráča mimo organizácie nepreradí", /player_not_in_org/.test(foreignPlayer.error?.message ?? ""), foreignPlayer.error?.message ?? "PRESLO!");
  }

  const ok = await director.rpc("assign_player_to_coach", { p_player_id: moved.id, p_coach_id: coachB });
  check(`šéftréner preradí hráča (${moved.name})`, ok.error === null, ok.error?.message);

  const { data: afterPlayer } = await db.from("players").select("coach_id").eq("id", moved.id).single();
  check("hráč patrí novému trénerovi", afterPlayer.coach_id === coachB);
  const { count: movedSessions } = await db
    .from("sessions")
    .select("id", { count: "exact", head: true })
    .eq("player_id", moved.id)
    .eq("coach_id", coachB);
  check(`história prešla s ním (${movedSessions}/${sessionIds.length} tréningov)`, movedSessions === sessionIds.length);
  const { count: movedDrills } = await db
    .from("session_drills")
    .select("id", { count: "exact", head: true })
    .in("session_id", sessionIds.length ? sessionIds : ["00000000-0000-0000-0000-000000000000"])
    .eq("coach_id", coachB);
  check(`cvičenia prešli s ním (${movedDrills}/${drillCount})`, movedDrills === drillCount);

  // Prístup sa riadi RLS, nie appkou — preto sa pozeráme cez session oboch trénerov.
  const newCoach = await signIn("coach2-today@test.local");
  const { data: seenByNew } = await newCoach.from("players").select("id").eq("id", moved.id);
  check("nový tréner hráča vidí", (seenByNew ?? []).length === 1);
  const { data: seenSessions } = await newCoach.from("sessions").select("id").eq("player_id", moved.id);
  check("nový tréner vidí aj jeho históriu", (seenSessions ?? []).length === sessionIds.length, `${(seenSessions ?? []).length}/${sessionIds.length}`);
  const oldCoach = await signIn("coach-today@test.local");
  const { data: seenByOld } = await oldCoach.from("players").select("id").eq("id", moved.id);
  check("pôvodný tréner ho už nevidí", (seenByOld ?? []).length === 0);

  // vrátenie do pôvodného stavu, aby ostatné sady sedeli
  await director.rpc("assign_player_to_coach", { p_player_id: moved.id, p_coach_id: coachA });
  const { data: restored } = await db.from("players").select("coach_id").eq("id", moved.id).single();
  check("preradenie sa dá vrátiť späť", restored.coach_id === coachA);

  section("10) Životný cyklus členstva: neaktívny, návrat, trvalé zmazanie");
  const { data: coach2Member } = await db
    .from("organization_members")
    .select("id")
    .eq("organization_id", org.id)
    .eq("user_id", coachB)
    .maybeSingle();

  // Scenár mení členstvo, takže musí upratať aj keď spadne — inak by ďalší beh
  // našiel trénera odobratého a rozsypal sa na počtoch (viď README).
  let throwawayId = null;
  try {
    await director
      .from("organization_members")
      .update({ status: "removed" })
      .eq("id", coach2Member.id);

    // Bez rozšírenej policy by bol zoznam neaktívnych zoznamom pomlčiek.
    const { data: removedProfile } = await director
      .from("profiles")
      .select("full_name")
      .eq("id", coachB)
      .maybeSingle();
    check(
      "šéftréner vidí meno trénera aj po odobratí",
      removedProfile?.full_name === "Boris Druhy",
      JSON.stringify(removedProfile),
    );

    // DELETE ostáva odobratý grantom (bezpečnostný audit) — mazať smie len RPC.
    const directDelete = await director
      .from("organization_members")
      .delete()
      .eq("id", coach2Member.id);
    const { data: stillThere } = await db
      .from("organization_members")
      .select("id")
      .eq("id", coach2Member.id);
    check(
      "priamy DELETE neprejde (grant je odobratý)",
      (stillThere ?? []).length === 1,
      directDelete.error?.message ?? "riadok zmizol!",
    );

    const back = await director
      .from("organization_members")
      .update({ status: "active" })
      .eq("id", coach2Member.id)
      .select("id");
    check("šéftréner vráti odobratého trénera späť", (back.data ?? []).length === 1, back.error?.message);

    // Aktívneho člena nemožno zmazať jedným krokom — najprv sa musí odobrať.
    const deleteActive = await director.rpc("delete_organization_member", { p_member_id: coach2Member.id });
    check(
      "aktívny člen sa vymazať nedá",
      /member_not_deletable/.test(deleteActive.error?.message ?? ""),
      deleteActive.error?.message ?? "PRESLO!",
    );

    const { data: throwaway } = await db
      .from("organization_members")
      .insert({ organization_id: org.id, role: "coach", status: "removed" })
      .select("id")
      .single();
    throwawayId = throwaway.id;

    const byCoach = await coach.rpc("delete_organization_member", { p_member_id: throwawayId });
    check(
      "tréner člena nezmaže",
      /not_director/.test(byCoach.error?.message ?? ""),
      byCoach.error?.message ?? "PRESLO!",
    );

    const deleted = await director.rpc("delete_organization_member", { p_member_id: throwawayId });
    check("šéftréner zmaže odobratého natrvalo", deleted.error === null, deleted.error?.message);
    const { data: gone } = await db.from("organization_members").select("id").eq("id", throwawayId);
    check("riadok je preč", (gone ?? []).length === 0);
    if ((gone ?? []).length === 0) throwawayId = null;
  } finally {
    await db
      .from("organization_members")
      .update({ status: "active" })
      .eq("id", coach2Member.id);
    if (throwawayId) {
      await db.from("organization_members").delete().eq("id", throwawayId);
    }
  }

  // upratanie
  await db.from("organization_members").delete().eq("invite_code", "RLS-TEST1");
  await db.from("drill_codes").delete().eq("code", "RLS-VOL");

  report();
}

main().catch((error) => {
  console.error("CHYBA:", error.message || error);
  process.exit(1);
});
