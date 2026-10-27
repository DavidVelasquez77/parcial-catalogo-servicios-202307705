#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
project=service-desk-suite-202307705
compose() { docker compose -p "$project" "$@"; }
compose up --build -d db api
compose exec -T api node apps/api/dist/scripts/seed-demo.js
compose exec -T api node apps/api/dist/scripts/validate-import.js
compose exec -T api node apps/api/dist/scripts/import-catalog.js
compose exec -T api node apps/api/dist/scripts/import-catalog.js
compose exec -T api node apps/api/dist/scripts/verify-import.js
compose exec -T -e CMDB_SEED=EVAL2026 -e CMDB_COUNT=5000 api node apps/api/dist/scripts/generate-cmdb.js
compose exec -T -e CMDB_SEED=EVAL2026 -e CMDB_COUNT=5000 api node apps/api/dist/scripts/generate-cmdb.js
compose exec -T api node apps/api/dist/scripts/seed-service-desk.js
compose exec -T -e DESK_TEST_ISOLATED=1 api node apps/api/dist/scripts/desk-acceptance.js
before=$(compose exec -T api node apps/api/dist/scripts/desk-persistence.js)
compose restart db
compose up --wait -d db
compose restart api
after=
attempt=0
while [ "$attempt" -lt 15 ]; do
  if after=$(compose exec -T api node apps/api/dist/scripts/desk-persistence.js 2>/dev/null); then break; fi
  attempt=$((attempt + 1))
  sleep 1
done
[ "$before" = "$after" ] || { echo "P18 falló: antes=$before después=$after" >&2; exit 1; }
printf 'P18 PASS %s\n' "$after"
printf '%s\n' '{"ok":true,"suite":"Service Desk P01-P18","isolatedProject":"service-desk-suite-202307705"}'
