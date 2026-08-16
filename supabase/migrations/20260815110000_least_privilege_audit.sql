-- =============================================================================
-- Bezpečnostný audit 2026-08-15 — najmenšie potrebné práva
-- =============================================================================
-- Nadväzuje na audit `20260809091000` / `20260809092000`, ktorý to isté urobil
-- pre vtedajšie tabuľky a pre rolu `anon`. Odvtedy pribudli nové tabuľky aj
-- funkcie a ukázalo sa, že problém má SYSTÉMOVÚ príčinu — tú rieši táto
-- migrácia, aby sa to neopakovalo pri každej ďalšej tabuľke.
--
-- ČO SA ZISTILO: `player_links` a `player_assignments` mali pre `authenticated`
-- plné `select, insert, update, delete`, hoci ich migrácie deklarujú `grant
-- select[, insert]`. **`grant` nič neodoberá — len pridáva**, a nová tabuľka
-- už všetko mala z DEFAULT PRIVILEGES schémy `public`. Predošlý audit odvolal
-- default privileges len pre `anon` (`20260809092000`), pre `authenticated`
-- ostali.
--
-- DOPAD BOL NULOVÝ: ani jedna z tých tabuliek nemá UPDATE/DELETE policy, takže
-- RLS zápis zamietla (overené útočnými scenármi). Chýbala však druhá vrstva
-- obrany a komentár v `20260815100000` tvrdil opak — kto by na `player_links`
-- pridal akúkoľvek UPDATE policy, otvoril by zároveň prepísanie
-- `source_player_id` na cudziu kartu. Presne to mala tá veta vylúčiť.
--
-- ZÁSADA, KTORÁ Z TOHO PLATÍ ĎALEJ: po pridaní tabuľky alebo funkcie si over
-- SKUTOČNÝ stav (`information_schema.role_table_grants`, `pg_proc.proacl`),
-- nie to, čo je napísané v migrácii.
-- =============================================================================


-- ---------------------------------------------------------------------------
-- A. Tabuľky — odobrať práva, ktoré appka nepoužíva
-- ---------------------------------------------------------------------------
-- `player_links`: appka kód vkladá (`generateCardLinkCode`) a číta, ale stav
-- mení výhradne cez `claim_player_link` / `revoke_player_link`. Tie sú
-- `security definer`, takže grant nepotrebujú.
revoke update, delete on public.player_links from authenticated;

-- `player_assignments`: zapisovať nesmie nikto priamo — priradenie zakladá
-- trigger `assign_new_org_player` a mení ho `assign_player_to_coach`. Keby mal
-- tréner INSERT, pridelil by si cudzieho hráča organizácie sám.
revoke insert, update, delete on public.player_assignments from authenticated;

-- `metrics_and_tests`: modul kondičných a technických testov je odložený na
-- neurčito a **appka na tabuľku nesiaha ani jedným riadkom** (overené). Policy
-- aj indexy ostávajú pripravené; **keď sa modul bude stavať, granty treba
-- vrátiť** (`grant select, insert, update, delete … to authenticated`), inak
-- budú policy platiť nad právami, ktoré nikto nemá.
revoke insert, update, delete on public.metrics_and_tests from authenticated;


-- ---------------------------------------------------------------------------
-- B. Default privileges — aby to isté nevzniklo pri ďalšej tabuľke
-- ---------------------------------------------------------------------------
-- Toto je vlastná príčina nálezu. Bez tohto riadku dostane každá ďalšia
-- tabuľka plné DML automaticky a `grant select` v jej migrácii bude opäť len
-- deklarácia bez účinku.
--
-- `select` sa zámerne NEODVOLÁVA: čítanie je v tejto appke pravidlo (každá
-- tabuľka ho pre `authenticated` potrebuje) a stráži ho RLS. Zápis je naopak
-- výnimka a má sa vypýtať explicitne.
--
-- Platí pre objekty vytvorené rolou `postgres` — tou bežia migrácie aj SQL
-- Editor. Rola `supabase_admin` má vlastné default privileges, do tých sa
-- nesiaha (nimi vznikajú systémové objekty Supabase).
alter default privileges in schema public
  revoke insert, update, delete on tables from authenticated;


-- ---------------------------------------------------------------------------
-- C. Funkcie — PUBLIC nemá čo spúšťať
-- ---------------------------------------------------------------------------
-- PostgreSQL dáva PUBLIC (teda aj `anon`) EXECUTE na každej novej funkcii,
-- pokiaľ sa to výslovne neodvolá. Novšie funkcie `revoke … from public` majú,
-- staršie nie — táto migrácia to zjednocuje.
--
-- Dopad bol aj tu nulový: každá z nich sa bráni cez `auth.uid()`, takže
-- neprihlásený padne na `not_director` / `not_authenticated` alebo dostane
-- prázdny výsledok (overené). Ide o odstránenie zbytočnej plochy — jedna
-- zabudnutá kontrola v budúcnosti by inak stačila na dieru.
revoke all on function public.assign_player_to_coach(uuid, uuid) from public;
revoke all on function public.claim_organization_invite(text) from public;
revoke all on function public.claim_player_connection(text) from public;
revoke all on function public.copy_session_to_org_player(uuid, uuid) from public;
revoke all on function public.current_org_id() from public;
revoke all on function public.current_org_role() from public;
revoke all on function public.delete_organization_member(uuid) from public;
revoke all on function public.is_member_of_my_org(uuid) from public;
revoke all on function public.org_players_for_copy() from public;

-- `organization_by_slug` je jediná zámerne verejná funkcia: `proxy.ts` ju volá
-- pri každej požiadavke na org subdoménu, teda aj pred prihlásením. Preto jej
-- PUBLIC berieme, ale `anon` grant necháva — ten má explicitne z vlastnej
-- migrácie a bez neho by prestali fungovať všetky org subdomény.
revoke all on function public.organization_by_slug(text) from public;
grant execute on function public.organization_by_slug(text) to anon, authenticated;

alter default privileges in schema public
  revoke execute on functions from public;
