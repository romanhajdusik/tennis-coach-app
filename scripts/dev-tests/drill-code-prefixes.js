// Predvolené kódy cvičení a ich prefixové skupiny — kontrola konfigurácie
// disciplín, bez dev servera aj bez databázy.
//
// Prečo sada existuje: v zoskupených zameraniach (tenis: Return, Serve)
// rozhoduje o skupine v grafe ZAČIATOK textu kódu. Kód, ktorý žiadnemu
// prefixu nesedí, appka nenahlási — v analytike ticho spadne do „Other"
// a na /drill-codes sa dosype do menšieho stĺpca. Pri premenúvaní kódov
// (2026-09-16 RZH-TRE/RZH-ZAP → WUP-PRC/WUP-MATCH) je toto jediná kontrola,
// ktorá by takú chybu chytila.
//
// Konfigurácie sa čítajú priamo z `lib/disciplines/*.ts` (Node 24 odstráni
// typy sám), takže sada kontroluje presne to, čo appka používa, a novú
// disciplínu pokryje bez úpravy.
const fs = require("node:fs");
const path = require("node:path");
const { createChecks } = require("./helpers");

const { check, section, report } = createChecks();

const REPO = path.join(__dirname, "..", "..");
const DISCIPLINES_DIR = path.join(REPO, "lib", "disciplines");
const { splitSlotsIntoGroups } = require(path.join(REPO, "lib", "drill-options.ts"));

// Rovnaké číslo ako `SLOT_COUNT` v lib/actions/drill-codes.ts a CHECK
// `slot between 1 and 20` v migrácii 20260707180000.
const SLOT_COUNT = 20;

// Veľké písmená a číslice, časti spojené `-` alebo `+` (FRH-CRS, SR1+1,
// ATK+VOL+SSH). Chytá medzery, malé písmená, diakritiku aj lomku.
const CODE_PATTERN = /^[A-Z0-9]+(?:[+-][A-Z0-9]+)*$/;

/**
 * Skupina kódu presne tak, ako ju určuje analytika — `groupOf`
 * v app/analytics/[category]/category-charts.tsx: PRVÁ skupina, ktorej
 * prefixom kód začína. `-1` = kód skončí v „Other".
 */
function analyticsGroupIndex(code, groups) {
  return groups.findIndex((group) => code.startsWith(group.prefix));
}

/** Kódy zoskupeného zamerania, ktoré žiadnemu prefixu nesedia. */
function unmatchedCodes(codes, groups) {
  return codes.filter((code) => analyticsGroupIndex(code, groups) < 0);
}

function loadDisciplines() {
  return fs
    .readdirSync(DISCIPLINES_DIR)
    .filter((file) => file.endsWith(".ts") && file !== "types.ts")
    .flatMap((file) =>
      Object.entries(require(path.join(DISCIPLINES_DIR, file)))
        .filter(([name]) => name.endsWith("_DISCIPLINE"))
        .map(([name, config]) => ({ file, name, config })),
    );
}

function checkDiscipline({ file, name, config }) {
  section(`${config.id} (${file} · ${name})`);

  const categories = new Set(config.categories);
  const drills = config.drills ?? {};
  const grouped = config.analytics?.groupedCategories ?? {};
  const fullBreakdown = config.analytics?.fullBreakdownCategories ?? [];

  // --- zamerania ------------------------------------------------------------
  const unknownDrillCategories = Object.keys(drills).filter((c) => !categories.has(c));
  check(
    "kódy sú len pri zameraniach, ktoré disciplína má",
    unknownDrillCategories.length === 0,
    unknownDrillCategories.join(", "),
  );

  const unknownAnalytics = [...Object.keys(grouped), ...fullBreakdown].filter(
    (c) => !categories.has(c),
  );
  check(
    "analytické pravidlá sa týkajú len existujúcich zameraní",
    unknownAnalytics.length === 0,
    unknownAnalytics.join(", "),
  );

  // Zameranie ide do adresy /analytics/[category] — lomka by rozbila segment.
  const slashed = config.categories.filter((c) => c.includes("/"));
  check("žiadne zameranie nemá v názve lomku", slashed.length === 0, slashed.join(", "));

  // --- kódy v slotoch -------------------------------------------------------
  const tooMany = Object.entries(drills)
    .filter(([, codes]) => codes.length > SLOT_COUNT)
    .map(([category, codes]) => `${category}: ${codes.length}`);
  check(`žiadne zameranie nemá viac než ${SLOT_COUNT} kódov`, tooMany.length === 0, tooMany.join(", "));

  const duplicates = Object.entries(drills).flatMap(([category, codes]) =>
    codes
      .filter((code, index) => codes.indexOf(code) !== index)
      .map((code) => `${category} · ${code}`),
  );
  check(
    "v žiadnom zameraní sa kód neopakuje (v analytike by sa zlial)",
    duplicates.length === 0,
    duplicates.join(", "),
  );

  const malformed = Object.entries(drills).flatMap(([category, codes]) =>
    codes
      .filter((code) => !CODE_PATTERN.test(code))
      .map((code) => `${category} · ${JSON.stringify(code)}`),
  );
  check(
    "kódy sú len z veľkých písmen, číslic, - a +",
    malformed.length === 0,
    malformed.join(", "),
  );

  // --- prefixové skupiny ----------------------------------------------------
  const groupedEntries = Object.entries(grouped);
  if (groupedEntries.length === 0) {
    check("disciplína nemá prefixové skupiny — nie je čo párovať", true);
    return;
  }

  for (const [category, groups] of groupedEntries) {
    const codes = drills[category] ?? [];
    const prefixes = groups.map((group) => group.prefix);

    // Ak je jeden prefix začiatkom druhého (SR a SR1), o skupine by
    // rozhodovalo poradie v konfigurácii, nie text kódu.
    const overlapping = prefixes.flatMap((a, i) =>
      prefixes.filter((b, j) => i !== j && b.startsWith(a)).map((b) => `${a} ⊂ ${b}`),
    );
    check(
      `${category}: prefixy sú neprázdne a žiadny nie je začiatkom iného`,
      prefixes.every(Boolean) && overlapping.length === 0,
      overlapping.join(", ") || JSON.stringify(prefixes),
    );

    const unmatched = unmatchedCodes(codes, groups);
    check(
      `${category}: každý predvolený kód sedí na prefix (nič nespadne do „Other")`,
      unmatched.length === 0,
      unmatched.join(", "),
    );

    const emptyGroups = groups
      .filter((_, index) => !codes.some((code) => analyticsGroupIndex(code, groups) === index))
      .map((group) => `${group.label} (${group.prefix})`);
    check(
      `${category}: každá skupina má aspoň jeden predvolený kód`,
      emptyGroups.length === 0,
      emptyGroups.join(", "),
    );

    // Stĺpce na /drill-codes robí splitSlotsIntoGroups — musia sedieť
    // s tým, kam kód zaradí analytika.
    const slots = Array.from({ length: SLOT_COUNT }, (_, i) => codes[i] ?? "");
    const columns = splitSlotsIntoGroups(slots, groups);
    const misplaced = columns.flatMap((column, index) =>
      column
        .filter((code) => code && analyticsGroupIndex(code, groups) !== index)
        .map((code) => `${code} v stĺpci ${groups[index].label}`),
    );
    check(
      `${category}: stĺpce na /drill-codes sedia so skupinami v analytike`,
      misplaced.length === 0,
      misplaced.join(", "),
    );
  }
}

function selfTest(disciplines) {
  // Kontrola, ktorá nikdy nič nenájde, nedokazuje nič. Podvrhneme kód
  // premenovaný mimo prefix a čakáme, že ho sada nahlási.
  section("Kontrolný pokus: premenovaný kód sa musí nájsť");
  const withGroups = disciplines.find(
    ({ config }) => Object.keys(config.analytics?.groupedCategories ?? {}).length > 0,
  );
  if (!withGroups) {
    check("žiadna disciplína nemá prefixové skupiny — pokus nie je na čom spraviť", true);
    return;
  }
  const { config } = withGroups;
  const [category, groups] = Object.entries(config.analytics.groupedCategories)[0];
  const renamed = `X${groups[0].prefix}-TEST`;
  const codes = [...(config.drills[category] ?? []), renamed];
  const found = unmatchedCodes(codes, groups);
  check(
    `${config.id} · ${category}: kód ${renamed} sa nahlási ako nezaradený`,
    found.includes(renamed),
    JSON.stringify(found),
  );
}

function main() {
  const disciplines = loadDisciplines();
  check(
    `našli sa konfigurácie disciplín (${disciplines.map((d) => d.config.id).join(", ")})`,
    disciplines.length >= 2,
    `počet: ${disciplines.length}`,
  );
  for (const discipline of disciplines) checkDiscipline(discipline);
  selfTest(disciplines);
  report();
}

main();
