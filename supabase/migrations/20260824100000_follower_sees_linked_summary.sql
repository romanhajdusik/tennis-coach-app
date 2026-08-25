-- =============================================================================
-- Sledujúci vidí súhrn druhej disciplíny — ale len keď to vlastník dát pustí
-- =============================================================================
-- Návrh: docs/roadmap-buduce-smery.md §2.3b, rozhodnuté 2026-08-24 (v ten istý
-- deň ako opačný smer pre trénera, `20260824090000` — je to ten istý vzor).
--
-- Čo to rieši: rodič (manažér, hráč) číta KÓPIE tréningov jednej karty, takže
-- o kondičnej príprave svojho dieťaťa nevie nič — trigger `sync_session_to_parent`
-- kopíruje podľa `player_connections.player_id`, a kondičné tréningy sedia na
-- inej karte, na ktorú pripojený nie je. Cross-read (`player_links`) je zas
-- výhradne trénerská vec.
--
-- ROZSAH: **len súhrnný graf podielov zameraní** (rozhodol user 2026-08-24,
-- výslovne „nič viac"). Žiadne kódy cvičení, žiadne poznámky, žiadne tréningy.
--
-- TRI VECI, KTORÉ TENTO MODEL DRŽIA:
--
-- 1. **Vezie sa na PREPOJENÍ KARIET, nie na druhom pripojení rodiča.**
--    Prepojenie už hovorí „sú to tie isté deti", čo je práve tá chýbajúca
--    informácia. Druhé pripojenie by si vyžiadalo uvoľniť
--    `one_active_connection_per_parent` a prerobiť `/parent`, ktorý dodnes
--    počíta s jedným pripojeným hráčom — a to všetko kvôli jednému grafu.
--    **Dôsledok, ktorý treba poznať: bez prepojenia trénerov sledujúci nič
--    neuvidí.** Je to prijaté vedome.
--
-- 2. **Súhlas dáva VLASTNÍK DÁT, teda zdrojová strana** (`source_coach_id`).
--    Že dnes svoju prácu ukazuje tenisovému kolegovi, neznamená, že ju chce
--    posielať ďalej rodičovi — je to samostatné rozhodnutie a samostatný
--    príznak. Rovnaký dôvod, pre ktorý sa 2026-08-22 zamietlo, aby dáta šíril
--    rodič: kto ich nevytvoril, nemá ich komu posúvať.
--
-- 3. **ŽIADNE KÓPIE — a to je vedomý rozdiel oproti zvyšku rodičovskej vrstvy.**
--    `parent_session_records` existujú preto, aby rodičovi história ostala aj
--    po ukončení spolupráce. Tu je to naopak: nie sú to dáta jeho trénera, len
--    mu ich niekto dočasne ukazuje, takže po zrušení prepojenia (alebo súhlasu)
--    majú zmiznúť. Presne ako u trénera.
-- =============================================================================


-- ---------------------------------------------------------------------------
-- A. Druhý príznak na tom istom prepojení
-- ---------------------------------------------------------------------------
-- Vedľa `target_shares_summary` (cieľ ukazuje súhrn späť vydávajúcemu) stojí
-- teraz `source_shares_with_follower` (vydávajúci ukazuje súhrn sledujúcemu
-- druhej karty). Dva rôzne súhlasy dvoch rôznych ľudí — preto dva stĺpce a nie
-- jeden spoločný.
alter table public.player_links
  add column source_shares_with_follower boolean not null default false;

comment on column public.player_links.source_shares_with_follower is
  'Vlastník dát (ten, kto kód vydal) ukazuje SÚHRN svojej práce aj sledujúcemu druhej karty — rodičovi, manažérovi alebo hráčovi (docs §2.3b). Len podiely zameraní; žiadne kódy cvičení, poznámky ani tréningy. Nezávislé od target_shares_summary: súhlas s kolegom nie je súhlas s rodičom.';


-- ---------------------------------------------------------------------------
-- B. Prepnutie súhlasu — smie ho len vlastník dát
-- ---------------------------------------------------------------------------
-- Cez funkciu z rovnakého dôvodu ako všetko ostatné nad touto tabuľkou:
-- **policy na UPDATE nevie obmedziť, KTORÝ stĺpec sa mení**, takže by si
-- volajúci popri príznaku prepísal aj `source_player_id` na cudziu kartu.
create function public.set_link_follower_sharing(
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

  -- Zrkadlovo k `set_link_summary_sharing`: tam rozhoduje cieľ o svojich
  -- dátach, tu zdroj o svojich. Cieľová strana tento príznak prepnúť nesmie —
  -- rozdávala by prácu niekoho iného.
  if v_link.source_coach_id <> auth.uid() then
    raise exception 'not_your_link';
  end if;

  if v_link.status <> 'active' then
    raise exception 'link_not_active';
  end if;

  update public.player_links
  set source_shares_with_follower = p_enabled
  where id = p_link_id;
end;
$$;

revoke all on function public.set_link_follower_sharing(uuid, boolean) from public;
grant execute on function public.set_link_follower_sharing(uuid, boolean) to authenticated;


-- ---------------------------------------------------------------------------
-- C. Samotný súhrn pre sledujúceho — agregát, nie riadky
-- ---------------------------------------------------------------------------
-- Cesta je: volajúci → jeho aktívne pripojenie → karta jeho dieťaťa → aktívne
-- prepojenie tejto karty → karta druhej disciplíny. Každý článok musí platiť,
-- inak funkcia nevráti nič.
--
-- **Hráča si volajúci nevyberá**, na rozdiel od trénerskej obdoby: sledujúci má
-- najviac jedno aktívne pripojenie (`one_active_connection_per_parent`), takže
-- karta z neho vyplýva a nie je čo podvrhnúť.
--
-- Disciplína sa vracia ako stĺpec, lebo sledujúci `player_links` čítať nesmie
-- (policy je len pre obe trénerské strany) a bez nej by appka nevedela, ktorou
-- konfiguráciou graf popísať. Je rovnaká vo všetkých riadkoch.
--
-- Obdobie sa porovnáva presne ako v `getPlayerSessionIdsInPeriod`
-- (`lib/actions/analytics.ts`): reálny dátum, inak plánovaný, v JSON ako úplné
-- ISO reťazce so `Z` — takže `::timestamptz` a `new Date(...)` porovnávajú ten
-- istý okamih.
create function public.follower_linked_category_minutes(
  p_start timestamptz,
  p_end timestamptz
)
returns table (discipline text, category text, duration_minutes integer)
language sql
stable
security definer
set search_path = public
as $$
  select pl.source_discipline, sd.category, sum(sd.duration_minutes)::integer
  from public.player_connections pc
  join public.player_links pl
    on pl.target_player_id = pc.player_id
   and pl.status = 'active'
   and pl.source_shares_with_follower
  join public.sessions s
    on s.player_id = pl.source_player_id
   and s.discipline = pl.source_discipline
  join public.session_drills sd
    on sd.session_id = s.id
   and sd.status = 'played'
  where pc.parent_id = auth.uid()
    and pc.status = 'active'
    and coalesce(s.actual_data ->> 'date', s.planned_data ->> 'date')::timestamptz >= p_start
    and coalesce(s.actual_data ->> 'date', s.planned_data ->> 'date')::timestamptz < p_end
  group by pl.source_discipline, sd.category;
$$;

revoke all on function public.follower_linked_category_minutes(timestamptz, timestamptz) from public;
grant execute on function public.follower_linked_category_minutes(timestamptz, timestamptz) to authenticated;
