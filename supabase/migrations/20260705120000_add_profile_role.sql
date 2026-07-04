-- Rola profilu — tréner, rodič a manažér majú rovnaké oprávnenia (rovnaký typ účtu),
-- rola slúži len na rozlíšenie v UI a budúce reporty
alter table public.profiles
  add column role text not null default 'coach' check (role in ('coach', 'parent', 'manager'));

-- Trigger pri registrácii teraz ukladá aj meno a rolu zadané vo formulári
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'full_name',
    coalesce(new.raw_user_meta_data ->> 'role', 'coach')
  );
  return new;
end;
$$;
