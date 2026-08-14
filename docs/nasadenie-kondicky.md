# Nasadenie kondičnej appky (`fitness.plawsports.com`)

Runbook pre Krok 3 kondičnej appky: **druhé nasadenie toho istého repa a tej
istej databázy, len s inou disciplínou.** Kód sa pritom nemení ani riadok —
všetko robí jedna premenná prostredia.

Rovnaký postup poslúži aj pri ďalšom športe (padel, bedminton), keď na to príde.

**Predpoklad:** migrácia `20260813090000_fitness_discipline.sql` je spustená na
produkcii a commity `a9617d8` + `eab1cee` sú na `master`. Oboje hotové 2026-08-13.

**Pozor na jazyk rozhraní:** Vercel je po anglicky, Websupport po slovensky.
Popisky nižšie sú v tom jazyku, v akom ich naozaj uvidíš.

---

## Krok 1 — nový projekt vo Verceli

Vercel dovolí importovať ten istý repozitár do viacerých projektov; tenisový
projekt sa tým nijako nedotkne.

1. `vercel.com` → **Add New…** → **Project**
2. V zozname repozitárov vyber **`romanhajdusik/tennis-coach-app`** → **Import**
3. **Project Name:** `plaw-fitness`
4. **Framework Preset** nechaj `Next.js` (deteguje sa sám), **Root Directory** `./`
5. Rozbaľ **Environment Variables** a pridaj **ešte pred prvým deployom**:

| Name | Value |
|---|---|
| `NEXT_PUBLIC_PLAW_DISCIPLINE` | `fitness` |
| `NEXT_PUBLIC_SUPABASE_URL` | to isté, čo má tenisový projekt |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | to isté, čo má tenisový projekt |
| `REGISTRATION_ENABLED` | nechaj **prázdne** (účty sa zakladajú ručne, viď Krok 4) |

**Prečo `NEXT_PUBLIC_`:** ponuku zameraní a trvaní potrebuje aj prehliadač.
Next ju vloží do balíka **pri builde**, takže po zmene tejto premennej treba
projekt **redeploynúť** — nestačí ju prepísať v nastaveniach.

**Google Calendar zatiaľ vynechaj** (`GOOGLE_*` premenné nepridávaj). Pripojenie
kalendára by aj tak zlyhalo, kým sa `https://fitness.plawsports.com/api/google/callback`
nepridá medzi *Authorized redirect URIs* v Google Cloud Console. Bez tých
premenných sa tlačidlo v `/settings` len nepodarí použiť — nič iné sa nerozbije.

6. **Deploy** a počkaj na zelené „Ready".

Zatiaľ appka beží na `plaw-fitness-*.vercel.app`. Otvor tú adresu: musí ťa
poslať rovno na **prihlásenie**, nie na tenisový marketing. To je kontrola, že
premenná zabrala.

---

## Krok 2 — doména

### 2a) Vo Verceli (tu sa doména len ohlási)

1. Projekt `plaw-fitness` → **Settings** → **Domains** → **Add**
2. Zadaj `fitness.plawsports.com` → **Add**
3. Vercel ukáže, čo treba v DNS. Bude to **CNAME**. **Skopíruj si tú hodnotu** —
   vyzerá ako `xxxxxxxxxxxx.vercel-dns-017.com`. Neopisuj ju z tohto dokumentu,
   Vercel ju môže zmeniť.

### 2b) Vo Websupporte (tu sa doména naozaj nastaví)

Zóna `plawsports.com` → `admin.websupport.sk/sk/dns/16117640/records` → **Pridať záznam**:

| Pole | Hodnota |
|---|---|
| Typ | `CNAME` |
| Názov | `fitness` |
| Cieľ / Hodnota | to, čo ukázal Vercel (`…vercel-dns-017.com`) |
| TTL | nechaj predvolené |

**Ničoho iného sa v tejto zóne nedotýkaj.** `MX`, `SPF`, `DKIM` ani `_dmarc` s
tým nemajú nič spoločné — pridávaš `CNAME`, pošta `plawsports.com` beží ďalej
nezmenene.

### 2c) Počkaj

Vo Verceli sa pri doméne objaví **Valid Configuration** a certifikát sa vystaví
sám (spravidla do pár minút). Kým sa tak nestane, adresa hlási chybu certifikátu
— to je normálne, nič nespravuj.

---

## Krok 3 — kontrola, že beží kondička a nie tenis

Otvor `https://fitness.plawsports.com` a over:

- [ ] odhlásený návštevník skončí na **prihlásení** (žiadna tenisová landing)
- [ ] `plaw.win` sa nezmenila — tenisový tréner má stále svoje zamerania

Zvyšok sa dá overiť až po prihlásení (Krok 5).

---

## Krok 4 — účet prvého kondičného trénera

Verejná registrácia je vypnutá, účty sa zakladajú ručne.

1. Supabase → projekt `tennis-coach-prod` → **Authentication** → **Users** →
   **Add user** → **Create new user**
2. E-mail, heslo, zaškrtni **Auto Confirm User**
3. V **SQL Editore** dorob profil (trigger založí riadok s rolou `coach` sám,
   ale meno nepozná a hladinu počtu hráčov má na 1):

```sql
update public.profiles
set full_name = 'Meno Priezvisko',
    -- kondičný tréner má z podstaty veci viac hráčov naraz
    player_limit = 20,
    -- bez tohto mu appka po 14 dňoch prestane dovoliť zapisovať
    subscription_status = 'complimentary'
where email = 'adresa@…';
```

`player_limit` a `subscription_status` sú obchodné rozhodnutia — cenník kondičky
zatiaľ neexistuje, takže prvý účet dostáva prístup zadarmo a hladinu, ktorá mu
nebude prekážať.

---

## Krok 5 — čo má kondičný tréner vidieť

Prihlás sa novým účtom na `fitness.plawsports.com`:

- [ ] `/drill-codes` ponúka **10 zameraní**: ENDURANCE, STRENGTH, SPEED,
      FOOTWORK, COORDINATION, MOBILITY, CORE MUSCLES, STRETCHING, YOUR 1, YOUR 2
- [ ] každé zameranie má **20 prázdnych slotov** (tenis má predvyplnené kódy,
      kondička nie — sloty si tréner pomenuje sám)
- [ ] pri zázname cvičenia **nie je pole charakteru** (offensive/neutral/defensive)
- [ ] ponuka trvania obsahuje aj **60 minút**
- [ ] v analytike je **len čas a %**, žiadny odhad úderov
- [ ] generálny graf sú **vodorovné stĺpce**, nie koláč

Presne toto overuje aj automatická sada — lokálne sa spúšťa takto:

```bash
NEXT_PUBLIC_PLAW_DISCIPLINE=fitness PORT=3001 npm run dev
DEV_PORT=3001 node scripts/dev-tests/fitness.js
```

**Pozor:** Next 16 nespustí druhý dev server v tom istom priečinku — tenisový
(port 3000) treba najprv zastaviť.

---

## Čo sa týmto NEROBÍ

- **Prepojenie s tenisovou appkou** (kondičné tréningy v tenisovom kalendári) je
  Krok 4 kondičnej roadmapy, nie súčasť nasadenia.
- **Kondička vo federácii** (`<slug>.plaw.win`) do v1 nejde — org subdomény sú
  tenisové a `copy_session_to_org_player` disciplínu neprenáša.
- **Marketing kondičky** neexistuje; `/` vedie rovno na prihlásenie. Keď raz
  vznikne, patrí k nemu aj vlastný názov v `manifest.ts` — dnes sa aj kondičná
  appka pridá na plochu ako „P.L.A.W".
