-- What Refee staff can actually do.
--
-- One function per job, each starting with require_admin(). Nothing here gives
-- blanket access: an admin sees exactly the columns these functions return,
-- and changes exactly what they change. Every write lands in admin_actions.
--
-- These return personal data (legal names, phone numbers, the reason a check
-- failed) because answering "why can't this person work?" is the whole point
-- of the tool. That is also why the door is a hand-granted row in a table no
-- client can write.

-- ── Trust & safety ──────────────────────────────────────────────────────────

-- Everyone whose verification needs a human: in review, declined, or approved
-- but flagged. Newest decision first.
create or replace function public.admin_identity_queue(p_status text default null)
returns table (
  user_id uuid,
  display_name text,
  legal_name text,
  primary_role text,
  identity_status text,
  identity_last_reason text,
  identity_decision_at timestamptz,
  date_of_birth date,
  suspended_at timestamptz,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.require_admin();
  return query
    select p.id,
           pub.display_name,
           nullif(trim(coalesce(p.legal_first_name, '') || ' ' || coalesce(p.legal_last_name, '')), ''),
           pub.primary_role,
           p.identity_status,
           p.identity_last_reason,
           p.identity_decision_at,
           p.date_of_birth,
           p.suspended_at,
           p.created_at
      from public.private_profiles p
      join public.public_profiles pub on pub.id = p.id
     where (p_status is null and p.identity_status in ('in_review', 'declined'))
        or (p_status is not null and p.identity_status = p_status)
     order by p.identity_decision_at desc nulls last, p.created_at desc
     limit 200;
end;
$$;

-- A human decision on someone's identity. Used when Didit sends a check to
-- review, or when someone shows up with a document the automated check could
-- not read. Mirrors exactly what the webhook does, so the badges stay true.
create or replace function public.admin_set_identity_status(
  p_user uuid,
  p_status text,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin uuid := (select auth.uid());
  v_dob date;
begin
  perform public.require_admin();

  if p_status not in ('unstarted', 'in_progress', 'in_review', 'approved', 'declined', 'expired', 'abandoned') then
    raise exception 'Unknown verification status: %', p_status using errcode = '22023';
  end if;

  -- Refee is 18+, and staff cannot override that: the date came off a
  -- government ID, and approving a minor is not a judgement call.
  select date_of_birth into v_dob from public.private_profiles where id = p_user;
  if p_status = 'approved' and v_dob is not null and not public.is_adult(v_dob) then
    raise exception 'This person is under 18 and cannot be approved.' using errcode = '23514';
  end if;

  update public.private_profiles
     set identity_status = p_status,
         identity_last_reason = p_reason,
         identity_decision_at = now(),
         identity_verified_at = case when p_status = 'approved' then now() else null end
   where id = p_user;

  update public.public_profiles
     set is_verified = (p_status = 'approved')
   where id = p_user;

  update public.hirers
     set is_verified = (p_status = 'approved')
   where user_id = p_user;

  insert into public.admin_actions (admin_id, action, subject_user_id, detail)
  values (v_admin, 'identity.' || p_status, p_user,
          jsonb_build_object('reason', p_reason));
end;
$$;

-- ── Accounts ────────────────────────────────────────────────────────────────

-- Find someone by name, phone, email or id. Staff answering "this person says
-- they can't accept games" start here.
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
           pub.state,
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

-- Everything about one account, for looking into a problem.
create or replace function public.admin_user_detail(p_user uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v jsonb;
begin
  perform public.require_admin();

  select jsonb_build_object(
    'user_id', p.id,
    'display_name', pub.display_name,
    'legal_name', nullif(trim(coalesce(p.legal_first_name, '') || ' ' || coalesce(p.legal_last_name, '')), ''),
    'phone', coalesce(p.phone, u.phone),
    'email', coalesce(p.email, u.email),
    'date_of_birth', p.date_of_birth,
    'primary_role', pub.primary_role,
    'city', pub.city,
    'state', pub.state,
    'created_at', p.created_at,
    'identity', jsonb_build_object(
      'status', p.identity_status,
      'reason', p.identity_last_reason,
      'decided_at', p.identity_decision_at,
      'verified_at', p.identity_verified_at,
      'session_id', p.identity_session_id
    ),
    'payout_account', jsonb_build_object(
      'status', p.stripe_account_status,
      'connected', p.stripe_account_id is not null
    ),
    'suspension', jsonb_build_object(
      'suspended_at', p.suspended_at,
      'reason', p.suspended_reason
    ),
    'badges', jsonb_build_object(
      'is_verified', pub.is_verified,
      'is_active', pub.is_active,
      'rating', pub.rating,
      'rating_count', pub.rating_count,
      'games_called_total', pub.games_called_total
    ),
    'work', jsonb_build_object(
      'assignments', (select count(*) from public.job_assignments ja where ja.ref_id = p.id),
      'accepted', (select count(*) from public.job_assignments ja
                    where ja.ref_id = p.id and ja.status = 'accepted'),
      'unpaid_owed', (select coalesce(sum(ja.amount_due), 0) from public.job_assignments ja
                       where ja.ref_id = p.id and ja.payout_status = 'pending'),
      'games_posted', (select count(*) from public.jobs j
                        join public.hirers h on h.id = j.hirer_id
                       where h.user_id = p.id)
    ),
    'recent_staff_actions', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'action', a.action, 'detail', a.detail, 'at', a.created_at
             ) order by a.created_at desc), '[]'::jsonb)
        from (select * from public.admin_actions
               where subject_user_id = p.id
               order by created_at desc limit 20) a
    )
  )
    into v
    from public.private_profiles p
    join public.public_profiles pub on pub.id = p.id
    join auth.users u on u.id = p.id
   where p.id = p_user;

  return v;
end;
$$;

-- Stop an account working, or let it work again. Never a delete: games,
-- payments and ratings all point at this person, and removing the row would
-- take other people's history with it.
create or replace function public.admin_set_suspended(
  p_user uuid,
  p_suspended boolean,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin uuid := (select auth.uid());
begin
  perform public.require_admin();

  if p_suspended and coalesce(trim(p_reason), '') = '' then
    raise exception 'A suspension needs a reason.' using errcode = '22023';
  end if;

  update public.private_profiles
     set suspended_at = case when p_suspended then now() else null end,
         suspended_reason = case when p_suspended then p_reason else null end,
         suspended_by = case when p_suspended then v_admin else null end
   where id = p_user;

  -- Take them out of the pool straight away; lifting a suspension does not
  -- silently put them back on duty.
  if p_suspended then
    update public.public_profiles set is_available = false, is_active = false where id = p_user;
  end if;

  insert into public.admin_actions (admin_id, action, subject_user_id, detail)
  values (v_admin,
          case when p_suspended then 'account.suspend' else 'account.reinstate' end,
          p_user,
          jsonb_build_object('reason', p_reason));
end;
$$;

-- ── Payments ────────────────────────────────────────────────────────────────

-- Games where the money needs a person: a failed charge, a dispute, or a
-- payout that never left.
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
           (select coalesce(sum(ja.amount_due), 0)
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

-- Marks a payment issue as dealt with. The money itself moves through Stripe
-- and the payout functions — this only clears the flag that put it on the
-- list, and records who decided it was settled.
create or replace function public.admin_clear_payment_review(p_job uuid, p_note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin uuid := (select auth.uid());
begin
  perform public.require_admin();

  update public.jobs
     set payment_issue_requires_review = false,
         payment_review_reason = p_note
   where id = p_job;

  insert into public.admin_actions (admin_id, action, subject_job_id, detail)
  values (v_admin, 'payment.review_cleared', p_job, jsonb_build_object('note', p_note));
end;
$$;

-- ── Metrics ─────────────────────────────────────────────────────────────────

create or replace function public.admin_metrics()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v jsonb;
begin
  perform public.require_admin();

  select jsonb_build_object(
    'users', jsonb_build_object(
      'total', (select count(*) from public.public_profiles),
      'referees', (select count(*) from public.public_profiles where primary_role = 'referee'),
      'directors', (select count(*) from public.public_profiles where primary_role = 'director'),
      'assignors', (select count(*) from public.public_profiles where primary_role = 'assignor'),
      'new_7d', (select count(*) from public.public_profiles where created_at > now() - interval '7 days')
    ),
    'verification', (
      select coalesce(jsonb_object_agg(identity_status, n), '{}'::jsonb)
        from (select identity_status, count(*) as n
                from public.private_profiles group by identity_status) s
    ),
    'suspended', (select count(*) from public.private_profiles where suspended_at is not null),
    'games', jsonb_build_object(
      'open', (select count(*) from public.jobs where status = 'open'),
      'upcoming', (select count(*) from public.jobs
                    where status not in ('completed', 'cancelled') and starts_at > now()),
      'completed_30d', (select count(*) from public.jobs
                         where status = 'completed' and starts_at > now() - interval '30 days'),
      'unfilled_next_7d', (
        select count(*) from public.jobs j
         where j.status = 'open' and j.starts_at between now() and now() + interval '7 days'
           and (select count(*) from public.job_assignments ja
                 where ja.job_id = j.id and ja.status = 'accepted') < coalesce(j.crew_size, 1)
      )
    ),
    'money', jsonb_build_object(
      'owed_to_crew', (select coalesce(sum(amount_due), 0) from public.job_assignments
                        where payout_status = 'pending'),
      'paid_30d', (select coalesce(sum(amount_due), 0) from public.job_assignments
                    where payout_status = 'paid' and paid_at > now() - interval '30 days'),
      'needs_review', (select count(*) from public.jobs where payment_issue_requires_review is true)
    )
  ) into v;

  return v;
end;
$$;

-- ── Access ──────────────────────────────────────────────────────────────────
-- Callable by any signed-in session; each one refuses non-staff itself. That
-- keeps the check in one place instead of spread across grants.
revoke all on function public.admin_identity_queue(text) from public, anon;
revoke all on function public.admin_set_identity_status(uuid, text, text) from public, anon;
revoke all on function public.admin_user_search(text) from public, anon;
revoke all on function public.admin_user_detail(uuid) from public, anon;
revoke all on function public.admin_set_suspended(uuid, boolean, text) from public, anon;
revoke all on function public.admin_payment_issues() from public, anon;
revoke all on function public.admin_clear_payment_review(uuid, text) from public, anon;
revoke all on function public.admin_metrics() from public, anon;

grant execute on function public.admin_identity_queue(text) to authenticated;
grant execute on function public.admin_set_identity_status(uuid, text, text) to authenticated;
grant execute on function public.admin_user_search(text) to authenticated;
grant execute on function public.admin_user_detail(uuid) to authenticated;
grant execute on function public.admin_set_suspended(uuid, boolean, text) to authenticated;
grant execute on function public.admin_payment_issues() to authenticated;
grant execute on function public.admin_clear_payment_review(uuid, text) to authenticated;
grant execute on function public.admin_metrics() to authenticated;
