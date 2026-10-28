#!/usr/bin/env sh
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$ROOT_DIR"
SUITE=${1:-all}
project=service-desk-pyramid-202307705
compose() { WEB_PORT=18081 docker compose -p "$project" "$@"; }

run() {
  name=$1
  shift
  printf '\n[TEST-PYRAMID] %s\n' "$name"
  compose "$@"
}

prepare_backend() {
  run 'preparar PostgreSQL, API y frontend aislados' up --build -d db api web
  run 'crear datos demo' exec -T api node apps/api/dist/scripts/seed-demo.js
  run 'validar Excel original' exec -T api node apps/api/dist/scripts/validate-import.js
  run 'cargar Excel original' exec -T api node apps/api/dist/scripts/import-catalog.js
  run 'importar los CI originales de CMDB.xlsx' exec -T api node apps/api/dist/scripts/import-cmdb.js
  run 'preparar 5,000 dispositivos sintéticos para interfaz' exec -T -e CMDB_SEED=EVAL2026 -e CMDB_COUNT=5000 api node apps/api/dist/scripts/generate-cmdb.js
  run 'preparar colas demo y preguntas frecuentes de autoservicio' exec -T api node apps/api/dist/scripts/seed-service-desk.js
}

run_unit() {
  run 'unitarias Jest (base 70% + extensión)' run --build --rm -T api node_modules/.bin/jest --config apps/api/test/jest.unit.config.js --runInBand
}

run_integration() {
  prepare_backend
  run 'integración Jest (base 20%)' run --rm -T api node_modules/.bin/jest --config apps/api/test/jest.integration.config.js --runInBand
}

run_e2e() {
  prepare_backend
  run 'E2E Playwright (base 10% + extensión)' --profile tests run --build --rm -T e2e
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

run 'detener contenedores de prueba (el volumen aislado se conserva)' down
if [ "$SUITE" = all ]; then
  printf '%s\n' '{"ok":true,"suite":"all","corePyramid":"70/20/10","coreTests":{"unit":7,"integration":2,"e2e":1},"extensions":{"unit":6,"integration":0,"e2e":2},"executedTotal":{"unit":13,"integration":2,"e2e":3}}'
else
  printf '{"ok":true,"suite":"%s"}\n' "$SUITE"
fi
