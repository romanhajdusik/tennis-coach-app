// Stabilná farba na zameranie (podľa jeho poradia v konfigurácii disciplíny),
// aby malo každé zameranie rovnakú farbu naprieč obdobiami aj obrazovkami.
// Tenis má 7 zameraní = 6 sérií + neutrálna pre posledné.
//
// POZOR: kondička má 10 zameraní, takže sa jej farby cez modulo opakujú.
//
// Žije to tu, a nie v grafe, lebo tú istú paletu potrebuje aj nástenka —
// dva zoznamy farieb by sa časom rozišli a ten istý úder by mal na domovskej
// obrazovke inú farbu než v analytike.
export const CATEGORY_COLOR_VARS = [
  "var(--series-1)",
  "var(--series-2)",
  "var(--series-3)",
  "var(--series-4)",
  "var(--series-5)",
  "var(--series-6)",
  "var(--series-other)",
];

export function categoryColor(category: string, categories: string[]): string {
  const index = categories.indexOf(category);
  return CATEGORY_COLOR_VARS[(index >= 0 ? index : 0) % CATEGORY_COLOR_VARS.length];
}
