-- Staff account tools: every account in one list, edits on a person's behalf,
-- and the money behind one account.
--
-- Same rules as 0051: each function starts with require_admin(), returns only
-- what it names, and records every write in admin_actions. Deactivating an
-- account and "view as" need the auth admin API, so they live in the
-- admin-account edge function rather than here.

-- ── The list ────────────────────────────────────────────────────────────────

-- Every account, newest first, a page at a time. A blank search lists
-- everyone; a search matches name, phone, email or id the way
-- admin_user_search does. total_count is the size of the whole match, so the
-- page can say "showing 50 of 312".
create or replace function public.admin_list_accounts(
  p_query text default null,
  p_role text default null,
  p_limit int default 50,
  p_offset int default 0
)
returns table (
  user_id uuid,
  display_name text,
  legal_name text,
  phone text,
  email text,
  primary_role text,
  roles text[],
  city text,
  state text,
  identity_status text,
  suspended_at timestamptz,
  deactivated boolean,
  created_at timestamptz,
  total_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_q text := nullif(trim(coalesce(p_query, '')), '');
  v_like text := '%' || coalesce(v_q, '') || '%';
  v_uuid uuid;
begin
  perform public.require_admin();

  begin
    v_uuid := v_q::uuid;
  exception when others then
    v_uuid := null;
  end;

  return query
    with matched as (
      select p.id,
             pub.display_name,
             nullif(trim(coalesce(p.legal_first_name, '') || ' ' || coalesce(p.legal_last_name, '')), '') as legal_name,
             coalesce(p.phone, u.phone)::text as phone,
             coalesce(p.email, u.email)::text as email,
             pub.primary_role,
             coalesce((select array_agg(r.role order by r.role) from public.user_roles r where r.user_id = p.id),
                      array[]::text[]) as roles,
             pub.city,
             pub.state::text as state,
             p.identity_status,
             p.suspended_at,
             coalesce(u.banned_until > now(), false) as deactivated,
             p.created_at
        from public.private_profiles p
        join public.public_profiles pub on pub.id = p.id
        join auth.users u on u.id = p.id
       where (v_q is null
              or (v_uuid is not null and p.id = v_uuid)
              or (v_uuid is null and (
                    pub.display_name ilike v_like
                 or coalesce(p.legal_first_name, '') ilike v_like
                 or coalesce(p.legal_last_name, '') ilike v_like
                 or coalesce(p.phone, u.phone, '') ilike v_like
                 or coalesce(p.email, u.email, '') ilike v_like
                 or coalesce(pub.city, '') ilike v_like)))
         and (p_role is null
              or pub.primary_role = p_role
              or exists (select 1 from public.user_roles r where r.user_id = p.id and r.role = p_role))
    )
    select m.*, count(*) over ()
      from matched m
     order by m.created_at desc, m.id
     limit least(greatest(coalesce(p_limit, 50), 1), 200)
    offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

-- ── One account ─────────────────────────────────────────────────────────────

-- Replaces 0051's version: adds the fields the edit form starts from, every
-- role and organization, and whether sign-in is turned off.
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
    'first_name', pub.first_name,
    'legal_first_name', p.legal_first_name,
    'legal_last_name', p.legal_last_name,
    'legal_name', nullif(trim(coalesce(p.legal_first_name, '') || ' ' || coalesce(p.legal_last_name, '')), ''),
    'phone', coalesce(p.phone, u.phone),
    'email', coalesce(p.email, u.email),
    'date_of_birth', p.date_of_birth,
    'primary_role', pub.primary_role,
    'roles', coalesce((select jsonb_agg(r.role order by r.role) from public.user_roles r where r.user_id = p.id),
                      '[]'::jsonb),
    'city', pub.city,
    'state', pub.state,
    'home_zip', p.home_zip,
    'avatar_url', pub.avatar_url,
    'created_at', p.created_at,
    'last_sign_in_at', u.last_sign_in_at,
    'organizations', coalesce((
      select jsonb_agg(jsonb_build_object('id', h.id, 'org_name', h.org_name, 'org_type', h.org_type,
                                          'city', h.city, 'state', h.state) order by h.created_at)
        from public.hirers h where h.user_id = p.id), '[]'::jsonb),
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
    'deactivated', coalesce(u.banned_until > now(), false),
    'is_staff', public.is_admin(p.id),
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
               'action', a.action, 'detail', a.detail, 'at', a.created_at,
               'by', (select pp.display_name from public.public_profiles pp where pp.id = a.admin_id)
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

-- ── Edits ───────────────────────────────────────────────────────────────────

-- Changes someone's details for them: the "contact support to change it" path
-- for a legal name that scanned badly, a wrong birthday, a move. Only the
-- fields named here; anything else is refused rather than silently dropped.
-- Returns {field: {from, to}} for what actually changed, and records the same
-- in admin_actions. A name change also lands in name_changes like any other.
--
-- Runs as the owner, so the app-facing guards (0067/0068) don't apply — staff
-- are exactly who those guards send people to. The rules that aren't about who
-- is asking still hold: 18+, two-letter states, five-digit ZIPs.
create or replace function public.admin_update_profile(
  p_user uuid,
  p_changes jsonb,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin uuid := (select auth.uid());
  v_allowed text[] := array['first_name', 'legal_first_name', 'legal_last_name', 'date_of_birth',
                            'phone', 'city', 'state', 'home_zip', 'org_name'];
  v_key text;
  v_pub public.public_profiles;
  v_priv public.private_profiles;
  v_org text;
  v_new jsonb;
  v_old jsonb;
  v_diff jsonb := '{}'::jsonb;
  v_val text;
  v_dob date;
begin
  perform public.require_admin();

  if p_changes is null or jsonb_typeof(p_changes) <> 'object' then
    raise exception 'Nothing to change.' using errcode = '22023';
  end if;

  for v_key in select jsonb_object_keys(p_changes) loop
    if not v_key = any(v_allowed) then
      raise exception 'Staff can''t change % here.', v_key using errcode = '22023';
    end if;
  end loop;

  select * into v_pub from public.public_profiles where id = p_user;
  select * into v_priv from public.private_profiles where id = p_user;
  if v_pub.id is null or v_priv.id is null then
    raise exception 'No such account.' using errcode = 'P0002';
  end if;
  select h.org_name into v_org from public.hirers h where h.user_id = p_user order by h.created_at limit 1;

  -- Normalise what came in: trimmed, blanks as null, states upper-cased.
  select coalesce(jsonb_object_agg(k, case
           when jsonb_typeof(val) = 'null' then 'null'::jsonb
           when k = 'state' then to_jsonb(upper(nullif(trim(val #>> '{}'), '')))
           else to_jsonb(nullif(trim(val #>> '{}'), ''))
         end), '{}'::jsonb)
    into v_new
    from jsonb_each(p_changes) as e(k, val);

  v_old := jsonb_build_object(
    'first_name', v_pub.first_name,
    'legal_first_name', v_priv.legal_first_name,
    'legal_last_name', v_priv.legal_last_name,
    'date_of_birth', v_priv.date_of_birth,
    'phone', v_priv.phone,
    'city', v_pub.city,
    'state', trim(v_pub.state),
    'home_zip', v_priv.home_zip,
    'org_name', v_org
  );

  for v_key in select jsonb_object_keys(v_new) loop
    if (v_new ->> v_key) is distinct from (v_old ->> v_key) then
      v_diff := v_diff || jsonb_build_object(v_key, jsonb_build_object('from', v_old -> v_key, 'to', v_new -> v_key));
    end if;
  end loop;

  if v_diff = '{}'::jsonb then
    return v_diff;
  end if;

  -- Checks, on the values that are actually changing.
  if v_diff ? 'first_name' and (v_new ->> 'first_name' is null or length(v_new ->> 'first_name') > 50) then
    raise exception 'A first name is 1 to 50 characters.' using errcode = '22023';
  end if;
  if (v_diff ? 'legal_first_name' and v_new ->> 'legal_first_name' is null)
     or (v_diff ? 'legal_last_name' and v_new ->> 'legal_last_name' is null) then
    raise exception 'A legal name can''t be blank.' using errcode = '22023';
  end if;
  if v_diff ? 'phone' and v_new ->> 'phone' is null then
    raise exception 'A phone number can''t be blank.' using errcode = '22023';
  end if;
  if v_diff ? 'city' and v_new ->> 'city' is null then
    raise exception 'A city can''t be blank.' using errcode = '22023';
  end if;
  if v_diff ? 'state' and coalesce(v_new ->> 'state', '') !~ '^[A-Z]{2}$' then
    raise exception 'A state is two letters, like TX.' using errcode = '22023';
  end if;
  if v_diff ? 'home_zip' and v_new ->> 'home_zip' is not null and v_new ->> 'home_zip' !~ '^[0-9]{5}$' then
    raise exception 'A ZIP is five digits.' using errcode = '22023';
  end if;
  if v_diff ? 'org_name' then
    if v_org is null then
      raise exception 'This account has no organization.' using errcode = '22023';
    end if;
    if v_new ->> 'org_name' is null then
      raise exception 'An organization needs a name.' using errcode = '22023';
    end if;
  end if;
  if v_diff ? 'date_of_birth' then
    begin
      v_dob := (v_new ->> 'date_of_birth')::date;
    exception when others then
      raise exception 'A date of birth looks like 1990-07-27.' using errcode = '22023';
    end;
    if not public.is_adult(v_dob) then
      raise exception 'Refee is 18 and over; that date makes them under 18.' using errcode = '23514';
    end if;
  end if;

  update public.public_profiles
     set first_name = case when v_diff ? 'first_name' then v_new ->> 'first_name' else first_name end,
         city = case when v_diff ? 'city' then v_new ->> 'city' else city end,
         state = case when v_diff ? 'state' then v_new ->> 'state' else state end
   where id = p_user
     and (v_diff ? 'first_name' or v_diff ? 'city' or v_diff ? 'state');

  update public.private_profiles
     set legal_first_name = case when v_diff ? 'legal_first_name' then v_new ->> 'legal_first_name' else legal_first_name end,
         legal_last_name = case when v_diff ? 'legal_last_name' then v_new ->> 'legal_last_name' else legal_last_name end,
         date_of_birth = case when v_diff ? 'date_of_birth' then v_dob else date_of_birth end,
         phone = case when v_diff ? 'phone' then v_new ->> 'phone' else phone end,
         home_zip = case when v_diff ? 'home_zip' then v_new ->> 'home_zip' else home_zip end,
         -- A saved map point would keep placing them where they used to live.
         -- Without one, matching falls back to the ZIP/city until they next
         -- save their profile from the app.
         home_lat = case when v_diff ?| array['city', 'state', 'home_zip'] then null else home_lat end,
         home_lng = case when v_diff ?| array['city', 'state', 'home_zip'] then null else home_lng end
   where id = p_user
     and v_diff ?| array['legal_first_name', 'legal_last_name', 'date_of_birth', 'phone',
                         'home_zip', 'city', 'state'];

  if v_diff ? 'org_name' then
    update public.hirers set org_name = v_new ->> 'org_name' where user_id = p_user;
  end if;

  insert into public.name_changes (user_id, field, old_value, new_value)
  select p_user, f, v_diff -> f ->> 'from', v_diff -> f ->> 'to'
    from unnest(array['first_name', 'legal_first_name', 'legal_last_name']) f
   where v_diff ? f;

  insert into public.admin_actions (admin_id, action, subject_user_id, detail)
  values (v_admin, 'account.edit', p_user,
          jsonb_build_object('changes', v_diff, 'reason', nullif(trim(coalesce(p_reason, '')), '')));

  return v_diff;
end;
$$;

-- ── Money ───────────────────────────────────────────────────────────────────

-- Everything money-shaped about one account: what they've been paid and are
-- owed as a referee, and what they've been charged, refunded and disputed as
-- a director. Amounts on assignments are dollars; charges on games are cents,
-- as they are in the tables.
create or replace function public.admin_user_finances(p_user uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_referee jsonb;
  v_director jsonb;
  v_account jsonb;
begin
  perform public.require_admin();

  select jsonb_build_object(
           'status', p.stripe_account_status,
           'connected', p.stripe_account_id is not null,
           'stripe_account_id', p.stripe_account_id)
    into v_account
    from public.private_profiles p where p.id = p_user;

  select jsonb_build_object(
    'paid_total', coalesce(sum(ja.amount_due) filter (where ja.payout_status = 'paid'), 0),
    'pending_total', coalesce(sum(ja.amount_due) filter (where ja.payout_status = 'pending'), 0),
    'processing_total', coalesce(sum(ja.amount_due) filter (where ja.payout_status = 'processing'), 0),
    'failed_total', coalesce(sum(ja.amount_due) filter (where ja.payout_status = 'failed'), 0),
    'lines', coalesce(jsonb_agg(jsonb_build_object(
        'assignment_id', ja.id,
        'job_id', j.id,
        'title', j.title,
        'org_name', h.org_name,
        'starts_at', j.starts_at,
        'job_status', j.status,
        'role', ja.role,
        'status', ja.status,
        'amount_due', ja.amount_due,
        'payout_status', ja.payout_status,
        'paid_at', ja.paid_at,
        'stripe_transfer_id', ja.stripe_transfer_id
      ) order by j.starts_at desc) filter (where ja.id is not null), '[]'::jsonb)
  )
    into v_referee
    from public.job_assignments ja
    join public.jobs j on j.id = ja.job_id
    left join public.hirers h on h.id = j.hirer_id
   where ja.ref_id = p_user
     and (coalesce(ja.amount_due, 0) > 0 or ja.status = 'accepted');

  if exists (select 1 from public.hirers h where h.user_id = p_user) then
    select jsonb_build_object(
      'org_names', (select jsonb_agg(h.org_name order by h.created_at) from public.hirers h where h.user_id = p_user),
      'charged_cents', coalesce(sum(coalesce(j.prepaid_crew_cents, 0) + coalesce(j.prepaid_fee_cents, 0))
                                  filter (where j.prepaid_at is not null), 0),
      'fees_cents', coalesce(sum(coalesce(j.prepaid_fee_cents, 0)) filter (where j.prepaid_at is not null), 0),
      'refunded_cents', coalesce(sum(coalesce(j.refunded_amount_cents, 0)), 0),
      'disputes', count(*) filter (where j.payment_dispute_status <> 'none'),
      'needs_review', count(*) filter (where j.payment_issue_requires_review is true),
      'crew_owed', coalesce(sum((select coalesce(sum(ja.amount_due), 0) from public.job_assignments ja
                                  where ja.job_id = j.id and ja.payout_status = 'pending')), 0),
      'jobs', coalesce(jsonb_agg(jsonb_build_object(
          'job_id', j.id,
          'title', j.title,
          'starts_at', j.starts_at,
          'status', j.status,
          'pay_total', j.pay_total,
          'payment_status', j.payment_status,
          'prepaid_at', j.prepaid_at,
          'prepaid_crew_cents', j.prepaid_crew_cents,
          'prepaid_fee_cents', j.prepaid_fee_cents,
          'refunded_amount_cents', j.refunded_amount_cents,
          'dispute_status', nullif(j.payment_dispute_status, 'none'),
          'requires_review', j.payment_issue_requires_review,
          'review_reason', j.payment_review_reason,
          'payment_intent_id', j.payment_intent_id,
          'stripe_charge_id', j.stripe_charge_id,
          'crew_owed', (select coalesce(sum(ja.amount_due), 0) from public.job_assignments ja
                         where ja.job_id = j.id and ja.payout_status = 'pending')
        ) order by j.starts_at desc) filter (where j.id is not null), '[]'::jsonb)
    )
      into v_director
      from public.hirers h
      left join public.jobs j on j.hirer_id = h.id
     where h.user_id = p_user;
  end if;

  return jsonb_build_object('payout_account', v_account, 'referee', v_referee, 'director', v_director);
end;
$$;

-- ── Payment issues (fixes 0051/0053) ────────────────────────────────────────
-- payment_dispute_status is 'none' when there's no dispute (0026), never null,
-- so "is not null" listed every game as a payment issue. A dispute needs a
-- person while it's open; won and lost are settled. Same for the refund
-- status, which reads 'none' too.
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
           nullif(j.payment_dispute_status, 'none'),
           nullif(j.payment_refund_status, 'none'),
           j.payment_issue_requires_review,
           j.payment_review_reason,
           (select coalesce(sum(ja.amount_due), 0)::numeric
              from public.job_assignments ja
             where ja.job_id = j.id and ja.payout_status = 'pending'),
           j.last_payment_event_at
      from public.jobs j
      join public.hirers h on h.id = j.hirer_id
     where j.payment_issue_requires_review is true
        or j.payment_dispute_status = 'open'
        or j.payment_status = 'failed'
        or (j.status in ('completed', 'cancelled')
            and j.payment_status in ('unpaid', 'processing'))
     order by j.payment_issue_requires_review desc nulls last,
              coalesce(j.last_payment_event_at, j.starts_at) desc
     limit 200;
end;
$$;

-- ── Access ──────────────────────────────────────────────────────────────────
revoke all on function public.admin_list_accounts(text, text, int, int) from public, anon;
revoke all on function public.admin_update_profile(uuid, jsonb, text) from public, anon;
revoke all on function public.admin_user_finances(uuid) from public, anon;
grant execute on function public.admin_list_accounts(text, text, int, int) to authenticated;
grant execute on function public.admin_update_profile(uuid, jsonb, text) to authenticated;
grant execute on function public.admin_user_finances(uuid) to authenticated;
