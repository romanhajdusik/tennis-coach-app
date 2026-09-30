/**
 * Či sa verejný web smie dostať do vyhľadávačov.
 *
 * DO SPUSTENIA JE CELÝ WEB `noindex` — appka bola rozostavaná a návštevník
 * z Googlu by prišiel na stránku, kde sa nevie ani zaregistrovať, ani zaplatiť.
 * Indexovanie je preto ZÁMERNE POSLEDNÝ krok spustenia.
 *
 * Bolo to rozsypané na 17 miestach v 13 súboroch, čo je v deň spustenia
 * priveľa na ručné prepínanie — stačí jedno prehliadnuté a stránka ostane
 * mimo vyhľadávania, čo si nikto nevšimne mesiace. Odteraz je to JEDEN
 * prepínač: premenná `PLAW_INDEXING` na Verceli.
 *
 * **Chýbajúca hodnota znamená `noindex`** — rovnaký princíp ako pri
 * disciplíne: keď premennú niekto zabudne, web sa nezaindexuje predčasne.
 *
 * TOTO SA NETÝKA APPKY. Tri miesta si `noindex` nechávajú natrvalo a nesmú
 * túto funkciu použiť: `app/layout.tsx` (predvolené pre všetko za
 * prihlásením), `app/subscribe/page.tsx` a vetva org subdomény v
 * `app/page.tsx` — to je pracovný nástroj federácie, nie marketing.
 */
export function publicRobots() {
  const indexing = process.env.PLAW_INDEXING === "true";
  return { index: indexing, follow: indexing };
}
