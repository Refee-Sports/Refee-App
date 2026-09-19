begin;

create extension if not exists pgtap with schema extensions;

select plan(4);

-- Referee 222...202 claims a badge with no approved check behind it; referee
-- 111...100 has a real approval. Director 111...101 claims one on the org.
update public.private_profiles set identity_status = 'unstarted' where id = '22222222-2222-4222-8222-222222222202';
update public.public_profiles set is_verified = true where id = '22222222-2222-4222-8222-222222222202';
update public.private_profiles set identity_status = 'approved' where id = '11111111-1111-4111-8111-111111111100';
update public.public_profiles set is_verified = true where id = '11111111-1111-4111-8111-111111111100';
update public.private_profiles set identity_status = 'in_review' where id = '11111111-1111-4111-8111-111111111101';
update public.hirers set is_verified = true where user_id = '11111111-1111-4111-8111-111111111101';

-- The migration's two statements, exactly.
update public.public_profiles pp set is_verified = false
where pp.is_verified and not public.is_identity_verified(pp.id);
update public.hirers h set is_verified = false
where h.is_verified and h.user_id is not null and not public.is_identity_verified(h.user_id);

select ok(not (select is_verified from public.public_profiles where id = '22222222-2222-4222-8222-222222222202'),
  'a badge with no approved check behind it is cleared');
select ok((select is_verified from public.public_profiles where id = '11111111-1111-4111-8111-111111111100'),
  'a badge backed by an approval stays');
select ok(not (select is_verified from public.hirers where user_id = '11111111-1111-4111-8111-111111111101'),
  'an organization badge is cleared while its director is still in review');
select is(
  (select count(*)::int from public.public_profiles pp
   where pp.is_verified and not public.is_identity_verified(pp.id)),
  0, 'afterwards, no profile claims VERIFIED without an approved check');

select * from finish();
rollback;
