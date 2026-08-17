-- =============================================================================
-- Promo kódy — registrácia na pozvánku a prístup zadarmo
-- =============================================================================
-- Rozhodnuté 2026-08-16. Dovtedy bola verejná registrácia zavretá jedinou
-- premennou prostredia (`REGISTRATION_ENABLED`) a účty trénerov sa zakladali
-- ručne. Testeri sa tak k appke nedostali sami a nemali ako dostať prístup
-- zadarmo bez toho, aby im ho niekto ručne prepísal v databáze.
--
-- Kód robí DVE veci naraz: pustí človeka cez registráciu a zároveň mu určí,
-- ako dlho má appku zadarmo. Je to štvrtý výskyt toho istého vzoru v tejto
-- appke (pozvánka do federácie, prepojenie rodiča, prepojenie kariet), takže
-- sa drží ich pravidiel: tabuľka + `security definer` funkcia, žiadne priame
-- právo pre `authenticated`.
--
-- KĽÚČOVÉ ROZHODNUTIE: kód sa uplatňuje v triggeri `handle_new_user`, nie
-- v appke. Appka zámerne nedrží `service_role` kľúč (viď CLAUDE.md, sekcia
-- Google Calendar) a do `profiles` nesmie zapisovať vôbec — inak by si účet
-- vedel sám nastaviť „zaplatené". Kód preto putuje v metadátach registrácie
-- a overí si ho databáza sama; vymyslený kód nedá nič.
-- =============================================================================


-- ---------------------------------------------------------------------------
-- Tabuľky
-- ---------------------------------------------------------------------------
create table public.promo_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  -- `null` = prístup zadarmo BEZ konca (`complimentary`), číslo = toľko dní
  -- skúšobnej doby. Jeden stĺpec tak pokryje „rok zadarmo" aj „doživotne"
  -- a pri vydávaní kódu sa nič neprepína.
  free_days integer,
  player_limit integer not null default 1,
  -- Hromadný kód (napr. TESTER2026 na 20 použití) aj kód pre jedného človeka
  -- (max_uses = 1) je tá istá tabuľka, líšia sa len číslom.
  max_uses integer not null default 1,
  used_count integer not null default 0,
  expires_at timestamptz,
  note text,
  created_at timestamptz not null default now(),
  constraint promo_codes_free_days_positive check (free_days is null or free_days > 0),
  constraint promo_codes_player_limit_positive check (player_limit >= 1),
  constraint promo_codes_max_uses_positive check (max_uses >= 1),
  constraint promo_codes_used_count_sane check (used_count >= 0 and used_count <= max_uses)
);

-- Kto ktorý kód uplatnil. Slúži na prehľad („kto z rozposlaných kódov už
-- prišiel") a zároveň bráni tomu, aby ten istý účet minul kód dvakrát.
create table public.promo_code_redemptions (
  promo_code_id uuid not null references public.promo_codes (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  redeemed_at timestamptz not null default now(),
  primary key (promo_code_id, user_id)
);


-- ---------------------------------------------------------------------------
-- Práva: obe tabuľky obsluhuje výhradne `security definer` kód
-- ---------------------------------------------------------------------------
-- Žiadne policy sa zámerne nepridávajú — nikto z appky sem nesmie ani
-- nazrieť. Kto by vedel čítať `promo_codes`, prečítal by si nepoužité kódy
-- a spravil si prístup zadarmo.
--
-- `revoke` je tu POVINNÉ, nie dekoratívne: default privileges schémy `public`
-- dávajú novej tabuľke `select` pre `authenticated` (audit 2026-08-15,
-- migrácia `20260815110000`), takže bez tohto riadku by boli kódy čitateľné.
alter table public.promo_codes enable row level security;
alter table public.promo_code_redemptions enable row level security;

revoke all on public.promo_codes from anon, authenticated;
revoke all on public.promo_code_redemptions from anon, authenticated;


-- ---------------------------------------------------------------------------
-- Overenie kódu ešte pred registráciou
-- ---------------------------------------------------------------------------
-- Aby formulár vedel povedať „taký kód neplatí" a účet vôbec nevznikol.
-- Vracia iba áno/nie — nikdy nič z tabuľky, takže sa cez ňu nedá zistiť,
-- čo kód dáva ani koľko použití mu ostáva.
create function public.promo_code_is_valid(p_code text)
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1
    from public.promo_codes
    where upper(code) = upper(trim(p_code))
      and used_count < max_uses
      and (expires_at is null or expires_at > now())
  );
$$;

-- PostgreSQL dáva PUBLIC execute na každej novej funkcii, kým sa to neodvolá
-- (migrácia `20260815120000`). Neprihlásený ju volať MUSÍ — registrácia je
-- z definície bez prihlásenia.
revoke all on function public.promo_code_is_valid(text) from public;
grant execute on function public.promo_code_is_valid(text) to anon, authenticated;


-- ---------------------------------------------------------------------------
-- Uplatnenie kódu pri vzniku účtu
-- ---------------------------------------------------------------------------
-- Nadväzuje na `20260705120000` (rola z metadát). Pôvodné správanie ostáva
-- nedotknuté: bez kódu vznikne presne ten istý profil ako doteraz, teda
-- 14-dňová skúšobná doba a jeden hráč.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_role text := coalesce(new.raw_user_meta_data ->> 'role', 'coach');
  v_code text := upper(trim(coalesce(new.raw_user_meta_data ->> 'promo_code', '')));
  v_promo public.promo_codes%rowtype;
  v_status text := 'trial';
  v_trial_ends timestamptz := now() + interval '14 days';
  v_player_limit integer := 1;
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

  insert into public.profiles (
    id, email, full_name, role, subscription_status, trial_ends_at, player_limit
  )
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'full_name',
    v_role,
    v_status,
    v_trial_ends,
    v_player_limit
  );
  return new;
end;
$$;
