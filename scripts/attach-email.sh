#!/usr/bin/env bash
#
# Give an existing phone-only account an email, so it can sign in with an
# emailed code (or Google/Apple using that same address) and keep everything
# it has: games, roster, payouts, history.
#
#   ./scripts/attach-email.sh <phone> <email> [local|linked]
#
# Why this exists: phone sign-in is gone. Someone who signs in with a brand-new
# email gets a brand-new account, not their old one — unless the old account
# already carries that email. Run this once per account before switching the
# phone provider off.
#
# `linked` is the hosted project this checkout is linked to (prod unless you
# re-linked) and asks you to confirm.
set -euo pipefail

PHONE_RAW="${1:-}"
EMAIL_RAW="${2:-}"
TARGET="${3:-local}"

if [[ -z "$PHONE_RAW" || -z "$EMAIL_RAW" ]]; then
  echo "usage: $0 <phone> <email> [local|linked]" >&2
  exit 1
fi

PHONE="$(echo "$PHONE_RAW" | tr -cd '0-9')"
if [[ ${#PHONE} -eq 10 ]]; then PHONE="1$PHONE"; fi
if [[ ! "$PHONE" =~ ^[0-9]{11,15}$ ]]; then
  echo "that doesn't look like a phone number: $PHONE_RAW" >&2
  exit 1
fi

EMAIL="$(echo "$EMAIL_RAW" | tr 'A-Z' 'a-z' | tr -d ' ')"
if [[ ! "$EMAIL" =~ ^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$ ]]; then
  echo "that doesn't look like an email address: $EMAIL_RAW" >&2
  exit 1
fi

cd "$(dirname "$0")/.."

case "$TARGET" in
  local) FLAG="--local" ;;
  linked)
    REF="$(cat supabase/.temp/project-ref 2>/dev/null || echo unknown)"
    read -r -p "Attach $EMAIL to the account for +$PHONE on the HOSTED project ($REF)? [y/N] " OK
    [[ "$OK" == "y" || "$OK" == "Y" ]] || { echo "cancelled"; exit 1; }
    FLAG="--linked"
    ;;
  *) echo "target must be local or linked" >&2; exit 1 ;;
esac

SQL="with target as (select id from auth.users where phone = '$PHONE'),
taken as (select 1 from auth.users where lower(email) = '$EMAIL' and phone is distinct from '$PHONE'),
upd as (
  update auth.users u
     set email = '$EMAIL', email_confirmed_at = coalesce(u.email_confirmed_at, now())
   where u.phone = '$PHONE' and not exists (select 1 from taken)
  returning u.id
),
ident as (
  insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  select id::text, id,
         jsonb_build_object('sub', id::text, 'email', '$EMAIL', 'email_verified', true, 'phone_verified', true),
         'email', now(), now(), now()
    from upd
  on conflict (provider_id, provider) do nothing
  returning 1
)
select (select count(*) from target) as accounts_found,
       (select count(*) from taken)  as email_already_used_elsewhere,
       (select count(*) from upd)    as updated;"

npx supabase db query $FLAG "$SQL"

echo
echo "accounts_found 0  → no account has that phone number."
echo "email_already_used_elsewhere 1 → that email already belongs to a different account; pick another."
echo "updated 1 → done. Signing in with that email (code, Google or Apple) now opens this account."
