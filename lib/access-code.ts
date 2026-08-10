import { randomInt } from "node:crypto";

/**
 * Jednorazové kódy, ktoré si ľudia posielajú správou a prepisujú ručne —
 * pozývací kód pre rodiča (`player_connections.connect_code`) aj pre trénera
 * do federácie (`organization_members.invite_code`).
 *
 * **Generuje sa kryptograficky (`node:crypto`), nie cez `Math.random()`.**
 * `Math.random()` nie je nepredvídateľný: je to bežný PRNG, ktorého stav sa
 * dá z dostatočného počtu výstupov odvodiť, a kto ho odvodí, vie predpovedať
 * kódy vygenerované potom. Kód je pritom jediné, čo stojí medzi cudzím
 * človekom a tréningovými dátami dieťaťa, takže na náhodu sa tu spoliehať
 * nedá. `randomInt` navyše nemá modulo bias, ktorý by vznikol pri
 * `randomBytes(1)[0] % dĺžka`.
 *
 * Beží výhradne na serveri (server actions) — `node:crypto` v prehliadači
 * nie je.
 */

/**
 * Bez znakov, ktoré sa pri prepisovaní zamieňajú: `0`/`O`, `1`/`I`/`L`.
 * Zjednotené pre oba druhy kódov — federačná verzia mala navyše `L`, čo bol
 * len nedopatrenie z kopírovania, nie zámer.
 */
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/** Náhodný kód zadanej dĺžky (predvolene 8 znakov ≈ 8,5 × 10¹¹ možností). */
export function generateAccessCode(length = 8): string {
  let code = "";
  for (let index = 0; index < length; index++) {
    code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  }
  return code;
}
