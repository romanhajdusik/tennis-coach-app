# Zásady ochrany osobných údajov — organizácia (`plaw.online`)

> **Stav: NÁVRH NA SCHVÁLENIE, 2026-08-29.** Pre zväzy, kluby a akadémie.
> **Anglické znenie je ZÁVÄZNÉ**, slovenské je preklad — preto je angličtina prvá.
>
> **Číta to iný človek než trénerské zásady.** Trénerovi vysvetľujeme, ako to
> funguje; zväzu dokazujeme, že sme preverateľný dodávateľ. Preto je tón vecnejší
> a preto sú tu veci, ktoré inde nie sú — kto vlastní dáta, čo sa stane pri
> odchode trénera a že šéftréner vidí prácu svojich ľudí.
>
> **Zmluvná časť sem NEPATRÍ.** Sprostredkovateľská zmluva podľa čl. 28 je
> samostatný dokument (zatiaľ nenapísaný) — tieto zásady sú informácia, nie zmluva.
>
> **Nezverejňuje sa** posledná časť „Poznámky k návrhu".

---
---

# ENGLISH (BINDING VERSION)

## Privacy Policy — for federations, clubs and academies

### 1. Who we are

The P.L.A.W application is operated by **[P.L.A.W s.r.o., company ID, registered
office, commercial register entry]**. You can write to us at
**[support@plawsports.com]**.

We have not appointed a Data Protection Officer — at our current size the law does
not require one. We will reassess this as the number of organisations grows.

### 2. The roles: your organisation is the controller, we are the processor

**The training data of your players belongs to your organisation.** You decide
which players are entered, what is recorded about them, who has access to them and
how long the records are kept. We only store and display that data on your
instructions.

**This means we do nothing of our own with it:** no statistics outside your
organisation, no model training, no benchmarking against other organisations, no
sale, no advertising. Any such use would require a separate agreement with you.

**We are the controller only for the accounts** of your director and coaches —
their email address, name and password, so that they can sign in. That part is
described in section 4.

The contractual detail of this arrangement — instructions, subprocessors, audits,
breach notification, return and deletion of data at the end of the service — is set
out in a separate **data processing agreement**.

### 3. What we process on your behalf

| Category | What it is |
|---|---|
| Players | name, year of birth, active status |
| Training | dates, times, status, focus areas, drills, duration, coach's notes |
| Tests and measurements | results and notes, where your coaches record them |
| Organisational structure | membership, roles, discipline, assignment of players to coaches, invitations, seats |
| Drill codes | your organisation's standardised codes |

**We do not process** payment data of your members (seats are invoiced outside the
application) and the application does not offer a parent or player access layer in
organisation mode — that is a feature of the standalone product.

### 4. What we process about your director and coaches

Email address, name, password (stored only as an unreadable hash), role, discipline
and the status of their membership. Additionally, on each visit, an IP address,
browser type and the time of the request — for operation and abuse detection.

**Legal basis:** performance of our contract with your organisation, and our
legitimate interest in secure operation.

### 5. Two things your organisation should be aware of

**Your head coach sees the work of your coaches.** The director's overview shows
the training records of all players of the organisation, including which coach they
are assigned to. That is what the oversight function is for — but it means your
coaches are visible to their employer through our application, and **it is your
organisation, not us, that has to tell them so.** We recommend covering it in the
employment or cooperation documentation.

**The data does not leave with a departing coach.** When a coach's membership ends,
the players and their history stay with the organisation and can be reassigned to
another coach. It is a deliberate design decision and the strongest reason why
organisation mode exists — but it also means the departing coach loses access to
work they created.

### 6. Where the data is stored

**The database is in Frankfurt, Germany — inside the European Union.** The same
applies to backups and to the servers the application runs on.

These providers help us, each with access only to what they need:

- **Supabase** — database and sign-in (Frankfurt, EU)
- **Vercel** — running the application (Frankfurt, EU)
- **Resend** — sending registration and password-reset emails

Vercel and Resend are US companies, so part of the processing may take place
outside the EU; we have in place with them the standard contractual clauses
designated by the European Union for that purpose. **We will inform you in advance
of any change to this list**, as set out in the data processing agreement.

### 7. How long the data is kept

**Your organisation decides.** The retention periods for player data are agreed in
the contract; **our default is 2 years from the end of the player's membership**
unless you instruct otherwise.

The retention rules that apply to independent coaches — an individual practice for
4 years and a player's records for a year after their last practice — **do not
apply to organisations.** Your documentation covers a whole youth base and its
period is your decision, not ours.

Accounts of your coaches are kept while their membership lasts; afterwards the
account remains theirs as a personal account without access to your data.

**At the end of the service we will, at your choice, return the data to you or
delete it.**

### 8. Security

- Row-level security on every table; access is enforced by the database, not by
  the user interface.
- **Separation between organisations** and between coaches within an organisation:
  a coach sees only the players assigned to them, the director has read-only access
  across the organisation.
- Completed practices and archived players are read-only at database level.
- Passwords are never stored in a readable form; the application holds no
  administrative database key.
- HTTPS with HSTS, security headers, protection against clickjacking.
- The access model has been audited twice against the live database, with every
  finding verified by an actual attack attempt rather than by inspection. We are
  glad to walk your technical staff through the details.

### 9. Rights

**Your director and coaches** may ask us for access to their account data, its
correction, deletion, restriction, portability, or object to processing based on
legitimate interest. Write to **[support@plawsports.com]**; we respond within one
month, free of charge.

**Players and their parents** exercise their rights **towards your organisation**,
which is the controller. We will assist you in handling such requests, including
where the application does not allow it directly — for example correcting an
already closed practice.

Complaints can be addressed to the **Office for Personal Data Protection of the
Slovak Republic, Hraničná 12, 820 07 Bratislava**.

### 10. Cookies

The application uses **only strictly necessary cookies**: sign-in, the selected
player, the time zone and the language of the public site.

**We have no analytics and no advertising or tracking scripts.** That is why we do
not ask for cookie consent and show no cookie banner.

### 11. Changes to this policy

If anything material changes — a new subprocessor, a change of location, a change
of retention periods — we will inform you in advance by email, in line with the
data processing agreement.

**This policy is effective from [date].**

---
---

# SLOVENSKY (PREKLAD)

## Zásady ochrany osobných údajov — pre zväzy, kluby a akadémie

### 1. Kto sme

Aplikáciu P.L.A.W prevádzkuje **[P.L.A.W s.r.o., IČO, sídlo, zapísaná v OR]**.
Napísať nám môžete na **[support@plawsports.com]**.

Nemáme určenú zodpovednú osobu (DPO) — pri našom dnešnom rozsahu ju zákon
nevyžaduje. S rastúcim počtom organizácií to prehodnotíme.

### 2. Roly: prevádzkovateľom je vaša organizácia, my sme sprostredkovateľ

**Tréningové dáta vašich hráčov patria vašej organizácii.** Vy rozhodujete, ktorí
hráči sa zapíšu, čo sa o nich zaznamená, kto k nim má prístup a ako dlho sa
záznamy uchovávajú. My ich len uchovávame a zobrazujeme podľa vašich pokynov.

**Znamená to, že s nimi nerobíme nič vlastné:** žiadne štatistiky mimo vašej
organizácie, žiadne trénovanie modelov, žiadne porovnávanie s inými
organizáciami, žiadny predaj, žiadna reklama. Akékoľvek takéto použitie by
vyžadovalo samostatnú dohodu s vami.

**Prevádzkovateľom sme len pri účtoch** vášho šéftrénera a trénerov — pri ich
e-maile, mene a hesle, aby sa vedeli prihlásiť. Tú časť opisuje §4.

Zmluvné podrobnosti — pokyny, ďalší sprostredkovatelia, audity, hlásenie
incidentov, vrátenie a zmazanie údajov po skončení služby — sú v samostatnej
**zmluve o spracúvaní osobných údajov**.

### 3. Čo spracúvame vo vašom mene

| Kategória | Čo to je |
|---|---|
| Hráči | meno, rok narodenia, či sú aktívni |
| Tréningy | dátumy, časy, stav, zamerania, cvičenia, trvanie, poznámky trénera |
| Testy a merania | výsledky a poznámky, ak ich vaši tréneri zaznamenávajú |
| Organizačná štruktúra | členstvo, role, disciplína, priradenie hráčov trénerom, pozvánky, sedadlá |
| Kódy cvičení | štandardizované kódy vašej organizácie |

**Nespracúvame** platobné údaje vašich členov (sedadlá sa fakturujú mimo
aplikácie) a v organizačnom režime aplikácia **neponúka rodičovskú ani hráčsku
vrstvu prístupu** — to je funkcia samostatného produktu.

### 4. Čo spracúvame o vašom šéftrénerovi a tréneroch

E-mailovú adresu, meno, heslo (uložené výhradne v podobe nečitateľného odtlačku),
rolu, disciplínu a stav členstva. Navyše pri každej návšteve IP adresu, typ
prehliadača a čas požiadavky — na prevádzku a odhalenie zneužitia.

**Právny základ:** plnenie našej zmluvy s vašou organizáciou a náš oprávnený
záujem na bezpečnej prevádzke.

### 5. Dve veci, o ktorých má vaša organizácia vedieť

**Šéftréner vidí prácu vašich trénerov.** Riadiaci pult zobrazuje tréningové
záznamy všetkých hráčov organizácie vrátane toho, ktorému trénerovi sú pridelení.
Presne na to funkcia dohľadu je — ale znamená to, že vaši tréneri sú cez našu
aplikáciu viditeľní pre svojho zamestnávateľa, a **povedať im to musí vaša
organizácia, nie my.** Odporúčame to pokryť v pracovnej alebo spolupracovnej
dokumentácii.

**Dáta neodchádzajú s odchádzajúcim trénerom.** Keď členstvo trénera skončí, hráči
aj ich história ostávajú organizácii a dajú sa prideliť inému trénerovi. Je to
vedomé rozhodnutie a najsilnejší dôvod, prečo organizačný režim existuje — ale
zároveň to znamená, že odchádzajúci tréner stráca prístup k práci, ktorú vytvoril.

### 6. Kde sú údaje uložené

**Databáza je vo Frankfurte v Nemecku, teda v Európskej únii.** To isté platí pre
zálohy aj pre servery, na ktorých aplikácia beží.

Pomáhajú nám títo poskytovatelia a každý má prístup len k tomu, čo potrebuje:

- **Supabase** — databáza a prihlasovanie (Frankfurt, EÚ)
- **Vercel** — prevádzka aplikácie (Frankfurt, EÚ)
- **Resend** — odosielanie e-mailov o registrácii a obnove hesla

Vercel aj Resend sú americké spoločnosti, takže časť spracúvania môže prebehnúť
mimo EÚ; máme s nimi uzavreté štandardné zmluvné doložky, ktoré na to Európska
únia určila. **O každej zmene tohto zoznamu vás budeme informovať vopred**, ako
je dohodnuté v zmluve o spracúvaní.

### 7. Ako dlho sa údaje uchovávajú

**Rozhoduje vaša organizácia.** Lehoty pre údaje hráčov sa dojednávajú v zmluve;
**naša predvolená hodnota sú 2 roky od skončenia členstva hráča**, ak neurčíte inak.

Lehoty, ktoré platia pre samostatných trénerov — jednotlivý tréning 4 roky
a záznamy hráča rok od posledného tréningu — **sa na organizácie nevzťahujú.**
Vaša dokumentácia pokrýva celú mládežnícku základňu a jej lehota je vaše
rozhodnutie, nie naše.

Účty vašich trénerov trvajú počas členstva; potom im účet ostáva ako osobný, bez
prístupu k vašim údajom.

**Po skončení služby vám údaje podľa vašej voľby vrátime alebo zmažeme.**

### 8. Bezpečnosť

- Riadenie prístupu na úrovni riadkov v každej tabuľke; hranicou je databáza,
  nie používateľské rozhranie.
- **Oddelenie medzi organizáciami** aj medzi trénermi v rámci organizácie: tréner
  vidí len jemu pridelených hráčov, šéftréner má prístup len na čítanie naprieč
  organizáciou.
- Dokončené tréningy a archivovaní hráči sú nemenné na úrovni databázy.
- Heslá sa nikdy neuchovávajú v čitateľnej podobe; aplikácia nedrží žiadny
  administrátorský kľúč k databáze.
- HTTPS s HSTS, bezpečnostné hlavičky, ochrana proti vloženiu do cudzieho rámca.
- Model prístupu prešiel **dvomi auditmi proti živej databáze**, pričom každý nález
  sa overoval skutočným pokusom o útok, nie čítaním kódu. Vašim technickým ľuďom
  to radi prejdeme podrobne.

### 9. Práva

**Váš šéftréner a tréneri** môžu od nás žiadať prístup k údajom o svojom účte,
ich opravu, zmazanie, obmedzenie, prenos alebo namietať proti spracúvaniu
založenému na oprávnenom záujme. Stačí napísať na **[support@plawsports.com]**;
odpovedáme do jedného mesiaca a je to zadarmo.

**Hráči a ich rodičia** uplatňujú svoje práva **voči vašej organizácii**, ktorá je
prevádzkovateľom. My vám s vybavením pomôžeme vrátane prípadov, keď to aplikácia
priamo neumožňuje — napríklad pri oprave už uzavretého tréningu.

So sťažnosťou sa možno obrátiť na **Úrad na ochranu osobných údajov Slovenskej
republiky, Hraničná 12, 820 07 Bratislava**.

### 10. Cookies

Aplikácia používa **len technicky nevyhnutné cookies**: prihlásenie, vybraný hráč,
časové pásmo a jazyk verejného webu.

**Nemáme žiadnu analytiku ani reklamné a sledovacie skripty.** Preto nepýtame
súhlas s cookies a nezobrazujeme lištu.

### 11. Zmeny týchto zásad

Ak sa niečo podstatné zmení — pribudne ďalší sprostredkovateľ, zmení sa umiestnenie
údajov alebo lehoty — budeme vás informovať vopred e-mailom, v súlade so zmluvou
o spracúvaní.

**Tieto zásady platia od [dátum].**

---
---

## Poznámky k návrhu (nezverejňuje sa)

### Čo je tu inak než v trénerských zásadách — a prečo

1. **Tón je vecnejší.** Trénerovi vysvetľujeme, zväzu dokazujeme. Číta to človek,
   ktorý má za úlohu nájsť dôvod, prečo dodávateľa neschváliť.
2. **§5 je celý navyše a je to najdôležitejšia časť dokumentu.**
   - **Šéftréner vidí prácu trénerov** — je to sledovanie zamestnanca cez náš
     nástroj. **Informačnú povinnosť má zamestnávateľ, nie my**, ale keby sme na
     to zväz neupozornili, prvý spor s trénerom by sa vrátil k nám. Táto veta nás
     nestojí nič a zväz pred niečím chráni.
   - **Dáta neodchádzajú s trénerom** — najsilnejší predajný argument B2B vrstvy,
     ale povedaný aj z druhej strany: odchádzajúci tréner stráca prístup k svojej
     práci. **Nezamlčať to** — zväz sa na to spýta a lepšie je odpovedať skôr.
3. **§7 výslovne hovorí, že trénerské lehoty (4 roky / rok) sa na organizácie
   nevzťahujú.** Bez tejto vety by si to niekto spojil a čakal, že mu appka po
   roku zmaže hráčov zväzu.
4. **§8 je podrobnejší než pri trénerovi** a spomína oba audity. Je to jediné
   miesto v celej dokumentácii, kde je bezpečnosť predajným argumentom, nie
   povinnosťou — a máme čím doložiť.

### Čo treba doplniť alebo rozhodnúť

5. **Údaje s.r.o.** (§1) — firma sa zakladá.
6. ~~Predvolená lehota 3 roky.~~ **POTVRDENÉ 2026-08-29: 2 roky od skončenia
   členstva hráča** (user znížil môj návrh z troch).
   - **Krátka predvolená hodnota je pre nás bezpečnejšia než dlhá.** Zväz, ktorý
     potrebuje viac, si to vypýta v zmluve a **prevezme za to číslo zodpovednosť
     on**. Naopak to nefunguje: dlhá predvolená hodnota znamená, že údaje o deťoch
     držíme dlho aj u zákazníka, ktorý o tom nikdy nepremýšľal — a nastavili sme
     to my.
   - Hodnota ide do **každej zmluvy so zväzom ako východisková**, takže sa mení
     dodatkom, nie úpravou dokumentu. Preto sa rozhodovala pred prvým podpisom.
7. **§2 a §11 odkazujú na zmluvu o spracúvaní, ktorá zatiaľ neexistuje** (bod 5
   textového zoznamu). Zásady sa nedajú zverejniť skôr než ona — odkazovali by
   na nič.
8. **§7 sľubuje vrátenie alebo zmazanie po skončení služby** a §9 pomoc pri
   vybavovaní žiadostí. Oboje je dnes ručná práca; pri jednom-dvoch zväzoch to
   stačí, pri desiatich už nie.
9. **Overiť adresu úradu** pred zverejnením.
10. **Dátum účinnosti** (§11).
