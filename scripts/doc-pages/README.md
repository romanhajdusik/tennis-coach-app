# Čitateľské stránky zmlúv a podmienok

Štyri dokumenty z `docs/` idú von — dvom zmluvám ich podpisuje zväz, dvoje
podmienok si odklikáva tréner a sledujúci. V markdowne sa čítajú zle a posielať
niekomu `.md` súbor s internými poznámkami na konci nejde vôbec. Tento skript
z nich preto postaví jednu HTML stránku na dokument a tá sa publikuje ako
Artifact.

```bash
node scripts/doc-pages/build.js                    # všetky štyri
node scripts/doc-pages/build.js podmienky-trener   # jeden
```

Výstup ide do `build/` (gitignorované) a odtiaľ sa publikuje.

## Čo stránka robí

- **Obe znenia v jednej stránke**, prepínač vpravo hore. Angličtina je označená
  ako **záväzná** a slovenčina ako **preklad**, lebo tak to hovoria samotné
  dokumenty a pri čítaní sa na to ľahko zabudne.
- **Odkaz priamo na angličtinu:** `…/artifact/<id>#english`, prípadne rovno na
  paragraf (`#en-s5`). Slovenčina je predvolená.
- **Obsah je preklikateľný**, kotvy sa odvodzujú z čísla paragrafu, takže sa
  s textom nerozídu.
- **Nevyplnené hranaté zátvorky sú farebne vyznačené.** Je to informácia, nie
  ozdoba: na prvý pohľad vidno, čo sa dopĺňa až pri konkrétnom podpise (údaje
  organizácie, sedadlá, sumy, dátumy).
- Tlač je pripravená — v `@media print` sa stránka prepne na bielu.

## Pravidlo, ktoré sa nesmie porušiť

**Časť „Poznámky k návrhu (nezverejňuje sa)" sa do stránky nikdy nedostane.**
Sú v nej interné úvahy, prečo je dokument napísaný práve takto, a odkaz na
stránku sa posiela von. Skript sa na tom nadpise zastaví a **keď ho nenájde,
skončí chybou** namiesto toho, aby ticho zverejnil všetko — preto ten nadpis
nepremenúvaj bez úpravy `build.js`.

## Vzhľad

Berie sa z `page.css` a je to zámerne tá istá antuková tmavá paleta ako
v `app/globals.css` (`#1e1e21`, `#27262b`, `#a24236`). Písmo je Spectral na text
a IBM Plex Sans na čísla paragrafov a tabuľky.

## Publikované stránky

Sú **súkromné**, kým sa nezdieľajú. Pri úprave dokumentu prestav stránku a
publikuj na **tú istú adresu**, inak vznikne druhá:

| Dokument | Stránka |
|---|---|
| `zmluva-organizacia.md` | https://claude.ai/code/artifact/4d064696-6865-4714-af3c-8ba341011683 |
| `gdpr-zmluva-cl28.md` | https://claude.ai/code/artifact/d6a167e4-87f5-4236-a91a-83e96ac35004 |
| `podmienky-trener.md` | https://claude.ai/code/artifact/30d9c5a1-227e-4909-b919-9688915427ec |
| `podmienky-sledujuci.md` | https://claude.ai/code/artifact/2e6f7e60-6f8c-4bba-92b3-f881f0615266 |

Text hlavičky každej stránky (nadpis, štítok stavu, úvodný odsek, pätička) je
v `pages.json` — **nie je v dokumentoch**, takže po zmene stavu dokumentu treba
upraviť aj štítok. Dnes je to najmä `podmienky-trener`, ktoré majú
„Angličtina neschválená".
