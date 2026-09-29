#!/usr/bin/env bash
#
# Make someone Refee staff (lets them open /admin).
#
#   ./scripts/make-admin.sh <phone> [local|linked] [note]
#
#   <phone>   the number they sign in with, digits only or with +/spaces/dashes
#             ("(555) 555-0100" and "+15555550100" both work)
#   local     the Supabase stack on this machine (default)
#   linked    whichever hosted project this checkout is linked to — prod unless
#             you've re-linked. Asks you to confirm first.
#
# They must have signed in at least once so an account exists. Nothing in the
# apps can grant staff on purpose (migration 0050); this runs with your own
# Supabase login, which is the point.
set -euo pipefail

PHONE_RAW="${1:-}"
TARGET="${2:-local}"
NOTE="${3:-granted with make-admin.sh}"

if [[ -z "$PHONE_RAW" ]]; then
  echo "usage: $0 <phone> [local|linked] [note]" >&2
  exit 1
fi

# Digits only, US numbers get the leading 1 auth.users stores.
PHONE="$(echo "$PHONE_RAW" | tr -cd '0-9')"
if [[ ${#PHONE} -eq 10 ]]; then PHONE="1$PHONE"; fi
if [[ ! "$PHONE" =~ ^[0-9]{11,15}$ ]]; then
  echo "that doesn't look like a phone number: $PHONE_RAW" >&2
  exit 1
fi

# The note goes into SQL; keep it to plain text.
NOTE="$(echo "$NOTE" | tr -cd 'A-Za-z0-9 ._@-' | cut -c1-80)"

cd "$(dirname "$0")/.."

case "$TARGET" in
  local) FLAG="--local" ;;
  linked)
    REF="$(cat supabase/.temp/project-ref 2>/dev/null || echo unknown)"
    read -r -p "Grant staff access on the HOSTED project ($REF) to +$PHONE? [y/N] " OK
    [[ "$OK" == "y" || "$OK" == "Y" ]] || { echo "cancelled"; exit 1; }
    FLAG="--linked"
    ;;
  *) echo "target must be local or linked" >&2; exit 1 ;;
esac

SQL="with target as (select id from auth.users where phone = '$PHONE'),
ins as (
  insert into public.admins (user_id, note)
  select id, '$NOTE' from target
  on conflict (user_id) do nothing
  returning user_id
)
select (select count(*) from target) as accounts_found,
       (select count(*) from ins)    as newly_granted;"

npx supabase db query $FLAG "$SQL"

echo
echo "If accounts_found is 0, that number hasn't signed in yet — sign in once, then rerun."
echo "Otherwise they can open /admin now."
