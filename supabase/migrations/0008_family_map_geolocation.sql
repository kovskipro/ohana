-- 0008_family_map_geolocation.sql
-- Rozszerzenie publicznego widoku family_map o współrzędne z cache map_locations (0007).
-- Zamiast nowego widoku modyfikujemy istniejący family_map — /mapa i testy
-- (rls_security_tests.sql, e2e) działają bez zmian, a jedynie dostają dodatkowe
-- kolumny latitude/longitude (NULL, gdy brak współrzędnych), geo_status oraz
-- marker_seed.
--
-- Join obejmuje WSZYSTKIE rekordy map_locations (w tym geo_status = 'failed').
-- Constraint w 0007 gwarantuje, że 'failed' ma latitude/longitude = NULL, więc
-- pinezka i tak nie powstanie — ale family_map.geo_status zwróci wtedy 'failed',
-- co pozwala UI odróżnić nieudane geokodowanie od lokalizacji, której w ogóle
-- jeszcze nie próbowano geokodować (NULL).
--
-- Bezpieczeństwo (wzorzec jak w 0001):
--  * security_barrier = true — predykaty widoku (map_visible, geo_status) są
--    stosowane zanim predykaty wywołującego mogłyby zobaczyć podrzędne wiersze.
--  * Widok NIE jest security_invoker — działa z uprawnieniami właściciela, ale
--    ujawnia wyłącznie białą listę kolumn (nigdy PESEL, adres, dzieci, zgody).
--  * marker_seed = deterministyczny, nieujemny hash profile_id (bez surowego UUID),
--    używany do stabilnego rozstawienia rodzin w tej samej lokalizacji (spread).
--  * map_visible = true pozostaje jedynym źródłem widoczności na mapie.
--
-- Uprawnienia nadane w 0001/0003 (select dla anon, authenticated, service_role)
-- są zachowywane przez create or replace view; ponownie je deklarujemy jawnie.

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
  abs(hashtext(p.id::text)::bigint) as marker_seed
from public.profiles p
left join public.map_locations ml
  on ml.postal_code = p.postal_code
 and ml.city = p.city
 and ml.voivodeship = p.voivodeship
where p.map_visible = true;

grant select on public.family_map to anon, authenticated;
grant select on public.family_map to service_role;