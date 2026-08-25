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
// 2. **Jazyk prežije skok na druhú doménu.** Cookie `LANDING_LOCALE` je viazaná
//    na doménu, takže bez prenosu v adrese by slovenský návštevník dostal po
//    presmerovaní anglickú stránku — a vyzeralo by to ako chyba prekladu.
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
  ["/navod", PUBLIC],
  ["/federacie", PUBLIC],
  ["/navod-hrac", PARENT],
  ["/cennik-hrac", PARENT],
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

  section("3) Jazyk prežije skok na druhú doménu");
  const carried = await request("/navod-hrac", {
    host: PUBLIC,
    cookies: "LANDING_LOCALE=sk",
  });
  check(
    "k presmerovaniu sa pripojí jazyk z cookie",
    (carried.headers.location ?? "").includes("lang=sk"),
    carried.headers.location,
  );

  const withLang = await request("/navod-hrac?lang=sk", { host: PARENT });
  check(
    "cieľová stránka sa ním naozaj vykreslí",
    /Návod/.test(textOf(withLang.body)),
    textOf(withLang.body).slice(0, 120),
  );

  const withoutLang = await request("/navod-hrac", { host: PARENT });
  check(
    "bez neho ostáva predvolená angličtina",
    /Guide/.test(textOf(withoutLang.body)),
    textOf(withoutLang.body).slice(0, 120),
  );

  const noCookie = await request("/navod-hrac", { host: PUBLIC });
  check(
    "bez cookie sa do adresy nič nedopisuje",
    !(noCookie.headers.location ?? "").includes("lang="),
    noCookie.headers.location,
  );

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
