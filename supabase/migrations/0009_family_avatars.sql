-- 0009_family_avatars.sql
-- Prywatne avatary rodzin. Obiekty Storage są zapisywane i odczytywane wyłącznie
-- przez Route Handlery korzystające z service_role. Klienci nie dostają polityk
-- na storage.objects ani bezpośredniego prawa do zmiany profiles.avatar_path.

begin;

alter table public.profiles
  add column avatar_path text,
  add constraint profiles_avatar_path_format check (
    avatar_path is null
    or avatar_path ~ (
      '^' || id::text ||
      '/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}[.]webp$'
    )
  );

-- Dotychczasowy grant tabelowy obejmowałby również nową kolumnę. Zamieniamy go
-- na granty kolumnowe, aby avatar_path dało się zmieniać tylko serwerowo.
revoke update on public.profiles from authenticated;
grant update (
  profile_name,
  num_children,
  children_ages,
  interests,
  contact_phone,
  contact_phone_country,
  contact_email,
  contact_fb,
  contact_instagram,
  city,
  postal_code,
  voivodeship
) on public.profiles to authenticated;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'family-avatars',
  'family-avatars',
  false,
  524288,
  array['image/webp']::text[]
)
on conflict (id) do update
set
  name = excluded.name,
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Celowo nie tworzymy żadnych polityk SELECT/INSERT/UPDATE/DELETE na
-- storage.objects dla anon ani authenticated. service_role omija RLS.

create or replace view public.family_map
with (security_barrier = true)
as
select
  p.id as profile_id,
  p.profile_name,
  p.city,
  p.postal_code,
  p.voivodeship,
  p.interests,
  p.num_children,
  p.children_ages,
  p.contact_phone,
  p.contact_email,
  p.contact_fb,
  p.contact_instagram,
  p.updated_at,
  ml.latitude,
  ml.longitude,
  ml.geo_status,
  abs(hashtext(p.id::text)::bigint) as marker_seed,
  p.avatar_path
from public.profiles p
left join public.map_locations ml
  on ml.postal_code = p.postal_code
 and ml.city = p.city
 and ml.voivodeship = p.voivodeship
where p.map_visible = true;

grant select on public.family_map to anon, authenticated;
grant select on public.family_map to service_role;

commit;
