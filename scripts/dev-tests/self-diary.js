// Hráčsky denník (docs/roadmap-buduce-smery.md §6) — registrácia a poistky
// v databáze. Nepotrebuje dev server, len lokálnu Supabase.
//
// Overuje: hráčsky denník vznikne ako trénerský účet s `self_diary` a práve
// jednou kartou (on sám); na kondičke sa ticho stane obyčajným trénerom;
// podvrhnuté `self_diary` rodičovi nedá nič; CHECK odmietne denník mimo
// kurtu aj nie-trénerovi; prihlásený si príznak neprepne.
//
// Spustenie: node scripts/dev-tests/self-diary.js
const { execSync } = require("child_process");
const { createClient } = require(process.cwd() + "/node_modules/@supabase/supabase-js");
const st = JSON.parse(execSync("npx supabase status -o json", { encoding: "utf8" }).replace(/^[^{]*/, ""));
const admin = createClient(st.API_URL, st.SERVICE_ROLE_KEY);
const anon = createClient(st.API_URL, st.ANON_KEY, { auth: { persistSession: false } });
let fails = 0; const check = (n, ok, d = "") => { console.log((ok ? "OK   " : "FAIL ") + n + (ok ? "" : "  " + d)); if (!ok) fails++; };
(async () => {
  const stamp = Date.now();
  const mk = async (email, meta) => {
    const { data, error } = await anon.auth.signUp({ email, password: "heslo12345", options: { data: meta } });
    if (error) throw error; return data.user.id;
  };
  // 1) tenisový hráčsky denník
  const a = await mk(`self-${stamp}@test.local`, { full_name: "Jana Hráčka", role: "coach", discipline: "tennis", self_diary: true });
  const pa = (await admin.from("profiles").select("*").eq("id", a).single()).data;
  check("tenis: self_diary = true", pa.self_diary === true, JSON.stringify(pa));
  check("tenis: role coach, limit 1", pa.role === "coach" && pa.player_limit === 1);
  const cards = (await admin.from("players").select("name,is_active,organization_id").eq("coach_id", a)).data;
  check("tenis: vznikla práve jedna karta s jeho menom", cards.length === 1 && cards[0].name === "Jana Hráčka" && cards[0].is_active && cards[0].organization_id === null, JSON.stringify(cards));
  // 2) kondička: self ignorovaný
  const b = await mk(`self-fit-${stamp}@test.local`, { full_name: "Fit", role: "coach", discipline: "fitness", self_diary: true });
  const pb = (await admin.from("profiles").select("self_diary,discipline").eq("id", b).single()).data;
  const cb = (await admin.from("players").select("id").eq("coach_id", b)).data;
  check("kondička: self_diary ticho false, žiadna karta", pb.self_diary === false && pb.discipline === "fitness" && cb.length === 0, JSON.stringify([pb, cb]));
  // 3) bežný tréner bez zmeny
  const c = await mk(`coach-${stamp}@test.local`, { full_name: "Tréner", role: "coach", discipline: "padel" });
  const pc = (await admin.from("profiles").select("self_diary").eq("id", c).single()).data;
  const cc = (await admin.from("players").select("id").eq("coach_id", c)).data;
  check("tréner: self_diary false, žiadna karta", pc.self_diary === false && cc.length === 0);
  // 4) sledujúci s podvrhnutým self_diary
  const d = await mk(`par-${stamp}@test.local`, { full_name: "Rodič", role: "parent", self_diary: true });
  const pd = (await admin.from("profiles").select("self_diary,role").eq("id", d).single()).data;
  check("rodič: self_diary podvrh nedá nič", pd.self_diary === false && pd.role === "parent");
  // 5) CHECK: denník nesmie byť na kondičke ani nie-tréner
  const e1 = await admin.from("profiles").update({ self_diary: true }).eq("id", b);
  check("CHECK odmietne self_diary na kondičke", !!e1.error, "prešlo");
  const e2 = await admin.from("profiles").update({ self_diary: true }).eq("id", d);
  check("CHECK odmietne self_diary rodičovi", !!e2.error, "prešlo");
  // 6) účet si to nezmení sám
  await anon.auth.signInWithPassword({ email: `coach-${stamp}@test.local`, password: "heslo12345" });
  const e3 = await anon.from("profiles").update({ self_diary: true }).eq("id", c).select();
  const after = (await admin.from("profiles").select("self_diary").eq("id", c).single()).data;
  check("prihlásený si self_diary neprepne", after.self_diary === false, JSON.stringify(e3));
  // 7) Prepojenia (docs §6.2 bod 3) — rovnaké cesty, aké volajú server akcie
  //    `generateConnectCode`/`claimConnection` a `generateCardLinkCode`/`claimCardLink`.
  const as = async (email) => {
    const client = createClient(st.API_URL, st.ANON_KEY, { auth: { persistSession: false } });
    const { error } = await client.auth.signInWithPassword({ email, password: "heslo12345" });
    if (error) throw error;
    return client;
  };
  const selfClient = await as(`self-${stamp}@test.local`);
  const ownCard = (await selfClient.from("players").select("id").eq("coach_id", a).single()).data;

  //    a) rodič zadá kód od hráča
  const connectCode = `S${String(stamp).slice(-7)}`;
  const ins = await selfClient.from("player_connections").insert({
    coach_id: a, player_id: ownCard.id, connect_code: connectCode, status: "pending",
  });
  check("hráč vydá kód pre rodiča", !ins.error, ins.error?.message);
  const parentClient = await as(`par-${stamp}@test.local`);
  const claim = await parentClient.rpc("claim_player_connection", { p_code: connectCode });
  const conn = (await admin.from("player_connections").select("status,parent_id").eq("connect_code", connectCode).single()).data;
  check("rodič sa kódom pripojí", !claim.error && conn?.status === "active" && conn?.parent_id === d, claim.error?.message ?? JSON.stringify(conn));

  //    b) hráč zadá kód od kondičného trénera
  const fitCard = (await admin.from("players").insert({ coach_id: b, name: "Jana (fitness)" }).select("id").single()).data;
  const fitClient = await as(`self-fit-${stamp}@test.local`);
  const linkCode = `L${String(stamp).slice(-7)}`;
  const link = await fitClient.from("player_links").insert({
    source_player_id: fitCard.id, source_coach_id: b, source_discipline: "fitness", link_code: linkCode,
  });
  check("kondičný tréner vydá kód", !link.error, link.error?.message);
  const linkClaim = await selfClient.rpc("claim_player_link", {
    p_code: linkCode, p_player_id: ownCard.id, p_discipline: "tennis",
  });
  const linkRow = (await admin.from("player_links").select("target_player_id,status").eq("link_code", linkCode).single()).data;
  check("hráč sa prepojí s kondičkou", !linkClaim.error && linkRow?.target_player_id === ownCard.id, linkClaim.error?.message ?? JSON.stringify(linkRow));

  for (const id of [a, b, c, d]) await admin.auth.admin.deleteUser(id);
  console.log(`\nVýsledok: ${fails ? fails + " FAIL" : "0 FAIL"}`);
})().catch((e) => { console.error(e); process.exit(1); });
