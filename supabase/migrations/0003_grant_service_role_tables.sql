-- 0003_grant_service_role_tables.sql
-- Uprawnienia dla service_role (klucz serwerowy) — standardowa konwencja
-- Supabase. Wymagane do seedowania danych testowych w E2E (global setup)
-- oraz do przyszłych operacji administracyjnych po stronie serwera.
-- service_role omija RLS, więc dostęp musi być kontrolowany przez posiadacza
-- klucza — nigdy nie trafia do klienta.

grant select, insert, update, delete on public.profiles to service_role;
grant select, insert, update, delete on public.children to service_role;
grant select, insert, update, delete on public.enrollments to service_role;
grant select, insert, update, delete on public.enrollment_children to service_role;
grant select, insert, update, delete on public.consents to service_role;

grant select on public.family_map to service_role;