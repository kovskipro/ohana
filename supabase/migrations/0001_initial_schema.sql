-- 0001_initial_schema.sql
-- Ohana — model danych + RLS + funkcje SECURITY DEFINER.
-- Region: West EU (Paris). Na tym etapie żadne dane nie są przekazywane do WRA.

begin;

-- ============================================================
-- Typy i helpery
-- ============================================================

do $$
begin
  create type public.enrollment_status as enum ('pending', 'accepted', 'rejected');
exception when duplicate_object then null;
end $$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Rola admina czytana wyłącznie z JWT (app_metadata). Nigdy z raw_user_meta_data.
create or replace function public.is_admin()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(
    (select (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'),
    false
  );
$$;

-- ============================================================
-- profiles (1:1 z auth.users)
-- ============================================================

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  profile_name text not null default '',
  num_children smallint not null default 1 check (num_children >= 1),
  children_ages smallint[] not null default '{}'::smallint[],
  interests text[] not null default '{}'::text[],
  contact_phone text,
  contact_phone_country text not null default '+48',
  contact_email text,
  contact_fb text,
  contact_instagram text,
  city text not null default '',
  postal_code text not null default '',
  voivodeship text not null default '',
  map_visible boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ============================================================
-- children — stabilny rekord dziecka (używany przez wiele enrollmentów)
-- ============================================================

create table public.children (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  first_name text not null,
  last_name text not null,
  birth_date date not null,
  birth_place text not null,
  pesel text not null check (pesel ~ '^\d{11}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (profile_id, pesel)
);

create trigger children_set_updated_at
  before update on public.children
  for each row execute function public.set_updated_at();

create index children_profile_idx on public.children (profile_id);

-- ============================================================
-- enrollments — decyzja accepted/rejected dotyczy CAŁEJ rodziny na rok szkolny
-- ============================================================

create table public.enrollments (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  school_year text not null check (school_year ~ '^\d{4}/\d{4}$'),
  status public.enrollment_status not null default 'pending',
  parent_first_name text not null,
  parent_last_name text not null,
  parent_phone text not null,
  parent_phone_country text not null default '+48',
  parent_email text not null,
  parent_fb_link text,
  decided_at timestamptz,
  decided_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (profile_id, school_year),
  constraint enrollments_status_decided check (
    (status = 'pending') = (decided_at is null)
  )
);

create trigger enrollments_set_updated_at
  before update on public.enrollments
  for each row execute function public.set_updated_at();

create index enrollments_profile_idx on public.enrollments (profile_id);
create index enrollments_status_idx on public.enrollments (status);
create index enrollments_decided_at_idx on public.enrollments (decided_at)
  where status = 'rejected';

-- ============================================================
-- enrollment_children — SNAPSHOT danych dziecka dla konkretnego enrollmentu
-- ============================================================

create table public.enrollment_children (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references public.enrollments (id) on delete cascade,
  child_id uuid not null references public.children (id) on delete restrict,
  first_name text not null,
  last_name text not null,
  birth_date date not null,
  birth_place text not null,
  pesel text not null,
  street text not null,
  house_number text not null,
  city text not null,
  postal_code text not null,
  voivodeship text not null,
  school_class text not null,
  created_at timestamptz not null default now(),
  unique (enrollment_id, child_id)
);

create index enrollment_children_enrollment_idx on public.enrollment_children (enrollment_id);
create index enrollment_children_child_idx on public.enrollment_children (child_id);

-- ============================================================
-- consents — zgody przechowywane w naszych tabelach, NIE w raw_user_meta_data
-- ============================================================

create table public.consents (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  consent_type text not null check (consent_type in ('privacy_policy', 'data_processing', 'map_publication')),
  policy_version text not null,
  granted boolean not null default true,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  unique (profile_id, consent_type, policy_version)
);

create index consents_profile_idx on public.consents (profile_id);

-- ============================================================
-- RLS + uprawnienia
-- ============================================================

alter table public.profiles enable row level security;
alter table public.children enable row level security;
alter table public.enrollments enable row level security;
alter table public.enrollment_children enable row level security;
alter table public.consents enable row level security;

-- Wszystkie zapisy (poza profilem właściciela) tylko przez RPC SECURITY DEFINER.
create policy profiles_select on public.profiles
  for select using (auth.uid() = id or public.is_admin());
create policy profiles_update on public.profiles
  for update using (auth.uid() = id or public.is_admin())
  with check (auth.uid() = id or public.is_admin());

create policy children_select on public.children
  for select using (profile_id = auth.uid() or public.is_admin());

create policy enrollments_select on public.enrollments
  for select using (profile_id = auth.uid() or public.is_admin());

create policy enrollment_children_select on public.enrollment_children
  for select using (
    exists (
      select 1 from public.enrollments e
      where e.id = enrollment_children.enrollment_id
        and (e.profile_id = auth.uid() or public.is_admin())
    )
  );

create policy consents_select on public.consents
  for select using (profile_id = auth.uid() or public.is_admin());

revoke all on public.profiles, public.children, public.enrollments,
  public.enrollment_children, public.consents from anon, authenticated;

grant select on public.profiles, public.children, public.enrollments,
  public.enrollment_children, public.consents to authenticated;
grant update on public.profiles to authenticated;

-- ============================================================
-- Automatyczne tworzenie profilu po rejestracji (trigger na auth.users)
-- ============================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id)
  values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- RPC: rejestracja (profil + dzieci + zgody). Właściciel = auth.uid(), nie payload.
-- ============================================================

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
         voivodeship = payload ->> 'voivodeship'
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

-- ============================================================
-- RPC: utworzenie enrollmentu (pending) + snapshoty dzieci.
-- Właściciel = auth.uid(). Dziecko musi należeć do wywołującego.
-- ============================================================

create or replace function public.create_enrollment(payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  school_year text := payload ->> 'school_year';
  eid uuid;
  c jsonb;
  ch public.children%rowtype;
begin
  if caller is null then raise exception 'ERR_AUTH'; end if;
  if school_year is null or school_year !~ '^\d{4}/\d{4}$' then raise exception 'ERR_YEAR'; end if;
  if not exists (select 1 from public.profiles where id = caller) then
    raise exception 'ERR_PROFILE_MISSING';
  end if;
  if nullif(payload ->> 'parent_first_name', '') is null
     or nullif(payload ->> 'parent_last_name', '') is null
     or nullif(payload ->> 'parent_email', '') is null
     or nullif(payload ->> 'parent_phone', '') is null then
    raise exception 'ERR_PARENT_FIELDS';
  end if;
  if jsonb_array_length(coalesce(payload -> 'children', '[]'::jsonb)) = 0 then
    raise exception 'ERR_NO_CHILDREN';
  end if;

  insert into public.enrollments
    (profile_id, school_year, status,
     parent_first_name, parent_last_name, parent_phone, parent_phone_country,
     parent_email, parent_fb_link)
  values
    (caller, school_year, 'pending',
     payload ->> 'parent_first_name', payload ->> 'parent_last_name',
     payload ->> 'parent_phone',
     coalesce(nullif(payload ->> 'parent_phone_country', ''), '+48'),
     payload ->> 'parent_email', nullif(payload ->> 'parent_fb_link', ''))
  returning id into eid;

  for c in select * from jsonb_array_elements(payload -> 'children') loop
    select * into ch
      from public.children
     where id = (c ->> 'child_id')::uuid
       and profile_id = caller;
    if not found then raise exception 'ERR_FOREIGN_CHILD'; end if;

    if nullif(c ->> 'school_class', '') is null
       or nullif(c ->> 'street', '') is null
       or nullif(c ->> 'house_number', '') is null
       or nullif(c ->> 'city', '') is null
       or nullif(c ->> 'voivodeship', '') is null then
      raise exception 'ERR_SNAPSHOT_FIELDS';
    end if;

    insert into public.enrollment_children
      (enrollment_id, child_id, first_name, last_name, birth_date, birth_place, pesel,
       street, house_number, city, postal_code, voivodeship, school_class)
    values
      (eid, ch.id, ch.first_name, ch.last_name, ch.birth_date, ch.birth_place, ch.pesel,
       c ->> 'street', c ->> 'house_number', c ->> 'city',
       c ->> 'postal_code', c ->> 'voivodeship', c ->> 'school_class');
  end loop;

  return eid;
end;
$$;

-- ============================================================
-- RPC: mapa — włączenie/wyłączenie publikacji (zgoda na publikację)
-- ============================================================

create or replace function public.set_map_visibility(visible boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
begin
  if caller is null then raise exception 'ERR_AUTH'; end if;

  update public.profiles set map_visible = visible where id = caller;

  insert into public.consents (profile_id, consent_type, policy_version, granted, granted_at, revoked_at)
  values (caller, 'map_publication', '1.0', visible, now(),
          case when visible then null else now() end)
  on conflict (profile_id, consent_type, policy_version)
    do update set
      granted = excluded.granted,
      revoked_at = case when excluded.granted then null else excluded.revoked_at end;
end;
$$;

-- ============================================================
-- RPC: zmiana statusu enrollmentu — wyłącznie dla admina.
-- decided_by = auth.uid() admina, nigdy dane z klienta.
-- ============================================================

create or replace function public.admin_set_enrollment_status(
  target_enrollment uuid,
  new_status text
)
returns public.enrollments
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  res public.enrollments%rowtype;
begin
  if caller is null or not public.is_admin() then raise exception 'ERR_FORBIDDEN'; end if;
  if new_status not in ('pending', 'accepted', 'rejected') then raise exception 'ERR_STATUS'; end if;

  update public.enrollments e
     set status = new_status::public.enrollment_status,
         decided_at = case when new_status = 'pending' then null else now() end,
         decided_by = case when new_status = 'pending' then null else caller end
   where e.id = target_enrollment
  returning * into res;

  if not found then raise exception 'ERR_NOT_FOUND'; end if;
  return res;
end;
$$;

-- ============================================================
-- RPC: nadanie/odebranie roli admina — wyłącznie dla admina.
-- Rola zapisywana w app_metadata (bezpieczne), nie w raw_user_meta_data.
-- ============================================================

create or replace function public.admin_set_role(target_user uuid, make_admin boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not public.is_admin() then raise exception 'ERR_FORBIDDEN'; end if;

  update auth.users
     set raw_app_meta_data =
         coalesce(raw_app_meta_data, '{}'::jsonb)
         || jsonb_build_object('role', case when make_admin then 'admin' else 'user' end)
   where id = target_user;

  if not found then raise exception 'ERR_NOT_FOUND'; end if;
end;
$$;

-- ============================================================
-- RPC: retencja — usunięcie odrzuconych enrollmentów po 30 dniach
-- ============================================================

create or replace function public.purge_rejected_enrollments()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  n int;
begin
  delete from public.enrollments
   where status = 'rejected'
     and decided_at < now() - interval '30 days';
  get diagnostics n = row_count;
  return n;
end;
$$;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('ohana-purge-rejected', '0 3 * * *',
                          'select public.purge_rejected_enrollments()');
  end if;
exception when others then null;
end $$;

-- ============================================================
-- Publiczny widok mapy — WYŁĄCZNIE dane do publikacji, nigdy PESEL.
-- Widok nie jest security_invoker, więc wykonuje się z uprawnieniami właściciela,
-- ale zwraca wyłącznie białą listę kolumn i tylko rodziny z map_visible = true.
-- ============================================================

create or replace view public.family_map
with (security_barrier = true)
as
select
  id as profile_id,
  profile_name,
  city,
  postal_code,
  voivodeship,
  interests,
  num_children,
  children_ages,
  contact_phone,
  contact_email,
  contact_fb,
  contact_instagram,
  updated_at
from public.profiles
where map_visible = true;

grant select on public.family_map to anon, authenticated;

-- ============================================================
-- Uprawnienia do funkcji RPC
-- ============================================================

grant execute on function public.complete_registration(jsonb) to authenticated;
grant execute on function public.create_enrollment(jsonb) to authenticated;
grant execute on function public.set_map_visibility(boolean) to authenticated;
grant execute on function public.admin_set_enrollment_status(uuid, text) to authenticated;
grant execute on function public.admin_set_role(uuid, boolean) to authenticated;
grant execute on function public.purge_rejected_enrollments() to authenticated;

commit;