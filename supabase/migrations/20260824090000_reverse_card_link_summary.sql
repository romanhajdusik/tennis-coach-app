-- =============================================================================
-- Opačný smer cross-readu — SÚHRN SPÄŤ, nie druhé prepojenie
-- =============================================================================
-- Návrh: docs/roadmap-buduce-smery.md §2.3 (2026-08-22), rozhodnuté 2026-08-24.
--
-- Čo to rieši: prepojenie kariet je dnes jednosmerné. Tenisový tréner vidí
-- kondičnú prípravu svojho zverenca, kondičný o tenisovej nevie nič — a pritom
-- práve on potrebuje vedieť, koľko záťaže na hráčovi už je.
--
-- ROZSAH JE ZÁMERNE ASYMETRICKÝ: tam CELÝ DETAIL, späť LEN SÚČTY. Tenisový
-- tréner vidí kondičný tréning vrátane cvičení a poznámky (rozhodnuté
-- 2026-08-15); späť ide výhradne agregát „koľko minút na ktorom zameraní".
-- Kódy cvičení sú trénerovo know-how a hlavný sľub appky, takže neopustia ani
-- jeden.
--
-- TRI VECI, KTORÉ TENTO MODEL DRŽIA:
--
-- 1. **Nie je to druhý riadok, ale PREPÍNAČ na tom istom.** Opačné prepojenie
--    (tenisový vydá kód, kondičný zadá) dnes prejde aj bez migrácie — indexy
--    `player_links_one_active_source`/`_target` sú nad rôznymi stĺpcami, takže
--    dvojica opačných riadkov im neprekáža. Overené zápisom do lokálnej DB, nie
--    čítaním SQL. Lenže `reads_linked_player` sa pýta výhradne na dvojicu
--    *zdroj → cieľ* a o smere nevie nič, takže taký riadok okamžite otvorí
--    `sessions` **aj `session_drills`** v plnom rozsahu — v skúške z 2026-08-24
--    z toho bolo 13 tréningov aj s poznámkou a 44 cvičení aj s kódmi. Preto sa
--    späť neposiela riadok, ale príznak na existujúcom prepojení.
--
-- 2. **Súhlas dáva vlastník dát, tu je ním CIEĽOVÁ strana.** Späť tečú dáta
--    karty `target_player_id`, teda toho, kto kód zadal — a len on smie príznak
--    prepnúť. `default false` je podstatné: prepojenia vydané do 2026-08-24
--    vznikli pod sľubom jednosmernosti a nesmú začať zdieľať samy od seba.
--
-- 3. **Užší rozsah je zaručený tvarom funkcie, nie výberom stĺpcov v appke.**
--    RLS obmedzuje RIADKY, nie stĺpce, takže policy „vidí minúty, ale nie kódy"
--    sa napísať nedá. Súhrn preto nedostáva žiadnu SELECT policy — vydáva ho
--    `security definer` funkcia, ktorá vracia rovno agregát. Nie je čo uniesť.
-- =============================================================================


-- ---------------------------------------------------------------------------
-- A. Príznak na existujúcom prepojení
-- ---------------------------------------------------------------------------
alter table public.player_links
  add column target_shares_summary boolean not null default false;

comment on column public.player_links.target_shares_summary is
  'Cieľová strana (ten, kto kód zadal) ukazuje vydávajúcemu SÚHRN svojej práce — len podiely zameraní, žiadne kódy cvičení ani poznámky (docs §2.3). Prepína sa cez set_link_summary_sharing, nie UPDATE-om: policy na UPDATE nevie obmedziť, ktorý stĺpec sa mení.';


-- ---------------------------------------------------------------------------
-- B. Prepnutie súhlasu — smie ho len cieľová strana
-- ---------------------------------------------------------------------------
-- Cez funkciu z toho istého dôvodu, pre ktorý ho nemá ani `revoke_player_link`:
-- **policy na UPDATE nevie obmedziť, KTORÝ stĺpec sa mení** (v jednej policy sa
-- nedá porovnať starý a nový riadok), takže „cieľ smie prepnúť svoj príznak" by
-- mu zároveň dovolilo prepísať `source_player_id` na cudziu kartu. Tabuľka
-- preto `UPDATE` grant nemá a mať nebude.
create function public.set_link_summary_sharing(
  p_link_id uuid,
  p_enabled boolean
)
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

  -- Zdrojová strana tu nemá čo hľadať: rozhoduje sa o CUDZÍCH dátach, tých,
  -- ktoré patria cieľovej karte. Vydávajúci prepojenie zrušiť smie (to je jeho
  -- právo na vlastné dáta), ale prepnúť si prísun opačným smerom nie.
  if v_link.target_coach_id is distinct from auth.uid() then
    raise exception 'not_your_link';
  end if;

  -- Nezaklaimované prepojenie ešte druhú stranu nemá, takže nie je komu
  -- ukazovať; zrušené sa neoživuje príznakom.
  if v_link.status <> 'active' then
    raise exception 'link_not_active';
  end if;

  update public.player_links
  set target_shares_summary = p_enabled
  where id = p_link_id;
end;
$$;

revoke all on function public.set_link_summary_sharing(uuid, boolean) from public;
grant execute on function public.set_link_summary_sharing(uuid, boolean) to authenticated;


-- ---------------------------------------------------------------------------
-- C. Samotný súhrn — agregát, nie riadky
-- ---------------------------------------------------------------------------
-- Vracia to isté, čo appka kreslí v generálnom grafe: zameranie a minúty.
-- Žiadny `drill_code`, žiadna `notes`, žiadne `id` tréningu — a to nie preto,
-- že by sa nevyberali, ale preto, že cez túto funkciu neexistuje spôsob, ako sa
-- k nim dostať. Volajúci nedostane ani SELECT na `sessions`.
--
-- Obdobie sa porovnáva presne ako v `getPlayerSessionIdsInPeriod`
-- (`lib/actions/analytics.ts`): reálny dátum, inak plánovaný. V JSON sú úplné
-- ISO reťazce so `Z`, takže `::timestamptz` a `new Date(...)` porovnávajú ten
-- istý okamih — appka posiela hranice ako ISO a čísla sedia s jej vlastnými.
--
-- `s.discipline <> pl.source_discipline` = „všetko, čo NIE JE moja disciplína".
-- Cieľová karta má mimo federácie tréningy jediného trénera, takže je to jej
-- celá práca; parameter disciplíny by tu bol len ďalší vstup od klienta.
create function public.linked_player_category_minutes(
  p_player_id uuid,
  p_start timestamptz,
  p_end timestamptz
)
returns table (category text, duration_minutes integer)
language sql
stable
security definer
set search_path = public
as $$
  select sd.category, sum(sd.duration_minutes)::integer
  from public.player_links pl
  join public.sessions s
    on s.player_id = pl.target_player_id
   and s.discipline <> pl.source_discipline
  join public.session_drills sd
    on sd.session_id = s.id
   and sd.status = 'played'
  where pl.source_player_id = p_player_id
    and pl.source_coach_id = auth.uid()
    and pl.status = 'active'
    and pl.target_shares_summary
    and coalesce(s.actual_data ->> 'date', s.planned_data ->> 'date')::timestamptz >= p_start
    and coalesce(s.actual_data ->> 'date', s.planned_data ->> 'date')::timestamptz < p_end
  group by sd.category;
$$;

revoke all on function public.linked_player_category_minutes(uuid, timestamptz, timestamptz) from public;
grant execute on function public.linked_player_category_minutes(uuid, timestamptz, timestamptz) to authenticated;


-- ---------------------------------------------------------------------------
-- D. Jedna dvojica kariet = jedno prepojenie
-- ---------------------------------------------------------------------------
-- Bez tejto poistky ostáva otvorená cesta, ktorá celú asymetriu obíde: keď si
-- dvojica vymení kódy oboma smermi, vzniknú dva riadky a každá strana vidí
-- druhej do plného detailu — presne to, čo sa rozhodlo nedať. Cez UI sa to
-- vyvolať nedá (druhá strana tlačidlo „vydať kód" nemá), ale RPC je cez
-- PostgREST dostupné priamo, takže hranica patrí do databázy, nie do appky.
--
-- Kontrola je disciplínovo neutrálna — pýta sa na tvar prepojenia, nie na to,
-- kto je tenis a kto kondička. Cesta späť je `target_shares_summary`.
--
-- Zvyšok tela je nezmenený oproti `20260815100000` (vrátane komentárov, telo sa
-- ukladá doslovne).
create or replace function public.claim_player_link(
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

  -- Dvojica kariet už prepojená je, len opačne (§2.3 a časť D tejto migrácie).
  -- Druhý riadok by z jednosmerného pohľadu spravil obojsmerný plný detail,
  -- takže sa odmieta; späť sa ukazuje súhrn cez `target_shares_summary`.
  if exists (
    select 1 from public.player_links existing
    where existing.status = 'active'
      and existing.source_player_id = p_player_id
      and existing.target_player_id = v_link.source_player_id
  ) then
    raise exception 'already_linked';
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
