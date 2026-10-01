-- 0007_map_locations.sql
-- Wspólny cache lokalizacji geokodowanych (server-side Nominatim):
-- (postal_code, city, voivodeship) → jedna współrzędna bazowa.
-- Jedna współrzędna na lokalizację — wiele rodzin w tej samej lokalizacji
-- współdzieli jeden wiersz (PK), więc geokodujemy raz, nie per rodzina.
--
-- Atrybucja (wymóg OSMF Nominatim Usage Policy, dane ODbL/OpenStreetMap):
-- wyświetlanie „© OpenStreetMap contributors" na mapie oraz oznaczenie atrybucji
-- bazy wyników geokodowania w dokumentacji (AGENTS.md / README). Cache przechowuje
-- wyłącznie współrzędne i status, nigdy surowe odpowiedzi API.
-- Geokoder jest ukryty za adapterem/interfejsem (src/lib/maps/geocoder.ts),
-- więc dostawca (Nominatim → MapTiler/Google/Apple) może być wymieniony bez
-- przebudowy aplikacji — wymóg polityki Nominatim (switch bez aktualizacji).
--
-- Bezpieczeństwo:
--  * Tabelę zapisuje WYŁĄCZNIE serwer (Next.js route handler + backfill) klientem service_role.
--  * anon/authenticated: zero grantów i zero polityk RLS → brak jakiegokolwiek dostępu.
--  * NIE istnieje publiczne RPC zapisu — klient nigdy nie przekazuje lat/lng,
--    więc wspólny cache nie może być zatruty z poziomu aplikacji.
--  * Klucz cache = dokładne wartości zapisane w profiles — join w widoku (0008)
--    jest dokładny, bez normalizacji.
--
-- geo_status:
--  * 'exact'        — geokodowanie pełnego (postal_code, city, voivodeship)
--  * 'approximate'  — fallback city + voivodeship (bez kodu pocztowego)
--  * 'failed'       — brak wyniku; retry_after = kiedy ponowić (backfill pomija do tego momentu)
--
-- Spójność stanu wymuszana w DB (check constraints):
--  * 'failed'                       → lat/lng NULL, retry_after NOT NULL
--  * 'exact' / 'approximate'        → lat/lng NOT NULL, retry_after NULL

create table public.map_locations (
  postal_code text not null,
  city text not null,
  voivodeship text not null,
  latitude numeric(9,6),
  longitude numeric(9,6),
  geo_status text not null
    check (geo_status in ('exact', 'approximate', 'failed')),
  retry_after timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (postal_code, city, voivodeship),
  constraint map_locations_state check (
    (geo_status = 'failed' and latitude is null and longitude is null and retry_after is not null)
    or
    (geo_status in ('exact', 'approximate')
       and latitude is not null and longitude is not null and retry_after is null)
  ),
  constraint map_locations_bounds check (
    (latitude is null or (latitude >= -90 and latitude <= 90))
    and
    (longitude is null or (longitude >= -180 and longitude <= 180))
  )
);

create trigger map_locations_set_updated_at
  before update on public.map_locations
  for each row execute function public.set_updated_at();

-- Indeks pod retry nieudanych geokodowań (backfill: retry_after <= now()).
create index map_locations_failed_retry_idx
  on public.map_locations (retry_after)
  where geo_status = 'failed';

alter table public.map_locations enable row level security;

-- Zero dostępu dla klientów; wyłącznie service_role (omija RLS).
revoke all on public.map_locations from anon, authenticated;
grant select, insert, update, delete on public.map_locations to service_role;