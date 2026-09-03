-- =============================================================================
-- Tretí nález (2026-09-02): `anon` mal EXECUTE prakticky na všetkých funkciách
-- =============================================================================
-- Odhalilo sa to náhodou pri `revoke_my_connection` (migrácia
-- `20260902090000`): migrácia mala `revoke all … from public`, a v
-- `pg_proc.proacl` na produkcii aj tak svietilo `anon=X`.
--
-- **`revoke … from public` odoberie len právo roly PUBLIC.** Explicitné
-- granty, ktoré novej funkcii dajú predvolené práva schémy (`anon`,
-- `authenticated`, `service_role`), tým nezmiznú. Je to tá istá zásada
-- „`grant` nič neodoberá, over si skutočný stav", akú si repo zapísalo po
-- audite 2026-08-15 pri TABUĽKÁCH (`20260809092000`, `20260815110000`) — len
-- teraz platí na FUNKCIÁCH. Migrácia `20260815120000` preto svoju úlohu
-- splnila len spolovice: PUBLIC prestal spúšťať čokoľvek, `anon` nie.
--
-- Rozsah na produkcii: **27 funkcií, teda prakticky všetky** okrem
-- `revoke_my_connection`, ktorá `anon` odoberá výslovne.
--
-- **NEBOLA to diera a je dôležité vedieť prečo.** Každá z tých funkcií
-- odvodzuje oprávnenie z `auth.uid()`. Neprihlásený ho nemá, takže dostane
-- `not_authenticated`, alebo funkcia neurobí nič. Držalo nás teda JEDINE telo
-- každej jednej funkcie. Prvá funkcia, ktorá na `auth.uid()` zabudne, by bola
-- volateľná z celého internetu — a v migrácii by to vyzeralo správne. Po tejto
-- migrácii drží plot aj vrstva pod ním.
--
-- **Prečo cyklom a nie menným zoznamom:** menný zoznam zostavený z LOKÁLU na
-- produkciu nesadne. Potvrdilo sa to už dvakrát (`20260809091000` pri grantoch,
-- `20260815120000` pri PUBLIC EXECUTE) — lokálna inštancia vznikla s inými
-- predvolenými právami Supabase než produkčná.
--
-- **Prečo to nespadne vnútri RLS policy.** Časť týchto funkcií
-- (`current_org_id`, `is_assigned_player`, `owns_personal_player`,
-- `reads_linked_*`) sa volá v policy. Keby ju `anon` potreboval vyhodnotiť,
-- dotaz by neskončil prázdnym výsledkom, ale CHYBOU — mlčky by to nezlyhalo.
-- Nestane sa to preto, že `anon` nemá na žiadnej tabuľke v `public` ani jedno
-- právo (`20260809092000`), takže ho zamietne už grant a k vyhodnoteniu policy
-- sa nedostane; a `security definer` funkcie vnútri bežia ako vlastník, nie ako
-- volajúci. **Neoveruje sa to úvahou:** stráži to `scripts/dev-tests/
-- security-boundaries.js` §7, ktorý číta skutočný obsah `pg_proc`.
-- =============================================================================

do $$
declare
  v_function record;
begin
  for v_function in
    select p.oid::regprocedure as signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prokind in ('f', 'p')  -- funkcie a procedúry, nie agregáty
  loop
    execute format('revoke all on function %s from anon', v_function.signature);
  end loop;
end $$;

-- -----------------------------------------------------------------------------
-- Dve ZÁMERNÉ výnimky — obe musia ostať volateľné bez prihlásenia
-- -----------------------------------------------------------------------------
-- Cyklus vyššie ich zobral spolu so zvyškom, tu sa vracajú výslovne. Zoznam je
-- úplný: čokoľvek ďalšie, čo tu raz pribudne, je rozhodnutie, ktoré treba
-- odôvodniť rovnako ako tieto dve.
--
-- 1. `organization_by_slug` — `proxy.ts` ju volá pri KAŽDEJ požiadavke na org
--    subdoménu, teda aj pre neprihláseného (mapuje hostname → organizácia ešte
--    pred prihlásením). Bez nej by naraz padli všetky org subdomény. Vracia len
--    `id, name, slug, sport` — žiadne sedadlá ani predplatné.
grant execute on function public.organization_by_slug(text) to anon;

-- 2. `promo_code_is_valid` — registrácia je z definície bez prihlásenia
--    (`lib/actions/auth.ts`). Vracia iba áno/nie, nikdy nič z tabuľky, takže sa
--    cez ňu nedá zistiť, čo kód dáva ani koľko použití mu ostáva.
grant execute on function public.promo_code_is_valid(text) to anon;

-- -----------------------------------------------------------------------------
-- Poistka na ďalšie funkcie
-- -----------------------------------------------------------------------------
-- Bez tohto by presne ten istý nález vznikol pri prvej ďalšej `create function`
-- — predvolené práva schémy jej `anon` dajú znova. Doplnok k tomu istému
-- riadku pre PUBLIC v `20260815120000` a pre tabuľky v `20260809092000`.
--
-- POZOR: `alter default privileges` platí pre rolu, ktorá ho nastavila. Toto
-- beží ako `postgres` (rovnako v `supabase migration up` aj v prod SQL editore),
-- teda proti tej istej role, ktorá objekty zakladá. Keby predvolený grant
-- pochádzal od inej roly, tento riadok ho nezruší — preto stav NIKDY neodvodzuj
-- z tejto migrácie, ale si ho prečítaj z `pg_proc.proacl`.
alter default privileges in schema public
  revoke execute on functions from anon;
