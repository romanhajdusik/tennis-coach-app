# Obnova zabudnutého hesla

Kto zabudne heslo, klikne na prihlásení „Forgot your password?", zadá e-mail,
príde mu odkaz a nastaví si nové. Do 2026-08-16 appka túto cestu **nemala vôbec**
— jediným riešením bola ručná zmena hesla v Supabase dashboarde.

---

## 1. Ako to funguje

| Krok | Kde to žije |
|---|---|
| 1. „Forgot your password?" na `/login` aj `/parent/login` | `app/login/page.tsx`, `app/parent/login/page.tsx` |
| 2. Formulár so zadaním e-mailu | `app/forgot-password/page.tsx` |
| 3. Odoslanie mailu | `requestPasswordReset` v `lib/actions/password-reset.ts` |
| 4. Pristátie po kliknutí na odkaz (výmena tokenu za session) | `app/auth/confirm/route.ts` |
| 5. Nastavenie nového hesla | `app/reset-password/page.tsx` + `updatePassword` |

Žiadna migrácia, žiadna zmena schémy — celé to stojí na Supabase Auth.

**Tri rozhodnutia, ktoré z kódu nevyčítaš:**

1. **Odpoveď na žiadosť je vždy rovnaká**, aj keď taký účet neexistuje alebo
   odoslanie zlyhá. Inak by z tej stránky bol overovač adries: ktokoľvek by si
   vedel vyskúšať, či daný človek appku používa. Skutočné zlyhanie ide do
   serverového logu.
2. **Jedna stránka pre trénera aj pre rodiča/hráča.** Po prihlásení ich `/`
   rozdelí podľa roly, takže dve verzie by nič nepridali.
3. **Cieľ odkazu sa skladá z hlavičky `Host`** (`lib/request-origin.ts`), nie
   z natvrdo zapísanej adresy. Appka beží na viacerých hostoch nad jedným
   Supabase Auth a cookies sú host-only — federačného trénera by pevná adresa
   vyhodila z jeho subdomény aj zo session.

---

## 2. ČO TREBA NASTAVIŤ NA PRODUKCII (bez toho to nefunguje)

### 2.1 Zoznam povolených adries — povinné

Supabase **ticho zahodí** cieľ presmerovania, ktorý nie je na jeho zozname, a do
mailu dá namiesto neho `Site URL`. Odkaz potom vedie na úvodnú stránku, obnova
hesla sa nestane a **nikde sa nezobrazí žiadna chyba** — appka je pritom
v poriadku. (Overené lokálne: presne toto sa stalo, kým sa zoznam nedoplnil.)

Dashboard projektu `pwnmssfyfrkmugnxprjj` → **Authentication → URL Configuration
→ Redirect URLs**, pridať:

```
https://plaw.win/**
https://www.plaw.win/**
https://*.plaw.win/**
https://fitness.plawsports.com/**
```

`Site URL` ostáva `https://plaw.win` (slúži už len ako záchranná adresa).

Lokálny ekvivalent je `additional_redirect_urls` v `supabase/config.toml` —
**produkciu neriadi**, tá sa nastavuje výhradne v dashboarde.

### 2.2 Odkaz otvorený na inom zariadení — voliteľné, ale odporúčané

S predvolenou šablónou mailu funguje odkaz len v **tom istom prehliadači**, ktorý
o obnovu požiadal (kód sa páruje s cookie uloženou pri žiadosti). Kto požiada na
notebooku a mail otvorí na telefóne, uvidí „This link no longer works".

Odstráni sa to prepísaním šablóny: **Authentication → Email Templates → Reset
Password**, odkaz zmeniť na

```html
<a href="{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=recovery">Reset password</a>
```

`app/auth/confirm/route.ts` obe podoby odkazu zvláda, takže sa dá prepnúť
kedykoľvek a nič sa nemusí meniť v kóde. **`{{ .SiteURL }}` tam nedávaj** —
je to jedna adresa a rozbila by ostatné hosty.

### 2.3 Kto mail posiela — vlastné SMTP cez Resend

**Vstavaný mailer Supabase na prevádzku nestačí:**

- je určený na **testovanie** a na novších projektoch býva obmedzený len na
  adresy členov tímu — **tréner by mail vôbec nedostal a nikto by sa to
  nedozvedel**, kým sa neozve, že mu nič neprišlo,
- **prísny hodinový limit** (Authentication → Rate Limits),
- odosielateľ **nie je naša doména** → vyššia šanca na spam.

**Toto je nastavenie, nie zmena kódu.** Appka posiela mail cez Supabase Auth
rovnako v oboch prípadoch, takže sa dá prepnúť kedykoľvek — pred aj po nasadení.

#### Prečo odosielacia SUBDOMÉNA a nie `plawsports.com`

Overiť sa dá aj hlavná doména, ale znamenalo by to siahnuť na jej `SPF` záznam,
cez ktorý chodí firemná pošta z Workspace. Odosielacia subdoména má vlastný SPF
aj DKIM, takže **prípadný problém s doručovaním appkových mailov nepoškodí
reputáciu firemnej pošty** — presne tak to určuje aj
[`domeny-a-email.md`](domeny-a-email.md) §8. Cena: odosielateľ je
`noreply@mail.plawsports.com`, nie `noreply@plawsports.com` (Resend dovolí
posielať len z domény, ktorú si overil).

#### Postup

1. **Účet na [resend.com](https://resend.com)** — zadarmo 3 000 mailov mesačne
   (100 denne). Na obnovu hesla to stačí s veľkou rezervou.
2. **Domains → Add Domain → `mail.plawsports.com`**, región vyber európsky
   (produkčná Supabase beží vo Frankfurte).
3. Resend vypíše **DNS záznamy** (MX + SPF `TXT` + DKIM `TXT`). **Presné hodnoty
   ber z jeho obrazovky**, sem sa neopisujú — menia sa.
4. **Websupport → zóna `plawsports.com`** → pridať tie záznamy.
   **NESIAHAJ na existujúce `MX` a `TXT` hlavnej domény** — tie patria Google
   Workspace a bez nich prestane chodiť firemná pošta. Všetky Resend záznamy
   sedia na subdoméne (`...mail.plawsports.com`), takže sa s ňou nestretnú.
5. Počkať na **„Verified"** v Resende (typicky minúty, pri Websupporte pokojne
   aj hodinu).
6. **Resend → API Keys → Create** (právo len na odosielanie). Kľúč sa ukáže
   **raz** — hneď ho ulož.
7. **Supabase dashboard** (projekt `pwnmssfyfrkmugnxprjj`) → **Project Settings
   → Authentication → SMTP Settings → Enable Custom SMTP**:
   - host `smtp.resend.com`, port `587`
   - user `resend`, heslo = **API kľúč z kroku 6**
   - sender email `noreply@mail.plawsports.com`, sender name `P.L.A.W`
8. Tamtiež **Authentication → Rate Limits** — hodinový limit mailov sa dá teraz
   zdvihnúť, vstavané obmedzenie už neplatí.
9. **Skúška naostro:** na `plaw.win/forgot-password` si vyžiadaj obnovu na
   adresu, ktorá **nie je** členom Supabase tímu (napr. súkromný Gmail), a over,
   že mail príde a odkaz otvorí nastavenie hesla.

Ak sa niekedy bude posielať aj potvrdenie registrácie alebo Stripe maily, pôjdu
tou istou cestou — nič ďalšie sa nastavovať nebude.

---

## 3. Lokálne overenie

Lokálna Supabase maily neposiela von — chytá ich schránka na
`http://127.0.0.1:54324` (`local_smtp` v `supabase/config.toml`).

```bash
node scripts/dev-tests/password-reset.js   # 24 kontrol, vrátane celej cesty mail → odkaz → formulár
node scripts/dev-tests/browser-coach.js    # §12 doklikne aj samotnú zmenu hesla
```

`password-reset.js` overuje aj to, že **odkaz v maili naozaj vedie na
`/auth/confirm`**, nie na východziu adresu — teda presne pascu z bodu 2.1.
Samotnú zmenu hesla HTTP sada overiť nevie (je to server action), preto je
v klikacej sade `browser-coach.js` §12, ktorá si na koniec skúsi novým heslom
prihlásiť a heslo potom vráti späť.

---

## 4. Čo sa tým NErieši

- **Potvrdzovanie registrácie mailom** ostáva vypnuté (`enable_confirmations`).
  Zapnúť sa dá až s vlastným SMTP, inak si nový tréner účet nepotvrdí.
- **Zmena e-mailu** účtu appka stále nemá.
- **Odhlásenie ostatných zariadení** po zmene hesla appka nerieši — Supabase
  ostatné session neruší.
