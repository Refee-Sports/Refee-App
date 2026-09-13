# Refee Web — production checklist

What stands between `main` and a working production site, in the order it
needs doing. Tick things off as they land.

## 1. Vercel — do now

- [ ] **Environment variables** (Project → Settings → Environment Variables → Production):
  - `NEXT_PUBLIC_SUPABASE_URL` = `https://rwqodozmniqjvkyjtcaw.supabase.co` (the hosted project the mobile app uses — same project means same accounts)
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = the mobile app's `EXPO_PUBLIC_SUPABASE_ANON_KEY` (starts `sb_publishable_`)
  - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` = the mobile app's `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY`
  - `NEXT_PUBLIC_APP_ENV` = `production`
  - `NEXT_PUBLIC_SITE_URL` = the production domain (only needed once Google/Apple sign-in is on)
- [ ] **Redeploy after setting them.** `NEXT_PUBLIC_*` values are compiled into the build; saving them does nothing until the next deploy.
- [ ] **Node 22+** (Settings → General → Node.js Version). `@supabase/*` 2.116 requires Node >= 22.

## 2. Supabase (hosted) — before launch

- [ ] **Auth → URL Configuration:** add the production domain to Site URL / Redirect URLs, plus `https://<domain>/auth/callback`.
- [ ] **Phone auth** is on with real Twilio — verified. Test numbers (555-555-01xx) are local only.
- [ ] **Google / Apple sign-in** are off. To turn on: create the OAuth credentials, enable the providers, add the callback URL above. The web buttons already hide/explain themselves while off.

## 3. Database migrations 0030–0032 — applied Sep 13, 2026

The mobile app hadn't been published, so no installed build depended on the
direct-write permissions 0030 removes, and all three went out together.

- [x] Mobile repo's pending work committed (branch `wip-sept-2026`).
- [x] Applied `0030_staffing_rbac`, `0031_schedule_import`, `0032_prepay_on_create` to hosted (`supabase db push`). Backup of the hosted schema and data taken first.
- [x] Removed the web's pre-0030 fallbacks (`lib/rpc-fallback.ts`, the `legacy*` helpers, the client-side staffing recompute). Staffing writes go through the RPCs only.
- [ ] Verify on production: a ref's accept becomes "pending" (organizer approval) unless the game auto-accepts; the director Approvals tab approves.

From here on: once the mobile app is in the stores, a migration that removes a
permission, column or function waits until no supported app version uses it
(add the new thing → switch both apps → remove the old thing).

## 4. Payments — charge at booking, pay out within 48h

Backend deployed to hosted in Stripe test mode. Details in the mobile repo:
`docs/PREPAY.md`.

- [x] Backend committed to the mobile repo (branch `wip-sept-2026`).
- [x] Applied migration `0032_prepay_on_create.sql`.
- [x] Deployed `prepay-game`, `run-payouts`, `stripe-webhook`, plus the updated `auto-pay`, `confirm-payout`, `connect-status`.
- [ ] Stripe dashboard (test mode) → Webhooks → endpoint `https://rwqodozmniqjvkyjtcaw.supabase.co/functions/v1/stripe-webhook`, events `payment_intent.succeeded`, `payment_intent.payment_failed`, `charge.refunded`, `charge.dispute.created`, `charge.dispute.closed`, `transfer.created`, `transfer.updated`, `transfer.reversed`. Put its signing secret in Supabase function secrets as `STRIPE_WEBHOOK_SECRET`.
- [ ] Create the two Vault secrets (`refee_functions_base_url`, `refee_service_role_key`) so the 15-minute payout job can run. Until both exist it does nothing.
- [ ] Restore the web side: `git stash list` → "prepay-web: charge at booking" → `git stash pop`, verify, commit.
- [ ] Swap to **live** Stripe keys (publishable in Vercel, secret in Supabase function secrets) and point the Stripe webhook at production.

## 5. Assignor role

- [x] Phase 1: assignor screens (tournaments, proposals, game staffing, roster). Live on production now that 0030/0031 are applied — the role shows on role-select.
- [ ] Phase 2: directors invite assignors and review proposals; refs see roster invites and assignment offers.

## 6. Housekeeping

- [ ] Remove `legacy-peer-deps=true` from `~/.npmrc` — it hid the Stripe version conflict that broke every Vercel build after the payments merge.
- [ ] Local only: delete the two `PREPAY … TEST` games from the local database.
