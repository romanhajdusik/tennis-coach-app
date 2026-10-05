-- =============================================================================
-- Trénerský účet patrí jednej disciplíne (docs/roadmap-buduce-smery.md §1.1)
-- =============================================================================
-- Rozhodnuté 2026-10-05: **jeden šport = jeden účet.** Kto učí tenis aj padel,
-- má dva účty, každý so svojimi hráčmi a predplatným. Dovtedy appka nevedela,
-- kde účet vznikol, a nič nebránilo prihlásiť sa tenisovým účtom na
-- `fitness.plawsports.com` — tréner tam videl svojich tenisových hráčov a
-- `profiles.player_limit` platil pre obe appky naraz.
--
-- Stĺpec len ZAPISUJE, kam účet patrí; stráž je v `proxy.ts` (účet na cudzom
-- nasadení sa odhlási a dostane odkaz na svoju appku).
--
-- - Má ho len TRÉNER. Rodič, hráč a manažér chodia výhradne na `plaw.win`.
-- - Vo FEDERÁCII rozhoduje členstvo (`organization_members.discipline`), nie
--   tento stĺpec — appka sa naň pri členovi nepozerá.
-- - Účet si ho nezmení: `authenticated` nemá na `profiles` UPDATE.
-- =============================================================================

alter table public.profiles
  add column discipline text
    check (discipline in ('tennis', 'fitness'));

comment on column public.profiles.discipline is
  'Disciplína (nasadenie), do ktorej trénerský účet patrí — jeden šport = jeden účet. Pre rodiča/hráča/manažéra NULL. Vo federácii rozhoduje členstvo, nie tento stĺpec. Zapisuje ho handle_new_user z metadát registrácie.';

-- Backfill: kde účet vznikol, sa nikde nezapisovalo, takže sa odvodzuje z dát.
-- Tréner s kondičnými tréningami alebo kódmi je kondičný, ostatní tenisoví.
-- **Kondičný účet bez jediného záznamu by tým dostal tenis** — preto sa pred
-- spustením na produkcii zoznam účtov skontroluje a prípadné výnimky sa
-- opravia ručne (rovnaký `update` s konkrétnym `id`).
update public.profiles p
  set discipline = case
    when exists (
      select 1 from public.sessions s
      where s.coach_id = p.id and s.discipline = 'fitness'
    ) or exists (
      select 1 from public.drill_codes d
      where d.coach_id = p.id and d.discipline = 'fitness'
    ) then 'fitness'
    else 'tennis'
  end
  where p.role = 'coach';

alter table public.profiles
  add constraint profiles_coach_has_discipline
  check (role <> 'coach' or discipline is not null);

-- Registrácia: disciplínu posiela appka v metadátach (disciplína nasadenia,
-- `lib/actions/auth.ts`). Metadáta si píše prehliadač, ale podvrhnutá hodnota
-- nedá nič — účet by sa len sám zamkol v cudzej appke. Neznáma alebo chýbajúca
-- hodnota = tenis, rovnako ako `getDeploymentDiscipline()`.
--
-- Telo je nasadená definícia z `20260816090000_promo_codes.sql` (overené cez
-- pg_get_functiondef) + `v_discipline`.
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
  if v_role = 'coach' then
    v_discipline := case new.raw_user_meta_data ->> 'discipline'
      when 'fitness' then 'fitness'
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
