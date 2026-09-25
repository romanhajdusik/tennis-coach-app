// HTTP scenáre trénerovej appky vo federačnom režime: nástenka „Dnes",
// roster so stavmi, a kontrola, že samostatný (1:1) režim ostal nedotknutý.
const expectations = require("./expect.json");
const {
  ORG_HOST,
  APP_HOST,
  authCookies,
  request,
  rendered,
  textOf,
  createChecks,
} = require("./helpers");

const { check, section, report } = createChecks();

async function main() {
  const cookies = await authCookies("coach-today@test.local");

  section(`1) Obrazovka Dnes na ${ORG_HOST}`);
  const home = await request("/", { cookies });
  const homeText = textOf(home.body);
  check("stránka sa načíta", home.status === 200, "status " + home.status);
  check("nadpis Today", /Today/.test(homeText));
  check("názov organizácie", /Today Test Academy/.test(homeText));
  check("sekcia Today's schedule", /Today's schedule/.test(homeText));
  check("sekcia Tomorrow's schedule", /Tomorrow's schedule/.test(homeText));

  const emaIndex = homeText.indexOf("Ema Horvathova");
  const adamIndex = homeText.indexOf("Adam Kovac");
  check("rozvrh je zoradený podľa času", emaIndex > -1 && emaIndex < adamIndex);
  check(
    "stavy tréningov",
    /Completed/.test(homeText) && /Planned/.test(homeText),
  );

  // Počet porovnávame proti tomu, čo seed reálne zapísal (expect.json) —
  // inak by test padal podľa hodiny spustenia. Riadky dnešného rozvrhu sú
  // všetky pred nadpisom „Tomorrow's schedule".
  const homeHtml = rendered(home.body);
  const todayRows = (
    homeHtml
      .slice(0, homeHtml.search(/>Tomorrow/))
      .match(/aria-label="Open the practice with /g) ?? []
  ).length;
  check(
    `dnešný rozvrh má ${expectations.sessionsToday} tréningy`,
    todayRows === expectations.sessionsToday,
    `našlo sa ${todayRows}`,
  );
  // Dlaždice so súčtami (tréningy dnes, koľko ešte čaká) sú od 2026-09-21 preč
  // — len opakovali rozvrh, ktorý je hneď pod nimi.
  check(
    "nástenka nemá dlaždice so súčtami",
    !/practices today|still ahead/.test(homeText),
  );
  // Upozornenie „hráč netrénuje" patrí od 2026-09-21 len šéftrénerovi (pult);
  // trénerovi na nástenke nie je — stav hráča vidí v zozname nižšie (§2).
  check("nástenka nemá dlaždicu need attention", !/need attention/.test(homeText));
  check(
    "nástenka neupozorňuje na hráča bez tréningu",
    !/no practice in the last|without a practice/.test(homeText),
  );

  section("2) Roster /players so stavmi");
  const players = await request("/players", { cookies });
  const playersText = textOf(players.body);
  check("stránka sa načíta", players.status === 200, "status " + players.status);
  check("nadpis rosteru", /My players/.test(playersText));
  check(
    `${expectations.activePlayers} aktívnych hráčov`,
    new RegExp(`${expectations.activePlayers}\\s*active players`).test(playersText),
  );
  check('Practiced yesterday (Adam)', /Practiced yesterday/.test(playersText));
  check('Practiced today (Ema)', /Practiced today/.test(playersText));
  check('6 days without a practice (Sofia)', /6 days without a practice/.test(playersText));
  check('12 days without a practice (Jakub)', /12 days without a practice/.test(playersText));
  check(
    'No practice in the last 60 days (Nina)',
    /No practice in the last 60 days/.test(playersText),
  );
  check("najbližší tréning", /Next (today|tomorrow) at/.test(playersText));
  check("hráč bez plánu", /No practice scheduled/.test(playersText));
  check(
    "stavové bodky (3 úrovne)",
    /bg-emerald-500/.test(rendered(players.body)) &&
      /bg-amber-500/.test(rendered(players.body)) &&
      /bg-red-500/.test(rendered(players.body)),
  );

  section(`3) Samostatný režim (${APP_HOST}) sa nezmenil`);
  // Účet je členom org, takže na plaw.win osobné dáta nemá — dôležité je, že
  // sa mu tam nezobrazí denná nástenka (tá patrí len na org subdoménu).
  const standalone = await request("/", { host: APP_HOST, cookies });
  const standaloneText = textOf(standalone.body);
  check("žiadny rozvrh mimo org", !/Today's schedule/.test(standaloneText));
  check("namiesto nástenky len kto je prihlásený", /Logged in as/.test(standaloneText));

  section("3b) Spodná lišta a hlavička domova (od 2026-09-21)");
  check(
    "domov má spodnú lištu so všetkými piatimi cieľmi",
    /aria-label="Main navigation"/.test(homeHtml) &&
      ['href="/"', 'href="/players"', 'href="/sessions"', 'href="/calendar"', 'href="/analytics/Forehand"']
        .every((href) => homeHtml.includes(href)),
  );
  check("na domove je aktívna záložka Home", /aria-current="page"[^>]*href="\/"|href="\/"[^>]*aria-current="page"/.test(homeHtml));
  check(
    "kódy cvičení a odhlásenie sú ikonky s popisom v hlavičke",
    /<header[\s\S]*href="\/drill-codes"[\s\S]*Drill codes[\s\S]*Log out[\s\S]*<\/header>/.test(homeHtml),
  );
  // Na /players vedie len záložka lišty — rad tlačidiel pod nástenkou je preč.
  check(
    "rad tlačidiel pod nástenkou zmizol",
    (homeHtml.match(/href="\/players"/g) ?? []).length === 1,
    `odkazov na /players: ${(homeHtml.match(/href="\/players"/g) ?? []).length}`,
  );
  const playersHtml = rendered(players.body);
  check(
    "na /players je aktívna záložka Players",
    /aria-current="page"[^>]*href="\/players"|href="\/players"[^>]*aria-current="page"/.test(playersHtml),
  );
  // Samostatný tréner s JEDINÝM hráčom: nástenku má tiež a časť „Players" nie
  // je prázdna — vedľa jeho hráča je sivý neaktívny čip „noname".
  const soloBody = (
    await request("/", { host: APP_HOST, cookies: await authCookies("demo@plaw.win") })
  ).body;
  const soloHome = rendered(soloBody);
  // Nadpis prvej sekcie závisí od dňa: keď je dnes tréning, je to „Today's
  // schedule", inak „Last practice" (od 2026-09-24 sa prázdny deň nahrádza
  // posledným odtrénovaným). Nástenku teda poznáme podľa oboch.
  check(
    "tréner s jedným hráčom má nástenku",
    /Today's schedule|Last practice/.test(textOf(soloBody)),
  );
  check(
    "vedľa jediného hráča je sivý čip noname",
    /Adam Kováč/.test(soloHome) && />noname</.test(soloHome),
  );
  const landing = await request("/", { host: APP_HOST });
  check(
    "odhlásený (landing) lištu nemá",
    !/aria-label="Main navigation"/.test(rendered(landing.body)),
  );

  section("3c) Nastavenia účtu (od 2026-09-25)");
  // Stránka je jediné miesto, kde sa PRIHLÁSENÝ dostane k podmienkam
  // a zásadám — na verejnom webe sú pred prihlásením, takže po registrácii by
  // ich už nenašiel. Každé publikum má pritom vlastné znenie.
  const settings = await request("/settings", {
    host: APP_HOST,
    cookies: await authCookies("demo@plaw.win"),
  });
  const settingsHtml = rendered(settings.body);
  check(
    "hlavička domova vedie na nastavenia",
    /<header[\s\S]*href="\/settings"[\s\S]*Settings[\s\S]*<\/header>/.test(soloHome),
  );
  check("tréner sa na ne dostane", settings.status === 200, String(settings.status));
  check(
    "dostane SVOJE znenie (podmienky aj zásady trénera)",
    settingsHtml.includes('href="/podmienky"') && settingsHtml.includes('href="/zasady"'),
  );
  check(
    "nedostane znenie iného publika",
    !/podmienky-hrac|zasady-hrac|zasady-organizacia/.test(settingsHtml),
  );
  check(
    "export dát a zmazanie účtu majú kontakt",
    /support@plawsports\.com/.test(textOf(settings.body)),
  );
  const settingsAnon = await request("/settings", { host: APP_HOST });
  check(
    "neprihlásený na ne nemá prístup",
    settingsAnon.status === 307 && /\/login/.test(settingsAnon.headers.location ?? ""),
    settingsAnon.status + " " + (settingsAnon.headers.location ?? ""),
  );

  section("4) Farebné odlíšenie appiek");
  // Federačná appka má svetlomodré tlačidlá, tenisová predvolené limetkové —
  // rozlišuje ich `data-app` na <html>, odtiene sú v globals.css.
  check(
    'org subdoména má data-app="org"',
    /<html[^>]*data-app="org"/.test(home.body),
    (home.body.match(/<html[^>]*>/) ?? [""])[0],
  );
  check(
    "tenisová appka nemá data-app (ostáva predvolená limetková)",
    !/<html[^>]*data-app=/.test(standalone.body),
    (standalone.body.match(/<html[^>]*>/) ?? [""])[0],
  );

  report();
}

main().catch((error) => {
  console.error("CHYBA:", error.message || error);
  process.exit(1);
});
