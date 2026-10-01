#!/usr/bin/env sh
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$ROOT_DIR"
SUITE=${1:-all}

run() {
  name=$1
  shift
  printf '\n[TEST-PYRAMID] %s\n' "$name"
  "$@"
}

prepare_backend() {
  run 'preparar PostgreSQL, API y frontend' docker compose up --build -d db api web
  run 'crear datos demo' docker compose exec -T api node apps/api/dist/scripts/seed-demo.js
  run 'validar Excel original' docker compose exec -T api node apps/api/dist/scripts/validate-import.js
  run 'cargar Excel original' docker compose exec -T api node apps/api/dist/scripts/import-catalog.js
}

run_unit() {
  run 'unitarias Jest (7 pruebas, 70%)' docker compose run --build --rm -T api node_modules/.bin/jest --config apps/api/test/jest.unit.config.js --runInBand
}

run_integration() {
  prepare_backend
  run 'integración Jest (2 pruebas, 20%)' docker compose run --rm -T api node_modules/.bin/jest --config apps/api/test/jest.integration.config.js --runInBand
}

run_e2e() {
  prepare_backend
  run 'E2E Playwright (1 prueba, 10%)' docker compose --profile tests run --build --rm -T e2e
}

case "$SUITE" in
  unit) run_unit ;;
  integration) run_integration ;;
  e2e) run_e2e ;;
  all)
    run_unit
    run_integration
    run_e2e
    ;;
  *)
    printf '%s\n' 'Uso: sh scripts/test-pyramid.sh [unit|integration|e2e|all]' >&2
    exit 2
    ;;
esac

printf '{"ok":true,"suite":"%s","pyramid":"70/20/10"}\n' "$SUITE"
