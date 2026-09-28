-- Postgres preserves varchar/char and bigint types in RETURN QUERY. Cast the
-- two report columns to the table signatures declared by the admin functions.

create or replace function public.admin_user_search(p_query text)
returns table (
  user_id uuid,
  display_name text,
  legal_name text,
  phone text,
  email text,
  primary_role text,
  city text,
  state text,
  identity_status text,
  suspended_at timestamptz,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_like text := '%' || trim(coalesce(p_query, '')) || '%';
  v_uuid uuid;
begin
  perform public.require_admin();

  begin
    v_uuid := trim(p_query)::uuid;
  exception when others then
    v_uuid := null;
  end;

  return query
    select p.id,
           pub.display_name,
           nullif(trim(coalesce(p.legal_first_name, '') || ' ' || coalesce(p.legal_last_name, '')), ''),
           coalesce(p.phone, u.phone),
           coalesce(p.email, u.email),
           pub.primary_role,
           pub.city,
           pub.state::text,
           p.identity_status,
           p.suspended_at,
           p.created_at
      from public.private_profiles p
      join public.public_profiles pub on pub.id = p.id
      join auth.users u on u.id = p.id
     where v_uuid is not null and p.id = v_uuid
        or (v_uuid is null and (
              pub.display_name ilike v_like
           or coalesce(p.legal_first_name, '') ilike v_like
           or coalesce(p.legal_last_name, '') ilike v_like
           or coalesce(p.phone, u.phone, '') ilike v_like
           or coalesce(p.email, u.email, '') ilike v_like
        ))
     order by p.created_at desc
     limit 50;
end;
$$;

create or replace function public.admin_payment_issues()
returns table (
  job_id uuid,
  title text,
  org_name text,
  starts_at timestamptz,
  job_status text,
  payment_status text,
  dispute_status text,
  refund_status text,
  requires_review boolean,
  review_reason text,
  crew_owed numeric,
  last_event_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.require_admin();
  return query
    select j.id,
           j.title,
           h.org_name,
           j.starts_at,
           j.status,
           j.payment_status,
           j.payment_dispute_status,
           j.payment_refund_status,
           j.payment_issue_requires_review,
           j.payment_review_reason,
           (select coalesce(sum(ja.amount_due), 0)::numeric
              from public.job_assignments ja
             where ja.job_id = j.id and ja.payout_status = 'pending'),
           j.last_payment_event_at
      from public.jobs j
      join public.hirers h on h.id = j.hirer_id
     where j.payment_issue_requires_review is true
        or j.payment_dispute_status is not null
        or j.payment_status = 'failed'
        or (j.status in ('completed', 'cancelled')
            and j.payment_status in ('unpaid', 'processing'))
     order by j.payment_issue_requires_review desc nulls last,
              coalesce(j.last_payment_event_at, j.starts_at) desc
     limit 200;
end;
$$;
