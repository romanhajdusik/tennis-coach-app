-- Hráčsky denník — hráč si zapisuje tréningy sám (docs/roadmap-buduce-smery.md §6).
--
-- Hráčsky denník NIE JE nová rola: je to trénerský účet (`role = 'coach'`)
-- s jediným hráčom, ktorým je on sám (§6.3). Zápis, kalendár, analytika, kód
-- pre rodiča aj prepojenie s kondičkou tak fungujú bez ďalšej zmeny. Nová rola
-- by znamenala prejsť všetky RLS policy a miesta v appke, ktoré čítajú
-- `role = 'coach'`. Hodnota `role = 'player'` už existuje a znamená
-- SLEDUJÚCEHO hráča — tá sa nemení.
--
-- Migrácia ide na prod v SQL Editore PRED pushom: kód číta `profiles.self_diary`.

-- 1. Označenie účtu --------------------------------------------------------------
-- Účet si ho nezmení sám — `authenticated` nemá na `profiles` UPDATE
-- (`20260807110000`). Inak by si hráč prepol účet na trénerský a kúpil
-- hladinu pre viac hráčov.

alter table public.profiles
  add column self_diary boolean not null default false;

-- Hráčsky denník je len trénerský účet a len na kurte (user 2026-10-05, §6.5
-- otázka č. 3: kondičku hráčovi zapisuje jeho kondičný tréner). Poistka
-- v databáze, nie len vo formulári — registrácia je verejná cesta.
alter table public.profiles
  add constraint profiles_self_diary_court_coach check (
    not self_diary
    or (role = 'coach' and discipline in ('tennis', 'padel', 'badminton', 'pickleball'))
  );

-- 2. Registrácia -----------------------------------------------------------------
-- Telo = nasadená definícia z `20261005110000_court_sports.sql`. Zmenené:
--  - `self_diary` z metadát (len tréner na kurte, inak sa ticho ignoruje),
--  - promo kód sa hráčskemu denníku NEMÍŇA — kódy dávajú hladinu pre viac
--    hráčov a denník má hladinu pevne 1,
--  - hráčskemu denníku sa hneď založí jeho vlastná karta, aby nemusel robiť
--    krok „pridaj hráča" (§6.4 bod 2).

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
  v_self boolean := false;
begin
  -- Jeden šport = jeden účet. Len tréner; sledujúci disciplínu nemá.
  -- Neznáma hodnota = tenis, rovnako ako `getDeploymentDiscipline()`.
  if v_role = 'coach' then
    v_discipline := case
      when new.raw_user_meta_data ->> 'discipline'
        in ('padel', 'badminton', 'pickleball', 'fitness')
      then new.raw_user_meta_data ->> 'discipline'
      else 'tennis'
    end;

    -- Hráčsky denník len na kurte. Na kondičke by ho CHECK aj tak odmietol
    -- a registrácia by spadla celá — tu sa radšej ticho stane obyčajným
    -- trénerským účtom (formulár na kondičke túto voľbu neponúka).
    v_self := coalesce((new.raw_user_meta_data ->> 'self_diary')::boolean, false)
      and v_discipline <> 'fitness';
  end if;

  -- Kód sa míňa len trénerovi. Rodič/hráč/manažér nič neplatia, takže by
  -- registrácia rodiča inak ticho zožrala jedno použitie kódu. Hráčsky
  -- denník tiež nie: kódy dávajú hladinu pre viac hráčov.
  if v_code <> '' and v_role = 'coach' and not v_self then
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

  insert into public.profiles (
    id, email, full_name, role, subscription_status, trial_ends_at,
    player_limit, discipline, self_diary
  )
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'full_name',
    v_role,
    v_status,
    v_trial_ends,
    v_player_limit,
    v_discipline,
    v_self
  );

  -- Karta hráča = on sám. Meno z registrácie; bez neho e-mail, aby karta
  -- nikdy nebola bez mena (`players.name` je povinné).
  if v_self then
    insert into public.players (coach_id, name)
    values (
      new.id,
      coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), new.email)
    );
  end if;

  return new;
end;
$$;
