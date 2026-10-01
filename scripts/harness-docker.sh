#!/usr/bin/env sh
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$ROOT_DIR"

run() {
  name=$1
  shift
  printf '\n[HARNESS-DOCKER] %s\n' "$name"
  "$@"
}

retry() {
  name=$1
  shift
  attempt=1
  while [ "$attempt" -le 30 ]; do
    printf '\n[HARNESS-DOCKER] %s (intento %s/30)\n' "$name" "$attempt"
    if "$@"; then
      return 0
    fi
    attempt=$((attempt + 1))
    sleep 2
  done
  printf '%s\n' "No se completó: $name" >&2
  exit 1
}

run 'validar Compose' docker compose config
run 'construir y levantar contenedores' docker compose up --build -d
retry 'validar el Excel dentro de la API' docker compose exec -T api node apps/api/dist/scripts/validate-import.js
run 'crear cuentas y organización demo' docker compose exec -T api node apps/api/dist/scripts/seed-demo.js
run 'importar el Excel dentro de la API' docker compose exec -T api node apps/api/dist/scripts/import-catalog.js
run 'verificar conteos y duplicados' docker compose exec -T api node apps/api/dist/scripts/verify-import.js
run 'ejecutar aceptación P01-P11' docker compose exec -T api node apps/api/dist/scripts/acceptance.js
run 'ejecutar smoke tests' docker compose exec -T api node apps/api/dist/scripts/smoke.js
run 'auditar secretos dentro de un contenedor Node' docker run --rm --mount "type=bind,source=$ROOT_DIR,target=/workspace,readonly" --workdir /workspace node:22-alpine node scripts/audit-secrets.mjs
run 'reiniciar PostgreSQL' docker compose restart db
retry 'esperar PostgreSQL' docker compose exec -T db pg_isready -U catalogo -d catalogo
run 'reiniciar API' docker compose restart api
retry 'verificar persistencia después del reinicio' docker compose exec -T api node apps/api/dist/scripts/verify-import.js

printf '%s\n' '{"ok":true,"harness":"docker-only"}'
