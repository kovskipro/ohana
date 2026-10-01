-- 0005_enrollments_decided_by_set_null.sql
-- Usunięcie admina, który podejmował decyzje, kończyło się błędem:
-- enrollments.decided_by (FK bez akcji) blokował delete z auth.users.
-- Semantycznie poprawne: po usunięciu konta admina decyzja pozostaje,
-- a odwołanie do admina staje się null.

alter table public.enrollments
  drop constraint enrollments_decided_by_fkey,
  add constraint enrollments_decided_by_fkey
    foreign key (decided_by) references auth.users (id) on delete set null;