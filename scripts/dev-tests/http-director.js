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
  // Spodná lišta patrí trénerovi; šéftréner (registrovaný tiež ako tréner)
  // ju mať nesmie — jeho domov je pult.
  check(
    "šéftréner nemá spodnú lištu trénera",
    !/aria-label="Main navigation"/.test(panel.body),
  );
  // Nastavenia (od 2026-09-25): šéftréner sa k zásadám pre organizácie inak
  // v appke nedostane. Spotrebiteľské podmienky trénera preňho neplatia —
  // appku mu poskytuje zväz na základe zmluvy, nie my jemu.
  check("pult vedie na nastavenia", rendered(panel.body).includes('href="/settings"'));
  const orgSettings = rendered((await request("/settings", { cookies: director })).body);
  check(
    "šéftréner dostane zásady pre organizácie",
    orgSettings.includes('href="/organization-privacy"'),
  );
  check(
    "nedostane spotrebiteľské znenie trénera",
    !orgSettings.includes('href="/terms"') && !orgSettings.includes('href="/privacy"'),
  );
  // Federačný TRÉNER je naopak trénerom ako každý iný — §3 podmienok
  // výslovne počíta s tým, že účet patrí organizácii.
  const coachSettings = rendered(
    (await request("/settings", { cookies: await authCookies("coach-today@test.local") })).body,
  );
  check(
    "federačný tréner dostane trénerské znenie",
    coachSettings.includes('href="/terms"') && coachSettings.includes('href="/privacy"'),
  );

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
  // Od 2026-10-12 má hráč zoznam trénerov (môže ich mať viac) a výber slúži
  // len na PRIDANIE ďalšieho. Pridelený tréner preto musí byť v zozname mimo
  // `<option>` a vo výbere nesmie byť — inak by šéftréner „pridával" toho,
  // koho hráč už má. Text bez `<option>` je nutný: v ponuke sú aj mená
  // ostatných trénerov, takže „meno je na stránke" by prešlo vždy.
  const withoutOptions = detail.body.replace(/<option[^>]*>[^<]*<\/option>/g, "");
  const listed = (textOf(withoutOptions).match(/Andrea Prva|Boris Druhy/g) || [])[0];
  check("ukazuje prideleného trénera", Boolean(listed), detailText.slice(0, 250));
  check(
    "pridelený tréner nie je v ponuke na pridanie",
    listed &&
      !new RegExp(`<option[^>]*>${listed} — `).test(detail.body),
  );
  check("pri trénerovi je tlačidlo na odobratie", />Remove</.test(detail.body));
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
    host: "demo.plawtennis.com",
  });
  check(
    "hráč org nie je dostupný z cudzej subdomény",
    foreign.status === 307 || foreign.status === 404,
    "status " + foreign.status,
  );

  section("6) Tréner sa v pulte nevolá „Court coach\" (od 2026-10-05)");
  // Rozhodol user: šéftréner má vidieť „Tennis coach", v padelovom zväze
  // „Padel coach". „Court" je len vnútorné rozlíšenie v kóde (kind).
  const teamBody = (await request("/director/team", { cookies: director })).body;
  const team = textOf(teamBody);
  check("pri trénerovi stojí „Tennis coach\"", /Tennis coach/.test(team), team.slice(0, 200));
  const dashBody = (await request("/director", { cookies: director })).body;
  const codesBody = (await request("/director/drill-codes", { cookies: director })).body;
  const all = team + textOf(dashBody) + textOf(codesBody);

  // Stráži sa JEDINE to, že sa tréner nevolá „Court coach" (user
  // 2026-10-12: „slovom court nemôže byť nazývaný coach, ale všetko ostatné
  // je možné"). Slovo „court" kdekoľvek inde — kódy a vysvetlivky cvičení
  // („Forehand cross-court", vlastný kód „COURT SPRINT"), iné texty — je
  // dovolené a test naň reagovať nesmie.
  const courtCoach = all.match(/\bcourt coach\b/i);
  check(
    "tréner sa v pulte nevolá „Court coach\"",
    !courtCoach,
    courtCoach ? all.slice(Math.max(0, courtCoach.index - 40), courtCoach.index + 40) : "",
  );

  report();
}

main().catch((error) => {
  console.error("CHYBA:", error.message || error);
  process.exit(1);
});
