begin;

create extension if not exists pgtap with schema extensions;

select plan(7);

-- Legal name and date of birth are what the ID check is matched against
-- (0067). The person can fix them until the check is under way; after that
-- the app can't change them, so a verified badge can't be moved onto a
-- different name or birthday.
--
-- Seed: Alex 111…100 (approved), Sam 222…200.

update public.private_profiles
   set legal_first_name = 'Alex', legal_last_name = 'Rivera', date_of_birth = '1990-04-02'
 where id = '11111111-1111-4111-8111-111111111100';
update public.private_profiles
   set identity_status = 'unstarted', legal_first_name = 'Sma', legal_last_name = 'Okafor', date_of_birth = '1992-01-01'
 where id = '22222222-2222-4222-8222-222222222200';

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);

-- Not yet checked: free to fix a typo.
select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222200', true);
update public.private_profiles
   set legal_first_name = 'Sam', date_of_birth = '1992-01-02'
 where id = '22222222-2222-4222-8222-222222222200';
select is((select legal_first_name from public.private_profiles where id = '22222222-2222-4222-8222-222222222200'),
  'Sam', 'before the ID check, a referee can correct their legal first name');
select is((select date_of_birth from public.private_profiles where id = '22222222-2222-4222-8222-222222222200'),
  '1992-01-02'::date, 'and their date of birth');

-- Verified: the app can't move them.
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111100', true);
select throws_ok(
  $$update public.private_profiles set legal_last_name = 'Someone Else' where id = '11111111-1111-4111-8111-111111111100'$$,
  '42501', null, 'after the ID is approved, the legal name is locked');
select throws_ok(
  $$update public.private_profiles set date_of_birth = '1980-01-01' where id = '11111111-1111-4111-8111-111111111100'$$,
  '42501', null, 'and so is the date of birth');
select lives_ok(
  $$update public.private_profiles set legal_first_name = 'Alex', legal_last_name = 'Rivera', date_of_birth = '1990-04-02'
     where id = '11111111-1111-4111-8111-111111111100'$$,
  'writing back the same values (sign-up for a second role) is fine');

-- Under review counts too: Didit is checking against what is there now.
reset role;
update public.private_profiles set identity_status = 'in_review' where id = '22222222-2222-4222-8222-222222222200';
set local role authenticated;
select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222200', true);
select throws_ok(
  $$update public.private_profiles set legal_first_name = 'Samuel' where id = '22222222-2222-4222-8222-222222222200'$$,
  '42501', null, 'while the ID is in review, the legal name is locked');

-- Declined (for example, a name typo): open again so it can be fixed and retried.
reset role;
update public.private_profiles set identity_status = 'declined' where id = '22222222-2222-4222-8222-222222222200';
set local role authenticated;
select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222200', true);
update public.private_profiles set legal_first_name = 'Samuel' where id = '22222222-2222-4222-8222-222222222200';
select is((select legal_first_name from public.private_profiles where id = '22222222-2222-4222-8222-222222222200'),
  'Samuel', 'after a declined check, the name can be corrected before trying again');

select * from finish();
rollback;
