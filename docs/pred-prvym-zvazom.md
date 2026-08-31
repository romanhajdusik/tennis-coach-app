# Pred prvým zväzom — kontrolný zoznam

Čo musí byť hotové, **než sa podpíše zmluva s prvou organizáciou a než sa jej
založí prístup**. Zoznam vznikol 2026-08-30 po dopísaní zmluvy podľa čl. 28
a postupu pri incidente; dovtedy boli tie isté body roztrúsené v poznámkach
troch dokumentov.

**Písanie je hotové.** Všetko nižšie je overovanie, doplnenie čísel a nastavenie
účtov — žiadny bod nie je „napísať text".

Dnes nič nehorí: v org režime je len **testovací tím s vymyslenými menami**.
Zoznam začne platiť dňom, keď sa objaví prvý skutočný zväz.

---

## Na kritickej ceste — bez toho sa nepodpisuje

- [ ] **Zapísaná s.r.o.**
  Kým firma neexistuje, prevádzkovateľom aj sprostredkovateľom je **fyzická
  osoba, ktorá ručí celým majetkom** — a appka pritom beží naostro so
  skutočnými deťmi. Po zápise sa vypĺňajú hranaté zátvorky v hlavičke
  [zmluvy](gdpr-zmluva-cl28.md), v §1 všetkých troch zásad a v oboch
  podmienkach.

- [ ] **Zástupca** — druhý človek s prístupom do produkcie a s **podpísanou
  mlčanlivosťou** (§4 zmluvy, príloha C).
  Zmluva dáva **48 hodín** na oznámenie incidentu od jeho zistenia. Jeden človek
  túto lehotu pri chorobe, dovolenke alebo vypnutom telefóne **nesplní** —
  vyplynulo to z [postupu pri incidente](postup-pri-incidente.md) §9.

- [x] ~~**Hodinová sadzba k §7.3**~~ — **HOTOVÉ 2026-08-30:** vznikla hlavná
  zmluva ([zmluva-organizacia.md](zmluva-organizacia.md)) a sadzba **129 EUR bez
  DPH za hodinu** je v jej prílohe 2. Tá istá zmluva dala obsah šiestim odkazom
  zmluvy podľa čl. 28, ktoré dovtedy viedli do prázdna.

- [ ] **Schváliť hlavnú zmluvu** — je to zatiaľ **návrh** a podpisuje sa spolu so
  zmluvou o spracúvaní. Bez nej by zväz podpísal ochranu údajov k neexistujúcej
  zmluve o službe: bez dohodnutej ceny, sedadiel, výpovede a stropu
  zodpovednosti, o ktorý sa §11.4 opiera.

- [x] ~~**Cena za sedadlo**~~ — **ROZHODNUTÉ 2026-08-30:** 49 EUR mesačne bez
  DPH za sedadlo, najmenej tri, pri ročnej platbe vopred zľava **15 % (3–5
  sedadiel) / 20 % (6–11) / 30 % (12 a viac)**. Fakturácia mesačne alebo ročne,
  **viazanosť je v oboch prípadoch 12 mesiacov**. Všetko v §3 hlavnej zmluvy.

- [x] ~~**Rozhodnúť, či cena ide na `/federacie`**~~ — **ROZHODNUTÉ 2026-08-31:
  ide, ale len vstupná cena.** Stránka ukazuje „od 49 € za trénera na mesiac,
  najmenej traja, bez DPH, ročne až −30 %". Tabuľka pásiem sa nezverejňuje
  a pásmo na dohodu pre veľkých tam nebude. Prehodnotilo sa to preto, že stránka
  je odteraz **po anglicky a mieri von** — a pôvodné „čoskoro" znelo pri produkte
  pre organizácie ako „ešte nevieme, čo robíme".

- [ ] **Cyklus záloh do §9.5** — zistiť u Supabase, akú retenciu má produkčný
  projekt na svojom pláne, a nahradiť `[X]` skutočným číslom.
  Zmluva bez neho tvrdí, že dáta zo záloh vypadnú „najneskôr do [X] dní".
  **Vymyslieť sa to nedá.**

- [ ] **Počet osôb s prístupom do prílohy C** — dnes `[počet]`.
  Vyrieši sa samo pri zástupcovi, ale nesmie sa naň zabudnúť.

---

## Prevádzka — spraviť pred podpisom, netreba naň čakať

- [ ] **Vercel Hobby → Pro** na oboch projektoch (`tennis-coach-app`
  aj `plaw-fitness`, tím `romi`).
  Hobby je podľa podmienok Vercelu na **nekomerčné použitie** a služba sa už
  speňažuje. Riziko je dvojaké: pozastavenie účtu a s ním výpadok dostupnosti,
  ktorá je **súčasťou bezpečnosti podľa čl. 32**. Je to otvorené riziko
  zapísané v [zázname](gdpr-zaznam-cinnosti.md) časti E.

- [ ] **Odkliknúť a overiť zmluvy o spracúvaní u poddodávateľov** — **Supabase**
  a **Resend** (v zázname, časť D, majú pri „DPA odklikané?" stále *doplniť*).
  Na týchto zmluvách stojí celé opieranie sa o štandardné zmluvné doložky
  v prílohe B. **Je to pol hodiny v dvoch dashboardoch** a je to prvá vec, na
  ktorú sa spýta právnik zväzu. Vercel má DPA súčasťou obchodných podmienok.

- [ ] **Overiť zálohy a raz vyskúšať obnovu.**
  Súvisí s bodom o §9.5, ale nie je to to isté: retencia je číslo do zmluvy,
  obnova je otázka, či dáta naozaj vieme dostať späť. **Strata dát bez
  použiteľnej zálohy je incident** rovnako ako únik.

- [ ] **Overiť adresu Úradu** na jeho stránke.
  Dnes je vo všetkých zásadách aj v postupe pri incidente uvedená „Hraničná 12,
  820 07 Bratislava" — prevzaté, **neoverené**. Adresy úradov sa menia.

- [ ] **Dátum účinnosti** do zásad pre organizáciu (§11) a do ostatných textov.

---

## Pri samotnom podpise a onboardingu

- [ ] **Obe zmluvy podpísané SKÔR, než sa organizácia založí** — hlavná zmluva
  ([zmluva-organizacia.md](zmluva-organizacia.md)) aj zmluva o spracúvaní
  ([gdpr-zmluva-cl28.md](gdpr-zmluva-cl28.md)). Je to Krok 0
  v [onboardingu](onboarding-organizacie.md) a §1.2 zmluvy o spracúvaní. Bez
  podpisu spracúvajú **obe strany bez právneho podkladu**.

- [ ] **Kontakt na oznámenie incidentu** od organizácie do prílohy A — meno,
  funkcia, e-mail, telefón. Bez neho nie je kam poslať 48-hodinové oznámenie.

- [ ] **Predvolená lehota 2 roky** od skončenia členstva hráča — potvrdiť so
  zväzom, alebo dohodnúť inú. Ide do prílohy A a mení sa **dodatkom**, nie
  úpravou dokumentu.

- [ ] **Priložiť zásady pre organizáciu** k zmluve ako dokument.
  Zverejnenie na webe je zatiaľ odložené (právne stránky v appke neexistujú),
  ale **pre B2B zákazníka to nevadí** — dostane text ako prílohu. Verejné
  stránky sú potrebné pre trénerov a rodičov, nie pre zväz.

---

## Nie je podmienkou podpisu, ale nesmie sa stratiť

- [ ] **Export dát a zmazanie účtu v appke.**
  Zmluva (§7.2, §9.2) aj zásady ich sľubujú ako funkciu; dnes ich robí podpora
  ručne. Pri jednom-dvoch zväzoch to stačí, pri desiatich nie. **S nimi sa
  vráti aj stránka `/settings`**, ktorá po odstránení Google Kalendára zanikla.

- [ ] **Mazacia úloha pre lehoty sledujúceho.**
  Prvý záznam vypadne z okna okolo **januára 2027** (najstaršie dáta sú z júla
  2026). Bude to prvé automatické mazanie v celej appke — maže sa výhradne
  `parent_session_records` a `parent_session_drill_records`, **nikdy zdroj
  u trénera**.

- [ ] **Záznam o čítaní (logovanie).**
  Appka dnes nevie povedať, kto ktorý riadok videl, takže **rozsah incidentu sa
  odhaduje, nemeria**. Stačilo by začať pri `security definer` funkciách.

- [ ] **Právne stránky na webe** — odkazy v štyroch pätičkách, potvrdenie
  dokumentov pri registrácii a tri vety v prepojení rodiča čakajú na to, kým
  budú mať texty na webe adresu. Rozhodnuté 2026-08-30 odložiť.
