# Fase 3: Harness Engineering

## Qué se entrega

El harness es el entorno repetible que permite levantar la aplicación, preparar fuentes y datos de evaluación, ejecutar controles y observar con claridad si cada etapa pasó. Docker es una pieza del harness; también incluye migraciones, importadores, generador con semilla, pruebas, controles de calidad, aislamiento, límites operativos y evidencia versionada.

## Componentes y responsabilidades

| Componente | Responsabilidad verificable |
|---|---|
| `compose.yaml` y Dockerfiles | PostgreSQL 16, API, web y contenedor Playwright; los Excel se montan de solo lectura. |
| `apps/api/dist/scripts/migrate.js` | Aplica las migraciones versionadas 001–006 al arrancar la API. |
| `seed-demo.js`, `seed-service-desk.js` | Preparan cuentas, organización, colas y datos demostrativos repetibles. |
| `validate-import.js`, `import-catalog.js`, `verify-import.js` | Validan el Excel de catálogo antes de importar; informan altas/cambios/omisiones y comprueban 12/46 e incidencias. |
| `import-cmdb.js` | Valida e importa los CI originales de `CMDB.xlsx`, conserva la procedencia y registra referencias no resueltas. |
| `generate-cmdb.js` | Crea o sincroniza dispositivos sintéticos identificados por `CMDB_SEED` y `CMDB_COUNT`; repetir semilla no duplica. |
| `scripts/service-desk-test.ps1/.sh` | Harness de aceptación P01–P18 en el proyecto Compose aislado `service-desk-suite-202307705`. |
| `scripts/test-pyramid.ps1/.sh` | Ejecuta las pruebas unitarias, de integración o navegador dentro de `service-desk-pyramid-202307705`. |
| Jest + ts-jest | Pruebas unitarias y de integración con la API; PostgreSQL se usa en integración. |
| Playwright | Recorridos reales de navegador en un contenedor dedicado. |
| `npm run lint`, `npm run typecheck`, `npm run audit:secrets` | Comprueban estilo/tipos y buscan secretos accidentales versionados. |
| `docs/PRUEBAS.md` | Conserva fechas, commit, comandos, conteos, fallos y resultados realmente observados. |

## Preparación de una evaluación Service Desk

Desde la raíz del clon, con Docker Compose v2 activo:

```powershell
# Windows PowerShell
Copy-Item .env.example .env
docker compose up --build -d
docker compose exec -T api node apps/api/dist/scripts/seed-demo.js
docker compose exec -T api node apps/api/dist/scripts/validate-import.js
docker compose exec -T api node apps/api/dist/scripts/import-catalog.js
docker compose exec -T api node apps/api/dist/scripts/import-cmdb.js
docker compose exec -T -e CMDB_SEED=EVAL2026 -e CMDB_COUNT=5000 api node apps/api/dist/scripts/generate-cmdb.js
docker compose exec -T api node apps/api/dist/scripts/seed-service-desk.js
```

En Linux/macOS, sustituir la copia inicial por `cp .env.example .env`; los comandos Docker restantes son iguales. La API aplica las migraciones automáticamente. No se necesita instalar Node.js ni PostgreSQL en el host.

La rutina completa de aceptación repite cargas y generación, ejecuta P01–P17, reinicia PostgreSQL y API sin borrar el volumen y comprueba P18:

```powershell
# Windows PowerShell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/service-desk-test.ps1
```

```sh
# Linux/macOS
sh scripts/service-desk-test.sh
```

El script devuelve código 0 y `ok: true` al terminar, y un código distinto de cero ante una etapa fallida. Es idempotente respecto a catálogo y datos CMDB de muestra. Usa el proyecto aislado `service-desk-suite-202307705`, no el volumen de la aplicación normal, y detiene la ejecución en caso de error. No borra el volumen de pruebas.

## Comandos por tipo de prueba

Los comandos aceptan `unit`, `integration`, `e2e` o `all`. `all` es la opción para la demostración integrada:

```powershell
# Windows PowerShell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/test-pyramid.ps1 unit
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/test-pyramid.ps1 integration
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/test-pyramid.ps1 e2e
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/test-pyramid.ps1 all
```

```sh
# Linux/macOS
sh scripts/test-pyramid.sh unit
sh scripts/test-pyramid.sh integration
sh scripts/test-pyramid.sh e2e
sh scripts/test-pyramid.sh all
```

La pirámide original del catálogo mantiene una base 70/20/10: siete unitarias (tres de autenticación y cuatro de servicios), dos integraciones de importación y una E2E del catálogo. La ampliación Service Desk añade siete unitarias de reglas y dos recorridos E2E; por ello la ejecución completa actual observa **14 unitarias, 2 integraciones y 3 E2E**. El reporte presenta por separado la base 70/20/10, las ampliaciones y el total, sin afirmar que el total ampliado conserve esos porcentajes. Cada ejecución de integración/E2E prepara su propio conjunto; Playwright usa el puerto aislado 18081. Al terminar se paran los contenedores, pero el volumen aislado se conserva.

Controles adicionales desde el host si Node.js está instalado:

```sh
npm run lint
npm run typecheck
npm run audit:secrets
git diff --check
```

Esos controles devuelven código cero al pasar; `audit:secrets` informa los archivos que escaneó. Para verificar configuración y estado de Docker: `docker compose config`, `docker compose ps` y `docker compose logs api`.

## Límites de operación

- Las pruebas Service Desk usan nombres de proyecto Compose distintos de la aplicación normal. No dirigirlas al volumen de evaluación.
- El arranque y las pruebas no ejecutan `down -v`; la comprobación P18 reinicia servicios conservando datos.
- No reemplazar ni editar `data/CatalogoServicios.xlsx` o `data/fuentes/CMDB.xlsx` como parte de una prueba. Los montajes de Compose son de solo lectura.
- No publicar `.env` ni contraseñas reales; `npm run audit:secrets` es un control antes del commit.
- No borrar manualmente registros que no pertenezcan al fixture de una prueba.
- El harness no usa modelos, suscripciones ni claves de proveedores de IA.

`harness-docker.ps1/.sh` es el control histórico del catálogo del parcial 2 y ejecuta su aceptación P01–P11 en el Compose predeterminado. Para la evaluación actual de Service Desk deben usarse los scripts aislados descritos arriba. La diferencia evita confundir una prueba histórica con la suite ampliada o ejecutarla por accidente contra la base normal.

## Criterio de cierre

Un cambio se acepta cuando el control afectado pasa, las pruebas de aceptación pertinentes conservan las reglas negativas, la salida tiene código 0, el resultado queda fechado y vinculado a un commit, y la documentación identifica los límites que no se probaron. La evidencia actual está en [PRUEBAS.md](../PRUEBAS.md) y los ciclos de corrección completos en [04-loop-engineering.md](04-loop-engineering.md).
