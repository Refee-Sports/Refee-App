# Staging

## Why

One hosted Supabase project (`rwqodozmniqjvkyjtcaw`) is currently both dev and
prod, and all three EAS build profiles point at it — so a "staging" build talks
to the live database. There is nowhere to run a migration, a destructive test,
or a store build without touching real accounts and real money.

Staging is a second project that mirrors production's **schema and
configuration**, with its own keys.

## What staging does NOT get

Real user data. Production holds legal names, dates of birth, phone numbers and
geocoded home addresses — the exact things migrations 0047 and 0049 just
finished locking down. Copying that into a second, less-watched project would
undo the work. Staging is schema-identical and seeded with the same synthetic
fixtures the local stack uses.

Anything that moves money or touches a real person stays in test mode:

| | Production | Staging |
|---|---|---|
| Supabase project | `rwqodozmniqjvkyjtcaw` | new project |
| Stripe | live keys | test keys |
| Didit | live workflow | sandbox workflow (free, unmetered) |
| Data | real accounts | synthetic seed |
| Phone sign-in | real Twilio SMS | test OTP numbers |

## Creating it

One decision first: the org already has two projects (`Refee`, and a paused
`referee assist`). A third may require a paid plan — check
[the org's billing page](https://supabase.com/dashboard/org/_/billing) before
running this, or pause/delete `referee assist` if it is no longer needed.

```bash
npx supabase projects create refee-staging \
  --org-id wrvnvdujiomwvvwrgupy \
  --region us-west-2 \
  --size micro
```

It prompts for a database password. Generate one and put it straight in a
password manager — it is not recoverable and is not needed day to day.

Note the project ref it prints, then:

```bash
./scripts/setup-staging.sh <new-project-ref>
```

That script links to the new project, pushes every migration, seeds it, and
prints the keys to paste into `eas.json` and Vercel.

## Wiring the apps

**Mobile** — in `apps/mobile/eas.json`, the `staging` profile's
`EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` currently
duplicate production. Replace them with the staging values the script prints.
Leave `development` and `production` alone.

**Web** — in Vercel, set the staging values on the **Preview** environment
only, so preview deploys of a branch hit staging while production keeps the
live project:

```
NEXT_PUBLIC_SUPABASE_URL       = https://<staging-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY  = <staging anon key>
```

**Edge function secrets** — staging needs its own, all in test/sandbox mode:

```bash
npx supabase secrets set --project-ref <staging-ref> \
  STRIPE_SECRET_KEY=sk_test_... \
  STRIPE_WEBHOOK_SECRET=whsec_... \
  DIDIT_API_KEY=<sandbox key> \
  DIDIT_WORKFLOW_ID=<sandbox workflow> \
  DIDIT_WEBHOOK_SECRET=<sandbox shared key> \
  DIDIT_CALLBACK_URL=https://<preview-domain>/verify/done \
  ANTHROPIC_API_KEY=...
```

## Keeping it mirrored

Staging leads production, never trails it. The order for any schema change:

1. `npx supabase db push` against **staging**, confirm the apps still work
2. then the production run: backup → `--dry-run` → push

A migration that drops or moves a column gets a dry run against a **copy of
production data**, not just against staging's synthetic rows — 0047 passed
every local test and would still have destroyed two users' home coordinates,
because production had accounts with no `private_profiles` row and the local
seed had none like that. Restore a production dump into a scratch database and
run the migration there first:

```bash
npx supabase db dump --linked -f /tmp/prod-data.sql --data-only
npx supabase db dump --linked -f /tmp/prod-schema.sql
# load both into a scratch database, apply the migration, check the data
```

## Adding staff

Staff access is a hand-written row; nothing in either app can grant it
(migration 0050). On staging, so you can use `/admin` there:

```sql
insert into public.admins (user_id, note)
select id, 'staging' from auth.users where phone = '+1XXXXXXXXXX';
```
