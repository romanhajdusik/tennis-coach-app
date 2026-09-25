// SMEROVANIE VEREJNÉHO WEBU medzi tromi doménami (plaw.win, plaw.online,
// plaw.click) — pravidlá z `proxy.ts` a `lib/public-face.ts`.
//
// Vzniklo pri kanonizácii 2026-08-24, keď sa ukázalo, že tú najkrehkejšiu časť
// (jeden Vercel projekt, tri hostitele, presmerovania tam aj späť) neoverovala
// ani jedna sada.
//
// Čo sa overuje a prečo práve to:
//
// 1. **Každá verejná stránka odpovedá 200 práve na JEDNOM hostiteľovi.**
//    Dovtedy odpovedali návody a cenník na dvoch–troch naraz; pri spustení do
//    vyhľadávačov by si tá istá stránka konkurovala sama so sebou.
// 2. **Verejný web je jednojazyčný (anglický).** Od 2026-09-14 tu nie je
//    prepínač, cookie `LANDING_LOCALE` ani prenos jazyka v adrese (`?lang=`) —
//    sada to overuje zo strany správania, aby sa tá vrstva nevrátila po
//    kúskoch. Dôvody sú v `lib/landing-locale.ts`.
// 3. **Appkové cesty na marketingových doménach neexistujú.** Login ani appka
//    sa na plaw.online/plaw.click vykresliť nesmú, inak by vznikli dve adresy
//    toho istého produktu a session by sa tvorila na nesprávnej doméne.
//
// Potrebuje bežiaci dev server (viď README.md). Virtuálne hostitele idú cez
// hlavičku `Host` — `fetch` ju zahadzuje, preto `request()` z helpers.
const { request, textOf, createChecks } = require("./helpers");

const { check, section, report } = createChecks();

const APP = "plaw.win";
const PUBLIC = "plaw.online";
const PARENT = "plaw.click";

// Stránka → hostiteľ, ktorému patrí. Poradie zodpovedá `CANONICAL_ORIGINS`
// v `proxy.ts`; keď tam niečo pribudne, patrí to aj sem.
const CANONICAL = [
  ["/", APP], // trénerský landing
  ["/navod", APP],
  ["/federacie", PUBLIC],
  ["/navod-hrac", PARENT],
  ["/cennik-hrac", PARENT],
  // Právne stránky (od 2026-09-24) — každá na doméne svojho publika.
  ["/podmienky", APP],
  ["/zasady", APP],
  ["/podmienky-hrac", PARENT],
  ["/zasady-hrac", PARENT],
  ["/zasady-organizacia", PUBLIC],
  // Text na odovzdanie rodičovi (od 2026-09-25) — číta ho rodič, takže plaw.click.
  ["/informacia-pre-rodicov", PARENT],
];

const HOSTS = [APP, PUBLIC, PARENT];
const ORIGIN = {
  [APP]: "https://plaw.win",
  [PUBLIC]: "https://plaw.online",
  [PARENT]: "https://plaw.click",
};

async function main() {
  section("0) Beží dev server?");
  const probe = await request("/login", { host: APP });
  if (probe.status !== 200) {
    console.error(`\n  Dev server neodpovedá (status ${probe.status}).\n`);
    process.exit(1);
  }
  check("appka odpovedá", probe.status === 200);

  section("1) Každá stránka má práve jednu adresu");
  for (const [path, owner] of CANONICAL) {
    for (const host of HOSTS) {
      const res = await request(path, { host });
      if (host === owner) {
        check(
          `${host}${path} sa vykreslí`,
          res.status === 200,
          `status ${res.status}`,
        );
      } else if (path === "/") {
        // Domovská stránka je na každej doméne iná (landing / rozcestník /
        // rodičovská landing), takže sa nepresmerúva — kontroluje ju §2.
        continue;
      } else {
        const location = res.headers.location ?? "";
        check(
          `${host}${path} vedie na ${owner}`,
          res.status === 307 && location.startsWith(ORIGIN[owner] + path),
          `status ${res.status}, location ${location}`,
        );
      }
    }
  }

  section("2) Domovská stránka hovorí k tomu, kto na ňu prišiel");
  const coachHome = textOf((await request("/", { host: APP })).body);
  const publicHome = textOf((await request("/", { host: PUBLIC })).body);
  const parentHome = textOf((await request("/", { host: PARENT })).body);
  check(
    "plaw.win = trénerský landing (je na ňom cenník trénera)",
    /players/i.test(coachHome) && /P\.L\.A\.W/.test(coachHome),
  );
  check(
    "plaw.online = rozcestník (ponúka federácie)",
    /federation|federácie/i.test(publicHome),
  );
  check(
    "plaw.click = landing pre sledujúceho, bez B2B dverí",
    !/federation|federácie/i.test(parentHome),
  );

  section("3) Verejný web je jednojazyčný (anglický)");
  // Cookie po starom prepínači môže návštevníkovi v prehliadači ešte ležať —
  // stránka ju musí ignorovať, nie sa podľa nej prepnúť.
  const withCookie = await request("/navod-hrac", {
    host: PUBLIC,
    cookies: "LANDING_LOCALE=sk",
  });
  check(
    "do presmerovania sa jazyk nedopisuje ani s cookie",
    !(withCookie.headers.location ?? "").includes("lang="),
    withCookie.headers.location,
  );

  const ignoredCookie = await request("/navod-hrac", {
    host: PARENT,
    cookies: "LANDING_LOCALE=sk",
  });
  check(
    "cookie LANDING_LOCALE stránku nepreloží",
    /Guide/.test(textOf(ignoredCookie.body)),
    textOf(ignoredCookie.body).slice(0, 120),
  );

  const ignoredLang = await request("/navod-hrac?lang=sk", { host: PARENT });
  check(
    "?lang= v adrese stránku nepreloží",
    /Guide/.test(textOf(ignoredLang.body)),
    textOf(ignoredLang.body).slice(0, 120),
  );

  // Prepínač vykresľoval kódy jazykov ako tlačidlá (`>DE<`, `>JA<`) — keby sa
  // vrátil, spadne práve táto kontrola.
  const parentGuide = await request("/navod-hrac", { host: PARENT });
  check(
    "prepínač jazykov na stránke nie je",
    !/>DE<|>JA<|>SK</.test(parentGuide.body),
  );

  // Text právnych stránok sa číta zo schválených dokumentov v `docs/` — keby
  // sa niekedy skopíroval do `messages/`, tieto kontroly to nezachytia, ale
  // zachytia, keď sa čítanie rozbije a stránka sa vykreslí prázdna.
  section("5) Právne stránky nesú text schváleného dokumentu");
  const PRAVNE = [
    ["/podmienky", APP, "Terms of Use"],
    ["/zasady", APP, "Privacy Policy"],
    ["/podmienky-hrac", PARENT, "Terms of Use"],
    ["/zasady-hrac", PARENT, "Privacy Policy"],
    ["/zasady-organizacia", PUBLIC, "Privacy Policy"],
  ];
  for (const [path, host, nadpis] of PRAVNE) {
    const res = await request(path, { host });
    const text = textOf(res.body);
    check(
      `${host}${path} má nadpis a prevádzkovateľa`,
      res.status === 200 && text.includes(nadpis) && text.includes("Go, s.r.o."),
      `status ${res.status}`,
    );
    // Obsah je jediná navigácia v dlhom dokumente; bez neho sa stránka na
    // telefóne nedá prejsť.
    check(`${host}${path} má obsah s paragrafmi`, /href="#s1"/.test(res.body));
  }

  section("5b) Text pre rodičov je celý a bez interných častí");
  const rodicia = await request("/informacia-pre-rodicov", { host: PARENT });
  const rodiciaText = textOf(rodicia.body);
  check(
    "stránka sa vykreslí",
    rodicia.status === 200 &&
      rodiciaText.includes("Information about the processing"),
    `status ${rodicia.status}`,
  );
  check(
    "má všetky časti textu",
    ["Who processes the data", "What I record about your child", "Your rights"].every(
      (h) => rodiciaText.includes(h),
    ),
  );
  // Prvá časť dokumentu je návod pre trénera a posledná interné poznámky —
  // ani jedna sa nesmie dostať von. Slovenské znenie tiež nie (rozhodol
  // používateľ 2026-09-25: appka aj web sú anglické).
  check(
    "nezverejnil sa návod pre trénera ani interné poznámky",
    !/Ako sa to má používať|Čo z toho ešte treba spraviť/.test(rodiciaText),
  );
  check(
    "nezverejnila sa slovenská verzia",
    !/Informácia o spracúvaní/.test(rodiciaText),
  );
  // Voliteľný odsek o zdraví je v dokumente blockquote a zaškrtávacie políčka
  // sú prázdne zátvorky — ani jedno sa nesmie vykresliť ako surový markdown
  // alebo ako žlté „nevyplnené miesto".
  check(
    "voliteľný odsek je v ráme, nie ako text s „>“",
    /<blockquote/.test(rodicia.body) && !/&gt;\s/.test(rodiciaText),
  );
  check(
    "zaškrtávacie políčka nie sú žlté diery",
    rodiciaText.includes("[ ] yes") &&
      !/<mark[^>]*>\s*<\/mark>/.test(rodicia.body),
  );
  // Žlté miesta tu ostať MAJÚ — sú to miesta, ktoré si dopĺňa tréner.
  const znacky = (rodicia.body.match(/<mark/g) ?? []).length;
  check("miesta na doplnenie trénerom sú zvýraznené", znacky === 3, `${znacky} miest`);

  section("4) Appka na marketingových doménach nežije");
  for (const host of [PUBLIC, PARENT]) {
    for (const path of ["/login", "/players", "/parent"]) {
      const res = await request(path, { host });
      const location = res.headers.location ?? "";
      check(
        `${host}${path} vedie na appku`,
        res.status === 307 && location.startsWith(ORIGIN[APP] + path),
        `status ${res.status}, location ${location}`,
      );
    }
  }
}

main()
  .then(report)
  .catch((error) => {
    console.error("CHYBA:", error.message || error);
    process.exit(1);
  });
