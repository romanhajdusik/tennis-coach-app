/**
 * Tvar konfigurácie disciplíny. Disciplína je to, ČO sa na tréningu zapisuje
 * (tenis = údery a ich charakter, kondička = zamerania bez charakteru) — nie
 * šport. Kondička je jedna spoločná disciplína naprieč všetkými raketovými
 * športmi, tenis/padel/bedminton sú tri nasadenia tej istej tenisovej logiky.
 *
 * Zlaté pravidlo (docs/roadmap-buduce-smery.md §1): disciplínovo špecifické =
 * konfigurácia, engine = zdieľaný kód. Do tohto súboru teda patria len DÁTA
 * a pravidlá, nikdy nie vetvenie „ak je to kondička".
 */

export type DisciplineId = "tennis" | "fitness";

export type AnalyticsCodeGroup = { label: string; prefix: string };

/**
 * Charakter cvičenia (offensive/neutral/defensive). `null` = disciplína ho
 * nezaznamenáva — je to tenisový slovník, kondičnému trénerovi nehovorí nič.
 */
export type CharacterConfig = {
  options: { value: string; label: string }[];
  labels: Record<string, string>;
  defaultValue: string;
};

/**
 * Odhad počtu úderov. `null` = disciplína ho nepočíta vôbec (kondička nemá
 * čo odhadovať), takže analytika o ňom mlčí namiesto zobrazenia núl.
 */
export type StrokesConfig = {
  /** Podiel času, ktorý sa reálne hrá (zvyšok je prestávka). */
  breakFactor: number;
  /** Sadzba úderov za minútu podľa charakteru cvičenia. */
  perMinByCharacter: Record<string, number>;
  /** Zamerania s vlastnou fixnou sadzbou — prebíjajú charakter. */
  fixedPerMinByCategory: Record<string, number>;
  /** Zamerania, kde je odhad nevýpovedný a skrýva sa (napr. POINTS). */
  hiddenCategories: string[];
};

export type DisciplineConfig = {
  id: DisciplineId;
  /** Zamerania cvičení — poradie určuje aj poradie záložiek a farbu v grafe. */
  categories: string[];
  defaultCategory: string;
  /** Predvolené kódy cvičení na zameranie, kým si tréner sloty nepomenuje. */
  drills: Record<string, string[]>;
  /** Ponuka trvania cvičenia v minútach. */
  durations: number[];
  character: CharacterConfig | null;
  analytics: {
    /** Zamerania s úplným rozpadom kódov + prepínačom koláč/stĺpce. */
    fullBreakdownCategories: string[];
    /** Zamerania s dvojúrovňovým zobrazením podľa prefixu kódu. */
    groupedCategories: Record<string, AnalyticsCodeGroup[]>;
    strokes: StrokesConfig | null;
  };
};
