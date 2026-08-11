/**
 * Prevedie ISO reťazec z databázy na hodnotu pre `<input type="datetime-local">`.
 *
 * Formátuje sa zámerne v pásme ZARIADENIA, nie diváka: dátumové polia sa podľa
 * pravidla v CLAUDE.md („Časové pásmo") vypĺňajú aj odosielajú v pásme toho,
 * kto práve zapisuje — pred odoslaním sa hodnota prevedie späť na ISO.
 */
export function toLocalInputValue(date: string | undefined | null): string {
  if (!date) return "";
  const value = new Date(date);
  if (Number.isNaN(value.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(
    value.getDate(),
  )}T${pad(value.getHours())}:${pad(value.getMinutes())}`;
}
