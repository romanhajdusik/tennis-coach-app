# Onboarding organizácie (federácia / klub / akadémia)

Postup, ako naostro spustiť novú B2B organizáciu na `<slug>.plaw.win`. Je to
**ručný administrátorský úkon**, nie samoobsluha — organizácií je málo
a onboardujú sa zámerne (§5.2 v [`roadmap-buduce-smery.md`](roadmap-buduce-smery.md)).

**Sedadlá sa v appke nekupujú.** Predplatné rieši faktúra mimo aplikácie
(rozhodnuté 2026-08-07); appka počet sedadiel len **vynucuje** (trigger
`enforce_membership_rules` pri pripojení trénera) a **zobrazuje**
(`/director/team`). Predaj ďalších sedadiel je preto jeden `UPDATE` nižšie.

Všetko SQL v tomto dokumente je overené proti lokálnej inštancii; na produkcii
sa púšťa cez **Supabase SQL Editor** projektu `tennis-coach-prod` (projekt nie
je linknutý cez CLI, `db push` tu nefunguje).

---

## Krok 0 — podpísané zmluvy

**Bez podpísaných zmlúv sa organizácia nezakladá.** Podpisujú sa **dve a spolu**:

- **hlavná zmluva** o poskytovaní služby ([zmluva-organizacia.md](zmluva-organizacia.md))
  — sedadlá, cena, trvanie, zodpovednosť;
- **zmluva o spracúvaní osobných údajov** podľa čl. 28 GDPR
  ([gdpr-zmluva-cl28.md](gdpr-zmluva-cl28.md)) — čo sa smie robiť s údajmi.

Druhá sa na prvú odvoláva na šiestich miestach, takže samostatne nedáva zmysel.
Podpísané musia byť **skôr, než zväz zapíše prvého hráča** — inak spracúvajú obe
strany bez právneho podkladu (§1.2 zmluvy o spracúvaní).

Do zmlúv sa pred podpisom dopĺňa objednávka (príloha 1 hlavnej zmluvy: slug,
disciplíny, sedadlá, cena, kontakty), kontakt na oznámenie incidentu (príloha A)
a cyklus záloh s počtom osôb s prístupom (§9.5 a príloha C).
**Úplný kontrolný zoznam pred prvým zväzom — vrátane prevádzkových vecí ako
zástupca, Vercel Pro a zmluvy s poddodávateľmi — je v
[pred-prvym-zvazom.md](pred-prvym-zvazom.md).**

**Výnimka je len testovací tím s vymyslenými menami** — tam sa žiadne osobné údaje
nespracúvajú.

---

## Krok 1 — subdoména vo Verceli

Vercel → projekt `tennis-coach-app` → Settings → Domains → **Add**
`<slug>.plaw.win`. Vercel ukáže, aký CNAME záznam očakáva.

## Krok 2 — DNS na Websupporte

Zóna `plaw.win` (`admin.websupport.sk/sk/dns/15904763`) → nový **CNAME**:

| Typ | Názov | Hodnota |
|---|---|---|
| CNAME | `<slug>` | hodnota z Vercelu, dnes `044898b4a673cb8d.vercel-dns-017.com.` |

**Hodnotu vždy odčítaj z Vercelu** („View DNS configuration"), môže sa zmeniť.
Wildcard zámerne nepoužívame — inak by sa museli presunúť nameservery plaw.win
na Vercel a prišli by sme o MX/mail na doméne.

## Krok 3 — HTTPS

Vercel vystaví certifikát sám. Počkaj, kým doména ukáže **Valid Configuration**.
Dovtedy subdoména nefunguje a kroky nižšie sa nedajú overiť.

## Krok 4 — organizácia v databáze

Kým riadok v `organizations` neexistuje, subdoména skončí presmerovaním na
`plaw.win` (neznámy slug) — appka sa dovtedy správa presne ako doteraz.

```sql
insert into public.organizations (name, slug, type, sport, seat_limit, subscription_status)
values ('Názov federácie', 'slug', 'federation', 'tennis', 10, 'active')
returning id, slug, seat_limit;
```

- `slug` **musí sedieť so subdoménou** a spĺňať `^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$`
  — malé písmená, číslice, pomlčky. Veľké písmeno zhodí `organizations_slug_check`.
- `type`: `federation` / `club` / `academy`. `sport`: zatiaľ vždy `tennis`.
- `seat_limit` = počet **trénerských** licencií podľa zmluvy (šéftréner sedadlo neberie).

## Krok 5 — šéftréner

Šéftréner si najprv **sám vytvorí účet na hlavnej adrese `plaw.win/register`**
(appka heslá nenastavuje za neho). **Na `<slug>.plaw.win/register` to nejde** —
`proxy.ts` tam registráciu presmeruje 307 na `/join`, lebo do federácie sa
nevstupuje samoobslužne. Účet teda vzniká na hlavnej adrese a k organizácii sa
pripojí až potom.

Vo formulári potrebuje:

- **promo kód od nás** — kým beží registrácia na pozvánku (`REGISTRATION_ENABLED`
  nie je `"true"`), formulár bez platného kódu nikoho nepustí (viď
  [Dva kódy na každého trénera](#dva-kódy-na-každého-trénera));
- **rolu `Coach`** — je predvolená, len ju nesmie zmeniť. S inou rolou ho `/`
  pošle na `/parent` skôr, než sa appka opýta na členstvo, a k pultu sa
  nedostane.

**Na `plaw.win` po registrácii nič nezakladá** — hráč založený tam je osobný
a SQL nižšie potom spadne na `has_personal_data`.

Keď ti pošle e-mail, ktorý použil, priradíš mu rolu:

```sql
insert into public.organization_members (organization_id, user_id, role, status)
select o.id, u.id, 'director', 'active'
from public.organizations o
cross join auth.users u
where o.slug = 'slug' and u.email = 'sefTrener@federacia.sk'
returning role, status;
```

Priamy zápis `user_id` je povolený **len tu**: trigger ho zamieta, keď ho robí
prihlásený používateľ (členstvo je dobrovoľné, §5.7), ale v SQL Editore je
`auth.uid()` prázdne, takže administrátorský bootstrap prejde.

Potom sa šéftréner **prihlási na `<slug>.plaw.win`** a pristane rovno na
`/director`. Je to druhé prihlásenie — cookies sú host-only, takže sa
prihlásenie z `plaw.win` na subdoménu neprenáša.

**Trénerov už nezakladáš** — šéftréner si ich pozve kódmi na `/director/team`.
Tréner si účet založí rovnako ako šéftréner, na `plaw.win/register` s promo
kódom a s rolou `Coach`, potom sa prihlási na subdoméne a pozývací kód zadá na
`/join`. To je celý onboarding trénera.

### Dva kódy na každého trénera

Kým je registrácia na pozvánku, potrebuje každý federačný tréner **dva rôzne
kódy**. Povedz to zväzu vopred, inak si ich tréneri pomýlia:

| Kód | Kto ho vydá | Na čo slúži | Kde sa zadáva |
|---|---|---|---|
| promo kód | my, SQL podľa [promo-kody.md](promo-kody.md) | založenie účtu | `plaw.win/register` |
| pozývací kód | šéftréner na `/director/team` | pripojenie k organizácii | `<slug>.plaw.win/join` |

Pre zväz stačí **jeden hromadný promo kód s `max_uses` = počet sedadiel + 1**.
Tá jednotka navyše je šéftréner: registruje sa s rolou `Coach` a kód sa míňa
každému takému účtu, teda aj jemu. Ak šéftréner aj trénuje, jeho druhý účet
obsadí sedadlo, takže je už v počte sedadiel.

```sql
insert into promo_codes (code, free_days, player_limit, max_uses, note)
values ('SLUG-2026', 14, 1, 11, 'zväz slug, 10 sedadiel + šéftréner');
```

**`free_days` a `player_limit` členovi zväzu nič nedávajú** — členstvo prebíja
predplatné aj cenovú hladinu (`lib/subscription.ts`). Prejavia sa, až keď
tréner zo zväzu odíde a jeho účet sa stane samostatným. **Odporúčanie: `14`
a `1`**, teda presne to, čo dá registrácia bez kódu. Kód je tu len vstupenka
a odchod zo zväzu nemá byť cestou k samostatnej appke zadarmo. Vedľajší účinok:
po uplynutí tých 14 dní si odobratý tréner osobného hráča nezaloží, takže ho
šéftréner vie vždy vrátiť späť (inak by návrat zablokovalo
`has_personal_data`). Hodnotu `0` databáza neprijme — `free_days` musí byť
kladné alebo prázdne.

**Po otvorení verejnej registrácie (`REGISTRATION_ENABLED=true`) promo kód
odpadá** a ostáva len pozývací kód od šéftrénera.

---

## Predaj ďalších sedadiel

```sql
update public.organizations set seat_limit = 15 where slug = 'slug'
returning slug, seat_limit;
```

Prejaví sa okamžite — `/director/team` ukáže nový limit a ďalší tréner sa vie
pripojiť.

## Stav predplatného

`organizations.subscription_status` (`trial` / `active` / čokoľvek si zavedieš)
je dnes **len administratívna evidencia — appka ho nikde nečíta a nič podľa neho
neblokuje.** Neplatiaca federácia teda appku ďalej používa; riešenie je faktúra,
prípadne odobratie prístupu ručne. Keby sa to malo raz vynucovať, je to vedomá
zmena (a treba rozhodnúť, či organizáciu prepnúť do read-only, alebo zamknúť
úplne — zamknúť federáciu uprostred sezóny je tvrdé).

---

## Overenie na záver

1. `https://<slug>.plaw.win/` → prihlásenie (org subdoména nemá marketingovú landing).
2. Šéftréner sa prihlási → má pristáť rovno na `/director`.
3. `/director/team` → sedí počet sedadiel, dá sa vytvoriť pozývací kód.
4. Tréner s účtom z `plaw.win/register` sa prihlási na subdoméne → `/join` →
   zadá pozývací kód → po pripojení vidí trénerskú appku.

## Pasce (overené, nie teoretické)

- **Na subdoméne organizácie sa účet založiť nedá** — `/register` tam vedie
  307 na `/join`, a to aj pre šéftrénera. Účet vždy vzniká na `plaw.win/register`.

- **Účet s osobnými hráčmi sa členom stať nemôže** — insert spadne na
  `has_personal_data`. Kto appku používal ako samostatný tréner, potrebuje na
  federáciu druhý účet/e-mail (§5.8, účet je buď nezávislý, alebo zamestnanec).
- **Zníženie `seat_limit` pod počet aktívnych trénerov prejde bez chyby** a nikoho
  nevyhodí — zablokujú sa len ďalšie pripojenia. Kto má odísť, sa odoberá
  na `/director/team`.
- **Organizácia sa nedá zmazať, kým má dáta** (`players_organization_id_fkey`,
  `on delete restrict`) — zámerne: zmazanie org nesmie ticho zmazať históriu
  federácie. Najprv sa musia vyriešiť dáta.
- **Odobratie trénera nemaže jeho hráčov** — ostávajú organizácii a v pulte sa
  objavia pod „No longer in the organization", kým ich šéftréner nepridelí
  inému trénerovi (`assign_player_to_coach`).
