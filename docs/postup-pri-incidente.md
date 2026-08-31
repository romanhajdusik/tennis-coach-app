# Postup pri porušení ochrany osobných údajov

Čo spraviť, keď sa niečo stane. Je to **prevádzkový postup, nie právny text** —
píše sa pre jedného človeka o druhej v noci, nie pre právnika.

Existuje preto, že [zmluva podľa čl. 28](gdpr-zmluva-cl28.md) §8.1 zaväzuje
oznámiť incident zväzu **do 48 hodín** a bez napísaného postupu je to číslo bez
obsahu. Bol to najvážnejší otvorený bod pred podpisom prvého zväzu (časť E
v [zázname o činnostiach](gdpr-zaznam-cinnosti.md)).

**Čítaj to celé aspoň raz teraz, kým sa nič nedeje.** Pri incidente sa čítajú
len kroky 1 a 2.

---

## 0. Čo je incident

Porušenie bezpečnosti, ktoré vedie k **zničeniu, strate, zmene alebo
neoprávnenému sprístupneniu** osobných údajov. Tri veci, ktoré sa pri tejto
definícii bežne prehliadajú:

- **Nemusí za tým byť útočník.** Vlastná chyba je incident rovnako.
- **Nedostupnosť sa počíta.** Zmazané dáta bez zálohy sú incident, aj keď ich
  nikto cudzí nevidel.
- **Nemusí byť istota.** Podozrenie, ktoré nevieš vyvrátiť, sa rieši ako incident.

**Čo to v tejto appke reálne môže byť:**

| Druh | Príklad u nás |
|---|---|
| Chyba v prístupových pravidlách | policy alebo `security definer` funkcia vydá viac, než má — tréner uvidí cudzieho hráča |
| Ukradnuté prihlásenie | phishing na trénera, jeho účet použije niekto iný |
| Kompromitované zariadenie | notebook s prístupom do produkčného Supabase |
| Chyba poskytovateľa | incident na strane Supabase, Vercelu alebo Resendu |
| Ľudská chyba | mail alebo screenshot s menom dieťaťa na zlú adresu |
| Strata dát | zmazané riadky bez použiteľnej zálohy |

**Čo incident NIE JE:** verejný `anon` kľúč v prehliadači (je verejný zámerne,
hranicou je RLS), neúspešný pokus o prihlásenie, ani chyba v appke, ktorá
neodhalila a nezničila žiadne údaje.

---

## 1. Prvá hodina

Poradie je záväzné. **Najprv zastav, potom vyšetruj** — a nikdy nie naopak.

**1.1 Zapíš čas a čo vidíš.** Jedna veta do súboru podľa kroku 6. Čas, kedy si
sa o tom dozvedel, je **začiatok lehoty** a spätne sa nedá zrekonštruovať.

**1.2 Zastav to.** Čím reálne disponuješ:

| Páka | Kde |
|---|---|
| Odhlásiť všetkých / konkrétny účet | Supabase → Authentication → používateľ → *Sign out* |
| Vymeniť kľúče projektu | Supabase → Settings → API → rotácia (pozor: mení sa aj vo Verceli) |
| Zavrieť registráciu | Supabase → Authentication → Providers → Email → *Allow new users to sign up* |
| Vrátiť nasadenie späť | Vercel → Deployments → predošlé → *Promote to Production* |
| Zavrieť dieru v pravidlách | migrácia; v núdzi `revoke` na tabuľke priamo v SQL Editore |
| Odpojiť zväz | `update organizations set subscription_status = …` **nestačí** — appka ho nečíta; reálne sa odpája zrušením členstiev |

**1.3 Nemaž dôkazy.** Logy Supabase aj Vercelu majú obmedzenú históriu — ak
niečo vyzerá dôležito, **stiahni si to hneď**, nie po víkende.

**1.4 Nepíš zväzu skôr, než vieš aspoň hrubý rozsah** — ale ani neodkladaj kvôli
detailom (krok 3).

---

## 2. Koľko máš času

| Čie dáta | Kto koho upovedomí | Lehota |
|---|---|---|
| Hráči organizácie | **my → organizácii** (kontakt je v prílohe A zmluvy) | **48 h** |
| Účty trénerov, riaditeľov, sledujúcich | **my → Úradu** | **72 h** |
| Rodičovské kópie (`parent_session_records`) | **my → Úradu** | **72 h** |

**Lehota beží od okamihu, keď sa o incidente dozvieš, nie keď mu porozumieš.**

Pri hráčoch organizácie **Úradu neoznamujeme nič** — to je povinnosť
organizácie a naša správa jej lehotu spúšťa (§8.3 zmluvy). Robíme to za ňu len
vtedy, ak nám to písomne uloží.

---

## 3. Čo treba zistiť, kým lehota beží

Päť otázok, presne v rozsahu, aký žiada §8.2 zmluvy a čl. 33 ods. 3:

1. **Čo sa stalo** a kedy (aj kedy sa to skončilo, ak už áno).
2. **Koho sa to týka** — kategórie osôb a **približný počet**.
3. **Ktorých údajov** sa to týka a približne koľkých záznamov.
4. **Aké to má následky** pre tie osoby.
5. **Čo sme spravili** a čo navrhujeme spraviť.

**Približne stačí.** Presné číslo nie je podmienkou oznámenia a čakanie naň je
najčastejší dôvod zmeškanej lehoty.

> **Obmedzenie, ktoré treba priznať:** appka **nemá záznam o čítaní** — žiadna
> tabuľka nedrží, kto ktorý riadok videl. Rozsah sa preto neodvodzuje z toho, čo
> sa **stalo**, ale z toho, čo bolo **možné**: dokedy diera existovala a kam až
> siahala. To vedie k širšiemu odhadu, a je to správne — podceniť rozsah je
> horšie než nadhodnotiť ho. Je to zároveň najsilnejší argument, prečo raz
> pridať logovanie aspoň k `security definer` funkciám.

---

## 4. Oznámenie organizácii (do 48 hodín)

Ide na kontakt z **prílohy A** zmluvy, e-mailom, z `support@plawsports.com`.
**Pošli ho aj vtedy, keď nevieš všetko** — a povedz to rovno.

```
Predmet: Oznámenie o porušení ochrany osobných údajov — [názov organizácie]

Vážení,

oznamujeme Vám porušenie ochrany osobných údajov podľa § 8 zmluvy
o spracúvaní osobných údajov. Toto je [prvé / doplňujúce] oznámenie.

Kedy sme sa o ňom dozvedeli: [dátum a čas]
Čo sa stalo: [dve až tri vety, bez technického žargónu]
Trvanie: [od – do, alebo „trvá"]
Dotknuté osoby: [kategórie a približný počet]
Dotknuté údaje: [kategórie a približný počet záznamov]
Pravdepodobné následky: [vecne, bez zľahčovania aj bez dramatizovania]
Čo sme spravili: [opatrenia, aj s časom]
Čo odporúčame Vám: [ak niečo]

Lehotu na ohlásenie dozornému orgánu podľa čl. 33 nariadenia má
prevádzkovateľ, teda Vaša organizácia. Na požiadanie Vám poskytneme
akékoľvek ďalšie informácie.

Kontakt: [meno], support@plawsports.com, [telefón]
```

**Čo v oznámení nikdy nesmie byť:** mená detí ani iné konkrétne osobné údaje.
Oznamuje sa **rozsah**, nie obsah.

---

## 5. Oznámenie Úradu (do 72 hodín) — len kde sme prevádzkovateľ

Týka sa **účtov a rodičovských kópií**, nie dát organizácií.

**Úrad na ochranu osobných údajov SR**, Hraničná 12, 820 07 Bratislava —
podanie cez jeho elektronický formulár.

**Neoznamuje sa, ak je nepravdepodobné, že incident povedie k riziku** pre práva
a slobody ľudí. To rozhodnutie **musíš zapísať aj s dôvodom** (krok 6) — to, že
sa neoznamuje, neznamená, že sa neeviduje.

Ak sa to nestihne do 72 hodín, oznámenie sa **aj tak podáva** a pripíše sa dôvod
omeškania.

---

## 6. Oznámenie ľuďom (len pri vysokom riziku)

Len keď incident pravdepodobne povedie k **vysokému** riziku. Píše sa
**jednoduchým jazykom**: čo sa stalo, čoho sa to týka, čo majú spraviť.

Netreba ho, ak boli údaje pre útočníka nečitateľné (napr. šifrované) alebo ak
sme riziko následne odvrátili.

---

## 7. Evidencia — vedie sa o KAŽDOM incidente

Aj o tom, ktorý sa nikomu neoznamoval. Vyžaduje to čl. 33 ods. 5 a §8.5 zmluvy.

Jeden súbor na incident v `docs/incidenty/RRRR-MM-DD-kratky-nazov.md`.
**Bez mien a bez osobných údajov** — evidencia incidentov nesmie byť ďalším
miestom, kde sa hromadia dáta o deťoch.

```markdown
# Incident RRRR-MM-DD — [krátky názov]

- **Zistené:** [dátum a čas] — [ako sa na to prišlo]
- **Trvanie:** [od – do]
- **Príčina:** [technicky, jednou vetou]
- **Rozsah:** [kategórie osôb a údajov, približné počty; ako sa odhadoval]
- **Následky:** [reálne, nie hypotetické]
- **Opatrenia:** [čo, kedy]
- **Oznámené:** organizácii [kedy / nie a prečo] · Úradu [kedy / nie a prečo] ·
  dotknutým osobám [kedy / nie a prečo]
- **Poučenie:** [čo sa zmenilo, aby sa to nezopakovalo]
```

---

## 8. Keď je po všetkom

1. **Odstráň príčinu**, nielen následok.
2. **Prilož k nej scenár** do `scripts/dev-tests/security-boundaries.js` — každý
   nález z oboch auditov skončil takto a preto sa žiadny nevrátil.
3. **Ak sa zmenili opatrenia, uprav prílohu C** zmluvy aj časť E záznamu
   o činnostiach. Rozchádzajú sa najľahšie práve po incidente.
4. **Povedz organizácii, čo sa zmenilo.** Je to jediná časť incidentu, ktorá
   dôveru buduje, nie búra.

---

## 9. Čo tento postup dnes nemá (a treba o tom vedieť)

- **Žiadny záznam o čítaní** — rozsah incidentu sa odhaduje, nemeria (krok 3).
- **Žiadne sledovanie ani upozornenia.** O probléme sa dozvieme od používateľa
  alebo náhodou. Appka nemá push notifikácie vôbec, takže neexistuje ani cesta,
  ktorou by nás niečo zobudilo.
- **Neoverené zálohy.** Produkcia beží na Free pláne a obnova sa nikdy neskúšala,
  takže na incident typu „strata dát" nie je pripravená odpoveď. To isté číslo
  chýba v §9.5 zmluvy (cyklus záloh).
- **Jeden človek.** Keď je nedostupný, 48-hodinovú lehotu nesplní nikto.
  **Pred prvým zväzom treba zástupcu** — aspoň druhý človek s prístupom
  a s podpísanou mlčanlivosťou (§4 zmluvy, príloha C).
