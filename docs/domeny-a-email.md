# Domény a e-mail — rozhodnutie a postup

> **Stav: ROZHODNUTÉ 2026-08-11.** Predtým to bolo otvorené (návrh od externého
> poradcu na ~12 domén + Google Workspace). Tento dokument je záväzný postup —
> keď sa niečo z neho zmení, prepíš ho, nezakladaj druhý.

---

## 1. Rozhodnutie v troch vetách

1. **Primárna doména Google Workspace bude `plawsports.com`** — neutrálna, nie
   tenisová, s koncovkou `.com`. Jedna platená licencia (`roman@plawsports.com`),
   všetky ostatné adresy sú **bezplatné aliasy** do tej istej schránky.
2. **Alias doména je len jedna: `plawtennis.com`** (upresnené 2026-08-12; pôvodne
   mali byť tri). Pošta na ňu padá do tej istej schránky. **`plaw.win` a
   `plaw.online` poštu vedome NEMAJÚ** a parkujú sa rovnako ako športové domény —
   user ju tam nechce a nechať ich v pôvodnom stave nebolo možné (websupportové
   MX tvrdili svetu, že poštu prijímajú, hoci tam schránka nie je, a bez DMARC sa
   dali zneužiť). Zvyšné (padel, pickleball, badminton, pomlčkové, `plaw.click`)
   sú **zaparkované a zabezpečené**, aktivujú sa až keď ten šport reálne pôjde von.
   *Čo sa tým stráca:* kto napíše na `support@plaw.win` — a je to doména, ktorú má
   tréner denne v adresnom riadku — dostane okamžitú chybu; ty sa o tom pokuse
   nedozvieš. Vrátiť sa to dá kedykoľvek (alias doména je zadarmo, Krok 9).
3. **Appkové (transakčné) maily cez Workspace NIKDY nepôjdu** — to je iná trieda
   pošty a iný nástroj (§9).
4. **`fitness.plawsports.com` je rezervovaná pre kondičnú appku** (rozhodnuté
   2026-08-12, appka sa zatiaľ nekóduje). Je to jediný web, ktorý na
   `plawsports.com` vznikne — kondička je spoločná vrstva nad raketovými športmi,
   takže patrí pod zastrešujúcu značku, nie pod `plaw.win`. DNS záznam sa zakladá
   až keď bude čo nasadiť. **Pošty apexu sa to nedotkne** (`A`/`CNAME` vs
   `MX`/`TXT`), len pozor, že DMARC `plawsports.com` platí aj pre subdoménu —
   keby kondička raz posielala vlastné maily, potrebuje poriadny SPF a DKIM.
   Odôvodnenie a dôsledky sú v [`docs/roadmap-buduce-smery.md`](roadmap-buduce-smery.md) §2.1.

---

## 2. Východiskový stav (overené DNS dotazmi 2026-08-11)

Všetky domény sú registrované cez **Websupport** a delegované na
`ns1/ns2/ns3.websupport.sk`:

| Doména | Na čo dnes slúži | MX dnes |
|---|---|---|
| `plaw.win` | appka + consumer landing (Vercel) | `mx10/mx20.websupport.sk` |
| `plaw.online` | verejná tvár: rozcestník + `/federacie` (Vercel) | `mx10/mx20.websupport.sk` |
| `plawsports.com` | nič | `mx10/mx20.websupport.sk` |
| `plawtennis.com` | nič | (predvolené Websupport) |
| `plawpadel.com`, `plawpickleball.com`, `plawbadminton.com` | nič | (predvolené Websupport) |
| `plaw-tennis.com` a spol. (pomlčkové) | nič | (predvolené Websupport) |
| `plaw.click` | nič | (predvolené Websupport) |

`plaw.win` má navyše SPF `v=spf1 a mx include:_spf.m1.websupport.sk -all`.

**Dve veci, ktoré z toho plynú:**

- **Každá doména dnes hovorí svetu „pošta mi chodí na Websupport".** Aj tie, kde
  žiadna schránka neexistuje. Mail na ne buď spadne do prázdna, alebo sa odmietne
  — a hlavne sa cez ne dá ľahšie predstierať odosielateľ. Preto §8.
- **V appke ani na webe nie je zverejnená ani jedna e-mailová adresa** (overené
  prehľadaním repa). Migrácia teda nemá čo rozbiť — ale zároveň to znamená, že
  **na `/federacie` dnes nemá zväz kam napísať**. Po zriadení schránky tam adresu
  doplniť (§10).

---

## 3. Prečo `plawsports.com` a nie `plaw.win`

**Primárna doména Workspace sa mení ťažko.** Zmeniť sa dá, ale nie je to
premenovanie: pôvodná doména musí ostať ako sekundárna, **každému používateľovi sa
mení e-mailová adresa** a čokoľvek, čo sa prihlasuje cez Google, o ňom vie podľa
starej adresy. Je to zásah, nie nastavenie. Preto sa vyberá tak, aby prežila
stratégiu, nie dnešný produkt.

- `plaw.win` je **doména tenisového produktu** — beží na nej appka aj org
  subdomény. Firemná pošta pre padel či federácie by chodila z „tenisovej" adresy.
- `plawsports.com` je **neutrálna** a pokrýva všetky športy aj B2B linku.
- `.com` je pre faktúru zväzu dôveryhodnejšie než `.win` alebo `.online`.

**Adresa v podpise bude `roman@plawsports.com`** a bude platiť aj o tri roky, nech
už appka beží na akejkoľvek doméne.

---

## 4. Slovníček — čo je čo (a čo za to platíš)

| Pojem | Čo to je | Cena |
|---|---|---|
| **Používateľ (licencia)** | Skutočný účet: schránka, Disk, prihlásenie do Googlu | platí sa **za každého** |
| **Alias adresy** | Ďalšia adresa toho istého účtu (`info@` → tvoja schránka) | zadarmo, až 30 na účet |
| **Alias doména** | Celá doména naklonuje **všetky** adresy primárnej (`roman@plawtennis.com` → tá istá schránka) | zadarmo, až 20 domén |
| **Sekundárna doména** | Doména s **vlastnými** používateľmi (iní ľudia, iné schránky) | každý jej používateľ = licencia |
| **Skupina** | Zdieľaná adresa pre viacerých (`podpora@`) | zadarmo |

**Pre jedného človeka je správna kombinácia: 1 licencia + alias adresy + alias
domény.** Sekundárna doména má zmysel až keď pribudne druhý človek s vlastnou
schránkou na inej doméne.

**Edícia: Business Starter.** 30 GB na používateľa, vlastná doména, Meet, Disk.
Cenníková cena je rádovo 6–7 € za používateľa a mesiac (pri registrácii sa
zobrazí presná suma v EUR pre SK; býva zľava na prvé mesiace). Standard (2 TB)
netreba, kým je účet jeden a neukladajú sa videá.

> **Firemný nákup:** účtuje sa na `&Go, s.r.o.` — pri registrácii vyplň fakturačné
> údaje firmy a **IČ DPH**, ak je firma platiteľ. Bez neho ti Google pripočíta DPH,
> ktorú by si inak riešil prenesením daňovej povinnosti.

---

## 5. Postup: založenie Workspace na `plawsports.com`

### Krok 0 — pred začiatkom

- Prihlás sa do Websupportu a over si, či na `plaw.win` (alebo inde) **existuje
  reálna schránka s poštou**. Ak áno, prečítaj si najprv §7 — poradie krokov je
  tam iné.
- Priprav si firemné údaje (názov, adresa, IČO, IČ DPH) a platobnú kartu.
- Maj otvorený DNS panel Websupportu; budeš doň niekoľkokrát zapisovať.

### Krok 1 — registrácia

1. Choď na `workspace.google.com` → **Začať / Get started**.
2. Zadaj názov firmy, počet zamestnancov **1**, krajinu Slovensko.
3. Kontaktné meno a **existujúci** e-mail (napr. gmail) — sem príde potvrdenie.
4. Na otázku o doméne vyber **„Áno, mám doménu, ktorú môžem použiť"** a zadaj
   `plawsports.com`.

> **Pasca:** Google v tom istom kroku ponúka doménu **kúpiť**. Neklikaj na to —
> doménu už vlastníš na Websupporte a kúpou by si vyrobil druhú registráciu
> a rozdvojenú správu DNS.

5. Vytvor prihlasovacie meno — odporúčam `roman@plawsports.com` (krátke, osobné;
   `info@` bude alias, nie hlavný účet, pretože hlavný účet je zároveň
   administrátorom celého Workspace).
6. Dokonči objednávku. Dostaneš 14-dňovú skúšobnú dobu.

### Krok 2 — overenie vlastníctva domény (TXT)

Google chce dôkaz, že doména je tvoja.

1. V konzole administrátora ti ukáže reťazec `google-site-verification=…`.
2. Vo Websupporte v zóne `plawsports.com` pridaj **TXT** záznam:
   - **Názov/host:** prázdne alebo `@` (znamená koreň domény)
   - **Hodnota:** celý reťazec `google-site-verification=…`
3. Počkaj pár minút a v konzole klikni **Overiť**.

**Prečo to tak je:** kto vie zapísať do DNS zóny domény, ten ju ovláda. TXT
záznam je len odkaz „áno, tento Google účet smie s doménou pracovať" — nič iné
nerobí a môže tam pokojne ostať navždy.

### Krok 3 — MX záznamy (smerovanie pošty)

**Toto je ten krok, po ktorom začne pošta chodiť do Gmailu.**

1. Vo Websupporte v zóne `plawsports.com` **zmaž existujúce MX záznamy**
   (`mx10.websupport.sk`, `mx20.websupport.sk`).
2. Pridaj **jediný** nový:
   - **Typ:** MX
   - **Názov/host:** prázdne alebo `@`
   - **Hodnota:** `smtp.google.com`
   - **Priorita:** `1`

**Prečo jeden a nie päť:** Google od roku 2023 používa jediný MX záznam
`smtp.google.com`. Staršie návody uvádzajú päticu `ASPMX.L.GOOGLE.COM` a spol. —
tie **stále fungujú**, ale pre nové nastavenie sú zbytočné.

**Čo je MX:** záznam, ktorý hovorí „poštu pre túto doménu doručuj na tento
server". Priorita je poradie pri viacerých serveroch (nižšie číslo = skôr).
Kým tam boli Websupport servery, pošta chodila k nim; od tejto zmeny chodí Googlu.

> **Pasca:** ak MX zmažeš a nový hneď nepridáš, odosielatelia sa pokúsia doručiť
> poštu na **A záznam** domény (RFC to tak vyžaduje). Nerob medzi tým pauzu.

### Krok 4 — SPF (kto smie odosielať za tvoju doménu)

Do zóny `plawsports.com` pridaj **TXT** v koreni:

```
v=spf1 include:_spf.google.com ~all
```

**Čo to znamená:** „za túto doménu smú odosielať servery Googlu; čokoľvek iné
označ ako podozrivé." `~all` je mäkké odmietnutie (softfail) — správne na
začiatok. Na `-all` (tvrdé) sa prejde až keď je isté, že odnikiaľ inde
neodosielaš.

> **Pravidlo, na ktorom sa dá pošmyknúť:** doména smie mať **len jeden** SPF
> záznam. Ak by si niekedy pridával ďalšieho odosielateľa, nepridávaj druhý
> riadok — rozšír ten existujúci o ďalší `include:`.

### Krok 5 — DKIM (podpis odchádzajúcej pošty)

**Google DKIM nezapne sám.** Bez tohto kroku ti pošta odchádza nepodpísaná a
časom začne padať do spamu.

1. Konzola administrátora → **Aplikácie → Google Workspace → Gmail →
   Overovanie e-mailov (Authenticate email)**.
2. Vyber doménu `plawsports.com`, dĺžku kľúča **2048 bitov**, **Vygenerovať**.
3. Google ti dá názov hostiteľa (`google._domainkey`) a dlhú hodnotu.
4. Vo Websupporte pridaj **TXT**: názov `google._domainkey`, hodnota od Googlu.
5. Vráť sa do konzoly a klikni **Spustiť overovanie (Start authentication)**.

**Čo DKIM robí:** ku každému odoslanému mailu pripojí kryptografický podpis.
Príjemca si verejný kľúč vytiahne z DNS a overí, že správu naozaj poslal tvoj
server a nikto ju cestou nezmenil.

> **Pasca:** hodnota je veľmi dlhá. Niektoré DNS panely ju musia rozdeliť na
> viac častí — Websupport to zvládne sám, ale skontroluj, že sa uložila celá.

### Krok 6 — DMARC (čo s poštou, ktorá kontrolu nezvládne)

Pridaj **TXT** so **názvom `_dmarc`**:

```
v=DMARC1; p=none; rua=mailto:roman@plawsports.com
```

**Čo to znamená:** „ak niečo neprejde SPF ani DKIM, zatiaľ s tým nič nerob
(`p=none`), ale pošli mi o tom súhrn." Reporty chodia raz denne ako XML.

**Sprísňuj postupne** — toto nie je krok na jeden večer:
1. `p=none` (~2 týždne) → z reportov uvidíš, či niečo odosiela mimo Googlu.
2. `p=quarantine` → nevyhovujúca pošta ide do spamu.
3. `p=reject` → nevyhovujúca pošta sa zahodí.

**Prečo to nepreskočiť:** DMARC je jediné, čo bráni cudziemu poslať faktúru
„od teba" zväzu. Pri B2B s verejnými inštitúciami to nie je kozmetika.

### Krok 7 — skúška

1. Pošli si mail zo súkromnej adresy na `roman@plawsports.com` → musí prísť.
2. Odpovedz z Gmailu → musí prísť späť a v hlavičkách prijatej správy má byť
   `dkim=pass` aj `spf=pass` (v Gmaile: tri bodky → **Zobraziť originál**).
3. Ak `dkim=pass` chýba, vráť sa na krok 5 — pravdepodobne nebolo kliknuté
   „Spustiť overovanie".

### Krok 8 — alias adresy

Konzola → **Adresár → Používatelia → tvoj účet → Alternatívne e-mailové adresy**.

Set zvolený používateľom 2026-08-12 (anglický, ako produkt — pôvodne tu boli
slovenské názvy `obchod@`/`podpora@`/`fakturacia@`):
- `info@plawsports.com` — všeobecný kontakt (pôjde na verejný web)
- `office@plawsports.com` — dopyty od zväzov a klubov
- `support@plawsports.com` — pomoc trénerom
- `billing@plawsports.com` — účtovníctvo

**Prečo aliasy a nie ďalšie účty:** alias nič nestojí a chodí do tej istej
schránky. Keď raz pribudne človek na podporu, alias sa zruší a `podpora@` sa
zmení na **skupinu** alebo jeho vlastný účet — bez zmeny adresy navonok.

V Gmaile si k nim nastav **štítky a filtre** (Nastavenia → Filtre → „Komu:
office@…" → priraď štítok), inak sa ti to celé zleje do jednej hromady. Zároveň
v **Účty a import → Odosielať e-maily ako** pridaj všetky štyri a zapni
**„Odpovedať z tej istej adresy, na ktorú bola správa odoslaná"** — inak
odpovieš z `roman@` na adresu, na ktorú ti nikto nepísal.

### Krok 9 — alias doména (`plawtennis.com`)

> **Upresnené 2026-08-12:** alias doména je len `plawtennis.com`. `plaw.win` a
> `plaw.online` idú namiesto toho do Kroku 10 (parkovanie pošty) — viď §1.
> Postup nižšie platí aj pre ne, keby sa to raz otočilo.

1. Konzola → **Účet → Domény → Spravovať domény → Pridať doménu**.
2. Vyber **„Doména typu alias (domain alias)"**, nie sekundárna doména.
3. Over ju TXT záznamom (rovnako ako krok 2, iná zóna).
4. V jej zóne nastav rovnaký **MX** ako v kroku 3 (`smtp.google.com`, priorita 1)
   a **zmaž** pôvodné Websupport MX.
5. Pridaj jej **SPF** (krok 4) a vygeneruj jej **vlastný DKIM kľúč** (krok 5 —
   DKIM je vždy per doména).
6. Pridaj jej **DMARC**: TXT s názvom `_dmarc`, hodnota
   `v=DMARC1; p=quarantine; rua=mailto:roman@<tá istá doména>`.
7. Uprac po Websupporte: `mail`/`webmail`/`smtp`/`pop3`/`imap` (**A aj AAAA** —
   Websupport ich zakladá v oboch a mazanie len `A` nestačí),
   `autodiscover`/`autoconfig` (CNAME), `_autodiscover._tcp` (SRV), `admin` (A)
   a **wildcard `*` A aj AAAA**. Inak si poštový klient pri nastavovaní schránky
   vypýta údaje od Websupportu a ľubovoľná vymyslená subdoména vedie na parkovanie.

> **Pasca s `rua` (chytila nás na `plawtennis.com`):** adresa pre DMARC reporty
> musí byť **v tej istej doméne** ako DMARC záznam. Report na cudziu doménu
> vyžaduje, aby tá doména vydala povoľovací záznam
> `<zdrojová-doména>._report._dmarc.<cieľová-doména>` — Google to kontroluje a
> bez neho reporty ticho zahodí. Pri alias doméne to netreba riešiť: `roman@`
> na nej padá do tej istej schránky, tak tam píš `rua=mailto:roman@` **jej
> vlastnej** domény. A `rua` nevynechávaj — bez reportov je dvojtýždňová fáza
> `p=quarantine` na nič a na `p=reject` by sa prechádzalo naslepo.

**Čo tým získaš:** `info@plaw.win` aj `info@plawtennis.com` padnú do tej istej
schránky a dá sa z nich aj odpovedať (Gmail → Nastavenia → Účty → „Odosielať
e-maily ako").

> **Pozor pri `plaw.win` a `plaw.online`:** meníš len **MX a TXT**. Záznamy `A`
> a `CNAME` (`216.198.79.1`, `…vercel-dns-017.com`) sú web a **musia ostať** —
> keby si ich zmazal, spadne appka aj verejný web.

### Krok 9b — tenisové domény vedú na appku (rozhodnuté 2026-08-12)

`plawtennis.com` **aj** `plaw-tennis.com` (vrátane `www` oboch) presmerúvajú na
`plaw.win`. Dovtedy ukazovali na websupportové parkovanie (`37.9.175.133`, resp.
`37.9.175.131`).

**Robí to Vercel, nie kód.** Projekt `tennis-coach-app` → Settings → Domains →
Add Domain → pri každom zo štyroch hostnames zvoliť **Redirect to `plaw.win`**,
typ **307 Temporary Redirect**. V zóne potom zmazať parkovacie `A`/`AAAA` na `@`
aj `www` a zapísať to, čo Vercel ukáže vo „View DNS configuration".

> **Nepridávaj tie domény do Vercelu bez voľby redirect.** Bez nej sa na nich
> začne servírovať appka, pričom `proxy.ts` tie hostnames nepozná
> (`lib/public-face.ts#isPublicFaceHost`) — takže by na nich vyskočila consumer
> landing namiesto presmerovania.

**Prečo 307 a nie 308:** 308 je trvalé a prehliadače si ho držia dlho aj po
zmene. Pri smerovaní na multi-šport je pravdepodobné, že `plawtennis.com` sa raz
stane domovom tenisového produktu (keď `plaw.win` prestane sedieť pre padel a
bedminton) — cachovaný 308 by vtedy posielal ľudí preč z domény, ktorú si práve
zapol. Na SEO to nemá vplyv, `plaw.win` je `noindex`.

**Web a pošta sú nezávislé:** `A`/`CNAME` rieši web, `MX`/`TXT` poštu. Preto
`plaw-tennis.com` môže viesť na appku a **zároveň ostať poštovo zaparkovaná**
podľa Kroku 10, a v `plawtennis.com` sa pri tejto zmene nesmú stratiť jej
poštové záznamy (je to alias doména, Krok 9).

### Krok 10 — zabezpečenie zaparkovaných domén

Týka sa: `plawpadel.com`, `plawpickleball.com`, `plawbadminton.com`, všetkých
pomlčkových a `plaw.click`. **`plaw-tennis.com` je medzi nimi**, hoci jej web
vedie na appku (Krok 9b) — parkovanie sa tu týka výhradne pošty. **Od 2026-08-12
sem patria aj `plaw.win` a `plaw.online`** (§1): pošta na nich nebude, web na
nich žije ďalej.

> **Pri `plaw.win` a `plaw.online` sa dotýkaš VÝHRADNE `MX` a `TXT`.** Záznamy
> `A` (`216.198.79.1`) a `CNAME` (`…vercel-dns-017.com`) sú Vercel — appka,
> verejný web aj org subdomény federácií. Pomôcka pri upratovaní zvyškov: **maž
> len to, čo ukazuje na Websupport** (`37.9.x`, `45.13.x`, `2a00:4b40:…`,
> `*.websupport.sk`), čokoľvek s Vercelom nechaj.
>
> **Do budúcna:** transakčné maily appky (Stripe fáza) pôjdu z **odosielacej
> subdomény** typu `mail.plaw.win` cez Resend/Postmark. Tá má vlastný SPF a DKIM,
> takže jej `v=spf1 -all` na koreni neprekáža a DMARC `p=reject` prejde, keď je
> nastavená správne. Meniť by sa muselo len pri odosielaní priamo z
> `noreply@plaw.win`.

V zóne každej z nich:
1. **Zmaž** Websupport MX záznamy a pridaj **null MX**: typ MX, hodnota `.`
   (samotná bodka), priorita `0`.
2. TXT v koreni: `v=spf1 -all`
3. TXT s názvom `_dmarc`: `v=DMARC1; p=reject;`

**Čo to robí:** hovorí celému svetu „táto doména neprijíma ani neodosiela poštu;
čokoľvek, čo tvrdí opak, zahoď". Bez toho je zaparkovaná doména vďačný cieľ na
podvodné maily v tvojom mene — a keď sa raz spáli reputácia mena „plaw",
odnesie si to aj hlavná doména.

> **Overené 2026-08-12: Websupport null MX NEPODPORUJE.** Pole „Mailový server"
> validuje hodnotu proti `^[a-z0-9-]+(\.[a-z0-9-]+)*$`, takže samotnú bodku
> odmietne. Riešenie: **nechaj doménu úplne bez MX záznamu** (zmaž oboje
> websupportové). Odosielateľ potom podľa RFC skúsi doručiť na `A` záznam
> domény, tam nikto na porte 25 nepočúva, mail mu chvíľu visí vo fronte a
> odskočí — rovnaký výsledok ako null MX, len pomalší. Ochranu robí `v=spf1
> -all` a DMARC `p=reject`, nie MX, takže sa tým nič neoslabuje.

### Krok 11 — zabezpečenie účtu

Toto nie je voliteľné: účet je zároveň administrátorom celej firmy.

1. **Dvojfaktorové overenie** (Konzola → Zabezpečenie, alebo priamo v účte).
2. **Záložné kódy** vytlač a odlož mimo počítača.
3. Zváž **druhý administrátorský účet** (nie alias, skutočný účet) pre prípad,
   že sa k hlavnému nedostaneš — Google ho pri strate prístupu neobnoví
   telefonátom.

---

## 6. Čo sa vedome NEROBÍ

| Neurobiť | Prečo |
|---|---|
| Presúvať appku na `app.plawsports.com` | Org kontext ide výhradne z hostname `<slug>.plaw.win` a auth cookies sú host-only. Presun = presunúť každú org subdoménu (Vercel + CNAME + `organizations.slug`), **odhlásiť všetkých** a **rozbiť PWA ikonu na trénerovom telefóne**. Má zmysel jedine spolu so spustením druhého športu, keď sa routing aj tak mení. |
| Presmerovať `plaw.online` na hlavnú doménu | Nie je to parkovaná doména, ale **nasadený rozcestník**; `/federacie` žije výhradne tam (`PUBLIC_ONLY_PATHS` v `proxy.ts`). Redirect by zmazal hotovú funkciu. |
| Aktivovať mail na športových doménach | Každá aktivovaná doména je ďalšia zóna na údržbu (MX, SPF, DKIM, DMARC). Alias doména sa pridá za desať minút v deň, keď ten šport pôjde von. |
| Robiť zo športových domén weby | Landing má 9 jazykov; 4 športy × 9 = 36 obsahových plôch, ktoré si navzájom kanibalizujú vo vyhľadávaní. |
| Meniť neskôr primárnu doménu | Viď §3 — mení sa tým adresa každého používateľa. |

---

## 7. Ak na Websupporte existuje schránka s poštou

Zmena MX **neprenesie staré správy** — tie ostanú na Websupporte. Ak tam reálne
niečo je:

1. Najprv založ Workspace a over doménu (kroky 1–2), ale **MX ešte nemeň**.
2. V Gmaile: **Nastavenia → Účty → Kontrolovať poštu z iných účtov** a pridaj
   Websupport schránku cez POP3 (údaje sú v paneli Websupportu). Stiahne staré
   správy do Gmailu.
3. Až potom prepni MX (krok 3).
4. Websupport schránku nechaj ešte mesiac žiť — zachytí, čo sa cestou minulo.

---

## 8. Čo s poštou, ktorú posiela appka

**Toto je iná trieda pošty a Workspace na ňu nie je nástroj.** Potvrdenia
registrácie, obnovy hesla a neskôr Stripe potvrdenia sú **transakčné** maily:
posiela ich stroj, chodia v nárazoch a musia mať vlastnú reputáciu.

- **Dnes** ich posiela vstavaný Supabase Auth zo svojej adresy. Funguje to, ale
  odosielateľ nie je tvoja doména a platia prísne limity.
- **Neskôr** sa nastaví vlastné SMTP v Supabase cez službu na transakčné maily
  (Resend, Postmark a podobne), s odosielateľom `noreply@plawsports.com` a
  **vlastnou subdoménou** na odosielanie (napr. `mail.plawsports.com`), aby
  prípadný problém s doručovaním nepoškodil reputáciu firemnej pošty.
- **Neposielaj appkové maily cez Workspace SMTP.** Má denné limity stavané na
  človeka, nie na aplikáciu, a pri prekročení ti zablokuje odosielanie —
  vrátane tvojej vlastnej pošty.

**Od 2026-08-16 to už nie je len téma Stripe fázy: appka odosiela mail pri
obnove zabudnutého hesla**, takže vlastné SMTP sa stalo aktuálnym skôr.
Postup krok za krokom (Resend, odosielacia subdoména `mail.plawsports.com`,
nastavenie v Supabase) je v [`obnova-hesla.md`](obnova-hesla.md) §2.3.

---

## 9. Keď schránka funguje: doplniť adresu na web

Dnes na verejnom webe nie je ani jedna adresa — vrátane `/federacie`, ktorá je
pritom stránka pre zväzy a kluby. Po zriadení pošty:

- `messages/sk/federacie.json` → doplniť kontakt `office@plawsports.com`
- landing a oba návody → `info@plawsports.com`

Je to malá zmena v prekladoch, ale bez nej nemá B2B záujemca ako odpovedať na
stránku, ktorá ho má osloviť.

---

## 10. Kontrolný zoznam

- [ ] Workspace založený, `plawsports.com` overená
- [ ] MX `smtp.google.com` (priorita 1), staré Websupport MX zmazané
- [ ] SPF `v=spf1 include:_spf.google.com ~all`
- [ ] DKIM vygenerovaný **a zapnutý** (`Spustiť overovanie`)
- [ ] DMARC `p=none` + adresa na reporty
- [x] Skúšobný mail tam aj späť, v hlavičkách `dkim=pass` a `spf=pass`
- [x] Skúška aliasu naostro: mail na `info@` dostal štítok, odpoveď odišla z `info@` (2026-08-12)
- [x] Aliasy `info@`, `office@`, `support@`, `billing@` (hotové 2026-08-12) + „Odosielať e-maily ako" + filtre v Gmaile
- [x] Alias doména `plawtennis.com` (MX, SPF, DKIM, DMARC — hotové 2026-08-12)
- [ ] `plaw.win` a `plaw.online`: parkovanie pošty (null MX + `v=spf1 -all` + DMARC `p=reject`)
- [ ] `A`/`CNAME` na `plaw.win` a `plaw.online` **nedotknuté**
- [x] `plawtennis.com` + `plaw-tennis.com` (aj `www`) → 307 redirect vo Verceli (2026-08-12; cieľ je **`www.plaw.win`**, nie apex — ušetrí to jeden skok navyše, lebo `plaw.win` sám presmerúva na `www`). Overené zvonku: všetky štyri hostnames vracajú `307 → https://www.plaw.win/`
- [ ] Zaparkované domény: null MX + `v=spf1 -all` + DMARC `p=reject`
- [x] Dvojfaktorové overenie a záložné kódy (2026-08-12; záchranný mail + telefón sa dali nastaviť až cez Admin konzolu → Users → Security → Recovery information, cez `myaccount.google.com` to nový účet odmietal s „We couldn't verify it's you")
- [ ] O ~2 týždne: DMARC na `p=quarantine`, potom `p=reject`
- [ ] Kontaktná adresa doplnená na `/federacie` a na landing
