-- rls_security_tests.sql
-- Testy bezpieczeństwa RLS/API dla Ohany.
-- Uruchomić jako postgres (rola uprzywilejowana), np.:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/rls_security_tests.sql
-- Wszystkie dane testowe są tworzone w transakcji i cofane na końcu (rollback).
-- Wzorzec: fail-fast — każdy nieudany warunek podnosi wyjątek i przerywa testy.

\set ON_ERROR_STOP on

begin;

-- Testowe konta (stałe UUID, by wnioskować identyfikatory).
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-0000000000aa', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'family-a@test.pl', '', now(), '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-0000000000bb', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'family-b@test.pl', '', now(), '{}'::jsonb, now(), now()),
  ('00000000-0000-0000-0000-0000000000cc', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin@test.pl', '', now(), '{"role":"admin"}'::jsonb, now(), now());

do $$
declare
  n int;
  s text;
  eid uuid;
  newchild uuid;
  rows_updated int;
begin
  -- Trigger on_auth_user_created utworzył profile automatycznie
  select count(*) into n from public.profiles
   where id in ('00000000-0000-0000-0000-0000000000aa',
                '00000000-0000-0000-0000-0000000000bb',
                '00000000-0000-0000-0000-0000000000cc');
  if n <> 3 then raise exception 'FAIL: profile nie powstały automatycznie (%', n; end if;
  raise notice 'OK trigger auto-profil';

  -- ============ Rejestracja rodzin A i B ============
  set role authenticated;

  perform set_config('request.jwt.claims',
    json_build_object('sub','00000000-0000-0000-0000-0000000000aa','role','authenticated','app_metadata','{}'::jsonb)::text, true);
  perform public.complete_registration(json_build_object(
    'profile_name','Rodzina A','num_children',2,'children_ages',json_build_array(5,9),
    'interests',json_build_array('żeglarstwo'),'contact_phone','500000001',
    'contact_email','a@test.pl','city','Warszawa','postal_code','00-001','voivodeship','mazowieckie',
    'children',json_build_array(
      json_build_object('first_name','Anna','last_name','A','birth_date','2017-01-01','birth_place','Warszawa','pesel','11111111111'),
      json_build_object('first_name','Borys','last_name','A','birth_date','2013-01-01','birth_place','Warszawa','pesel','22222222222')
    ),
    'consents',json_build_object('privacy_policy',json_build_object('version','1.0'),'data_processing',json_build_object('version','1.0'))
  )::jsonb);

  perform set_config('request.jwt.claims',
    json_build_object('sub','00000000-0000-0000-0000-0000000000bb','role','authenticated','app_metadata','{}'::jsonb)::text, true);
  perform public.complete_registration(json_build_object(
    'profile_name','Rodzina B','num_children',1,'children_ages',json_build_array(7),
    'interests','[]'::jsonb,'contact_phone','500000002',
    'city','Kraków','postal_code','30-001','voivodeship','małopolskie',
    'children',json_build_array(
      json_build_object('first_name','Celina','last_name','B','birth_date','2015-01-01','birth_place','Kraków','pesel','33333333333')
    ),
    'consents',json_build_object('privacy_policy',json_build_object('version','1.0'),'data_processing',json_build_object('version','1.0'))
  )::jsonb);

  -- ============ TEST 1: anon nie ma dostępu do prywatnych tabel ============
  -- anon nie ma żadnego grantu SELECT na prywatnych tabelach — zapytanie
  -- MUSI zakończyć się błędem braku uprawnień (nie pustym zbiorem).
  set role anon;
  perform set_config('request.jwt.claims',
    json_build_object('sub',null,'role','anon')::text, true);

  begin
    perform count(*) from public.profiles;
    raise exception 'FAIL: anon czyta profiles';
  exception when insufficient_privilege then null; end;
  begin
    perform count(*) from public.children;
    raise exception 'FAIL: anon czyta children';
  exception when insufficient_privilege then null; end;
  begin
    perform count(*) from public.enrollments;
    raise exception 'FAIL: anon czyta enrollments';
  exception when insufficient_privilege then null; end;
  begin
    perform count(*) from public.consents;
    raise exception 'FAIL: anon czyta consents';
  exception when insufficient_privilege then null; end;
  raise notice 'OK T1 anon nie ma dostępu do prywatnych tabel';

  -- ============ TEST 2: rodzina A widzi tylko swoje dane ============
  set role authenticated;
  perform set_config('request.jwt.claims',
    json_build_object('sub','00000000-0000-0000-0000-0000000000aa','role','authenticated','app_metadata','{}'::jsonb)::text, true);

  select count(*) into n from public.profiles where id = '00000000-0000-0000-0000-0000000000aa';
  if n <> 1 then raise exception 'FAIL: A nie widzi swojego profilu'; end if;
  select count(*) into n from public.profiles where id = '00000000-0000-0000-0000-0000000000bb';
  if n <> 0 then raise exception 'FAIL: A widzi profil B'; end if;
  select count(*) into n from public.children where profile_id = '00000000-0000-0000-0000-0000000000bb';
  if n <> 0 then raise exception 'FAIL: A widzi dzieci B'; end if;
  select count(*) into n from public.consents where profile_id = '00000000-0000-0000-0000-0000000000bb';
  if n <> 0 then raise exception 'FAIL: A widzi zgody B'; end if;
  raise notice 'OK T2 izolacja rodzin';

  -- A nie może modyfikować profilu B (RLS filtruje wiersz — 0 zmienionych)
  update public.profiles set profile_name = 'HACK' where id = '00000000-0000-0000-0000-0000000000bb';
  get diagnostics rows_updated = row_count;
  if rows_updated <> 0 then raise exception 'FAIL: A zmodyfikował profil B'; end if;
  raise notice 'OK T2b brak modyfikacji cudzego profilu';

  -- ============ TEST 3: A tworzy legalny enrollment (pending) ============
  eid := public.create_enrollment(json_build_object(
    'school_year','2026/2027','parent_first_name','Jan','parent_last_name','A',
    'parent_phone','500000001','parent_email','a@test.pl',
    'children',json_build_array(json_build_object(
      'child_id',(select id from public.children where profile_id='00000000-0000-0000-0000-0000000000aa' limit 1),
      'street','ul. Główna','house_number','1','city','Warszawa','postal_code','00-001','voivodeship','mazowieckie','school_class','Klasa 1'))
  )::jsonb);

  select status::text from public.enrollments where id = eid into s;
  if s <> 'pending' then raise exception 'FAIL: nowy enrollment nie jest pending: %', s; end if;
  raise notice 'OK T3 enrollment pending';

  -- zwykły użytkownik nie może zmienić statusu bezpośrednim UPDATE
  begin
    update public.enrollments set status = 'accepted' where id = eid;
    raise exception 'FAIL: A zmienił status bezpośrednim UPDATE';
  exception when insufficient_privilege then null; end;
  raise notice 'OK T3b brak bezpośredniej zmiany statusu';

  -- ============ TEST 4: A nie może wywołać RPC admina ============
  begin
    perform public.admin_set_role('00000000-0000-0000-0000-0000000000aa', true);
    raise exception 'FAIL: A nadał sobie rolę admina';
  exception when others then
    if sqlerrm not like '%ERR_FORBIDDEN%' then raise; end if;
  end;
  begin
    perform public.admin_set_enrollment_status(eid, 'accepted');
    raise exception 'FAIL: A zmienił status przez RPC';
  exception when others then
    if sqlerrm not like '%ERR_FORBIDDEN%' then raise; end if;
  end;
  raise notice 'OK T4 brak dostępu do RPC admina';

  -- ============ TEST 5: A nie może utworzyć enrollmentu na dziecko B ============
  begin
    perform public.create_enrollment(json_build_object(
      'school_year','2027/2028','parent_first_name','X','parent_last_name','X',
      'parent_phone','500000001','parent_email','x@test.pl',
      'children',json_build_array(json_build_object(
        'child_id',(select id from public.children where profile_id='00000000-0000-0000-0000-0000000000bb' limit 1),
        'street','x','house_number','1','city','x','postal_code','00-001','voivodeship','x','school_class','Klasa 1'))
    )::jsonb);
    raise exception 'FAIL: A utworzył enrollment na dziecko B';
  exception when others then
    if sqlerrm not like '%ERR_FOREIGN_CHILD%' then raise; end if;
  end;
  raise notice 'OK T5 brak enrollmentu na cudze dziecko';

  -- ============ TEST 6: admin zmienia status; decided_by = auth.uid() ============
  set role authenticated;
  perform set_config('request.jwt.claims',
    json_build_object('sub','00000000-0000-0000-0000-0000000000cc','role','authenticated','app_metadata',json_build_object('role','admin'))::text, true);
  perform public.admin_set_enrollment_status(eid, 'accepted');

  select count(*) into n from public.enrollments
   where id = eid and status = 'accepted'
     and decided_by = '00000000-0000-0000-0000-0000000000cc';
  if n <> 1 then raise exception 'FAIL: admin nie zaakceptował / zły decided_by'; end if;
  raise notice 'OK T6 admin akceptuje, decided_by = auth.uid()';

  -- admin widzi wszystkie profile
  select count(*) into n from public.profiles;
  if n < 3 then raise exception 'FAIL: admin nie widzi wszystkich profili'; end if;
  raise notice 'OK T6b admin widzi wszystkie dane';

  -- ============ TEST 7: mapa — anon widzi tylko opublikowane, bez PESEL ============
  -- Widok nie zawiera PESEL ani prywatnych danych enrollmentu
  select count(*) into n from information_schema.columns
   where table_schema = 'public' and table_name = 'family_map' and column_name in ('pesel','street','birth_date','birth_place');
  if n <> 0 then raise exception 'FAIL: family_map zawiera dane prywatne'; end if;
  raise notice 'OK T7a family_map bez PESEL i prywatnych kolumn';

  set role authenticated;
  perform set_config('request.jwt.claims',
    json_build_object('sub','00000000-0000-0000-0000-0000000000aa','role','authenticated','app_metadata','{}'::jsonb)::text, true);
  perform public.set_map_visibility(true);

  set role anon;
  select count(*) into n from public.family_map where profile_id = '00000000-0000-0000-0000-0000000000aa';
  if n <> 1 then raise exception 'FAIL: anon nie widzi opublikowanej rodziny A'; end if;
  select count(*) into n from public.family_map where profile_id = '00000000-0000-0000-0000-0000000000bb';
  if n <> 0 then raise exception 'FAIL: anon widzi nieopublikowaną rodzinę B'; end if;
  raise notice 'OK T7b mapa anon — tylko opublikowane rodziny';

  -- ============ TEST 7c: mapa — geo_status/koordynaty odzwierciedlają cache ============
  -- failed w cache => family_map.geo_status = 'failed', lat/lng NULL (join obejmuje failed).
  set role postgres;
  insert into public.map_locations (postal_code, city, voivodeship, geo_status, retry_after)
  values ('00-001', 'Warszawa', 'mazowieckie', 'failed', now() + interval '1 day');
  set role anon;
  select count(*) into n from public.family_map
   where profile_id = '00000000-0000-0000-0000-0000000000aa'
     and geo_status = 'failed' and latitude is null and longitude is null;
  if n <> 1 then raise exception 'FAIL: failed w cache nie przebił się do family_map'; end if;

  -- exact w cache => family_map.geo_status = 'exact' z koordynatami.
  set role postgres;
  update public.map_locations
     set geo_status = 'exact', latitude = 52.2297, longitude = 21.0122, retry_after = null
   where postal_code = '00-001' and city = 'Warszawa' and voivodeship = 'mazowieckie';
  set role anon;
  select count(*) into n from public.family_map
   where profile_id = '00000000-0000-0000-0000-0000000000aa'
     and geo_status = 'exact' and latitude = 52.2297 and longitude = 21.0122;
  if n <> 1 then raise exception 'FAIL: exact w cache nie przebił się do family_map'; end if;

  -- marker_seed deterministyczny i nieujemny.
  select count(*) into n from public.family_map
   where profile_id = '00000000-0000-0000-0000-0000000000aa' and marker_seed >= 0;
  if n <> 1 then raise exception 'FAIL: marker_seed niepoprawny'; end if;
  raise notice 'OK T7c geo_status/koordynaty/marker_seed z cache';

  -- ============ TEST 7d: map_locations niedostępny dla anon i authenticated ============
  set role anon;
  begin
    perform count(*) from public.map_locations;
    raise exception 'FAIL: anon czyta map_locations';
  exception when insufficient_privilege then null; end;
  set role authenticated;
  perform set_config('request.jwt.claims',
    json_build_object('sub','00000000-0000-0000-0000-0000000000aa','role','authenticated','app_metadata','{}'::jsonb)::text, true);
  begin
    perform count(*) from public.map_locations;
    raise exception 'FAIL: authenticated czyta map_locations';
  exception when insufficient_privilege then null; end;
  begin
    update public.map_locations set latitude = 0 where postal_code = '00-001';
    raise exception 'FAIL: authenticated zapisuje map_locations';
  exception when insufficient_privilege then null; end;
  raise notice 'OK T7d map_locations zamknięty dla klientów (tylko service_role)';

  -- ============ TEST 8: retencja odrzuconych po 30 dniach ============
  set role authenticated;
  perform set_config('request.jwt.claims',
    json_build_object('sub','00000000-0000-0000-0000-0000000000cc','role','authenticated','app_metadata',json_build_object('role','admin'))::text, true);
  perform public.admin_set_enrollment_status(eid, 'rejected');

  -- symulacja upływu 31 dni (update jako superuser, bo authenticated nie ma grantu UPDATE)
  reset role;
  update public.enrollments set decided_at = decided_at - interval '31 days' where id = eid;
  set role authenticated;

  if public.purge_rejected_enrollments() < 1 then raise exception 'FAIL: purge nie usunął odrzuconego'; end if;
  select count(*) into n from public.enrollments where id = eid;
  if n <> 0 then raise exception 'FAIL: odrzucony enrollment nie został usunięty'; end if;

  -- stabilny rekord dziecka pozostaje (współdzielony przez historyczne enrollmenty)
  select count(*) into n from public.children where profile_id = '00000000-0000-0000-0000-0000000000aa';
  if n < 2 then raise exception 'FAIL: children usunięte po purgu'; end if;
  raise notice 'OK T8 retencja 30 dni, children pozostają';

  -- ============ TEST 9: walidacja wejścia RPC ============
  perform set_config('request.jwt.claims',
    json_build_object('sub','00000000-0000-0000-0000-0000000000aa','role','authenticated','app_metadata','{}'::jsonb)::text, true);

  -- bez kontaktu
  begin
    perform public.complete_registration(json_build_object(
      'profile_name','X','num_children',1,'city','X','postal_code','00-000','voivodeship','X')::jsonb);
    raise exception 'FAIL: akceptacja bez kontaktu';
  exception when others then
    if sqlerrm not like '%ERR_CONTACT_MIN%' then raise; end if;
  end;

  -- zły PESEL
  begin
    perform public.complete_registration(json_build_object(
      'profile_name','X','num_children',1,'contact_phone','500000000','city','X',
      'postal_code','00-000','voivodeship','X',
      'children',json_build_array(json_build_object('first_name','Z','last_name','Z','birth_date','2020-01-01','birth_place','X','pesel','123')))::jsonb);
    raise exception 'FAIL: akceptacja złego PESEL';
  exception when others then
    if sqlerrm not like '%ERR_CHILD_FIELDS%' then raise; end if;
  end;

  -- zły rok szkolny
  begin
    perform public.create_enrollment(json_build_object(
      'school_year','2026','parent_first_name','X','parent_last_name','X',
      'parent_email','x@x.pl','parent_phone','500000000','children','[]'::jsonb)::jsonb);
    raise exception 'FAIL: akceptacja złego roku szkolnego';
  exception when others then
    if sqlerrm not like '%ERR_YEAR%' then raise; end if;
  end;
  raise notice 'OK T9 walidacja wejścia RPC';

  -- ============ TEST 10: add_child — izolacja, idempotencja po PESEL, walidacja ============
  -- A dodaje nowe dziecko (2 dziecko) przez RPC
  newchild := public.add_child(json_build_object(
    'first_name','Cezary','last_name','A','birth_date','2018-05-05','birth_place','Warszawa','pesel','44444444444')::jsonb);
  select count(*) into n from public.children
   where profile_id = '00000000-0000-0000-0000-0000000000aa' and pesel = '44444444444';
  if n <> 1 then raise exception 'FAIL: add_child nie dodał dziecka'; end if;

  -- idempotencja: ten sam PESEL drugi raz zwraca to samo id, bez duplikatu
  if public.add_child(json_build_object(
    'first_name','Cezary','last_name','A','birth_date','2018-05-05','birth_place','Warszawa','pesel','44444444444')::jsonb) <> newchild then
    raise exception 'FAIL: add_child nie jest idempotentny po PESEL';
  end if;
  select count(*) into n from public.children
   where profile_id = '00000000-0000-0000-0000-0000000000aa' and pesel = '44444444444';
  if n <> 1 then raise exception 'FAIL: add_child zduplikował dziecko'; end if;

  -- B nie widzi dziecka A (izolacja)
  perform set_config('request.jwt.claims',
    json_build_object('sub','00000000-0000-0000-0000-0000000000bb','role','authenticated','app_metadata','{}'::jsonb)::text, true);
  select count(*) into n from public.children where profile_id = '00000000-0000-0000-0000-0000000000aa';
  if n <> 0 then raise exception 'FAIL: B widzi dzieci A'; end if;

  -- zły PESEL — błąd ERR_CHILD_FIELDS
  perform set_config('request.jwt.claims',
    json_build_object('sub','00000000-0000-0000-0000-0000000000aa','role','authenticated','app_metadata','{}'::jsonb)::text, true);
  begin
    perform public.add_child(json_build_object(
      'first_name','Z','last_name','Z','birth_date','2020-01-01','birth_place','X','pesel','123')::jsonb);
    raise exception 'FAIL: add_child zaakceptował zły PESEL';
  exception when others then
    if sqlerrm not like '%ERR_CHILD_FIELDS%' then raise; end if;
  end;
  raise notice 'OK T10 add_child: izolacja + idempotencja + walidacja';
end $$;

-- ============ Sprzątanie (transakcja cofnięta — nic nie zostaje) ============

reset role;
reset request.jwt.claims;

rollback;

\echo 'OK — wszystkie testy RLS/API przeszły'