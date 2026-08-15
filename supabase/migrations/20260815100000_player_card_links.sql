-- =============================================================================
-- Krok 4 — prepojenie KARIET hráčov + živý read-only cross-read
-- =============================================================================
-- Návrh: docs/roadmap-buduce-smery.md §2.0 (krok 4) a rozhodnutia z 2026-08-10.
--
-- Čo to rieši: Adam chodí na kurt k Petrovi a na kondíciu k Jane. Sú to dva
-- samostatné účty na dvoch doménach (`plaw.win`, `fitness.plawsports.com`),
-- takže Adam je u každého z nich INÁ KARTA. Prepojenie hovorí „sú to tí istí"
-- a dá tenisovému trénerovi vidieť do kondičnej prípravy svojho zverenca.
--
-- TRI VECI, KTORÉ TENTO MODEL DRŽIA:
--
-- 1. **Prepája sa KARTA, nie účet.** Hráč nepotrebuje účet (na rozdiel od
--    rodičovského zdieľania, kde kód claimuje rodič) — claimuje ho DRUHÝ
--    TRÉNER. Rieši to aj nesúlad počtu hráčov: kód je viazaný na kartu, takže
--    kondičný tréner s dvadsiatimi hráčmi vydá dvadsať kódov a tenisový vidí
--    len to svoje dieťa.
--
-- 2. **Kód vydáva VLASTNÍK DÁT** — kondičný tréner. Rovnaký smer ako pri
--    rodičovi: kód dáva ten, komu dáta patria, zadáva ten, kto ich chce vidieť.
--
-- 3. **Živý pohľad cez RLS, NIE kópie ako pri rodičovi** (`parent_session_records`).
--    Rozdiel je zámerný a je v ňom celý zmysel: rodičovi má história ostať aj
--    po ukončení spolupráce (je to záznam o jeho dieťati), kým tenisovému
--    trénerovi má po zrušení prepojenia zmiznúť — nie sú to jeho dáta, len mu
--    ich niekto dočasne ukazoval.
--
-- VO FEDERÁCII SA ŽIADNY KÓD NEVYDÁVA. Tam dáta vlastní zväz a dvaja jeho
-- zamestnanci si navzájom povolenia na cudzie dáta vydávať nemajú — hráča
-- obom prideľuje šéftréner (`player_assignments`, migrácia `20260815090000`).
-- Cross-read je tam preto len uvoľnenie SELECT policy podľa priradenia (časť E)
-- a prepojenie kariet sa org účtom v DB priamo zakazuje.
--
-- ROZSAH ČÍTANIA (rozhodol user 2026-08-15): tenisový tréner vidí CELÝ detail
-- kondičného tréningu vrátane cvičení a poznámky, plánované aj dokončené.
-- Preto sa uvoľňuje aj `session_drills`, nielen `sessions`.
-- =============================================================================


-- ---------------------------------------------------------------------------
-- A. player_links — dve karty toho istého človeka
-- ---------------------------------------------------------------------------
-- Zdroj (`source_*`) je vlastník dát, ktorý kód vydal; cieľ (`target_*`) je
-- tréner, ktorý ho zadal a odteraz do tých dát vidí. Kým kód nikto nezadá, sú
-- cieľové stĺpce prázdne — presne ako `parent_id` v `player_connections`,
-- odkiaľ je celý vzor prevzatý.
create table public.player_links (
  id uuid primary key default gen_random_uuid(),
  source_player_id uuid not null references public.players (id) on delete cascade,
  source_coach_id uuid not null references auth.users (id) on delete cascade,
  -- Disciplína VYDÁVAJÚCEHO v čase vydania kódu. Karta sama disciplínu nemá
  -- (a mať nesmie — kondičný tréner má v jednom rosteri tenistu aj
  -- bedmintonistu), takže sa berie z jeho nasadenia. Slúži UI na pomenovanie
  -- cudzieho tréningu a claimu ako poistka proti omylu, NIE ako hranica
  -- prístupu — tou je vlastníctvo karty a samotný kód.
  source_discipline text not null check (source_discipline in ('tennis', 'fitness')),
  target_player_id uuid references public.players (id) on delete cascade,
  target_coach_id uuid references auth.users (id) on delete cascade,
  link_code text not null unique,
  status text not null default 'pending' check (status in ('pending', 'active', 'revoked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.player_links is
  'Prepojenie dvoch kariet toho istého hráča naprieč disciplínami (docs/roadmap-buduce-smery.md §2.0, krok 4). Kód vydáva vlastník dát, zadáva ho druhý tréner. Dáva ŽIVÝ read-only pohľad cez RLS, nie kópie ako parent_session_records — po zrušení prepojenia má cudzí tréningy prestať vidieť.';

-- Jedna karta = najviac jedno aktívne prepojenie na každej strane. Bez toho by
-- kondičná karta mohla svietiť dvom tenisovým trénerom naraz a tenisový
-- kalendár by miešal dva kondičné zdroje.
create unique index player_links_one_active_source
  on public.player_links (source_player_id) where status = 'active';

create unique index player_links_one_active_target
  on public.player_links (target_player_id) where status = 'active';

-- Podľa nich sa pýtajú obe RLS funkcie nižšie (pri každom rendri kalendára).
create index player_links_target_coach_idx
  on public.player_links (target_coach_id) where status = 'active';

alter table public.player_links enable row level security;

create trigger player_links_set_updated_at
  before update on public.player_links
  for each row execute function public.set_updated_at();

-- Zámerne BEZ `update` a `delete`: obe zmeny stavu robia `security definer`
-- funkcie nižšie. Dôvod je ten istý, pre ktorý `assign_player_to_coach` nie je
-- obyčajná policy — **policy na UPDATE nevie obmedziť, KTORÝ stĺpec sa mení**
-- (v jednej policy sa nedá porovnať starý a nový riadok), takže „cieľ smie
-- zrušiť svoje prepojenie" by mu zároveň dovolilo prepísať `source_player_id`
-- na cudziu kartu a začať ju čítať.
grant select, insert on public.player_links to authenticated;
grant select, insert, update, delete on public.player_links to service_role;

-- Vydanie kódu: len na VLASTNÚ OSOBNÚ kartu a len ako nezaklaimovaný riadok.
-- `owns_personal_player` (z `20260807120000`) drží oboje naraz — vlastníctvo aj
-- to, že karta nepatrí organizácii. Bez podmienok na cieľové stĺpce by si
-- tréner vedel vložiť rovno aktívne prepojenie a obísť tým súhlas druhej
-- strany.
create policy "player_links_insert_own_source"
  on public.player_links for insert
  with check (
    source_coach_id = auth.uid()
    and public.owns_personal_player(source_player_id)
    and target_player_id is null
    and target_coach_id is null
    and status = 'pending'
    and (select public.current_org_id()) is null
  );

-- Vidieť ho majú obaja: vydávajúci (aby vedel, či už bol kód zadaný) aj ten,
-- kto ho zadal (appka z toho riadku zisťuje, ktorú cudziu kartu má čítať).
create policy "player_links_select_own_side"
  on public.player_links for select
  using (
    source_coach_id = auth.uid()
    or target_coach_id = auth.uid()
  );


-- ---------------------------------------------------------------------------
-- B. Pomocné funkcie pre RLS
-- ---------------------------------------------------------------------------
-- `security definer` je tu nutnosť, nie pohodlie: policy nad `sessions` sa
-- pýta na `player_links` a tá má vlastnú RLS, takže priamy poddotaz by videl
-- len riadky, ktoré volajúcemu prejdú cez policy — a hlavne by pri cudzej
-- karte skončil pri `players`, kde platia ďalšie policy. Rovnaký dôvod ako pri
-- `owns_personal_player` a `current_org_id`.
--
-- Nič nevyzrádzajú: vracajú boolean o karte, ktorú volajúcemu aj tak niekto
-- dobrovoľne sprístupnil kódom.
create function public.reads_linked_player(p_player_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.player_links pl
    where pl.source_player_id = p_player_id
      and pl.target_coach_id = auth.uid()
      and pl.status = 'active'
  );
$$;

revoke all on function public.reads_linked_player(uuid) from public;
grant execute on function public.reads_linked_player(uuid) to authenticated;

-- Cvičenia nemajú `player_id`, len `session_id` — a `session_drills` policy sa
-- preto musí spýtať cez tréning. Cez funkciu (nie poddotazom v policy), aby to
-- nešlo cez RLS `sessions`: tá by pri cudzom tréningu sama volala
-- `reads_linked_player` a vznikla by zbytočná dvojitá kontrola pri každom
-- riadku cvičenia.
create function public.reads_linked_session(p_session_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.sessions s
    join public.player_links pl on pl.source_player_id = s.player_id
    where s.id = p_session_id
      and pl.target_coach_id = auth.uid()
      and pl.status = 'active'
  );
$$;

revoke all on function public.reads_linked_session(uuid) from public;
grant execute on function public.reads_linked_session(uuid) to authenticated;


-- ---------------------------------------------------------------------------
-- C. claim_player_link — druhý tréner zadá kód
-- ---------------------------------------------------------------------------
-- Vzor aj dôvody prevzaté z `claim_player_connection`: funkcia musí nájsť
-- `pending` riadok, na ktorý volajúci ešte nemá RLS prístup, a spraviť to
-- atomicky s odpojením predošlého prepojenia tej istej karty.
--
-- **Prihlásenie sa overuje ako prvé** (`not_authenticated`) — poučenie
-- z `20260809090000`: PostgREST vystavuje RPC aj priamo, a tam je `auth.uid()`
-- NULL. Bez tejto kontroly by neprihlásený minul cudzí kód.
create function public.claim_player_link(
  p_code text,
  p_player_id uuid,
  p_discipline text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_link public.player_links%rowtype;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  -- Vo federácii sa prepojenia kódom nevydávajú ani nezadávajú — hráča obom
  -- trénerom prideľuje šéftréner (časť E). Kontrola je tu, nie len v appke:
  -- org tréner má na RPC grant ako každý prihlásený.
  if (select public.current_org_id()) is not null then
    raise exception 'not_supported_in_organization';
  end if;

  -- Cieľom smie byť len vlastná osobná karta volajúceho. `owns_personal_player`
  -- overuje vlastníctvo aj to, že karta nepatrí organizácii.
  if not public.owns_personal_player(p_player_id) then
    raise exception 'not_your_player';
  end if;

  select * into v_link
  from public.player_links
  where link_code = p_code and status = 'pending'
  for update;

  if not found then
    raise exception 'invalid_code';
  end if;

  if v_link.source_player_id = p_player_id then
    raise exception 'same_player';
  end if;

  -- Poistka proti OMYLU, nie bezpečnostná hranica (disciplínu posiela appka
  -- zo svojho nasadenia). Prepojiť dve tenisové karty nedáva zmysel: kalendár
  -- by ukázal druhý rad tenisových tréningov ako „cudziu disciplínu".
  if v_link.source_discipline = p_discipline then
    raise exception 'same_discipline';
  end if;

  -- Zdrojová karta musí byť stále osobná. Medzi vydaním kódu a jeho zadaním
  -- mohol vydávajúci vstúpiť do federácie — vtedy jeho dáta už patria zväzu.
  if not exists (
    select 1 from public.players p
    where p.id = v_link.source_player_id and p.organization_id is null
  ) then
    raise exception 'invalid_code';
  end if;

  -- Nový kód nahrádza staré prepojenie tej istej karty — rovnaké pravidlo ako
  -- `one_active_connection_per_parent` pri rodičovi. Bez tohto kroku by
  -- čiastočný unikát z časti A zápis rovno odmietol a tréner by nevedel prečo.
  update public.player_links
  set status = 'revoked'
  where target_player_id = p_player_id and status = 'active';

  update public.player_links
  set target_player_id = p_player_id,
      target_coach_id = auth.uid(),
      status = 'active'
  where id = v_link.id;

  return v_link.source_player_id;
end;
$$;

revoke all on function public.claim_player_link(text, uuid, text) from public;
grant execute on function public.claim_player_link(text, uuid, text) to authenticated;


-- ---------------------------------------------------------------------------
-- D. revoke_player_link — zrušiť smú OBAJA
-- ---------------------------------------------------------------------------
-- Vydávajúci preto, že sú to jeho dáta; ten, kto kód zadal, preto, že cudzie
-- tréningy v kalendári sú jeho obrazovka. Funkcia mení výhradne `status`,
-- takže odpadá riziko z časti A (prepísanie `source_player_id` cez UPDATE
-- policy). Ruší aj nezaklaimovaný `pending` kód — tým sa dá kód „prehodiť",
-- keď sa pošle nesprávnemu človeku.
create function public.revoke_player_link(p_link_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_link public.player_links%rowtype;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  select * into v_link
  from public.player_links
  where id = p_link_id
  for update;

  if not found then
    raise exception 'link_not_found';
  end if;

  if v_link.source_coach_id <> auth.uid()
     and coalesce(v_link.target_coach_id, '00000000-0000-0000-0000-000000000000'::uuid) <> auth.uid() then
    raise exception 'not_your_link';
  end if;

  update public.player_links
  set status = 'revoked'
  where id = p_link_id;
end;
$$;

revoke all on function public.revoke_player_link(uuid) from public;
grant execute on function public.revoke_player_link(uuid) to authenticated;


-- ---------------------------------------------------------------------------
-- E. Cross-read — samostatný režim (prepojenie kódom)
-- ---------------------------------------------------------------------------
-- Prísne SELECT-only a prísne aditívne: zapisovacie policy sa nedotýkajú, takže
-- cudzí tréning sa nedá upraviť, dokončiť ani zrušiť. Podmienka
-- `current_org_id() is null` drží pravidlo „účet je buď nezávislý, alebo
-- zamestnanec" rovnako ako ostatné osobné policy.
--
-- **`players` sa NEUVOĽŇUJE a je to zámer.** Cudzia karta sa nesmie dostať do
-- rosteru, do prepínača hráčov ani do `getSelectedPlayer()` — appka by potom
-- ponúkala „vybrať" hráča, ktorému nesmie nič zapísať. Je to presne tá chyba,
-- ktorej sme sa vyhli pri skupinovom tréningu vo federácii (`org_players_for_copy`
-- namiesto rozšírenia `players_org_select`). Meno hráča appka ani nepotrebuje —
-- má vlastnú kartu toho istého dieťaťa.
create policy "sessions_linked_select"
  on public.sessions for select
  using (
    organization_id is null
    and (select public.current_org_id()) is null
    and public.reads_linked_player(player_id)
  );

create policy "session_drills_linked_select"
  on public.session_drills for select
  using (
    organization_id is null
    and (select public.current_org_id()) is null
    and public.reads_linked_session(session_id)
  );


-- ---------------------------------------------------------------------------
-- F. Cross-read — federačný režim (prepojenie priradením)
-- ---------------------------------------------------------------------------
-- Tu netreba nič vydávať ani claimovať: keď má Adam tenisové aj kondičné
-- priradenie, obaja tréneri sú „jeho" a hráč je jedna karta. Stačí prestať
-- obmedzovať SELECT na vlastné `coach_id`.
--
-- Ruší sa tým rozsah v1 z `20260815090000` („tréner vidí len svoju disciplínu"),
-- čo bolo vedomé dočasné obmedzenie práve do tohto kroku.
--
-- Zápis sa NEMENÍ: `sessions_org_coach_insert`/`update` naďalej žiadajú
-- `coach_id = auth.uid()` a `discipline = current_org_discipline()`, takže
-- kondičný tréning ostáva neupraviteľný pre tenisového trénera aj potom, ako ho
-- začal vidieť.
drop policy "sessions_org_select" on public.sessions;

create policy "sessions_org_select"
  on public.sessions for select
  using (
    organization_id = (select public.current_org_id())
    and (
      (select public.current_org_role()) = 'director'
      or coach_id = auth.uid()
      or public.is_assigned_player(player_id)
    )
  );

drop policy "session_drills_org_select" on public.session_drills;

create policy "session_drills_org_select"
  on public.session_drills for select
  using (
    organization_id = (select public.current_org_id())
    and (
      (select public.current_org_role()) = 'director'
      or coach_id = auth.uid()
      or exists (
        select 1
        from public.sessions s
        where s.id = session_id
          and public.is_assigned_player(s.player_id)
      )
    )
  );
