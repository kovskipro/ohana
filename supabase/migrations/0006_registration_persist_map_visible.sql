-- Zapisywanie wyboru widoczności na mapie podczas rejestracji.
-- Bez nowego pola: to ta sama wartość profiles.map_visible, którą później
-- zmienia użytkownik w /profil (set_map_visibility).
create or replace function public.complete_registration(payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  c jsonb;
begin
  if caller is null then raise exception 'ERR_AUTH'; end if;
  if not exists (select 1 from public.profiles where id = caller) then
    raise exception 'ERR_PROFILE_MISSING';
  end if;

  if nullif(payload ->> 'profile_name', '') is null then raise exception 'ERR_PROFILE_NAME'; end if;
  if nullif(payload ->> 'city', '') is null then raise exception 'ERR_CITY'; end if;
  if nullif(payload ->> 'voivodeship', '') is null then raise exception 'ERR_VOIVODESHIP'; end if;
  if (payload ->> 'postal_code') !~ '^\d{2}-\d{3}$' then raise exception 'ERR_POSTAL'; end if;
  if coalesce(payload ->> 'num_children', '0')::int < 1 then raise exception 'ERR_NUM_CHILDREN'; end if;
  if not (
    coalesce(payload ->> 'contact_phone', '') <> ''
    or coalesce(payload ->> 'contact_email', '') <> ''
    or coalesce(payload ->> 'contact_fb', '') <> ''
    or coalesce(payload ->> 'contact_instagram', '') <> ''
  ) then raise exception 'ERR_CONTACT_MIN'; end if;

  update public.profiles p
     set profile_name = payload ->> 'profile_name',
         num_children = (payload ->> 'num_children')::int,
         children_ages = coalesce(
           (select array_agg(elem::smallint)
              from jsonb_array_elements_text(coalesce(payload -> 'children_ages', '[]'::jsonb)) t(elem)),
           '{}'::smallint[]
         ),
         interests = coalesce(
           (select array_agg(elem)
              from jsonb_array_elements_text(coalesce(payload -> 'interests', '[]'::jsonb)) t(elem)),
           '{}'::text[]
         ),
         contact_phone = nullif(payload ->> 'contact_phone', ''),
         contact_phone_country = coalesce(nullif(payload ->> 'contact_phone_country', ''), '+48'),
         contact_email = nullif(payload ->> 'contact_email', ''),
         contact_fb = nullif(payload ->> 'contact_fb', ''),
         contact_instagram = nullif(payload ->> 'contact_instagram', ''),
         city = payload ->> 'city',
         postal_code = payload ->> 'postal_code',
         voivodeship = payload ->> 'voivodeship',
         map_visible = coalesce(payload -> 'map_visible', 'false')::boolean
   where p.id = caller;

  for c in select * from jsonb_array_elements(coalesce(payload -> 'children', '[]'::jsonb)) loop
    if nullif(c ->> 'first_name', '') is null
       or nullif(c ->> 'last_name', '') is null
       or nullif(c ->> 'birth_date', '') is null
       or nullif(c ->> 'birth_place', '') is null
       or (c ->> 'pesel') !~ '^\d{11}$' then
      raise exception 'ERR_CHILD_FIELDS';
    end if;
    insert into public.children
      (profile_id, first_name, last_name, birth_date, birth_place, pesel)
    values
      (caller, c ->> 'first_name', c ->> 'last_name',
       (c ->> 'birth_date')::date, c ->> 'birth_place', c ->> 'pesel')
    on conflict (profile_id, pesel) do nothing;
  end loop;

  insert into public.consents (profile_id, consent_type, policy_version, granted, granted_at)
  values
    (caller, 'privacy_policy',
     coalesce(payload -> 'consents' -> 'privacy_policy' ->> 'version', '1.0'), true, now()),
    (caller, 'data_processing',
     coalesce(payload -> 'consents' -> 'data_processing' ->> 'version', '1.0'), true, now())
  on conflict (profile_id, consent_type, policy_version)
    do update set granted = true, revoked_at = null;

  return caller;
end;
$$;