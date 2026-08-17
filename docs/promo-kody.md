# Promo kódy — registrácia na pozvánku a prístup zadarmo

Do 2026-08-16 bola registrácia zavretá jedinou premennou prostredia
(`REGISTRATION_ENABLED`) a účty trénerov sa zakladali ručne. Tester sa tak
k appke nedostal sám a prístup zadarmo mu musel niekto prepísať priamo
v databáze.

Od 2026-08-16 platí: **kto má kód, zaregistruje sa sám a rovno s prístupom
zadarmo.** Kto kód nemá, neprejde.

---

## 1. Čo kód robí

Kód robí dve veci naraz — je vstupenkou do registrácie **aj** určuje, čo účet
dostane:

| Stĺpec v `promo_codes` | Význam |
|---|---|
| `code` | samotný kód, malé/veľké písmená nerozhodujú |
| `free_days` | `365` = rok zadarmo; **prázdne (`null`) = doživotne** |
| `player_limit` | koľko hráčov smie mať tréner naraz aktívnych |
| `max_uses` / `used_count` | koľkokrát sa smie použiť a koľkokrát už bol |
| `expires_at` | dokedy sa dá uplatniť (prázdne = bez obmedzenia) |
| `note` | pre koho bol vydaný — len pre teba |

**Rok zadarmo je obyčajná skúšobná doba, len dlhšia.** Po jej uplynutí účet
prejde do čítania (história, analytika, kalendár ostávajú), nezapisuje.
**Tréner o svoje záznamy nepríde nikdy** — to je celý zmysel toho, že paywall
zastavuje zápis a nie prístup.

**Doživotne zadarmo** je stav `complimentary` — ten istý, aký dostali skorí
používatelia pri zavedení paywallu.

---

## 2. Ako vydať kód

Appka na to nemá obrazovku (rovnako ako sa nepredávajú sedadlá federácie) —
robí sa to jedným príkazom v **Supabase → SQL Editor**.

**Hromadný kód pre testerov, rok zadarmo, 10 použití:**

```sql
insert into promo_codes (code, free_days, player_limit, max_uses, note)
values ('TESTER2026', 365, 3, 10, 'testeri, jeseň 2026');
```

**Kód pre jedného človeka, doživotne:**

```sql
insert into promo_codes (code, free_days, player_limit, max_uses, note)
values ('JANKO-DOZIVOTNE', null, 1, 1, 'Janko Mrkvička, prvý tréner');
```

**`player_limit` rozmyslieť:** pri hodnote `1` tester nikdy neuvidí prepínač
hráčov, roster ani nástenku „Dnes" — tie sa zapínajú až od druhého hráča.
Pre testerov preto dáva zmysel `2`–`3`.

**Platnosť samotného kódu** (nie prístupu) sa dá obmedziť:

```sql
insert into promo_codes (code, free_days, max_uses, expires_at, note)
values ('JESEN2026', 365, 10, '2026-10-31', 'letáky na turnaji');
```

---

## 3. Ako zistiť, kto ho použil

```sql
select c.code, c.used_count, c.max_uses, p.email, r.redeemed_at
from promo_code_redemptions r
join promo_codes c on c.id = r.promo_code_id
join profiles p on p.id = r.user_id
order by r.redeemed_at desc;
```

Prehľad všetkých účtov a ich prístupu:

```sql
select email, subscription_status, trial_ends_at, player_limit
from profiles order by created_at;
```

**Predĺžiť alebo zmeniť prístup** sa dá kedykoľvek, kód s tým už nemá nič
spoločné:

```sql
update profiles set subscription_status = 'complimentary' where email = '…';
update profiles set trial_ends_at = now() + interval '365 days' where email = '…';
update profiles set player_limit = 3 where email = '…';
```

---

## 4. Prečo to uplatňuje databáza a nie appka

Appka **zámerne nedrží `service_role` kľúč** a do `profiles` nesmie zapisovať
vôbec — inak by si účet vedel sám nastaviť „zaplatené" (viď CLAUDE.md, sekcia
Skúšobná doba a predplatné).

Kód preto putuje v metadátach registrácie a uplatní ho trigger
`handle_new_user`, ktorý beží s právami databázy. **Metadáta si píše
prehliadač**, takže si tam ktokoľvek napíše, čo chce — rozhoduje výhradne
tabuľka. Vymyslený kód dá presne to isté, čo žiadny kód: 14 dní a jedného
hráča. Overuje to `scripts/dev-tests/promo-codes.js` §6.

**Kódy nesmie nikto čítať** — obe tabuľky sú bez policy a bez grantov, takže
sa k nim z appky nedostane ani prihlásený tréner. Keby ich vedel čítať,
prečítal by si nepoužité kódy.

**Kód sa míňa len trénerovi.** Registrácia rodiča/hráča/manažéra ho ignoruje —
tí nič neplatia, takže by inak ticho zožrali jedno použitie.

---

## 5. Registrácia je odteraz „na pozvánku"

- **`REGISTRATION_ENABLED=true`** vo Verceli → registrácia je otvorená pre
  všetkých, kód je nepovinný (kto ho má, dostane prístup zadarmo).
- **premenná prázdna** (dnešný stav, tenis aj kondička) → formulár si kód
  **vypýta** a bez platného kódu nikoho nepustí.

**Na subdoméne organizácie `/register` neexistuje** — presmeruje na `/join`.
Do federácie sa vstupuje pozývacím kódom od šéftrénera; kto by si tam založil
účet sám, vyrobil by si samostatného trénera bez členstva.

**Čo to NEzatvára:** kto vie pracovať s API, vie si aj tak cez verejný
Supabase endpoint založiť účet bez kódu — dostane obyčajných 14 dní a v appke
mu to nič nedá. Ak by to raz prekážalo, vypína sa to v dashboarde
(Authentication → Sign In / Providers → Email → *Allow new users to sign up*),
ale tým prestanú fungovať aj promo kódy a účty sa budú zakladať zase ručne.

---

## 6. Potvrdzovanie mailu

Zapína sa v dashboarde: **Authentication → Sign In / Providers → Email →
Confirm email**. Odkedy appka posiela maily cez Resend
([`obnova-hesla.md`](obnova-hesla.md) §2.3), to má zmysel — chráni to pred
účtami na vymyslené adresy a pred preklepom, na ktorý by tréner prišiel až
vtedy, keď mu nepríde obnova hesla.

**K tomu patrí aj šablóna** (Authentication → Emails → Templates → **Confirm
signup**), rovnako ako pri obnove hesla:

```html
<a href="{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=signup">Confirm your email</a>
```

Appka na to je pripravená: po registrácii ukáže obrazovku „skontroluj si mail"
(bez nej by to vyzeralo, že sa odoslaním formulára nič nestalo) a
`app/auth/confirm/route.ts` prijíma aj typ `signup`.

---

## 7. Poradie nasadenia (záväzné)

1. **Migráciu `20260816090000_promo_codes.sql` spusti v prod SQL Editore.**
2. Až potom **push** (Vercel nasadí sám).
3. V dashboarde zapni potvrdzovanie mailu a uprav šablónu *Confirm signup*.
4. Vlož prvý kód (bod 2).
5. Skús registráciu naostro na adresu, ktorá ešte účet nemá.

Opačné poradie znamená, že appka volá `promo_code_is_valid`, ktorá na
produkcii ešte neexistuje — registrácia by hlásila neplatný kód každému.
Rovnaké pravidlo ako pri paywalle a pri prepojení kariet.
