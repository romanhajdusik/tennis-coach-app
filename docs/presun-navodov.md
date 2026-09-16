# Presun návodov do appky (plán, 2026-09-16)

Päť podrobných návodov a hárok s kódmi cvičení dnes žijú ako **publikované
stránky mimo repa** (Claude artefakty). Fungujú, ale zdieľajú sa po jednom
a ich text nie je v repe. Tento dokument hovorí, ako ich dostať na verejný web
appky — a **prečo s tým zatiaľ netreba ponáhľať**.

> **Kedy do toho ísť:** až keď sa text ustáli. Kým sa návody ladia podľa
> prvých trénerov a prvého zväzu, je úprava artefaktu desať sekúnd, kým úprava
> stránky je commit, build a deploy. Presúvať skôr znamená prepisovať tú istú
> vetu na dvoch miestach.

---

## 1. Čo sa presúva a kam

| Návod | Adresa | Hostiteľ | Stav |
|---|---|---|---|
| Privátny tréner | `/navod` | `plaw.win` | **nahradí** dnešný krátky |
| Sledujúci (hráč/rodič/manažér) | `/navod-hrac` | `plaw.click` | **nahradí** dnešný krátky |
| Šéftréner federácie | `/navod-federacia` | `plaw.online` | nová |
| Federačný tréner | `/navod-federacny-trener` | `plaw.online` | nová |
| Kondičný tréner | `/navod-kondicka` | `plaw.online` | nová |
| Tenisové kódy (hárok) | `/kody` | `plaw.win` | nová |

**Každá nová cesta potrebuje dva zápisy v `proxy.ts`:** riadok v
`CANONICAL_ORIGINS` (aby mala práve jednu adresu) a zápis do zoznamu povolených
ciest svojho hostiteľa (`PUBLIC_PATHS`, resp. `PARENT_FACE_PATHS`). Bez prvého
odpovie na troch doménach naraz, bez druhého sa na svojej vlastnej nevykreslí.

**Prečo kondička na `plaw.online`:** nasadenie `fitness.plawsports.com` nemá
verejnú tvár vôbec — odhlásený návštevník ide rovno na prihlásenie. Kým kondička
nedostane vlastný marketing, je neutrálna verejná tvár jediné rozumné miesto.
Keď ten marketing raz vznikne, návod sa presunie za ním.

---

## 2. Tri rozhodnutia, ktoré treba spraviť pred písaním kódu

### 2.1 Text ide priamo do TSX, nie do `messages/`

Dnešné návody majú text v `messages/en/navod.json` a stránka číta kľúče. Pri
deviatich jazykoch to bolo nutné; **od 2026-09-14 je web jednojazyčný**, takže
jediný dôvod pre tú vrstvu zanikol. Rozsekať podrobný návod na ~60 kľúčov
sťažuje písanie aj čítanie a pri revízii textu sa nedá prečítať súvisle.

**Odporúčanie: text priamo v komponente.** Loadery v `lib/landing-locale.ts`
ostávajú pre existujúce stránky; nové ich nepotrebujú.

### 2.2 Písmo: Archivo cez `next/font`, telo Geist

Artefakty stoja na Archivo (nadpisy) + IBM Plex (text a mono), appka na Geiste
(`next/font/google`, teda **stiahnuté pri builde — za behu nejde žiadna
požiadavka na Google**, čo je aj GDPR výhoda).

**Odporúčanie:** pridať **Archivo cez `next/font`** pre nadpisy, telo nechať na
Geiste, mono na Geist Mono. Charakter nadpisov ostane, pravidlo „nič sa za behu
neťahá zvonka" tiež. **Neprenášať `<link>` na Google CDN z artefaktov** — v
appke by to bola prvá vonkajšia požiadavka na stránku.

### 2.3 Každý návod si drží svoj akcent

Federačné návody sú svetlomodré, kondičný tyrkysový — ale na `plaw.online` beží
appka v antukovej. Farba tu nesie informáciu: hovorí, o ktorej z troch appiek
návod je (antuka = tenis, svetlomodrá = federácia, tyrkys = kondička).

**Odporúčanie:** akcent nastaviť lokálnou premennou na koreni stránky. Je to
dokumentácia, nie appka, takže `data-app` sa tým neporušuje.

---

## 3. Fázy

### Fáza 1 — podvozok (jadro roboty)

Spoločné komponenty v `components/guide/`:

- `GuideMasthead` (eyebrow, nadpis, lede, mriežka faktov),
- `GuideToc` (prilepený obsah od 1000 px, inak obyčajný blok),
- `GuidePart` + `GuideStep` (číslovaný krok s hlavičkou a telom),
- `GuideNote` so štyrmi druhmi (neutrálna, `why`, `watch`, `stop`),
- `GuideCards`, `GuideTable`, `GuideFooter`.

Po tejto fáze je každý ďalší návod **len obsah**.

**Pozor na dve veci z CLAUDE.md:** mobile-first (úzka šírka musí ostať
použiteľná a bez horizontálneho scrollu) a to, že každý stránkový root div
potrebuje popri `max-w-*` aj `w-full min-w-0`.

### Fáza 2 — dve náhrady

`/navod` a `/navod-hrac` prepísať na nový podvozok, **zmazať staré kľúče**
z `messages/en/{navod,navod-hrac}.json` a skontrolovať dve tlačidlá v hero na
landingu, ktoré na návody odkazujú.

### Fáza 3 — tri nové stránky

Šéftréner, federačný tréner, kondičný tréner + zápisy do `proxy.ts` (§1)
+ odkazy z rozcestníka a z `/federacie`, aby na ne niečo viedlo.

### Fáza 4 — hárok s kódmi sa generuje sám

V appke netreba generátor: server component si zavolá `getDisciplineConfig()`
a vykreslí sloty priamo z konfigurácie disciplíny. **Stránka sa potom nemôže
rozísť s produktom ani teoreticky** — a tá istá stránka obslúži aj kondičku
(desať zameraní, dvadsať prázdnych slotov) bez písania druhej.

Slovník významov skratiek (dnes v generátore v scratchpade) treba preniesť —
patrí k stránke, nie ku konfigurácii: sú to trénerské konvencie, ktoré appka
nikde nečíta.

### Fáza 5 — overenie

- `scripts/dev-tests/public-web.js`: každá nová cesta odpovedá **200 na svojom
  hostiteľovi a 307 inde**;
- `npm run build`;
- kontrola, že nové stránky sú `noindex` ako zvyšok webu.

---

## 4. Čo tým získame a čo stratíme

**Získame:** žiadne zdieľanie po jednom, jedna adresa na návod, aktualizácia
deployom, text v repe s históriou a s review. Odkazy medzi návodmi prestanú
závisieť od toho, či adresát vidí aj cieľovú stránku.

**Stratíme:** rýchlosť. Dnešná úprava je prepublikovanie za desať sekúnd.

---

## 5. Odkazy na dnešné verzie

Kým sa presun nespraví, platné sú tieto stránky:

| Návod | Adresa |
|---|---|
| Privátny tréner | https://claude.ai/code/artifact/b8d1ace0-4179-45b3-9cce-dd6d44436def |
| Sledujúci | https://claude.ai/code/artifact/6c47fe3f-fba5-4fed-b971-619c540dcf41 |
| Šéftréner | https://claude.ai/code/artifact/4b672628-db65-4f10-af3a-f16636003ce1 |
| Federačný tréner | https://claude.ai/code/artifact/ce7de1dd-db8b-43ab-9c88-bf0af770b453 |
| Kondičný tréner | https://claude.ai/code/artifact/3573dd54-6b38-4133-a4af-89f0077d79c6 |
| Tenisové kódy | https://claude.ai/code/artifact/7bad8a66-8487-409b-bc09-b21dd2cfe25b |

**Sú súkromné** — adresát ich vidí, až keď ich vlastník zdieľa. Návod pre
privátneho trénera aj pre šéftrénera odkazujú na hárok s kódmi, takže tie dve
sa zdieľajú vždy spolu.
