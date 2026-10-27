# Pruebas y evidencia reproducible

## Entorno, fecha y comandos

El 26 de octubre de 2026 (Guatemala; salida UTC del contenedor: 27 de octubre), sobre el contenido versionado en `146bbe4`, se ejecutó la suite en el proyecto Compose **aislado** `service-desk-suite-202307705`: PowerShell `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/service-desk-test.ps1`. La variante Linux/macOS es `sh scripts/service-desk-test.sh`. Usa PostgreSQL 16 Alpine, API Node 22 y los Excel originales montados de solo lectura. El proyecto de pruebas no comparte los volúmenes de la aplicación normal. La salida final fue `{"ok":true,"suite":"Service Desk P01-P18","isolatedProject":"service-desk-suite-202307705"}` y código 0. Una falla lanza error y termina distinto de 0.

La rutina ejecutó dos importaciones de catálogo (12/46 y 3 en revisión), dos importaciones de `CMDB.xlsx` (2 CI originales, 2 observaciones por ejecución, sin duplicados), dos generaciones de semilla `EVAL2026` (5,000 dispositivos; segunda ejecución `created=0, skipped=5000`), y preparó siete colas y 37 tickets de ejemplo. En esta repetición la fuente CMDB ya estaba cargada: ambas ejecuciones informaron `created=0, updated=0, skipped=2, observed=2`. El SHA-256 del Excel fue `d182796bb40b492be2cb87e2c5fe19a8f910f2e754183dc48b5e89bd360464dc`.

| ID | Entrada / resultado esperado | Resultado observado y punto de código |
|---|---|---|
| P01 | Sesión válida e inválida; sin sesión, consulta e inactivo rechazados | PASS; `auth`, `users`, `desk-acceptance.ts` |
| P02 | Reimportación del catálogo sin duplicar y 12/46 | PASS; 12, 46, 3 REVIEW, observaciones; `import-catalog.ts` |
| P03 | Generar 5,000 códigos únicos, repetir sin nuevos | PASS; `total=5000`, `unique_codes=5000`; `generate-cmdb.ts` |
| P04 | Raíces del Excel, dos CI originales, padre inválido y ciclo rechazados | PASS; `CmdbService`, `import-cmdb.ts` |
| P05 | Ticket con referencias válidas, rechazo de servicio inexistente y adjuntos con descarga autorizada | PASS; `DeskService.createTicket/uploadAttachment/attachment` |
| P06 | Cola por usuario y rol; acceso permitido/denegado | PASS; `queue_grants`, guardas de `DeskService` |
| P07 | Orden prioridad/antigüedad; reclamo concurrente único | PASS; respuestas `[409,201]`, `SELECT ... FOR UPDATE` |
| P08 | Transferencia con motivo/historial; otro proceso rechazado | PASS; `DeskService.transfer` |
| P09 | Ruta de los siete procesos y transición imposible | PASS; `process-rules.ts`, `DeskService.transition` |
| P10 | Cambio prematuro y autoaprobación de acceso rechazados | PASS; validaciones de transición |
| P11 | E0–E3; E2/E3 con un incidente y notificación | PASS; `ensureEventIncident` y `ticket_notifications` |
| P12 | I0–I6, regla del hueco temporal | PASS; `incident-rules.ts`, `PROJECT_GAP_RULE_7_TO_30_DAYS` |
| P13 | Incidente, problema y cambio relacionados | PASS; dos vínculos recuperados por API |
| P14 | CI, servicio e impacto; edición y clasificación completa; ciclo técnico rechazado | PASS; `CmdbService.item/updateItem/relation/impact` |
| P15 | Cierre inválido, reapertura y actor en bitácora | PASS; `reopen_count=1` y `ticket_history` |
| P16 | Dos páginas distintas de 25 sobre más de 5,000 CI | PASS; primera consulta 10.4 ms observados, API interna Docker/PG16; es una medición puntual, no una garantía de rendimiento |
| P17 | Primera atención, resolución con pausa, abierto sin promedio | PASS; 30 y 80 min; abierto `null` para promedio de resolución |
| P18 | Reiniciar DB y API conservando datos | PASS; 12 niveles 1, 46 nivel 2, 5,000 dispositivos, 2 CI fuente, 194 tickets, 657 eventos de historial, 17 colas en el proyecto de pruebas ya reutilizado |

El código de P01–P17 está en `apps/api/src/scripts/desk-acceptance.ts`; el de P18 en `scripts/service-desk-test.ps1`, `.sh` y `desk-persistence.ts`. Cada ejecución crea IDs con marca propia para evitar colisiones dentro de la base de pruebas. Se puede ejecutar otra vez: los resultados y totales dinámicos aumentan por las pruebas que crean tickets, no por duplicación de los 5,000 dispositivos ni de los dos Excel.

## Pruebas unitarias, integración y navegador

Desde la raíz, con **PowerShell**:

```powershell
.\scripts\test-pyramid.ps1 unit
.\scripts\test-pyramid.ps1 integration
.\scripts\test-pyramid.ps1 e2e
.\scripts\test-pyramid.ps1 all
```

Con **Linux/macOS**:

```sh
sh scripts/test-pyramid.sh unit
sh scripts/test-pyramid.sh integration
sh scripts/test-pyramid.sh e2e
sh scripts/test-pyramid.sh all
```

Estos comandos heredados del catálogo ejecutan Jest (unitarias e integración) y Playwright en contenedores. La proporción 70/20/10 describe su conjunto original de 7/2/1 escenarios; la ampliación añade 6 unitarias de reglas Service Desk y un segundo recorrido Playwright, así que la proporción aritmética del conjunto total cambia. No se presentan porcentajes artificiales para la ampliación. La suite P01–P18 es aceptación de API y persistencia separada.

Comprobaciones ejecutadas de la ampliación: `docker compose -p service-desk-suite-202307705 exec -T api node_modules/.bin/jest --config apps/api/test/jest.unit.config.js --runInBand`: **3 suites y 13 pruebas pasadas** (salida 27 de octubre UTC); `WEB_PORT=8081 docker compose -p service-desk-suite-202307705 --profile tests run --build --rm -T e2e`: **2 pruebas Playwright pasadas** (Playwright 1.64.1, imagen `v1.64.1-noble`), catálogo y portal Service Desk. En PowerShell, defina primero `$env:WEB_PORT='8081'` si ejecuta ese comando suelto y ya está ocupado el 8080. `npm run typecheck` pasó en API y web. Para auditar archivos versionados sin Node en el anfitrión: `docker run --rm --mount type=bind,source="${PWD}",target=/workspace,readonly --workdir /workspace node:22-alpine node scripts/audit-secrets.mjs` (en PowerShell, `${PWD}` se puede reemplazar por `$((Get-Location).Path)`).

## Criterio de salida y límites

El criterio de salida fue código 0 para cada rutina, P01–P18 PASS, 5,000 dispositivos únicos, 12/46 de catálogo, dos CI originales, dos pruebas Playwright y 13 Jest. `scripts/service-desk-test.*` nunca ejecuta `down -v`. Para reiniciar solo el conjunto desechable, use explícitamente `docker compose -p service-desk-suite-202307705 down -v`; esto **destruye datos de ese proyecto de pruebas**. Las pruebas de interfaz cubren recorrido principal; no afirman inspección visual manual exhaustiva ni una prueba de carga.

La matriz aquí vincula requisito → implementación → ejecución → salida verificable. Las decisiones y fórmulas están en [PROCESOS.md](PROCESOS.md), el modelo en [MODELO.md](MODELO.md), y los ciclos de corrección en [IA.md](IA.md).

Controles adicionales sobre `146bbe4`: `npm run lint`, `npm run typecheck`, `npm run audit:secrets` y `npm audit --audit-level=high` terminaron con código 0; la auditoría informó `found 0 vulnerabilities`.
