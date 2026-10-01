-- ============================================================
-- 0002: RPC add_child — dodanie dziecka do profilu po rejestracji
-- (np. przy enrollmentie na kolejny rok). Idempotentne po PESEL.
-- Właściciel = auth.uid(). Zwraca id dziecka (istniejącego lub nowego).
-- ============================================================

create or replace function public.add_child(payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  existing uuid;
  p_first_name text := payload ->> 'first_name';
  p_last_name text := payload ->> 'last_name';
  p_birth_date text := payload ->> 'birth_date';
  p_birth_place text := payload ->> 'birth_place';
  p_pesel text := payload ->> 'pesel';
begin
  if caller is null then raise exception 'ERR_AUTH'; end if;
  if not exists (select 1 from public.profiles where id = caller) then
    raise exception 'ERR_PROFILE_MISSING';
  end if;

  if nullif(p_first_name, '') is null
     or nullif(p_last_name, '') is null
     or nullif(p_birth_date, '') is null
     or nullif(p_birth_place, '') is null
     or p_pesel !~ '^\d{11}$' then
    raise exception 'ERR_CHILD_FIELDS';
  end if;

  select id into existing
    from public.children
   where profile_id = caller and pesel = p_pesel;
  if found then return existing; end if;

  insert into public.children
    (profile_id, first_name, last_name, birth_date, birth_place, pesel)
  values
    (caller, p_first_name, p_last_name, p_birth_date::date, p_birth_place, p_pesel)
  returning id into existing;

  return existing;
end;
$$;

grant execute on function public.add_child(jsonb) to authenticated;