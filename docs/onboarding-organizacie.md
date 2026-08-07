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

Šéftréner si najprv **sám vytvorí účet** na `<slug>.plaw.win/register` (appka
heslá nenastavuje za neho). Potom mu priradíš rolu:

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

**Trénerov už nezakladáš** — šéftréner si ich pozve sám kódmi na
`/director/team`, oni ho zadajú na `/join`. To je celý onboarding trénera.

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
4. Tréner s kódom → `/join` → po pripojení vidí trénerskú appku.

## Pasce (overené, nie teoretické)

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
