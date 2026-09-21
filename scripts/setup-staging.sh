#!/usr/bin/env bash
#
# Bring a freshly created staging project up to match production's schema.
#
#   ./scripts/setup-staging.sh <staging-project-ref>
#
# Pushes every migration, seeds synthetic fixtures, and prints the keys to
# paste into eas.json and Vercel. Safe to re-run: migrations are tracked and
# the seed is written to be idempotent.
#
# It deliberately does NOT copy production data. Production holds legal names,
# dates of birth, phone numbers and home coordinates; staging is a less-watched
# environment and has no business holding any of it.
set -euo pipefail

REF="${1:-}"
PROD_REF="rwqodozmniqjvkyjtcaw"

if [[ -z "$REF" ]]; then
  echo "usage: $0 <staging-project-ref>" >&2
  exit 1
fi

if [[ "$REF" == "$PROD_REF" ]]; then
  echo "refusing: that is the production project." >&2
  exit 1
fi

cd "$(dirname "$0")/.."

echo "==> Linking to $REF"
npx supabase link --project-ref "$REF"

echo "==> Pushing migrations"
npx supabase db push --linked

echo "==> Seeding synthetic fixtures"
# The seed is the same one the local stack uses: no real people in it.
npx supabase db execute --linked --file supabase/seed.sql 2>/dev/null \
  || psql "$(npx supabase status -o json 2>/dev/null | python3 -c 'import json,sys;print(json.load(sys.stdin).get("DB_URL",""))')" \
       -f supabase/seed.sql 2>/dev/null \
  || echo "    (seed not applied automatically — run it from the SQL editor)"

echo "==> Deploying edge functions"
for fn in supabase/functions/*/; do
  name="$(basename "$fn")"
  [[ "$name" == "_shared" ]] && continue
  npx supabase functions deploy "$name" --project-ref "$REF" >/dev/null && echo "    $name"
done

echo
echo "==> Keys for eas.json (staging profile) and Vercel (Preview only)"
npx supabase projects api-keys --project-ref "$REF"

cat <<'NEXT'

Still to do by hand:
  1. Set staging edge-function secrets — all test/sandbox (see docs/STAGING.md)
  2. Point eas.json's staging profile at the staging URL and anon key
  3. Set NEXT_PUBLIC_SUPABASE_* on Vercel's Preview environment only
  4. Re-link to production when you're done:
       npx supabase link --project-ref rwqodozmniqjvkyjtcaw
NEXT
