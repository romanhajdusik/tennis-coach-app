# GDPR — mapa rolí a právnych základov

> **Stav: PRACOVNÝ PODKLAD, 2026-08-25.** Prvý z dokumentov ku GDPR a základ pre
> všetky ostatné: zásady ochrany údajov, podmienky používania, sprostredkovateľskú
> zmluvu pre federácie aj technické úlohy. Kým nie je uzavretá táto mapa, každý
> ďalší text by sa písal naslepo. Keď sa niečo z neho zmení, **prepíš tento
> dokument, nezakladaj druhý.**
>
> **Jazyk:** tento dokument aj [záznam o činnostiach](gdpr-zaznam-cinnosti.md) sú
> interné a slovenské, ako zvyšok `docs/`. **Zverejňované právne texty budú
> anglické ako záväzné znenie + slovenský preklad** (rozhodnuté 2026-08-25) —
> s jednou výhradou, viď §7.

---

## 1. Kto v tomto systéme vôbec vystupuje

| Účastník | Kto to je | Má účet v appke? |
|---|---|---|
| **P.L.A.W s.r.o.** | prevádzkovateľ služby (obchodné meno, IČO a sídlo treba doplniť) | — |
| **Samostatný tréner** | platiaci zákazník, sám si zakladá hráčov | áno (`role = coach`) |
| **Organizácia** (zväz/klub/akadémia) | B2B zákazník, platí za sedadlá mimo appky | — (má subdoménu) |
| **Šéftréner** | člen organizácie, read-only dohľad nad celou organizáciou | áno (`role = director`) |
| **Tréner-zamestnanec** | člen organizácie, pracuje s pridelenými hráčmi | áno (`coach` + členstvo) |
| **Hráč** | **spravidla dieťa**, o ktorom sa vedie záznam | **väčšinou nie** |
| **Sledujúci** | rodič / manažér / samotný hráč, číta kópie tréningov | áno (`parent`/`manager`/`player`) |

**Kľúčová asymetria celej appky: hlavná dotknutá osoba — dieťa — je jediný
účastník, ktorý appku spravidla nikdy neuvidí.** Jeho meno, rok narodenia
a poznámky o ňom zadáva tretia osoba. Z toho plynie väčšina toho, čo je nižšie.

---

## 2. Režim A — samostatný tréner (`organization_id IS NULL`)

| Okruh údajov | Prevádzkovateľ | Sprostredkovateľ | Prečo tak |
|---|---|---|---|
| Hráč: meno, rok narodenia, tréningy, cvičenia, poznámky, testy | **tréner** | **P.L.A.W s.r.o.** | Tréner rozhoduje, koho zapíše, čo si o ňom poznačí a ako dlho to drží. My k tomu nedávame žiadny vlastný účel — appka je nástroj. |
| Prepojenia (rodičovský kód, prepojenie kariet) | **tréner** | **P.L.A.W s.r.o.** | Kód vydáva tréner, my ho len vykonávame. |
| Účet trénera: e-mail, meno, heslo, rola, predplatné, promo kód | **P.L.A.W s.r.o.** | Supabase, Vercel, Resend | O týchto údajoch rozhodujeme my — tréner ich zveruje nám, aby mohol službu používať. |
| Prevádzkové logy, bezpečnosť, fakturácia | **P.L.A.W s.r.o.** | Vercel, Supabase, neskôr Stripe | Vlastný účel: prevádzka a ochrana služby. |

**Dôsledok, ktorý sa musí premietnuť do podmienok:** voči údajom o deťoch nie sme
prevádzkovateľ. Nesmieme s nimi robiť nič nad rámec pokynov trénera — ani
štatistiky, ani trénovanie modelov, ani „vylepšovanie produktu" nad rámec
anonymizovaných agregátov. Čokoľvek z toho by nás zmenilo na prevádzkovateľa so
všetkými povinnosťami vrátane vlastného právneho základu voči každému dieťaťu.

---

## 3. Režim B — federácia / klub / akadémia (`organization_id` vyplnené)

| Okruh údajov | Prevádzkovateľ | Sprostredkovateľ |
|---|---|---|
| Hráči organizácie a celá ich tréningová história | **organizácia** | **P.L.A.W s.r.o.** |
| Štandardizované kódy cvičení organizácie | **organizácia** | **P.L.A.W s.r.o.** |
| Členstvo, priradenia hráčov, pozvánky, sedadlá | **organizácia** | **P.L.A.W s.r.o.** |
| Účty trénerov a šéftrénera (identita, prihlásenie, heslo) | **P.L.A.W s.r.o.** | Supabase, Vercel, Resend |

Je to priamy dôsledok pravidla, ktoré appka už má zapísané v `CLAUDE.md`: **dáta
vlastní organizácia, nie tréner** (odchod trénera prácu neodnesie). Zväz je preto
prevádzkovateľom aj voči vlastným trénerom — ale len v rozsahu členstva
a priradení, nie voči ich prihlasovacej identite.

**Praktický dopad, ktorý nie je papierovanie:** prvá federácia, ktorá bude
podpisovať, si od nás vypýta **sprostredkovateľskú zmluvu podľa čl. 28** so
zoznamom ďalších sprostredkovateľov. Bez nej to ich právne oddelenie neschváli.
Je to teda predajný blokátor B2B vetvy, nie administratíva.

---

## 4. Režim C — sledujúci (rodič / manažér / hráč) a rodičovské kópie

Tu je jediné miesto, kde mapa nevyplýva z architektúry sama a treba **rozhodnúť**.

**Fakty z kódu:**

- `parent_session_records` / `parent_session_drill_records` sú **kópie**, nie pohľad.
- `source_session_id` je **zámerne bez cudzieho kľúča**, aby kópia prežila zmazanie
  tréningu aj **zmazanie celého trénerovho účtu**.
- DELETE sa nikdy nepropaguje; zrušenie prepojenia synchronizáciu len zastaví.
- Sledujúci má vlastný účet a vlastný vstupný bod — nie je „hosťom" u trénera.

Bolo to správne produktové rozhodnutie (rodič nesmie prísť o históriu dieťaťa),
ale právne vytvára stav, v ktorom tu ležia údaje o dieťati bez prevádzkovateľa,
ktorý by za ne vedel odpovedať: pôvodný tréner už nemusí existovať a jeho pokyny
nemajú kam doznieť.

**Návrh na rozhodnutie (odporúčam): P.L.A.W s.r.o. je prevádzkovateľom
rodičovských kópií od okamihu ich vzniku.**

| | |
|---|---|
| Účel | poskytnúť sledujúcemu trvalý záznam o tréningu dieťaťa, nezávislý od toho, či tréner v službe zostane |
| Právny základ | čl. 6 ods. 1 písm. b — plnenie zmluvy so sledujúcim (je to služba poskytovaná jemu) |
| Podmienka zákonnosti | tréner dáta vydá **vedome** (vygeneruje a odovzdá kód) a sledujúci je pri zadaní kódu **informovaný**, že mu vzniká vlastná kópia, ktorá ostane aj po skončení spolupráce |
| Čo tým vzniká nám | povinnosť vedieť kópie na požiadanie **zmazať a vydať** — dnes k nim appka nemá ani jednu cestu (iba `service_role`, žiadne UI) |

**Alternatíva, ktorú neodporúčam:** ponechať prevádzkovateľstvo trénerovi. Je to
formálne čistejšie, ale po zmazaní jeho účtu neexistuje nikto, kto by práva
dotknutej osoby vykonal — a to je horší stav než zodpovednosť prevziať.

**Zmeny, ktoré z odporúčaného variantu plynú (malé, ale povinné):**

1. Veta pri zadaní kódu na `/parent`: vzniká ti vlastná kópia a ostáva aj po zrušení prepojenia.
2. Veta pri generovaní kódu na `/players`: vydaním kódu odovzdávaš dáta sledujúcemu natrvalo.
3. Cesta na výmaz kópií na žiadosť (dnes chýba úplne).
4. Vlastná lehota uchovávania kópií — viď §6.

---

## 5. Ťažké miesta, ktoré vyplývajú z architektúry

### 5.1 Deti, ktoré appku nikdy neuvidia

Právnym základom voči hráčovi **nemôže byť súhlas daný nám** — nemáme s dieťaťom
ani s rodičom žiadny kontakt. Základ leží u trénera (zmluva o trénerskej službe,
prípadne oprávnený záujem viesť záznam o tréningu) alebo u organizácie (členstvo
v zväze). **Naša povinnosť je dať trénerovi hotový, prekopírovateľný text pre
rodičov** — bez neho stojí zákonnosť celej appky na tom, že si to každý tréner
vyriešil sám. Je to zároveň najlacnejšia vec, ktorú vieme spraviť: jedna strana textu.

### 5.2 Sledujúci účet pre samotného hráča (`role = player`)

Dieťa si vie **samo založiť účet** na `/parent/login`. Súhlas ako právny základ tu
nepoužívame (základom je zmluva), takže veková hranica z čl. 8 sa neuplatní
priamo — ale zmluva s maloletým má vlastný limit v Občianskom zákonníku.

**Návrh: v podmienkach určiť dolnú hranicu pre vlastný sledujúci účet (odporúčam
16 rokov, zhodne so slovenskou hranicou podľa čl. 8) a mladšie dieťa nechať
sledovať iba cez účet rodiča.** Vek overovať nad rámec vyhlásenia nebudeme —
nerobí sa to ani inde a viedlo by to k zberu ďalších údajov.

### 5.3 Osobitná kategória údajov (čl. 9) je na dosah, dnes tam ešte nie sme

- `metrics_and_tests` je zatiaľ **prázdna** — kondičné a technické testy.
- §3 roadmapy (**záťaž z hodiniek**, tepová frekvencia) je **jednoznačne údaj
  o zdraví**, teda osobitná kategória s prísnejším režimom.
- **Reálne riziko je už dnes inde: voľné textové polia.** `sessions.notes`
  a `metrics_and_tests.notes` sú presne miesta, kam tréner napíše „bolelo ho
  koleno". Tomu sa nedá zabrániť schémou, len textom v podmienkach a poznámkou v UI.

**Rozhodnúť sa dá teraz zadarmo, po nasadení hodiniek už nie.** Odporúčanie:
záťaž z hodiniek už pri návrhu označiť za osobitnú kategóriu, viazať ju na
výslovný súhlas rodiča, ktorý zbiera tréner (príznak na karte hráča), a držať ju
kratšie než zvyšok. Ak by sa to ukázalo ako priveľa, alternatíva je ukladať len
odvodené číslo bez tepových kriviek — lacnejšie, ale stále údaj o zdraví.

### 5.4 Meno dieťaťa odchádza do Google Kalendára

`syncSessionToGoogleCalendar` posiela do kalendára názov udalosti, ktorý obsahuje
**meno hráča** ([sessions.ts:174](../lib/actions/sessions.ts#L174)). Ak si tréner
pripojí súkromný gmail, meno dieťaťa skončí v spotrebiteľskom účte Googlu, kde
Google **nie je náš sprostredkovateľ**, ale vlastný prevádzkovateľ. Nie je to naša
chyba (koná tréner na vlastnom účte), ale musí to byť v texte — a existuje lacná
náprava: **prepínač, či má názov udalosti obsahovať meno, iniciály, alebo len
„Training".** Odporúčam ho spraviť, odstráni to problém takmer celý.

### 5.5 Cross-read medzi disciplínami má súhlas na správnom mieste, ale bez opory

`player_links` rieši, že dáta vydáva **vlastník dát** (`target_shares_summary`,
`source_shares_with_follower`) — architektonicky správne. Právne je to však vydanie
údajov o dieťati **inému prevádzkovateľovi** (druhému trénerovi), a na to potrebuje
vydávajúci tréner základ voči rodičovi, nie len vlastné tlačidlo. **Riešenie je opäť
text, nie kód:** veta pri prepínači a odsek v texte pre rodičov, že takéto
prepojenie môže vzniknúť a čo sa v ňom vydáva.

### 5.6 Právo na výmaz ide proti tomu, čo sa dnes predáva ako výhoda

Stav kódu (overený):

- **Zmazanie účtu neexistuje nikde** — v `lib/actions/` nie je jediná taká akcia
  a appka nedrží `service_role` kľúč, ktorým by sa `auth.users` dal zmazať.
- Hráč sa **iba archivuje** (`deactivatePlayer`), nemaže sa nikdy.
- Rodičovské kópie sa nemažú zámerne.
- Export údajov nie je nikde.
- V cenníku je „**história nič nestojí a nikdy sa nemaže**" uvedené ako **predajný argument**.

To je priamy stret s čl. 17 a so zásadou minimalizácie uchovávania. Neznamená to,
že sa argument musí zrušiť — znamená to, že „nikdy" musí dostať hranicu a výmaz na
žiadosť musí existovať ako cesta v appke. Návrh lehôt je v §6.

---

## 6. Návrh lehôt uchovávania (na potvrdenie)

Zásada: lehota sa počíta od **konca vzťahu**, nie od vzniku záznamu, a kedykoľvek
ju predbehne žiadosť o výmaz.

| Okruh | Návrh | Odôvodnenie |
|---|---|---|
| Tréningové dáta počas aktívneho vzťahu | po celý čas trvania | to je samotná služba |
| Archivovaný hráč u samostatného trénera | **3 roky** od archivácie, potom výzva trénerovi a zmazanie | športová história má hodnotu naprieč sezónami, ale „naveky" neobstojí |
| Hráči organizácie | podľa pokynu organizácie v zmluve, **predvolene 3 roky** od ukončenia členstva hráča | prevádzkovateľom je zväz, lehota je jeho rozhodnutie |
| Rodičovské kópie | **3 roky** od zrušenia prepojenia | zosúladené s archívom, inak kópia prežije originál |
| Účet bez prihlásenia | **24 mesiacov** neaktivity → e-mail s upozornením → zmazanie | štandardná a obhájiteľná lehota |
| Účtovné doklady (Stripe, faktúry zväzom) | **10 rokov** | zákon o účtovníctve, prebíja právo na výmaz |
| Prevádzkové logy (Vercel, Supabase) | podľa nastavenia poskytovateľa, **cieľ do 30 dní** | treba overiť skutočný stav |
| Google OAuth tokeny | do odpojenia alebo zmazania účtu | |
| Nepoužité prepojovacie a promo kódy | do expirácie, potom zmazať | dnes ostávajú natrvalo |

---

## 7. Jazyk dokumentov — jedna výhrada k rozhodnutiu

Rozhodnutie **EN záväzné + SK preklad** je pre trénerské a B2B dokumenty
v poriadku: produkt je anglický a zväzy majú právnikov.

**Výhradu mám k textu pre rodičov a k tomu, ktorý tréner odovzdáva rodičom.**
Číta ho slovenský rodič o údajoch svojho dieťaťa a čl. 12 žiada „jasný
a zrozumiteľný jazyk" meraný adresátom. Keby sa niekedy riešil spor, veta
„záväzná je anglická verzia" by stála proti nám.

**Odporúčam: pri rodičovskom texte (`plaw.click` a odovzdávaný text pre rodičov)
uviesť slovenskú verziu ako rovnako záväznú.** Ostatné dokumenty nechať tak, ako
si rozhodol. Ak s tým nesúhlasíš, píše sa to podľa pôvodného zadania — je to tvoja
voľba, nie prekážka.

---

## 8. Úlohy, ktoré z tejto mapy vyplývajú

**Dokumenty** (v poradí, v akom ich treba):

1. Záznam o spracovateľských činnostiach — [gdpr-zaznam-cinnosti.md](gdpr-zaznam-cinnosti.md) ✅ hotový spolu s týmto
2. Zásady ochrany osobných údajov — tri verzie: tréner (`plaw.win`), sledujúci (`plaw.click`), organizácia (`plaw.online`)
3. Podmienky používania — samostatné pre trénera a pre sledujúceho
4. **Text pre rodičov, ktorý odovzdáva tréner** — najvyššia hodnota za najmenej práce
5. Sprostredkovateľská zmluva podľa čl. 28 pre federácie
6. Postup pri bezpečnostnom incidente (72 h) — kto komu hlási a v akom poradí

**Technické úlohy** (bez nich sú dokumenty sľubom, ktorý sa nedá splniť):

1. **Zmazanie účtu** vrátane hráčov, tréningov a kópií — vyžaduje `service_role`, takže visí na tom istom rozhodnutí ako F4 a Stripe
2. **Export údajov** (prenosnosť) — trénerovi aj sledujúcemu, stačí JSON
3. **Trvalé zmazanie hráča**, nielen archivácia
4. Odkazy na dokumenty v pätičkách a potvrdenie pri registrácii
5. Prepínač mena v názve Google udalosti (§5.4)
6. Vety pri vydávaní kódov a pri prepínačoch zdieľania (§4, §5.5)
7. Automatické mazanie po lehote (§6)

---

## 9. Otvorené otázky — potrebujem odpoveď od teba

1. **Región Supabase projektu** (EU vs US) — rozhoduje o prenosoch do tretích krajín. Dashboard → Project Settings → General.
2. **Región Vercel projektu** a či sú funkcie viazané na EU.
3. **Máš odklikané DPA** u Supabase, Vercelu, Googlu a Resendu?
4. **Je Resend na produkcii reálne zapnutý** ako SMTP, alebo maily stále chodia vstavaným mailerom Supabase?
5. **Obchodné meno, IČO a sídlo s.r.o.** do dokumentov — a či už existuje.
6. **Potvrdenie §4** — preberáme prevádzkovateľstvo rodičovských kópií?
7. **Potvrdenie lehôt v §6.**
8. **Rozhodnutie o záťaži z hodiniek** (§5.3) — osobitná kategória so súhlasom, alebo len odvodené číslo?
