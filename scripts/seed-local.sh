#!/usr/bin/env bash
#
# Re-run the local seed against the Supabase stack on this machine.
#
#   npm run db:seed
#
# Moves every seeded game date forward from today and puts the seeded accounts
# back in their states, without wiping accounts you created yourself. Local
# only: it talks to the database container directly, never a hosted project.
# `supabase db reset` runs the same files on a fresh database.
set -euo pipefail

cd "$(dirname "$0")/.."
DB="supabase_db_$(sed -n 's/^project_id = "\(.*\)"/\1/p' supabase/config.toml)"

if ! docker ps --format '{{.Names}}' | grep -qx "$DB"; then
  echo "Local Supabase isn't running ($DB). Start it with: npm run db:start" >&2
  exit 1
fi

for f in supabase/seed.sql supabase/seeds/*.sql; do
  echo "Seeding $f"
  docker exec -i "$DB" psql -U postgres -q -v ON_ERROR_STOP=1 --single-transaction < "$f" >/dev/null
done
echo "Done. Accounts are listed at the top of supabase/seeds/dc.sql; codes arrive at http://127.0.0.1:54324"
