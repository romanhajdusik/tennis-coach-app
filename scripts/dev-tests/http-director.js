// HTTP scenáre riadiaceho pultu: smerovanie podľa roly, obsah pultu,
// drill-in do hráča a tenant izolácia.
const {
  authCookies,
  request,
  rendered,
  textOf,
  createChecks,
} = require("./helpers");

const { check, section, report } = createChecks();

async function main() {
  const director = await authCookies("director-today@test.local");
  const coach = await authCookies("coach-today@test.local");

  section("1) Smerovanie podľa roly");
  const home = await request("/", { cookies: director });
  check(
    "šéftréner ide z / na pult",
    home.status === 307 && /\/director$/.test(home.headers.location ?? ""),
    home.status + " " + home.headers.location,
  );
  const coachHome = await request("/", { cookies: coach });
  check(
    "tréner ostáva na nástenke Dnes",
    coachHome.status === 200 && /Today's schedule/.test(textOf(coachHome.body)),
  );
  const coachPanel = await request("/director", { cookies: coach });
  check(
    "tréner sa na pult nedostane",
    coachPanel.status === 307,
    coachPanel.status + " " + coachPanel.headers.location,
  );

  section("2) Pult");
  const panel = await request("/director", { cookies: director });
  const panelText = textOf(panel.body);
  check("pult sa načíta", panel.status === 200, "status " + panel.status);
  check("názov organizácie", /Today Test Academy/.test(panelText));
  check("6 hráčov v dlaždici", /6 players/.test(panelText), panelText.slice(0, 250));
  check("2 tréneri v dlaždici", /2 coaches/.test(panelText));
  check(
    "obaja tréneri v zozname",
    /Andrea Prva/.test(panelText) && /Boris Druhy/.test(panelText),
  );
  check(
    "hráči oboch trénerov",
    /Adam Kovac/.test(panelText) && /Tomas Novy/.test(panelText),
  );
  check(
    "sekcia pozornosti so stavmi",
    /Needs attention/.test(panelText) && /without a practice/.test(panelText),
  );
  check("poznámka o read-only", /Read-only overview/.test(panelText));
  // Jediný formulár na pulte je odhlásenie — pult nič nezapisuje.
  const forms = (rendered(panel.body).match(/<form/g) || []).length;
  check("žiadne editačné formuláre okrem odhlásenia", forms === 1, "formulárov: " + forms);

  section("3) Drill-in do hráča");
  const playerIds = [
    ...new Set(
      [...panel.body.matchAll(/\/director\/players\/([0-9a-f-]{36})/g)].map(
        (match) => match[1],
      ),
    ),
  ];
  check("pult odkazuje na detaily hráčov", playerIds.length >= 5, "odkazov: " + playerIds.length);

  // Zoznam pozornosti začína hráčom bez tréningu, takže prvý odkaz nestačí —
  // hľadáme takého, čo nejaký tréning má.
  let playerId = playerIds[0];
  let detail = await request(`/director/players/${playerId}`, { cookies: director });
  for (const candidate of playerIds) {
    const page = await request(`/director/players/${candidate}`, { cookies: director });
    if (/\/director\/sessions\//.test(page.body)) {
      playerId = candidate;
      detail = page;
      break;
    }
  }
  const detailText = textOf(detail.body);
  check("detail hráča sa načíta", detail.status === 200, "status " + detail.status);
  // Meno prideleného trénera sa od commitu `0560a31` nepíše zvlášť — ukazuje ho
  // predvolená voľba vo výbere na preradenie (dvakrát by tam stálo zbytočne).
  // Preto sa kontroluje vybraná `<option>` v surovom HTML, nie text stránky:
  // v texte sú aj mená ostatných trénerov ako ďalšie voľby, takže obyčajné
  // „meno je na stránke" by prešlo aj pri zle priradenom hráčovi.
  check(
    "ukazuje prideleného trénera",
    // Za menom je od migrácie 20260815090000 aj disciplína („Andrea Prva —
    // court"): preradenie sa týka len jednej disciplíny, takže výber musí
    // povedať, ktorú mení.
    /<option[^>]*\sselected[^>]*>(Andrea Prva|Boris Druhy) — (court|fitness)</.test(
      detail.body,
    ),
    detailText.slice(0, 250),
  );
  check("zoznam tréningov", /Practices/.test(detailText));

  const sessionId = (detail.body.match(/\/director\/sessions\/([0-9a-f-]{36})/) || [])[1];
  check("detail hráča odkazuje na tréning", !!sessionId);
  const session = await request(`/director/sessions/${sessionId}`, { cookies: director });
  const sessionText = textOf(session.body);
  check("detail tréningu sa načíta", session.status === 200, "status " + session.status);
  check("read-only (žiadny formulár)", !/<form/.test(rendered(session.body)));
  check(
    "ukazuje trvanie a rozpis",
    /Total duration/.test(sessionText) && /Drills/.test(sessionText),
  );

  const analytics = await request(
    `/director/players/${playerId}/analytics/Forehand`,
    { cookies: director },
  );
  const analyticsText = textOf(analytics.body);
  check("analytika hráča sa načíta", analytics.status === 200, "status " + analytics.status);
  check("záložky zameraní", /Backhand/.test(analyticsText) && /GAME DRILLS/.test(analyticsText));
  check(
    "generálny graf je prvý",
    analyticsText.indexOf("Share of total training time") <
      (analyticsText.includes("By drill code")
        ? analyticsText.indexOf("By drill code")
        : Infinity),
  );

  section("4) Porovnanie hráčov");
  const compare = await request("/director/compare", { cookies: director });
  const compareText = textOf(compare.body);
  check("porovnanie sa načíta", compare.status === 200, "status " + compare.status);
  check("os podľa trénera aj ročníka", /By coach/.test(compareText) && /By year of birth/.test(compareText));

  section("5) Tenant izolácia cez URL");
  const foreign = await request(`/director/players/${playerId}`, {
    cookies: director,
    host: "demo.plaw.win",
  });
  check(
    "hráč org nie je dostupný z cudzej subdomény",
    foreign.status === 307 || foreign.status === 404,
    "status " + foreign.status,
  );

  report();
}

main().catch((error) => {
  console.error("CHYBA:", error.message || error);
  process.exit(1);
});
