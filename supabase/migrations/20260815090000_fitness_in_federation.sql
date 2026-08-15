-- =============================================================================
-- Kondička vo federácii — disciplína je vlastnosťou ČLENSTVA
-- =============================================================================
-- Rozhodnutý model: docs/roadmap-buduce-smery.md §2.2 (cesta A).
--
-- Problém, ktorý to celé definuje: vo federácii chodia tenisový aj kondičný
-- tréner na TÚ ISTÚ subdoménu `<slug>.plaw.win`, takže disciplína sa nedá
-- odvodiť ani z adresy (ako na `fitness.plawsports.com`), ani z nasadenia.
-- Zamietnutá cesta B bola druhá subdoména na organizáciu — v kóde by nezmenila
-- skoro nič, ale zdvojnásobila by onboarding a pult by bol len na jednej z nich.
--
-- Hlavná prekážka nebola disciplína, ale PRIRADENIE: `players.coach_id` je
-- jediná kolónka a neunesie, že Adam má naraz Petra na kurt a Janu na kondíciu.
-- Na tom pritom stojí prakticky celé riadenie prístupu v org režime.
--
-- ZISTENIE, KTORÉ ROZSAH ZMENŠILO: dvoch trénerov naraz neunesie JEDINE
-- `players`. `sessions.coach_id` (a tým aj `session_drills`) unesie — je to
-- priradený tréner TEJ disciplíny a štítok `sessions.discipline` ich rozlišuje.
-- Preto sa policy `… coach_id = auth.uid()` nad tréningami nemenia vôbec;
-- menia sa len tie poddotazy, ktoré sa pýtali na `players.coach_id`.
--
-- ROZSAH v1 (rozhodol user 2026-08-15): tréner vidí LEN SVOJU disciplínu.
-- Tenisový tréner teda kondičné tréningy svojho hráča nevidí; prehľad
-- „kurt vs kondička" dáva pult šéftrénera. Read-only cross-read príde až
-- s krokom 4 (prepojenie kariet hráčov), kde sa naraz doplní filtrovanie
-- disciplíny do analytiky aj do „dní bez tréningu" pre OBA režimy — bez neho
-- by sa kondičné minúty ticho primiešali do percent zamerania.
--
-- Migrácia je ADITÍVNA pre všetko existujúce: samostatný (1:1 aj 1:N) tenis na
-- `plaw.win` sa jej nedotkne (jeho riadky majú `organization_id is null`),
-- kondičná appka na `fitness.plawsports.com` tiež nie (tá org nepozná), a každý
-- dnešný org hráč dostane priradenie s disciplínou `tennis`, takže sa navonok
-- nič nezmení.
-- =============================================================================


-- ---------------------------------------------------------------------------
-- A. organization_members.discipline — disciplína je vlastnosť ČLENSTVA
-- ---------------------------------------------------------------------------
-- Pozvánku vytvára šéftréner pre konkrétnu disciplínu; pozvaný ňou dostane aj
-- podobu appky (zamerania, kódy cvičení, charakter úderu, trvania). Šéftrénera
-- sa netýka — ten vidí obe, jeho hodnota je len výplň.
--
-- Predvolený `tennis` drží spätnú kompatibilitu: všetci dnešní členovia sú
-- tenisoví a nič sa im nemení.
alter table public.organization_members
  add column discipline text not null default 'tennis'
    check (discipline in ('tennis', 'fitness'));

comment on column public.organization_members.discipline is
  'Disciplína člena (tennis/fitness). Určuje podobu trénerovej appky vo federácii — tam sa nedá odvodiť z hostname, lebo obaja tréneri chodia na tú istú org subdoménu. Šéftrénera sa netýka, ten vidí obe.';


-- ---------------------------------------------------------------------------
-- B. player_assignments — hráč × tréner × disciplína
-- ---------------------------------------------------------------------------
-- `players.coach_id` prestáva byť v org režime kľúčom prístupu (ostáva ako
-- AUTOR riadku). Prístup určuje priradenie.
--
-- Tabuľka je zámerne LEN pre org hráčov: samostatný tréner je vlastníkom
-- svojich hráčov a jeho model `coach_id = auth.uid()` ostáva nedotknutý. Nič
-- v samostatnom režime sa preto nemusí prepisovať ani preseedovať.
create table public.player_assignments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete restrict,
  player_id uuid not null references public.players (id) on delete cascade,
  coach_id uuid not null references auth.users (id) on delete cascade,
  discipline text not null check (discipline in ('tennis', 'fitness')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.player_assignments is
  'Priradenie hráča trénerovi v organizácii, po disciplínach. Nahrádza players.coach_id ako kľúč prístupu v org režime (docs/roadmap-buduce-smery.md §2.2). Osobní hráči tu riadok nemajú.';

-- Jeden tréner na hráča a disciplínu — Adam má práve jedného tenisového a
-- práve jedného kondičného trénera (alebo žiadneho).
create unique index player_assignments_one_coach_per_discipline
  on public.player_assignments (player_id, discipline);

-- Najčastejší dotaz je „ktorých hráčov mám ja" (roster, prepínač, „Dnes").
create index player_assignments_coach_idx
  on public.player_assignments (coach_id, discipline);

create index player_assignments_organization_idx
  on public.player_assignments (organization_id);

alter table public.player_assignments enable row level security;

create trigger player_assignments_set_updated_at
  before update on public.player_assignments
  for each row execute function public.set_updated_at();

-- Čítať smie tréner (svoje) a šéftréner (celú org) — pozri policy nižšie.
-- ZAPISOVAŤ NESMIE NIKTO priamo: priradenie vzniká trigger-om pri založení
-- hráča a mení ho výhradne `assign_player_to_coach` (obe `security definer`).
-- Keby tréner mal INSERT, pridelil by si cudzieho hráča organizácie sám.
grant select on public.player_assignments to authenticated;
grant select, insert, update, delete on public.player_assignments to service_role;

-- Policy sa zámerne NEPÝTAJÚ na `players` — inak by vznikol ten istý cyklus
-- ako pri `owns_personal_player` (policy nad players → player_assignments →
-- players). Vlastníctvo org riadku overuje `organization_id`.
create policy "player_assignments_select_own_coach"
  on public.player_assignments for select
  using (coach_id = auth.uid());

create policy "player_assignments_select_director"
  on public.player_assignments for select
  using (
    organization_id = (select public.current_org_id())
    and (select public.current_org_role()) = 'director'
  );


-- Backfill: celá doterajšia federačná história je tenisová, takže každý dnešný
-- org hráč dostane tenisové priradenie na svojho doterajšieho trénera. Tým sa
-- prístup ani o riadok nezmení — len sa presunie z `players.coach_id` sem.
--
-- Hráči trénerov, ktorí už nie sú aktívnymi členmi („No longer in the
-- organization"), sa berú tiež: priradenie musí ostať visieť na odídenom
-- trénerovi presne ako dnes `coach_id`, inak by z pultu zmizli a nemal by ich
-- kto prevziať (§5.4).
insert into public.player_assignments (organization_id, player_id, coach_id, discipline)
select p.organization_id, p.id, p.coach_id, 'tennis'
from public.players p
where p.organization_id is not null;


-- ---------------------------------------------------------------------------
-- C. Pomocné funkcie pre RLS
-- ---------------------------------------------------------------------------
-- `security definer` z rovnakého dôvodu ako `owns_personal_player` a
-- `current_org_id`: priamy poddotaz na `player_assignments` v policy nad
-- `players` by sa cez policy tejto tabuľky vrátil späť k `players`.
--
-- Funkcia nič nevyzrádza — vracia len boolean o hráčovi, ktorého má volajúci
-- prideleného, a tých si aj tak vie vypísať.
create function public.is_assigned_player(p_player_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.player_assignments pa
    where pa.player_id = p_player_id
      and pa.coach_id = auth.uid()
  );
$$;

revoke all on function public.is_assigned_player(uuid) from public;
grant execute on function public.is_assigned_player(uuid) to authenticated;

-- Disciplína prihláseného člena — vo federácii jediný zdroj pravdy o tom, ktorú
-- disciplínu appka obsluhuje (mimo federácie ju určuje nasadenie).
create function public.current_org_discipline()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select om.discipline
  from public.organization_members om
  where om.user_id = auth.uid() and om.status = 'active'
  limit 1;
$$;

revoke all on function public.current_org_discipline() from public;
grant execute on function public.current_org_discipline() to authenticated;


-- ---------------------------------------------------------------------------
-- D. Nový org hráč dostane priradenie sám
-- ---------------------------------------------------------------------------
-- Cez trigger, nie z appky: appka zapisuje hráča jedným `insert` a priradenie
-- je podmienka toho, aby ho vzápätí vôbec videla. Keby ho robila appka druhým
-- dotazom, pri zlyhaní medzi nimi by vznikol hráč, ktorého nevidí nikto okrem
-- šéftrénera.
create function public.assign_new_org_player()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_discipline text;
begin
  -- Osobný hráč priradenie nemá — tam je vlastníkom sám tréner.
  if new.organization_id is null then
    return new;
  end if;

  select om.discipline into v_discipline
  from public.organization_members om
  where om.user_id = new.coach_id
    and om.organization_id = new.organization_id
    and om.status = 'active';

  -- Neznáme členstvo = tenis, rovnaké pravidlo ako v `lib/discipline.ts`:
  -- chýbajúca hodnota nikdy nesmie znamenať „bez disciplíny". Stane sa to
  -- jedine pri servisnom zápise (service_role, seed), nie cez appku.
  insert into public.player_assignments (organization_id, player_id, coach_id, discipline)
  values (new.organization_id, new.id, new.coach_id, coalesce(v_discipline, 'tennis'))
  on conflict (player_id, discipline) do nothing;

  return new;
end;
$$;

create trigger players_assign_new_org_player
  after insert on public.players
  for each row execute function public.assign_new_org_player();


-- ---------------------------------------------------------------------------
-- E. metrics_and_tests dostáva štítok disciplíny
-- ---------------------------------------------------------------------------
-- Modul testov síce nie je postavený (odložený na neurčito), ale bez štítku by
-- `assign_player_to_coach` nevedela, ktorému z dvoch trénerov tie riadky pri
-- preradení patria — a pasca by ticho čakala na deň, keď sa modul dorobí.
-- Rovnaký dôvod a rovnaká predvolená hodnota ako pri `sessions.discipline`.
alter table public.metrics_and_tests
  add column discipline text not null default 'tennis'
    check (discipline in ('tennis', 'fitness'));


-- ---------------------------------------------------------------------------
-- F. RLS — prístup v org režime určuje PRIRADENIE, nie `players.coach_id`
-- ---------------------------------------------------------------------------
-- Menia sa presne tie miesta, ktoré sa pýtali na `players.coach_id`. Policy nad
-- `sessions`/`session_drills`, ktoré sa pýtajú na vlastné `coach_id`, ostávajú
-- — tam je `coach_id` priradený tréner tej disciplíny a zároveň to je to, čo
-- v1 drží pravidlo „tréner vidí len svoju disciplínu".

-- players ---------------------------------------------------------------
drop policy "players_org_select" on public.players;

create policy "players_org_select"
  on public.players for select
  using (
    organization_id = (select public.current_org_id())
    and (
      (select public.current_org_role()) = 'director'
      or public.is_assigned_player(id)
    )
  );

drop policy "players_org_coach_update" on public.players;

-- Pozn.: upraviť/archivovať hráča smie ktorýkoľvek z jeho pridelených trénerov.
-- `is_active` je vlastnosť hráča, nie disciplíny — kondičný tréner tak vie
-- archivovať aj hráča, ktorý ešte chodí na kurt. Vedome prijaté: alternatíva
-- (archivuje len tenisový) by znamenala, že kondičný tréner s hráčom bez
-- tenisového trénera by nemal ako upratať roster.
create policy "players_org_coach_update"
  on public.players for update
  using (
    organization_id = (select public.current_org_id())
    and (select public.current_org_role()) = 'coach'
    and public.is_assigned_player(id)
  )
  with check (
    organization_id = (select public.current_org_id())
    and (select public.current_org_role()) = 'coach'
    and public.is_assigned_player(id)
  );

-- `players_org_coach_insert` sa nemení: zakladateľ ostáva `coach_id` (autor)
-- a priradenie mu vzápätí založí trigger z bodu D.


-- sessions --------------------------------------------------------------
drop policy "sessions_org_coach_insert" on public.sessions;

-- Dve zmeny: hráč sa overuje priradením (nie `p.coach_id`) a disciplína
-- tréningu MUSÍ sedieť s disciplínou člena. To druhé je poistka proti tichej
-- chybe appky — kondičný tréner nesmie zapísať tréning označený ako tenisový,
-- inak by sa objavil v tenisovej analytike hráča.
create policy "sessions_org_coach_insert"
  on public.sessions for insert
  with check (
    organization_id = (select public.current_org_id())
    and (select public.current_org_role()) = 'coach'
    and coach_id = auth.uid()
    and discipline = (select public.current_org_discipline())
    and exists (
      select 1 from public.players p
      where p.id = player_id
        and p.organization_id = (select public.current_org_id())
        and public.is_assigned_player(p.id)
        and p.is_active = true
    )
  );

drop policy "sessions_org_coach_update" on public.sessions;

create policy "sessions_org_coach_update"
  on public.sessions for update
  using (
    organization_id = (select public.current_org_id())
    and (select public.current_org_role()) = 'coach'
    and coach_id = auth.uid()
    and status <> 'completed'
    and exists (
      select 1 from public.players p
      where p.id = player_id
        and p.organization_id = (select public.current_org_id())
        and public.is_assigned_player(p.id)
        and p.is_active = true
    )
  )
  with check (
    organization_id = (select public.current_org_id())
    and (select public.current_org_role()) = 'coach'
    and coach_id = auth.uid()
    -- Štítok sa nesmie prepísať ani dodatočne (presun tréningu, review).
    and discipline = (select public.current_org_discipline())
    and exists (
      select 1 from public.players p
      where p.id = player_id
        and p.organization_id = (select public.current_org_id())
        and public.is_assigned_player(p.id)
        and p.is_active = true
    )
  );

-- `session_drills` sa nemenia vôbec: ich org policy sa pýtajú na
-- `s.coach_id = auth.uid()` nad tréningom, nie na `players.coach_id`.


-- metrics_and_tests -----------------------------------------------------
drop policy "metrics_org_coach_insert" on public.metrics_and_tests;

create policy "metrics_org_coach_insert"
  on public.metrics_and_tests for insert
  with check (
    organization_id = (select public.current_org_id())
    and (select public.current_org_role()) = 'coach'
    and coach_id = auth.uid()
    and discipline = (select public.current_org_discipline())
    and exists (
      select 1 from public.players p
      where p.id = player_id
        and p.organization_id = (select public.current_org_id())
        and public.is_assigned_player(p.id)
        and p.is_active = true
    )
  );

drop policy "metrics_org_coach_update" on public.metrics_and_tests;

create policy "metrics_org_coach_update"
  on public.metrics_and_tests for update
  using (
    organization_id = (select public.current_org_id())
    and (select public.current_org_role()) = 'coach'
    and coach_id = auth.uid()
  )
  with check (
    organization_id = (select public.current_org_id())
    and (select public.current_org_role()) = 'coach'
    and coach_id = auth.uid()
    and discipline = (select public.current_org_discipline())
    and exists (
      select 1 from public.players p
      where p.id = player_id
        and p.organization_id = (select public.current_org_id())
        and public.is_assigned_player(p.id)
        and p.is_active = true
    )
  );


-- ---------------------------------------------------------------------------
-- G. Disciplína člena je po prijatí pozvánky NEMENNÁ
-- ---------------------------------------------------------------------------
-- Inak by sa prepnutím trénera z tenisu na kondíciu rozišli jeho priradenia
-- (tie majú disciplínu v sebe) s jeho členstvom: videl by hráčov, ktorým už
-- nepatrí, a nezapísal by im tréning (RLS pýta zhodu disciplíny). Kto zmení
-- disciplínu, dostane novú pozvánku — rovnaký princíp ako „účet je buď
-- nezávislý, alebo org-zamestnanec".
--
-- Pred prijatím (kým je `user_id` null) sa disciplína meniť dá — šéftréner si
-- tak vie opraviť pozvánku, ktorú vytvoril s nesprávnou disciplínou.
--
-- `create or replace` vychádza z reálne nasadenej definície (overené cez
-- `pg_get_functiondef`), nie zo staršej migrácie — tá pasca sa už raz chytila
-- pri `claim_player_connection`.
create or replace function public.enforce_membership_rules()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_seat_limit integer;
  v_used_seats integer;
begin
  -- (1) Účet k pozvánke pripája výhradne claim_organization_invite. Ani
  -- šéftréner nesmie priradiť cudzí účet priamym zápisom — členstvo je
  -- dobrovoľné (§5.7). Servisné/administrátorské pripojenie (bez prihláseného
  -- používateľa, napr. založenie prvého šéftrénera pri onboardingu) prechádza.
  if tg_op = 'UPDATE'
     and new.user_id is distinct from old.user_id
     and auth.uid() is not null
     and coalesce(current_setting('app.claiming_invite', true), '') <> 'on'
  then
    raise exception 'membership_requires_claim';
  end if;

  -- (1b) Disciplína je po prijatí pozvánky nemenná (viď komentár vyššie).
  if tg_op = 'UPDATE'
     and new.discipline is distinct from old.discipline
     and old.user_id is not null
  then
    raise exception 'discipline_is_fixed';
  end if;

  if new.status = 'active' and new.user_id is not null then
    -- (2) Buď nezávislý, alebo org-zamestnanec (§5.8): kto už vlastní osobných
    -- hráčov, nemôže sa stať členom organizácie — inak by mu osobné dáta
    -- „zmizli" (osobné RLS policy pre org účty neplatia).
    if exists (
      select 1 from public.players p
      where p.coach_id = new.user_id and p.organization_id is null
    ) then
      raise exception 'has_personal_data';
    end if;

    -- (3) Sedadlá: proti limitu sa počítajú len tréneri, šéftréner sedadlo neberie.
    -- Kondičný tréner berie sedadlo ako každý iný (§2.2 — nemení sa).
    if new.role = 'coach' then
      select o.seat_limit into v_seat_limit
      from public.organizations o
      where o.id = new.organization_id;

      select count(*) into v_used_seats
      from public.organization_members om
      where om.organization_id = new.organization_id
        and om.status = 'active'
        and om.role = 'coach'
        and om.id <> new.id;

      if v_used_seats >= v_seat_limit then
        raise exception 'seat_limit_reached';
      end if;
    end if;
  end if;

  return new;
end;
$$;


-- ---------------------------------------------------------------------------
-- H. assign_player_to_coach — preradenie sa zužuje na JEDNU disciplínu
-- ---------------------------------------------------------------------------
-- Doteraz prepisovala `coach_id` na hráčovi aj na všetkých jeho tréningoch.
-- Odteraz presunie len priradenie a riadky TEJ disciplíny, ktorú robí cieľový
-- tréner — a presne kvôli tomu je štítok na tréningu: výmena tenisového trénera
-- sa nesmie dotknúť kondičnej histórie.
--
-- `players.coach_id` sa UŽ NEMENÍ. V org režime je to autor riadku, nie kľúč
-- prístupu; keby sa presúval ďalej, existovali by dve pravdy o tom, kto hráča
-- trénuje, a jedna z nich by pri dvoch tréneroch musela klamať.
create or replace function public.assign_player_to_coach(p_player_id uuid, p_coach_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_player_org uuid;
  v_discipline text;
begin
  -- Volajúci musí byť aktívny šéftréner — členstvo je najviac jedno (§5.8).
  select om.organization_id into v_org_id
  from public.organization_members om
  where om.user_id = auth.uid()
    and om.role = 'director'
    and om.status = 'active';

  if v_org_id is null then
    raise exception 'not_director';
  end if;

  -- Hráč musí patriť organizácii volajúceho (tenant izolácia — funkcia beží
  -- s právami vlastníka, takže RLS ju tu nechráni).
  select p.organization_id into v_player_org
  from public.players p
  where p.id = p_player_id;

  if v_player_org is null or v_player_org <> v_org_id then
    raise exception 'player_not_in_org';
  end if;

  -- Cieľ musí byť aktívny TRÉNER tej istej organizácie. Šéftrénerovi hráča
  -- prideliť nejde: nemá trénerskú appku a §5.7 mu zápis nedovoľuje.
  -- Jeho členstvo zároveň hovorí, KTORÚ disciplínu preraďujeme.
  select om.discipline into v_discipline
  from public.organization_members om
  where om.user_id = p_coach_id
    and om.organization_id = v_org_id
    and om.role = 'coach'
    and om.status = 'active';

  if v_discipline is null then
    raise exception 'target_not_coach';
  end if;

  -- Priradenie: hráč má na disciplínu práve jedného trénera, takže preradenie
  -- je upsert. Pri prvom kondičnom trénerovi vznikne nový riadok — tenisové
  -- priradenie ostáva nedotknuté a hráč má odteraz oboch.
  insert into public.player_assignments (organization_id, player_id, coach_id, discipline)
  values (v_org_id, p_player_id, p_coach_id, v_discipline)
  on conflict (player_id, discipline)
  do update set coach_id = excluded.coach_id, updated_at = now();

  -- História tej istej disciplíny ide s priradením — RLS trénera je nad
  -- tréningami `coach_id = auth.uid()`, takže bez toho by nový tréner videl
  -- hráča, ale nie jeho tréningy.
  update public.sessions
  set coach_id = p_coach_id
  where player_id = p_player_id
    and organization_id = v_org_id
    and discipline = v_discipline;

  update public.session_drills sd
  set coach_id = p_coach_id
  where sd.organization_id = v_org_id
    and exists (
      select 1 from public.sessions s
      where s.id = sd.session_id
        and s.player_id = p_player_id
        and s.discipline = v_discipline
    );

  update public.metrics_and_tests
  set coach_id = p_coach_id
  where player_id = p_player_id
    and organization_id = v_org_id
    and discipline = v_discipline;

  -- Pozn.: `sessions.google_event_id` ostáva ukazovať do kalendára pôvodného
  -- trénera (pripojenie je per účet) — nový tréner udalosti nezdedí. Zdieľanie
  -- s rodičom sa nerieši, v org režime je vypnuté (§5.6).
end;
$$;


-- ---------------------------------------------------------------------------
-- I. Skupinový tréning naprieč trénermi — po disciplínach
-- ---------------------------------------------------------------------------
-- Ponuka hráčov na skopírovanie sa odteraz skladá z PRIRADENÍ volajúcej
-- disciplíny, nie z `players.coach_id`. Bez toho by kondičný tréner dostal na
-- výber hráčov aj s ich tenisovými trénermi a kópia by skončila u človeka,
-- ktorý kondíciu nerobí.
create or replace function public.org_players_for_copy()
returns table (id uuid, name text, coach_id uuid, coach_name text)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.name, pa.coach_id, coalesce(pr.full_name, '')
  from public.players p
  join public.player_assignments pa
    on pa.player_id = p.id
   and pa.discipline = public.current_org_discipline()
  join public.organization_members om
    on om.organization_id = p.organization_id
   and om.user_id = pa.coach_id
   and om.status = 'active'
  left join public.profiles pr on pr.id = pa.coach_id
  where p.organization_id = public.current_org_id()
    and p.is_active = true
    -- Šéftréner tréningy nezapisuje (§5.7), takže mu funkcia nevydá nič.
    and public.current_org_role() = 'coach'
  order by p.name;
$$;


-- Kópia MUSÍ niesť disciplínu zdroja (§2.0 to vedome odkladalo, kým kondička
-- vo federácii neexistovala) — inak by kondičný skupinový tréning dostal
-- predvolený `tennis` a objavil by sa hráčovi v tenisovej analytike.
create or replace function public.copy_session_to_org_player(
  p_session_id uuid,
  p_target_player_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_discipline text;
  v_source public.sessions;
  v_target public.players;
  v_target_coach uuid;
  v_planned_date text;
  v_new_id uuid;
begin
  -- `security definer` obchádza RLS, takže všetky kontroly musia byť tu.
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  select om.organization_id, om.discipline into v_org_id, v_discipline
  from public.organization_members om
  where om.user_id = auth.uid()
    and om.role = 'coach'
    and om.status = 'active';

  if v_org_id is null then
    raise exception 'not_org_coach';
  end if;

  -- Kopírovať sa dá len z VLASTNÉHO tréningu — funkcia nesmie byť cestou, ako
  -- si prečítať cudzí tréning tým, že si ho niekam skopírujem. Zhoda disciplíny
  -- je tým daná: vlastný tréning inú disciplínu mať nemôže (RLS pri zápise).
  select * into v_source
  from public.sessions s
  where s.id = p_session_id
    and s.organization_id = v_org_id
    and s.coach_id = auth.uid();

  if not found then
    raise exception 'source_not_found';
  end if;

  select * into v_target
  from public.players p
  where p.id = p_target_player_id
    and p.organization_id = v_org_id
    and p.is_active = true;

  if not found then
    raise exception 'target_not_found';
  end if;

  if v_target.id = v_source.player_id then
    raise exception 'same_player';
  end if;

  -- Cieľový tréner je ten, kto hráčovi robí TÚ ISTÚ disciplínu — nie
  -- `players.coach_id` (ten je len autor riadku). Keď hráč v tejto disciplíne
  -- trénera nemá, kópia by nemala komu patriť.
  select pa.coach_id into v_target_coach
  from public.player_assignments pa
  where pa.player_id = v_target.id
    and pa.discipline = v_source.discipline;

  if v_target_coach is null then
    raise exception 'target_not_found';
  end if;

  if not exists (
    select 1
    from public.organization_members om
    where om.user_id = v_target_coach
      and om.organization_id = v_org_id
      and om.role = 'coach'
      and om.status = 'active'
  ) then
    raise exception 'target_coach_inactive';
  end if;

  -- Poistka proti dvojkliku a proti druhému skopírovaniu toho istého
  -- tréningu — inak by hráčovi pribudol duplikát a analytika by mu
  -- zdvojnásobila odohraný čas. Porovnáva sa v rámci TEJ ISTEJ disciplíny:
  -- kondícia a kurt v ten istý deň sú legitímne dva tréningy.
  v_planned_date := v_source.planned_data ->> 'date';

  if v_planned_date is not null and exists (
    select 1
    from public.sessions s
    where s.player_id = v_target.id
      and s.status <> 'cancelled'
      and s.discipline = v_source.discipline
      and s.planned_data ->> 'date' = v_planned_date
  ) then
    raise exception 'duplicate_practice';
  end if;

  -- Nikdy nie 'completed': do uzamknutého tréningu sa cvičenia vložiť nedajú
  -- a odomknúť sa už nedá, takže by hráčov tréner nemohol upraviť, čo jeho
  -- zverenec neodohral. `google_event_id` sa zámerne neprenáša — udalosť patrí
  -- do kalendára toho, kto tréning naplánoval.
  insert into public.sessions (
    coach_id, organization_id, player_id, status, planned_data, actual_data,
    notes, discipline
  )
  values (
    v_target_coach, v_org_id, v_target.id, 'planned',
    v_source.planned_data, v_source.actual_data, v_source.notes,
    v_source.discipline
  )
  returning id into v_new_id;

  -- `replaces_drill_id` sa neprenáša, ukazovalo by na cvičenia cudzieho tréningu.
  insert into public.session_drills (
    session_id, coach_id, organization_id, category, character, drill_code,
    duration_minutes, status, sort_order
  )
  select
    v_new_id, v_target_coach, v_org_id, d.category, d.character, d.drill_code,
    d.duration_minutes, d.status, d.sort_order
  from public.session_drills d
  where d.session_id = p_session_id
  order by d.sort_order;

  return v_new_id;
end;
$$;
