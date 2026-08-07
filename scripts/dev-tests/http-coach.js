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
  check("sekcia Tomorrow", /Tomorrow/.test(homeText));

  const emaIndex = homeText.indexOf("Ema Horvathova");
  const adamIndex = homeText.indexOf("Adam Kovac");
  check("rozvrh je zoradený podľa času", emaIndex > -1 && emaIndex < adamIndex);
  check(
    "stavy tréningov",
    /Completed/.test(homeText) && /Planned/.test(homeText),
  );

  // Počty porovnávame proti tomu, čo seed reálne zapísal (expect.json) —
  // inak by test padal podľa hodiny spustenia.
  check(
    `dlaždica ${expectations.sessionsToday} practices today`,
    new RegExp(`${expectations.sessionsToday}\\s*practices today`).test(homeText),
    homeText.slice(0, 300),
  );
  check(
    `dlaždica ${expectations.stillAhead} still ahead`,
    new RegExp(`${expectations.stillAhead}\\s*still ahead`).test(homeText),
  );
  check("3 vyžadujú pozornosť", /3\s*need attention/.test(homeText));
  check(
    "upozornenie mieri na najzanedbanejšieho (Nina bez tréningu)",
    /Nina Bakova — no practice in the last 60 days/.test(homeText),
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
  check("žiadne dlaždice zhrnutia mimo org", !/need attention/.test(standaloneText));

  report();
}

main().catch((error) => {
  console.error("CHYBA:", error.message || error);
  process.exit(1);
});
