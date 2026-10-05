-- =============================================================================
-- Padel, bedminton, pickleball ako disciplíny (docs/roadmap-buduce-smery.md §1.1,
-- krok 3)
-- =============================================================================
-- Nové športy sú ďalšie disciplíny vedľa tenisu a kondičky — každý samostatné
-- nasadenie toho istého repa (`padel.plawsports.com` …). Zatiaľ majú 9
-- dočasných zameraní `FOCUS 1`…`FOCUS 9`; skutočné názvy dodá user a premenujú
-- sa vlastnou migráciou (vrátane CHECK-u nižšie).
--
-- Mení sa:
-- 1. všetkých sedem CHECK-ov `in ('tennis', 'fitness')` → päť disciplín,
-- 2. `drill_codes_category_check` — dvojice (disciplína, zameranie) pre nové
--    športy (rovnaké názvy zameraní vo viacerých disciplínach sú v poriadku,
--    rozlišuje ich disciplína — `20261005090000`),
-- 3. `handle_new_user` pozná nové disciplíny z metadát registrácie,
-- 4. `assign_new_org_player` pri chýbajúcom členstve berie šport ZVÄZU, nie
--    natvrdo tenis,
-- 5. `linked_player_category_minutes` vracia aj disciplínu — kondičná strana
--    prepojenia v samostatnom režime inak nevie, ktorý šport na kurte súhrn
--    ukazuje (do kroku 3 bol jediný, tenis).
--
-- Názvy constraintov sú zámerne bez `if exists`: keby sa na produkcii volali
-- inak, migrácia má spadnúť celá (a nič nezapísať), nie ticho nechať starý
-- CHECK, ktorý by nové športy odmietal.
-- =============================================================================

-- 1. Disciplína v stĺpcoch ---------------------------------------------------

alter table public.sessions drop constraint sessions_discipline_check;
alter table public.sessions add constraint sessions_discipline_check
  check (discipline in ('tennis', 'padel', 'badminton', 'pickleball', 'fitness'));

alter table public.metrics_and_tests drop constraint metrics_and_tests_discipline_check;
alter table public.metrics_and_tests add constraint metrics_and_tests_discipline_check
  check (discipline in ('tennis', 'padel', 'badminton', 'pickleball', 'fitness'));

alter table public.organization_members drop constraint organization_members_discipline_check;
alter table public.organization_members add constraint organization_members_discipline_check
  check (discipline in ('tennis', 'padel', 'badminton', 'pickleball', 'fitness'));

alter table public.player_assignments drop constraint player_assignments_discipline_check;
alter table public.player_assignments add constraint player_assignments_discipline_check
  check (discipline in ('tennis', 'padel', 'badminton', 'pickleball', 'fitness'));

alter table public.player_links drop constraint player_links_source_discipline_check;
alter table public.player_links add constraint player_links_source_discipline_check
  check (source_discipline in ('tennis', 'padel', 'badminton', 'pickleball', 'fitness'));

alter table public.profiles drop constraint profiles_discipline_check;
alter table public.profiles add constraint profiles_discipline_check
  check (discipline in ('tennis', 'padel', 'badminton', 'pickleball', 'fitness'));

-- 2. Zamerania kódov cvičení --------------------------------------------------
-- Musí sedieť s `lib/disciplines/*.ts` (nové športy: `court-placeholder.ts`).

alter table public.drill_codes drop constraint drill_codes_category_check;
alter table public.drill_codes add constraint drill_codes_category_check check (
  (discipline = 'tennis' and category in (
    'Forehand', 'Backhand', 'Volley', 'Return', 'Serve', 'GAME DRILLS', 'POINTS'
  ))
  or (discipline in ('padel', 'badminton', 'pickleball') and category in (
    'FOCUS 1', 'FOCUS 2', 'FOCUS 3', 'FOCUS 4', 'FOCUS 5',
    'FOCUS 6', 'FOCUS 7', 'FOCUS 8', 'FOCUS 9'
  ))
  or (discipline = 'fitness' and category in (
    'ENDURANCE', 'STRENGTH', 'SPEED', 'FOOTWORK', 'COORDINATION', 'MOBILITY',
    'CORE MUSCLES', 'STRETCHING', 'WARM UP - COOL DOWN', 'REGENERATION'
  ))
);

-- 3. Registrácia ---------------------------------------------------------------
-- Telo = nasadená definícia z `20261005100000_profile_discipline.sql`, zmenené
-- je len mapovanie disciplíny z metadát.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text := coalesce(new.raw_user_meta_data ->> 'role', 'coach');
  v_code text := upper(trim(coalesce(new.raw_user_meta_data ->> 'promo_code', '')));
  v_promo public.promo_codes%rowtype;
  v_status text := 'trial';
  v_trial_ends timestamptz := now() + interval '14 days';
  v_player_limit integer := 1;
  v_discipline text;
begin
  -- Kód sa míňa len trénerovi. Rodič/hráč/manažér nič neplatia, takže by
  -- registrácia rodiča inak ticho zožrala jedno použitie kódu.
  if v_code <> '' and v_role = 'coach' then
    -- Overenie a započítanie v JEDNOM príkaze. Dva súbežné pokusy o posledné
    -- voľné použitie sa tak nemôžu podariť obidva (`used_count < max_uses`
    -- je vyhodnotené pri zámku riadku, nie pred ním).
    update public.promo_codes
       set used_count = used_count + 1
     where upper(code) = v_code
       and used_count < max_uses
       and (expires_at is null or expires_at > now())
    returning * into v_promo;

    if found then
      insert into public.promo_code_redemptions (promo_code_id, user_id)
      values (v_promo.id, new.id);

      v_player_limit := v_promo.player_limit;

      if v_promo.free_days is null then
        -- Doživotne zadarmo. `complimentary` je ten istý stav, aký dostali
        -- skorí používatelia pri zavedení paywallu.
        v_status := 'complimentary';
      else
        -- Rok zadarmo je obyčajná skúšobná doba, len dlhšia — pruh v appke
        -- preto mlčí, kým sa koniec nepriblíži na týždeň, a po uplynutí
        -- účet prejde do čítania. Tréner o svoje záznamy nepríde.
        v_trial_ends := now() + make_interval(days => v_promo.free_days);
      end if;
    end if;
  end if;

  -- Jeden šport = jeden účet. Len tréner; sledujúci disciplínu nemá.
  -- Neznáma hodnota = tenis, rovnako ako `getDeploymentDiscipline()`.
  if v_role = 'coach' then
    v_discipline := case
      when new.raw_user_meta_data ->> 'discipline'
        in ('padel', 'badminton', 'pickleball', 'fitness')
      then new.raw_user_meta_data ->> 'discipline'
      else 'tennis'
    end;
  end if;

  insert into public.profiles (
    id, email, full_name, role, subscription_status, trial_ends_at,
    player_limit, discipline
  )
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'full_name',
    v_role,
    v_status,
    v_trial_ends,
    v_player_limit,
    v_discipline
  );
  return new;
end;
$$;

-- 4. Priradenie nového hráča organizácie ----------------------------------------
-- Telo = nasadená definícia (overené cez pg_get_functiondef), zmenený je len
-- záložný šport: namiesto natvrdo tenisu šport ZVÄZU (zväz je vždy jeden šport).

create or replace function public.assign_new_org_player()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_discipline text;
  v_sport text;
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

  -- Neznáme členstvo = šport zväzu (do 2026-10-05 natvrdo tenis). Chýbajúca
  -- hodnota nikdy nesmie znamenať „bez disciplíny". Stane sa to jedine pri
  -- servisnom zápise (service_role, seed), nie cez appku.
  if v_discipline is null then
    select o.sport into v_sport
    from public.organizations o
    where o.id = new.organization_id;

    v_discipline := case
      when v_sport in ('tennis', 'padel', 'badminton', 'pickleball') then v_sport
      else 'tennis'
    end;
  end if;

  insert into public.player_assignments (organization_id, player_id, coach_id, discipline)
  values (new.organization_id, new.id, new.coach_id, v_discipline)
  on conflict (player_id, discipline) do nothing;

  return new;
end;
$$;

-- 5. Súhrn opačným smerom vracia disciplínu --------------------------------------
-- Mení sa návratový typ, takže `create or replace` nestačí — funkcia sa zmaže
-- a založí znova. Práva sa preto nastavujú nanovo a MUSIA byť rovnaké ako
-- predtým: EXECUTE len `authenticated` (overené `pg_proc.proacl`, viď
-- zásadu „`grant` nič neodoberá" v CLAUDE.md).

drop function public.linked_player_category_minutes(uuid, timestamptz, timestamptz);

create function public.linked_player_category_minutes(
  p_player_id uuid,
  p_start timestamptz,
  p_end timestamptz
)
returns table (discipline text, category text, duration_minutes integer)
language sql
stable
security definer
set search_path = public
as $$
  select s.discipline, sd.category, sum(sd.duration_minutes)::integer
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
  group by s.discipline, sd.category;
$$;

revoke all on function public.linked_player_category_minutes(uuid, timestamptz, timestamptz)
  from public, anon, service_role;
grant execute on function public.linked_player_category_minutes(uuid, timestamptz, timestamptz)
  to authenticated;
