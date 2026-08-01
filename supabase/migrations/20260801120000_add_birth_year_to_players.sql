-- Ročník narodenia namiesto presného dátumu: tréner zadáva len rok narodenia.
-- Pridáme birth_year (smallint) a doplníme ho z existujúceho birth_date.
-- birth_date ostáva v tabuľke (nezahadzujeme historické dáta), appka ho už ale
-- nepoužíva ani nezapisuje — číta/píše výhradne birth_year.

alter table public.players
  add column if not exists birth_year smallint;

update public.players
  set birth_year = extract(year from birth_date)::smallint
  where birth_date is not null
    and birth_year is null;
