-- =============================================================================
-- Samostatný tréner smie mať viac aktívnych hráčov (cenové hladiny)
-- =============================================================================
-- Doteraz platilo 1:1 — samostatný tréner mal najviac jedného aktívneho hráča
-- a držal to unikátny index `one_active_player`. Tréner s viacerými zverencami
-- ich musel prepínať cez archív, prípadne si založiť druhý účet.
--
-- Od 2026-08-10 je počet hráčov **cenová hladina**: appka viac hráčov umožní,
-- ale koľko ich smie byť naraz aktívnych, hovorí `profiles.player_limit`.
--
-- Aparát na viacerých hráčov už existuje — postavil sa pre federačný režim
-- (`getSelectedPlayer()` pracuje so zoznamom, prepínač hráčov a roster so stavmi
-- sa zapínajú pri 2+). Táto migrácia teda nič nestavia, len **uvoľňuje zámok**
-- a pridáva mieru.
--
-- POZOR — limit sa NEVYNUCUJE tu, ale v server actions (`lib/subscription.ts`).
-- Je to tá istá vedomá výnimka ako pri paywalle a z toho istého dôvodu: RLS
-- stráži VLASTNÍCTVO (cudzí riadok nevydá nikomu), kým počet hráčov je obchodná
-- podmienka. Vpísať ju do policy by znamenalo pridať poddotaz s počítaním do
-- každej write policy na `players`. Appka zakladá hráčov výhradne cez server
-- actions, takže stráž je serverová hranica, nie skrytie tlačidla.
-- =============================================================================


-- ---------------------------------------------------------------------------
-- Zámok „jeden aktívny hráč" padá
-- ---------------------------------------------------------------------------
-- Index bol čiastočný (`... and organization_id is null`) — federačného trénera
-- sa netýkal už od 20260803090000. Teraz padá aj pre osobných hráčov.
--
-- Index pritom robil aj druhú, nenápadnú prácu: bol jediným indexom nad
-- `players.coach_id`. Bez náhrady by každé načítanie hráčov trénera skončilo
-- sekvenčným prechodom celej tabuľky, takže hneď pod ním pribúda plnohodnotný.
drop index public.one_active_player;

create index players_coach_idx on public.players (coach_id);


-- ---------------------------------------------------------------------------
-- Koľko hráčov smie mať účet naraz aktívnych
-- ---------------------------------------------------------------------------
-- Default 1 zámerne: appka je na produkcii a nikto dnes viac než jedného
-- aktívneho hráča nemá (držal to index vyššie), takže sa **nikomu nič nemení**
-- — ani nepribúda zadarmo, ani neuberá. Vyššiu hladinu dostane účet jedným
-- `update public.profiles set player_limit = 5 where id = '…'`, presne ako sa
-- dnes predávajú sedadlá organizácii (`organizations.seat_limit`).
--
-- Do limitu sa počítajú len AKTÍVNI hráči — archív je uzavretá história a platiť
-- za ňu nedáva zmysel. Zníženie hladiny pod aktuálny počet nikoho nevyhodí,
-- len zabráni pridať ďalšieho (rovnaké správanie ako pri sedadlách).
--
-- Federačného trénera sa stĺpec netýka: `getSubscription()` mu vráti
-- `coveredByOrganization` ešte pred čítaním profilu — za neho platí organizácia
-- a počet hráčov mu určuje šéftréner priradením, nie predplatné.
alter table public.profiles
  add column player_limit integer not null default 1;

alter table public.profiles
  add constraint profiles_player_limit_positive check (player_limit >= 1);

-- Účet si hladinu nesmie zdvihnúť sám. Nič sa tu nezavádza — `authenticated`
-- prišiel o `update` na `profiles` už v 20260807110000 (aby si nenastavil
-- „zaplatené"), takže sa nový stĺpec zvezie s tou istou ochranou. Zapisuje
-- `service_role`, odkiaľ to neskôr bude robiť Stripe webhook.
comment on column public.profiles.player_limit is
  'Koľko hráčov smie mať účet naraz aktívnych (cenová hladina). Vynucuje sa v server actions, nie v RLS — viď lib/subscription.ts.';
