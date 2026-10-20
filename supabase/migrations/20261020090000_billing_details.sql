-- Fakturačné údaje platiaceho účtu — firma, adresa, IČO a DIČ na faktúre.
--
-- Prečo vôbec: tréner, ktorý kupuje na firmu, nemal na faktúre ani názov
-- firmy, ani IČO (sťažnosť klienta 2026-10-19). Do pokladne sme neposielali
-- nič a pokladňa Managed Payments sa pýta len na IČ DPH.
--
-- Prečo VLASTNÁ TABUĽKA a nie stĺpce v `profiles`: `authenticated` nemá na
-- `profiles` UPDATE (`20260807110000`) — inak by si účet sám nastavil
-- „zaplatené". Otvárať ju kvôli štyrom políčkam by bolo zbytočné riziko.
--
-- Prečo sa údaje do Stripe NEPOSIELAJÚ ako meno a adresa zákazníka: pokladňa
-- Managed Payments `customer.name` aj `customer.address` po platbe PREPÍŠE
-- (menom z karty, adresu zúži na krajinu) a zabrániť tomu nejde —
-- `customer_update` Stripe pri Managed Payments odmietne. Overené testovacou
-- platbou 2026-10-20. Prežijú len `invoice_settings.custom_fields` (najviac
-- štyri, hodnota najviac 140 znakov), preto idú všetky štyri údaje tam
-- (`lib/stripe.ts#billingCustomFields`).
--
-- IČ DPH tu zámerne NIE JE: mení daňový režim platby, pýta sa naň pokladňa
-- sama a Stripe ho overuje. Neplatiteľ DPH ho vyplniť nesmie.
--
-- Migrácia ide na prod v SQL Editore PRED pushom: kód číta `billing_details`.

create table public.billing_details (
  user_id uuid primary key references auth.users (id) on delete cascade,
  company text check (char_length(company) <= 140),
  address text check (char_length(address) <= 140),
  company_id text check (char_length(company_id) <= 140),
  tax_id text check (char_length(tax_id) <= 140),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.billing_details is
  'Fakturačné údaje platiaceho účtu. Do Stripe idú ako invoice_settings.custom_fields zákazníka (lib/stripe.ts), lebo meno a adresu zákazníka pokladňa Managed Payments prepíše.';

alter table public.billing_details enable row level security;

create trigger billing_details_set_updated_at
  before update on public.billing_details
  for each row execute function public.set_updated_at();

-- `revoke` je POVINNÉ, nie dekoratívne: default privileges schémy `public` by
-- tabuľke inak dali práva, ktoré tu nikto nevypísal (CLAUDE.md, „grant nič
-- neodoberá"). DELETE nikto nepotrebuje — vymazanie údajov je uloženie
-- prázdnych políčok a riadok zanikne s účtom (`on delete cascade`).
revoke all on public.billing_details from anon, authenticated;
grant select, insert, update on public.billing_details to authenticated;
grant select, insert, update, delete on public.billing_details to service_role;

-- Každý vidí a mení len svoj riadok. `user_id` sa pri UPDATE zmeniť nedá
-- inak než na seba (`with check`), takže si nikto nepreberie cudzí riadok.
create policy "billing_details_select_own"
  on public.billing_details for select
  using (user_id = (select auth.uid()));

create policy "billing_details_insert_own"
  on public.billing_details for insert
  with check (user_id = (select auth.uid()));

create policy "billing_details_update_own"
  on public.billing_details for update
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
