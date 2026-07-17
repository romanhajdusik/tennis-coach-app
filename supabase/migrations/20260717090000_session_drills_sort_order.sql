-- Ručné preusporiadanie cvičení v pláne (šípky hore/dole, len kým je
-- tréning naplánovaný — RLS na session_drills už blokuje update, ak je
-- session dokončená, netreba žiadnu ďalšiu kontrolu).
alter table public.session_drills add column sort_order integer;

with ranked as (
  select id, row_number() over (partition by session_id order by created_at) as rn
  from public.session_drills
)
update public.session_drills sd
set sort_order = ranked.rn
from ranked
where sd.id = ranked.id;

alter table public.session_drills alter column sort_order set not null;
