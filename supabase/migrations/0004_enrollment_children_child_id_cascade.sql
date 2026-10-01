-- 0004_enrollment_children_child_id_cascade.sql
-- Usunięcie RESTRICT na enrollment_children.child_id.
-- RESTRICT powodował błąd usunięcia użytkownika (GoTrue admin deleteUser → 500):
-- kaskada auth.users → profiles → children trafiała na RESTRICT, bo snapshoty
-- w enrollment_children wciąż odwoływały się do dzieci w momencie ich usuwania.
-- Aplikacja nie usuwa dzieci pojedynczo (tylko przez kaskadę z profilu/użytkownika),
-- więc CASCADE nie gubi żadnych danych, które i tak zniknęłyby wraz z profilem.

alter table public.enrollment_children
  drop constraint enrollment_children_child_id_fkey,
  add constraint enrollment_children_child_id_fkey
    foreign key (child_id) references public.children (id) on delete cascade;